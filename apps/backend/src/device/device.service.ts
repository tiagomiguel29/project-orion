import { ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DeviceEntity, DeviceStatus } from './entities/device.entity';
import { MetricEntity } from './entities/metric.entity';
import { EventEntity } from './entities/event.entity';
import { RealtimeService } from '../realtime/realtime.service';
import { NotificationEventsService } from '../notifications/notification-events.service';

@Injectable()
export class DeviceService {
  private readonly logger = new Logger(DeviceService.name);
  constructor(
    @InjectRepository(DeviceEntity)
    private readonly devicesRepo: Repository<DeviceEntity>,
    @InjectRepository(MetricEntity)
    private readonly metricsRepo: Repository<MetricEntity>,
    @InjectRepository(EventEntity)
    private readonly eventsRepo: Repository<EventEntity>,
    private readonly realtime: RealtimeService,
    private readonly notifications: NotificationEventsService,
  ) {}

  async createDevice(input: {
    externalId: string;
    hostname?: string;
    os?: string;
  }): Promise<DeviceEntity> {
    const externalId = input.externalId.trim();

    const existing = await this.devicesRepo.findOne({ where: { externalId } });
    if (existing) {
      throw new ConflictException('Device with this externalId already exists');
    }

    const device = this.devicesRepo.create({
      externalId,
      hostname: input.hostname ?? null,
      os: input.os ?? null,
      isActive: true,
      status: 'unknown',
      lastSeenAt: null,
      statusChangedAt: null,
    });

    return this.devicesRepo.save(device);
  }

  async getActiveDevice(externalId: string): Promise<DeviceEntity> {
    const device = await this.devicesRepo.findOne({ where: { externalId, isActive: true } });
    if (!device) throw new NotFoundException(`Device ${externalId} not found`);
    return device;
  }

  async updateDeviceInfo(externalId: string, info: {
    hostname?: string;
    os?: string;
    kernel?: string;
    cpuName?: string;
    memoryCapacity?: number;
    diskCapacity?: number;
    osName?: string;
  }): Promise<void> {
    await this.devicesRepo.update({ externalId }, info);
  }

  /**
   * Called whenever we receive telemetry from a device.
   * - updates lastSeenAt
   * - flips status to online if needed
   * - emits WS status change event if status changed
   */
  async markSeen(externalId: string, seenAt = new Date()): Promise<void> {
    const rows = await this.devicesRepo.query(`
      WITH previous AS MATERIALIZED (
        SELECT id, status FROM devices WHERE "externalId" = $1 FOR UPDATE
      ), updated AS (
        UPDATE devices d SET
          "lastSeenAt" = GREATEST(d."lastSeenAt", $2::timestamptz),
          status = 'online',
          "statusChangedAt" = CASE WHEN p.status <> 'online' THEN $2::timestamptz ELSE d."statusChangedAt" END
        FROM previous p WHERE d.id = p.id
        RETURNING d."externalId", d."lastSeenAt", p.status AS "previousStatus"
      ) SELECT * FROM updated
    `, [externalId, seenAt]);
    for (const row of rows) {
      if (row.previousStatus !== 'online') {
        this.emitStatus(row.externalId, 'online', row.lastSeenAt);
        await this.recordStatus(row.externalId, 'online');
      }
    }
  }

  /**
   * Marks devices offline if lastSeenAt is too old.
   * Emits WS events only for transitions.
   */
  async markStaleDevicesOffline(offlineAfterSec: number): Promise<number> {
    // Check the cutoff in the UPDATE itself: an agent can reconnect while the
    // scheduler is running on another replica. Only actual transitions emit.
    const result = await this.devicesRepo.createQueryBuilder()
      .update(DeviceEntity)
      .set({ status: 'offline', statusChangedAt: new Date() })
      .where('status = :status', { status: 'online' })
      .andWhere(`"lastSeenAt" < NOW() - make_interval(secs => COALESCE(
        (SELECT (override.config->'rules'->>'offlineAfterSec')::int FROM device_notification_settings override WHERE override."deviceId" = devices.id),
        :offlineAfterSec
      ))`, { offlineAfterSec })
      .returning(['externalId', 'lastSeenAt'])
      .execute();
    for (const row of result.raw) {
      this.emitStatus(row.externalId, 'offline', row.lastSeenAt);
      await this.recordStatus(row.externalId, 'offline');
    }
    return result.raw.length;
  }

  /**
   * Deletes a device and all its associated metrics and events.
   */
  async deleteDevice(externalId: string): Promise<void> {
    const device = await this.devicesRepo.findOne({ where: { externalId } });
    if (!device) {
      throw new NotFoundException(`Device ${externalId} not found`);
    }

    // Delete metrics (uses externalId as deviceId)
    await this.metricsRepo
      .createQueryBuilder()
      .delete()
      .where('deviceId = :deviceId', { deviceId: externalId })
      .execute();

    // Delete events (uses device UUID as deviceId)
    await this.eventsRepo
      .createQueryBuilder()
      .delete()
      .where('deviceId = :deviceId', { deviceId: device.id })
      .execute();

    // Delete the device itself
    await this.devicesRepo.remove(device);
  }

  private emitStatus(externalId: string, status: DeviceStatus, lastSeenAt: Date | null) {
    const payload = {
      deviceId: externalId,
      status,
      lastSeenAt: lastSeenAt?.toISOString() ?? null,
    };
    // broadcast to device-specific room
    this.realtime.emitToDevice(externalId, 'device.status', payload);
    // broadcast to dashboard subscribers
    this.realtime.emitToDashboard('device.status', payload);
  }

  private async recordStatus(externalId: string, status: 'online' | 'offline') {
    try { await this.notifications.onStatus(externalId, status); }
    catch (error) { this.logger.warn(`notification evaluation failed for ${externalId}: ${error instanceof Error ? error.message : error}`); }
  }
}
