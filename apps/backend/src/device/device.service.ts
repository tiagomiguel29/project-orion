import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, Repository } from 'typeorm';
import { DeviceEntity, DeviceStatus } from './entities/device.entity';
import { MetricEntity } from './entities/metric.entity';
import { EventEntity } from './entities/event.entity';
import { RealtimeService } from '../realtime/realtime.service';

@Injectable()
export class DeviceService {
  constructor(
    @InjectRepository(DeviceEntity)
    private readonly devicesRepo: Repository<DeviceEntity>,
    @InjectRepository(MetricEntity)
    private readonly metricsRepo: Repository<MetricEntity>,
    @InjectRepository(EventEntity)
    private readonly eventsRepo: Repository<EventEntity>,
    private readonly realtime: RealtimeService,
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
    const device = await this.devicesRepo.findOne({ where: { externalId } });
    if (!device) return; // or create automatically if you want

    const wasStatus = device.status;
    const nextStatus: DeviceStatus = 'online';

    device.lastSeenAt = seenAt;

    if (wasStatus !== nextStatus) {
      device.status = nextStatus;
      device.statusChangedAt = seenAt;

      await this.devicesRepo.save(device);

      this.emitStatus(device.externalId, device.status, device.lastSeenAt);
      return;
    }

    // status unchanged, only update lastSeenAt (fast path)
    await this.devicesRepo.update(device.id, { lastSeenAt: seenAt });
  }

  /**
   * Marks devices offline if lastSeenAt is too old.
   * Emits WS events only for transitions.
   */
  async markStaleDevicesOffline(offlineBefore: Date): Promise<number> {
    // Find devices currently online but stale
    const staleOnline = await this.devicesRepo.find({
      where: {
        status: 'online',
        lastSeenAt: LessThan(offlineBefore),
      },
      select: ['id', 'externalId', 'lastSeenAt', 'status'],
      take: 5000, // safety cap per tick
    });

    console.log('staleOnline', staleOnline);

    if (staleOnline.length === 0) return 0;

    const now = new Date();

    // Update in DB (bulk)
    const ids = staleOnline.map((d) => d.id);
    await this.devicesRepo
      .createQueryBuilder()
      .update(DeviceEntity)
      .set({ status: 'offline', statusChangedAt: now })
      .whereInIds(ids)
      .execute();

    // Emit WS events per device
    for (const d of staleOnline) {
      this.emitStatus(d.externalId, 'offline', d.lastSeenAt);
    }

    return staleOnline.length;
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
}
