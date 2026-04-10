import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DeviceEntity } from '../entities/device.entity';
import { MetricEntity } from '../entities/metric.entity';
import {
  DashboardTotalsDto,
  ListDevicesResponseDto,
} from '../dtos/list-devices.dto';
import { DeviceCardDto } from '../dtos/device-card.dto';
import { SparklineDto } from '../metrics/dtos/sparkline.dto';
import { DeviceSummaryDto } from '../dtos/device-summary.dto';
import { DockerContainerDto } from '../dtos/docker-container.dto';
import { CloudflareTunnelDto } from '../dtos/cloudflare-tunnel.dto';
import { MetricPointDto } from '../metrics/dtos/metric-point.dto';
import { DashboardRange } from '../dtos/dashboard-range-query.dto';

type LatestMetricRow = {
  deviceId: string;
  name: string;
  value: number;
  time: Date;
};

type SparklineRange = DashboardRange | '15m';

type SparklineStrategy = {
  since: Date | null;
  bucketMs: number;
};

type BucketedSparklineRow = {
  deviceId: string;
  tsUnixMs: string | number;
  value: string | number;
  firstTsUnixMs: string | number;
  lastTsUnixMs: string | number;
};

const DASHBOARD_METRICS = {
  cpuPct: { name: 'cpu.percent', unit: '%' },

  ramPct: { name: 'mem.percent', unit: '%' },
  ramUsed: { name: 'mem.used_bytes', unit: 'B' },
  ramTotal: { name: 'mem.total_bytes', unit: 'B' },

  diskUsed: { name: 'disk.used_bytes' },
  diskTotal: { name: 'disk.total_bytes' },
  diskPct: { name: 'disk.used_percent', unit: '%' },

  netIn: { name: 'net.rx_bytes_per_sec', unit: 'Bps' },
  netOut: { name: 'net.tx_bytes_per_sec', unit: 'Bps' },

  cpuTempC: { name: 'sensor.temperature_celsius', unit: 'C' },
  uptimeSec: { name: 'system.uptime_seconds', unit: 's' },
} as const;

const SPARKLINE_KEYS: Array<keyof typeof DASHBOARD_METRICS> = [
  'cpuPct',
  'ramPct',
  'diskPct',
  'netIn',
  'netOut',
  'cpuTempC',
];

const RANGE_MS: Record<Exclude<SparklineRange, 'all'>, number> = {
  '1m': 1 * 60 * 1000,
  '5m': 5 * 60 * 1000,
  '15m': 15 * 60 * 1000,
  '1h': 60 * 60 * 1000,
  '2h': 2 * 60 * 60 * 1000,
  '5h': 5 * 60 * 60 * 1000,
  '12h': 12 * 60 * 60 * 1000,
  '1d': 24 * 60 * 60 * 1000,
  '1w': 7 * 24 * 60 * 60 * 1000,
  '1mo': 30 * 24 * 60 * 60 * 1000,
  '1y': 365 * 24 * 60 * 60 * 1000,
};

const RANGE_TARGET_POINTS: Record<SparklineRange, number> = {
  '1m': 12,
  '5m': 20,
  '15m': 30,
  '1h': 60,
  '2h': 60,
  '5h': 60,
  '12h': 72,
  '1d': 96,
  '1w': 84,
  '1mo': 120,
  '1y': 120,
  all: 120,
};

const NICE_BUCKETS_MS = [
  5_000,
  10_000,
  15_000,
  30_000,
  60_000,
  2 * 60_000,
  5 * 60_000,
  10 * 60_000,
  15 * 60_000,
  30 * 60_000,
  60 * 60_000,
  2 * 60 * 60_000,
  3 * 60 * 60_000,
  6 * 60 * 60_000,
  12 * 60 * 60_000,
  24 * 60 * 60_000,
  2 * 24 * 60 * 60_000,
  3 * 24 * 60 * 60_000,
  4 * 24 * 60 * 60_000,
  7 * 24 * 60 * 60_000,
  14 * 24 * 60 * 60_000,
  30 * 24 * 60 * 60_000,
] as const;

@Injectable()
export class DashboardService {
  constructor(
    @InjectRepository(DeviceEntity)
    private readonly devicesRepo: Repository<DeviceEntity>,
    @InjectRepository(MetricEntity)
    private readonly metricsRepo: Repository<MetricEntity>,
    private readonly config: ConfigService,
  ) {}

  async getDashboardPayload(): Promise<ListDevicesResponseDto> {
    const devices = await this.devicesRepo.find({
      order: { externalId: 'ASC' },
      take: 200,
    });

    const deviceIds = devices.map((d) => d.externalId);
    const osDiskMounts = this.getOsDiskMounts(devices);
    const latestMap = await this.getLatestMetrics(deviceIds, [
      DASHBOARD_METRICS.cpuPct.name,
      DASHBOARD_METRICS.ramPct.name,
      DASHBOARD_METRICS.ramUsed.name,
      DASHBOARD_METRICS.ramTotal.name,
      DASHBOARD_METRICS.diskPct.name,
      DASHBOARD_METRICS.diskUsed.name,
      DASHBOARD_METRICS.diskTotal.name,
      DASHBOARD_METRICS.netIn.name,
      DASHBOARD_METRICS.netOut.name,
      DASHBOARD_METRICS.cpuTempC.name,
      DASHBOARD_METRICS.uptimeSec.name,
    ], osDiskMounts);
    const latestTemperatureMap = await this.getLatestTemperatureMap(deviceIds);
    const sparklineStrategy = await this.getSparklineStrategy(deviceIds, '15m');
    const sparklineData = await this.getSparklines(deviceIds, sparklineStrategy, osDiskMounts);

    const cards = this.buildCards(
      devices,
      latestMap,
      sparklineData,
      latestTemperatureMap,
    );

    return {
      totals: this.computeTotals(cards),
      devices: cards,
    };
  }

  async getDeviceDashboardPayload(
    externalId: string,
    range: SparklineRange = 'all',
  ): Promise<DeviceCardDto> {
    const device = await this.devicesRepo.findOne({ where: { externalId } });
    if (!device) {
      throw new NotFoundException(`Device ${externalId} not found`);
    }

    const metricNames = [
      DASHBOARD_METRICS.cpuPct.name,
      DASHBOARD_METRICS.ramPct.name,
      DASHBOARD_METRICS.ramUsed.name,
      DASHBOARD_METRICS.ramTotal.name,
      DASHBOARD_METRICS.diskPct.name,
      DASHBOARD_METRICS.diskUsed.name,
      DASHBOARD_METRICS.diskTotal.name,
      DASHBOARD_METRICS.netIn.name,
      DASHBOARD_METRICS.netOut.name,
      DASHBOARD_METRICS.cpuTempC.name,
      DASHBOARD_METRICS.uptimeSec.name,
    ];

    const deviceIds = [device.externalId];
    const osDiskMounts = this.getOsDiskMounts([device]);
    const latestMap = await this.getLatestMetrics(deviceIds, metricNames, osDiskMounts);
    const latestTemperatureMap = await this.getLatestTemperatureMap(deviceIds);
    const sparklineStrategy = await this.getSparklineStrategy(deviceIds, range);
    const sparklineData = await this.getSparklines(deviceIds, sparklineStrategy, osDiskMounts);
    const containers = await this.getDockerContainers(device.externalId);
    const tunnels = await this.getCloudflareTunnels(device.externalId);
    const cards = this.buildCards(
      [device],
      latestMap,
      sparklineData,
      latestTemperatureMap,
      new Map([[device.externalId, containers]]),
      new Map([[device.externalId, tunnels]]),
    );

    return cards[0];
  }

  private buildCards(
    devices: DeviceEntity[],
    latestMap: Map<string, Map<string, LatestMetricRow>>,
    sparklineData: Map<string, MetricPointDto[]>,
    latestTemperatureMap: Map<string, number>,
    containersMap?: Map<string, DockerContainerDto[]>,
    tunnelsMap?: Map<string, CloudflareTunnelDto[]>,
  ): DeviceCardDto[] {
    return devices.map((device) => {
      const latest = latestMap.get(device.externalId) ?? new Map();
      const summary = this.buildSummary(
        latest,
        latestTemperatureMap.get(device.externalId),
      );

      const sparklines = SPARKLINE_KEYS.map((key) => {
        const metricName = DASHBOARD_METRICS[key].name;
        const unit = (DASHBOARD_METRICS[key] as { unit?: string }).unit ?? '';
        const points = sparklineData.get(`${device.externalId}::${metricName}`) ?? [];

        return {
          name: key,
          unit,
          points,
        } satisfies SparklineDto;
      });

      return {
        externalId: device.externalId,
        hostname: device.hostname ?? undefined,
        status: device.status as DeviceCardDto['status'],
        lastSeenAt: device.lastSeenAt ? device.lastSeenAt.toISOString() : undefined,
        summary,
        sparklines,
        os: device.os ?? '',
        osName: device.osName ?? '',
        kernel: device.kernel ?? '',
        cpuName: device.cpuName ?? '',
        memoryCapacity: device.memoryCapacity ?? 0,
        diskCapacity: device.diskCapacity ?? 0,
        containers: containersMap?.get(device.externalId),
        tunnels: tunnelsMap?.get(device.externalId),
      } satisfies DeviceCardDto;
    });
  }

  private computeTotals(cards: DeviceCardDto[]): DashboardTotalsDto {
    const total = cards.length;
    const online = cards.filter((c) => c.status === 'online').length;
    const offline = cards.filter((c) => c.status === 'offline').length;
    const warning = cards.filter((c) => this.isWarning(c.summary)).length;

    return { total, online, offline, warning };
  }

  private isWarning(summary: DeviceSummaryDto): boolean {
    if (!summary) return false;
    if (summary.cpuPct >= 85) return true;
    if (summary.ramPct >= 85) return true;
    if (summary.disk?.usedPct >= 90) return true;
    if ((summary.cpuTempC ?? 0) >= 80) return true;
    return false;
  }

  private buildSummary(
    latest: Map<string, LatestMetricRow>,
    latestTemperatureC?: number,
  ): DeviceSummaryDto {
    const num = (name: string) => latest.get(name)?.value ?? 0;
    const diskUsed = num(DASHBOARD_METRICS.diskUsed.name);
    const diskTotal = num(DASHBOARD_METRICS.diskTotal.name);
    const diskPct = num(DASHBOARD_METRICS.diskPct.name);
    const cpuTempC = latestTemperatureC ?? num(DASHBOARD_METRICS.cpuTempC.name);

    return {
      cpuPct: num(DASHBOARD_METRICS.cpuPct.name),
      ramPct: num(DASHBOARD_METRICS.ramPct.name),
      ramUsedBytes: num(DASHBOARD_METRICS.ramUsed.name),
      ramTotalBytes: num(DASHBOARD_METRICS.ramTotal.name),
      disk: {
        usedBytes: diskUsed,
        totalBytes: diskTotal,
        usedPct: diskPct,
      },
      network: {
        inBps: num(DASHBOARD_METRICS.netIn.name),
        outBps: num(DASHBOARD_METRICS.netOut.name),
      },
      cpuTempC: cpuTempC || undefined,
      uptimeSec: num(DASHBOARD_METRICS.uptimeSec.name) || undefined,
    };
  }

  private async getSparklineStrategy(
    deviceIds: string[],
    range: SparklineRange,
  ): Promise<SparklineStrategy> {
    if (range !== 'all') {
      const windowMs = RANGE_MS[range];
      return {
        since: new Date(Date.now() - windowMs),
        bucketMs: this.pickBucketMs(windowMs, RANGE_TARGET_POINTS[range]),
      };
    }

    const windowMs = await this.getMetricsSpanMs(deviceIds);
    return {
      since: null,
      bucketMs: this.pickBucketMs(
        windowMs ?? RANGE_MS['1d'],
        RANGE_TARGET_POINTS.all,
      ),
    };
  }

  private pickBucketMs(windowMs: number, targetPoints: number): number {
    const rawBucketMs = Math.max(1, Math.ceil(windowMs / Math.max(targetPoints, 1)));

    for (const candidate of NICE_BUCKETS_MS) {
      if (candidate >= rawBucketMs) {
        return candidate;
      }
    }

    return NICE_BUCKETS_MS[NICE_BUCKETS_MS.length - 1];
  }

  private async getMetricsSpanMs(deviceIds: string[]): Promise<number | null> {
    if (deviceIds.length === 0) return null;

    const row = await this.metricsRepo
      .createQueryBuilder('m')
      .select('MIN(m.time)', 'minTime')
      .addSelect('MAX(m.time)', 'maxTime')
      .where('m.deviceId IN (:...deviceIds)', { deviceIds })
      .getRawOne<{
        minTime?: Date | string | null;
        maxTime?: Date | string | null;
      }>();

    if (!row?.minTime || !row?.maxTime) return null;

    return new Date(row.maxTime).getTime() - new Date(row.minTime).getTime();
  }

  /**
   * Returns the OS root mount point for each device.
   * Linux/macOS → "/", Windows → "C:\".
   */
  private getOsDiskMounts(
    devices: DeviceEntity[],
  ): Map<string, string> {
    const result = new Map<string, string>();
    for (const device of devices) {
      const os = (device.os ?? '').toLowerCase();
      const mount = os === 'windows' ? 'C:\\' : '/';
      result.set(device.externalId, mount);
    }
    return result;
  }

  private async getLatestMetrics(
    deviceIds: string[],
    names: string[],
    osDiskMounts?: Map<string, string>,
  ) {
    const map = new Map<string, Map<string, LatestMetricRow>>();
    if (deviceIds.length === 0) return map;

    const diskMetricNames: Set<string> = new Set([
      DASHBOARD_METRICS.diskPct.name,
      DASHBOARD_METRICS.diskUsed.name,
      DASHBOARD_METRICS.diskTotal.name,
    ]);

    // Split into disk vs non-disk metrics
    const nonDiskNames = names.filter((n) => !diskMetricNames.has(n));
    const diskNames = names.filter((n) => diskMetricNames.has(n));

    // Query non-disk metrics (no label filtering needed)
    if (nonDiskNames.length > 0) {
      const rows = await this.metricsRepo
        .createQueryBuilder('m')
        .select([
          'm.deviceId AS "deviceId"',
          'm.name AS "name"',
          'm.value AS "value"',
          'm.time AS "time"',
        ])
        .where('m.deviceId IN (:...deviceIds)', { deviceIds })
        .andWhere('m.name IN (:...names)', { names: nonDiskNames })
        .distinctOn(['m.deviceId', 'm.name'])
        .orderBy('m.deviceId', 'ASC')
        .addOrderBy('m.name', 'ASC')
        .addOrderBy('m.time', 'DESC')
        .getRawMany<LatestMetricRow>();

      for (const row of rows) {
        if (!map.has(row.deviceId)) map.set(row.deviceId, new Map());
        map.get(row.deviceId)!.set(row.name, row);
      }
    }

    // Query disk metrics filtered by primary mount
    if (diskNames.length > 0 && osDiskMounts && osDiskMounts.size > 0) {
      for (const [deviceId, mount] of osDiskMounts) {
        const rows = await this.metricsRepo
          .createQueryBuilder('m')
          .select([
            'm.deviceId AS "deviceId"',
            'm.name AS "name"',
            'm.value AS "value"',
            'm.time AS "time"',
          ])
          .where('m.deviceId = :deviceId', { deviceId })
          .andWhere('m.name IN (:...names)', { names: diskNames })
          .andWhere("m.labels->>'mount' = :mount", { mount })
          .distinctOn(['m.name'])
          .orderBy('m.name', 'ASC')
          .addOrderBy('m.time', 'DESC')
          .getRawMany<LatestMetricRow>();

        if (!map.has(deviceId)) map.set(deviceId, new Map());
        for (const row of rows) {
          map.get(deviceId)!.set(row.name, { ...row, deviceId });
        }
      }
    }

    return map;
  }

  private async getLatestTemperatureMap(
    deviceIds: string[],
  ): Promise<Map<string, number>> {
    const result = new Map<string, number>();
    if (deviceIds.length === 0) return result;

    const latestTimesQb = this.metricsRepo
      .createQueryBuilder('latest')
      .select('latest.deviceId', 'deviceId')
      .addSelect('MAX(latest.time)', 'latestTime')
      .where('latest.deviceId IN (:...deviceIds)', { deviceIds })
      .andWhere('latest.name = :tempMetricName', {
        tempMetricName: DASHBOARD_METRICS.cpuTempC.name,
      })
      .groupBy('latest.deviceId');

    const rows = await this.metricsRepo
      .createQueryBuilder('m')
      .select('m.deviceId', 'deviceId')
      .addSelect('MAX(m.value)', 'value')
      .innerJoin(
        `(${latestTimesQb.getQuery()})`,
        'latest',
        '"latest"."deviceId" = m."deviceId" AND "latest"."latestTime" = m."time"',
      )
      .where('m.name = :tempMetricName', {
        tempMetricName: DASHBOARD_METRICS.cpuTempC.name,
      })
      .setParameters(latestTimesQb.getParameters())
      .groupBy('m.deviceId')
      .getRawMany<{ deviceId: string; value: string | number }>();

    for (const row of rows) {
      result.set(row.deviceId, Number(row.value));
    }

    return result;
  }

  private async getSparklines(
    deviceIds: string[],
    strategy: SparklineStrategy,
    osDiskMounts?: Map<string, string>,
  ): Promise<Map<string, MetricPointDto[]>> {
    const result = new Map<string, MetricPointDto[]>();
    if (deviceIds.length === 0) return result;
    const offlineGapThresholdMs =
      Number(this.config.get('OFFLINE_AFTER_SEC', 20)) * 1000;

    for (const key of SPARKLINE_KEYS) {
      const metricName = DASHBOARD_METRICS[key].name;
      const aggregateExpr =
        metricName === DASHBOARD_METRICS.cpuTempC.name
          ? 'MAX(m.value)'
          : 'AVG(m.value)';
      const bucketExpr =
        'floor(extract(epoch from m.time) * 1000 / :bucketMs) * :bucketMs';

      const isDiskMetric = metricName === DASHBOARD_METRICS.diskPct.name;

      const query = this.metricsRepo
        .createQueryBuilder('m')
        .select([
          'm.deviceId AS "deviceId"',
          `${bucketExpr} AS "tsUnixMs"`,
          `${aggregateExpr} AS "value"`,
          'MIN(extract(epoch from m.time) * 1000) AS "firstTsUnixMs"',
          'MAX(extract(epoch from m.time) * 1000) AS "lastTsUnixMs"',
        ])
        .where('m.deviceId IN (:...deviceIds)', { deviceIds })
        .andWhere('m.name = :name', { name: metricName })
        .setParameter('bucketMs', strategy.bucketMs)
        .groupBy('m.deviceId')
        .addGroupBy(bucketExpr)
        .orderBy('m.deviceId', 'ASC')
        .addOrderBy('"tsUnixMs"', 'DESC');

      if (strategy.since) {
        query.andWhere('m.time >= :since', { since: strategy.since });
      }

      // Filter disk sparklines to primary mount only
      if (isDiskMetric && osDiskMounts && osDiskMounts.size > 0) {
        const mounts = [...osDiskMounts.values()];
        query.andWhere("m.labels->>'mount' IN (:...mounts)", { mounts });
      }

      const rows = await query.getRawMany<BucketedSparklineRow>();

      const perDevice = new Map<string, BucketedSparklineRow[]>();
      for (const row of rows) {
        const points = perDevice.get(row.deviceId) ?? [];
        points.push(row);
        perDevice.set(row.deviceId, points);
      }

      for (const [deviceId, pointsDesc] of perDevice.entries()) {
        const bucketRows = pointsDesc.reverse();
        const points: MetricPointDto[] = [];
        let previousRow: BucketedSparklineRow | null = null;

        for (const row of bucketRows) {
          const currentFirstTsUnixMs = Number(row.firstTsUnixMs);

          if (previousRow) {
            const previousLastTsUnixMs = Number(previousRow.lastTsUnixMs);
            const rawGapMs = currentFirstTsUnixMs - previousLastTsUnixMs;

            if (rawGapMs > offlineGapThresholdMs) {
              points.push({
                tsUnixMs: Math.floor(
                  previousLastTsUnixMs + rawGapMs / 2,
                ),
                value: null,
              });
            }
          }

          points.push({
            tsUnixMs: Number(row.tsUnixMs),
            value: Number(row.value),
          });
          previousRow = row;
        }

        result.set(`${deviceId}::${metricName}`, points);
      }
    }

    return result;
  }

  /**
   * Queries the latest docker container metrics for a device.
   * The agent sends metrics like docker.container.cpu_percent with labels
   * {container, image, health}. We pivot the latest values per container.
   */
  async getDockerContainers(
    deviceId: string,
  ): Promise<DockerContainerDto[]> {
    const dockerMetricNames = [
      'docker.container.cpu_percent',
      'docker.container.ram_usage_bytes',
      'docker.container.ram_limit_bytes',
      'docker.container.net_rx_bytes',
      'docker.container.net_tx_bytes',
    ];

    // Get the latest value per (metric name, container name)
    // Only consider metrics from the last 60 seconds so stale containers
    // (e.g. Docker stopped) are excluded automatically.
    const cutoff = new Date(Date.now() - 15_000);
    const rows = await this.metricsRepo
      .createQueryBuilder('m')
      .select([
        'm.name AS "name"',
        'm.value AS "value"',
        'm.labels AS "labels"',
        'm.time AS "time"',
      ])
      .where('m.deviceId = :deviceId', { deviceId })
      .andWhere('m.name IN (:...names)', { names: dockerMetricNames })
      .andWhere("m.labels->>'container' IS NOT NULL")
      .andWhere('m.time >= :cutoff', { cutoff })
      .distinctOn(["m.labels->>'container'", 'm.name'])
      .orderBy("m.labels->>'container'", 'ASC')
      .addOrderBy('m.name', 'ASC')
      .addOrderBy('m.time', 'DESC')
      .getRawMany<{
        name: string;
        value: number;
        labels: Record<string, string>;
        time: Date;
      }>();

    // Pivot: group by container name
    const containerMap = new Map<
      string,
      { image: string; health: string; metrics: Map<string, number> }
    >();

    for (const row of rows) {
      const containerName = row.labels?.container;
      if (!containerName) continue;

      if (!containerMap.has(containerName)) {
        containerMap.set(containerName, {
          image: row.labels?.image ?? '',
          health: row.labels?.health ?? 'unknown',
          metrics: new Map(),
        });
      }

      const entry = containerMap.get(containerName)!;
      entry.metrics.set(row.name, Number(row.value));
      // Update health/image from the freshest row
      if (row.labels?.health) entry.health = row.labels.health;
      if (row.labels?.image) entry.image = row.labels.image;
    }

    const containers: DockerContainerDto[] = [];
    for (const [name, data] of containerMap) {
      const m = (n: string) => data.metrics.get(n) ?? 0;
      containers.push({
        name,
        image: data.image,
        health: data.health,
        cpuPercent: m('docker.container.cpu_percent'),
        ramUsageBytes: m('docker.container.ram_usage_bytes'),
        ramLimitBytes: m('docker.container.ram_limit_bytes'),
        netRxBytes: m('docker.container.net_rx_bytes'),
        netTxBytes: m('docker.container.net_tx_bytes'),
      });
    }

    return containers;
  }

  /**
   * Queries the latest Cloudflare tunnel metrics for a device.
   * The agent sends metrics like cloudflare.tunnel.ha_connections with labels
   * {tunnel_id, tunnel_name, status}. We pivot the latest values per tunnel.
   */
  async getCloudflareTunnels(
    deviceId: string,
  ): Promise<CloudflareTunnelDto[]> {
    const tunnelMetricNames = [
      'cloudflare.tunnel.ha_connections',
      'cloudflare.tunnel.total_requests',
      'cloudflare.tunnel.request_errors',
    ];

    const cutoff = new Date(Date.now() - 15_000);
    const rows = await this.metricsRepo
      .createQueryBuilder('m')
      .select([
        'm.name AS "name"',
        'm.value AS "value"',
        'm.labels AS "labels"',
        'm.time AS "time"',
      ])
      .where('m.deviceId = :deviceId', { deviceId })
      .andWhere('m.name IN (:...names)', { names: tunnelMetricNames })
      .andWhere("m.labels->>'tunnel_id' IS NOT NULL")
      .andWhere('m.time >= :cutoff', { cutoff })
      .distinctOn(["m.labels->>'tunnel_id'", 'm.name'])
      .orderBy("m.labels->>'tunnel_id'", 'ASC')
      .addOrderBy('m.name', 'ASC')
      .addOrderBy('m.time', 'DESC')
      .getRawMany<{
        name: string;
        value: number;
        labels: Record<string, string>;
        time: Date;
      }>();

    // Pivot: group by tunnel_id
    const tunnelMap = new Map<
      string,
      { tunnelName: string; status: string; metrics: Map<string, number> }
    >();

    for (const row of rows) {
      const tunnelId = row.labels?.tunnel_id;
      if (!tunnelId) continue;

      if (!tunnelMap.has(tunnelId)) {
        tunnelMap.set(tunnelId, {
          tunnelName: row.labels?.tunnel_name ?? tunnelId,
          status: row.labels?.status ?? 'unknown',
          metrics: new Map(),
        });
      }

      const entry = tunnelMap.get(tunnelId)!;
      entry.metrics.set(row.name, Number(row.value));
      if (row.labels?.status) entry.status = row.labels.status;
      if (row.labels?.tunnel_name) entry.tunnelName = row.labels.tunnel_name;
    }

    const tunnels: CloudflareTunnelDto[] = [];
    for (const [tunnelId, data] of tunnelMap) {
      const m = (n: string) => data.metrics.get(n) ?? 0;
      tunnels.push({
        tunnelId,
        tunnelName: data.tunnelName,
        status: data.status,
        haConnections: m('cloudflare.tunnel.ha_connections'),
        totalRequests: m('cloudflare.tunnel.total_requests'),
        requestErrors: m('cloudflare.tunnel.request_errors'),
      });
    }

    return tunnels;
  }
}
