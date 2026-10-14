import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { DeviceEntity } from '../device/entities/device.entity';
import { EventEntity } from '../device/entities/event.entity';
import { DeviceCardDto } from '../device/dtos/device-card.dto';
import { RealtimeService } from '../realtime/realtime.service';
import { NotificationDeliveryEntity } from './entities/notification-delivery.entity';
import { NotificationRuleStateEntity } from './entities/notification-rule-state.entity';
import { NotificationSettingsService } from './notification-settings.service';
import { NotificationEventPayload, NotificationPolicy, NotificationRule, NOTIFICATION_PROVIDERS } from './notification.types';

@Injectable()
export class NotificationEventsService {
  constructor(
    private readonly db: DataSource,
    @InjectRepository(DeviceEntity) private readonly devices: Repository<DeviceEntity>,
    @InjectRepository(EventEntity) private readonly events: Repository<EventEntity>,
    private readonly settings: NotificationSettingsService,
    private readonly realtime: RealtimeService,
  ) {}

  async onStatus(externalId: string, status: 'online' | 'offline'): Promise<void> {
    const device = await this.devices.findOneBy({ externalId, isActive: true });
    if (!device) return;
    const { policy } = await this.settings.effectiveFor(device.id);
    if (!policy.enabled || !policy.rules.offline) return;
    await this.record(device, policy, 'offline', status === 'offline');
  }

  async evaluateCard(card: DeviceCardDto): Promise<void> {
    const device = await this.devices.findOneBy({ externalId: card.externalId, isActive: true });
    if (!device) return;
    const { policy } = await this.settings.effectiveFor(device.id);
    if (!policy.enabled || card.status !== 'online') return;
    const { rules } = policy;
    const summary = card.summary;
    await this.record(device, policy, 'cpu', summary.cpuPct >= rules.cpuPct, summary.cpuPct, rules.cpuPct);
    await this.record(device, policy, 'ram', summary.ramPct >= rules.ramPct, summary.ramPct, rules.ramPct);
    await this.record(device, policy, 'disk', summary.disk.usedPct >= rules.diskPct, summary.disk.usedPct, rules.diskPct);
    if (typeof summary.cpuTempC === 'number') {
      await this.record(device, policy, 'temperature', summary.cpuTempC >= rules.temperatureC, summary.cpuTempC, rules.temperatureC);
    }
  }

  private async record(
    device: DeviceEntity,
    policy: NotificationPolicy,
    rule: NotificationRule,
    active: boolean,
    value?: number,
    threshold?: number,
  ): Promise<void> {
    const created = await this.db.transaction(async (manager) => {
      await manager.createQueryBuilder().insert().into(NotificationRuleStateEntity)
        .values({ deviceId: device.id, rule, active: false }).orIgnore().execute();
      const state = await manager.getRepository(NotificationRuleStateEntity).findOne({
        where: { deviceId: device.id, rule }, lock: { mode: 'pessimistic_write' },
      });
      if (!state || state.active === active) return null;
      state.active = active;
      await manager.save(state);
      if (!active && !policy.rules.recovery) return null;

      const deviceName = device.hostname || device.externalId;
      const subject = rule === 'offline' ? 'Agent' : rule === 'temperature' ? 'CPU temperature' : `${rule.toUpperCase()} usage`;
      const message = rule === 'offline'
        ? `${deviceName} is ${active ? 'offline' : 'back online'}`
        : `${deviceName}: ${subject} ${active ? `reached ${value?.toFixed(1)}${rule === 'temperature' ? '°C' : '%'}` : 'recovered'}${active ? ` (threshold ${threshold}${rule === 'temperature' ? '°C' : '%'})` : ''}`;
      const event = await manager.save(manager.create(EventEntity, {
        deviceId: device.id,
        time: new Date(),
        type: `alert.${rule}.${active ? 'triggered' : 'recovered'}`,
        severity: !active ? 'info' : rule === 'offline' ? 'critical' : 'warning',
        message,
        labels: { deviceName, externalId: device.externalId, rule, ...(value === undefined ? {} : { value: String(value) }) },
      }));
      for (const provider of NOTIFICATION_PROVIDERS) {
        if (!policy.providers[provider]) continue;
        await manager.save(manager.create(NotificationDeliveryEntity, {
          eventId: event.id,
          provider,
          status: 'pending',
          attempts: 0,
          nextAttemptAt: new Date(),
        }));
      }
      return event;
    });
    if (created) {
      const payload = this.payload(created);
      this.realtime.emitToDashboard('notification.event', payload);
      this.realtime.emitToDevice(device.externalId, 'notification.event', payload);
    }
  }

  private payload(event: EventEntity): NotificationEventPayload {
    return {
      id: event.id,
      deviceId: event.labels.externalId ?? event.deviceId,
      deviceName: event.labels.deviceName ?? event.labels.externalId ?? event.deviceId,
      type: event.type,
      severity: event.severity,
      message: event.message ?? '',
      time: event.time.toISOString(),
      labels: event.labels,
    };
  }

  async listEvents(limit: number, externalId?: string): Promise<NotificationEventPayload[]> {
    const qb = this.events.createQueryBuilder('event').where('event.type LIKE :prefix', { prefix: 'alert.%' })
      .orderBy('event.time', 'DESC').take(Math.min(Math.max(limit || 50, 1), 100));
    if (externalId) {
      const device = await this.settings.findDevice(externalId);
      qb.andWhere('event.deviceId = :deviceId', { deviceId: device.id });
    }
    return (await qb.getMany()).map((event) => this.payload(event));
  }
}
