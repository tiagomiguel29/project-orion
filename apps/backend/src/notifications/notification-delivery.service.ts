import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SESv2Client, SendEmailCommand } from '@aws-sdk/client-sesv2';
import { Interval } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import nodemailer from 'nodemailer';
import { DataSource, Repository } from 'typeorm';
import { EventEntity } from '../device/entities/event.entity';
import { NotificationDeliveryEntity } from './entities/notification-delivery.entity';
import { NotificationSettingsService } from './notification-settings.service';
import { NotificationEventPayload, NotificationProvider } from './notification.types';

@Injectable()
export class NotificationDeliveryService {
  private readonly logger = new Logger(NotificationDeliveryService.name);
  private running = false;

  constructor(
    private readonly db: DataSource,
    @InjectRepository(EventEntity) private readonly events: Repository<EventEntity>,
    @InjectRepository(NotificationDeliveryEntity) private readonly deliveries: Repository<NotificationDeliveryEntity>,
    private readonly settings: NotificationSettingsService,
    private readonly env: ConfigService,
  ) {}

  @Interval(5000)
  async run(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      const jobs = await this.claim();
      await Promise.all(jobs.map((job) => this.process(job)));
    } catch (error) {
      this.logger.warn(`notification delivery sweep failed: ${error instanceof Error ? error.message : 'unknown error'}`);
    } finally {
      this.running = false;
    }
  }

  private async claim(): Promise<NotificationDeliveryEntity[]> {
    return this.db.transaction(async (manager) => {
      const now = new Date();
      const rows = await manager.getRepository(NotificationDeliveryEntity).createQueryBuilder('delivery')
        .where('(delivery.status = :pending AND delivery.nextAttemptAt <= :now) OR (delivery.status = :sending AND delivery.lockedUntil <= :now)', {
          pending: 'pending', sending: 'sending', now,
        })
        .orderBy('delivery.nextAttemptAt', 'ASC')
        .limit(20)
        .setLock('pessimistic_write')
        .setOnLocked('skip_locked')
        .getMany();
      for (const row of rows) {
        row.status = 'sending';
        row.attempts += 1;
        row.lockedUntil = new Date(now.getTime() + 60_000);
      }
      await manager.save(rows);
      return rows;
    });
  }

  private async process(job: NotificationDeliveryEntity): Promise<void> {
    try {
      const event = await this.events.findOneBy({ id: job.eventId });
      if (!event) throw new Error('event missing');
      const { policy } = await this.settings.effectiveFor(event.deviceId);
      if (!policy.enabled || !policy.providers[job.provider]) {
        await this.deliveries.update(job.id, { status: 'failed', lastError: 'Provider disabled', lockedUntil: null });
        return;
      }
      await this.deliver(job.provider, {
        id: event.id,
        deviceId: event.labels.externalId ?? event.deviceId,
        deviceName: event.labels.deviceName ?? event.deviceId,
        type: event.type,
        severity: event.severity,
        message: event.message ?? '',
        time: event.time.toISOString(),
        labels: event.labels,
      });
      await this.deliveries.update(job.id, { status: 'sent', lockedUntil: null, lastError: null });
    } catch (error) {
      const attempts = job.attempts;
      const code = error instanceof Error ? (error as Error & { code?: string }).code ?? error.name : 'UnknownError';
      const nextAttemptAt = new Date(Date.now() + Math.min(60 * 60_000, 15_000 * 2 ** Math.max(0, attempts - 1)));
      await this.deliveries.update(job.id, {
        status: attempts >= 5 ? 'failed' : 'pending',
        lockedUntil: null,
        nextAttemptAt,
        lastError: String(code).slice(0, 120),
      });
      this.logger.warn(`notification delivery ${job.id} via ${job.provider} failed (${code})`);
    }
  }

  async sendTest(provider: NotificationProvider): Promise<void> {
    await this.deliver(provider, {
      id: randomUUID(), deviceId: 'test', deviceName: 'Scope', type: 'alert.test',
      severity: 'info', message: 'Scope test notification', time: new Date().toISOString(), labels: {},
    });
  }

  private async deliver(provider: NotificationProvider, event: NotificationEventPayload): Promise<void> {
    if (provider === 'email') {
      const config = await this.settings.getGlobal();
      if (!config.emailRecipients.length) throw new BadRequestException('Email recipients are not configured');
      const subject = `[Scope] ${event.message}`;
      const text = `${event.message}\nDevice: ${event.deviceName} (${event.deviceId})\nType: ${event.type}\nTime: ${event.time}\nEvent ID: ${event.id}\n`;
      if (config.emailTransport === 'resend') {
        const { resendApiKey } = await this.settings.getEmailCredentials();
        if (!resendApiKey || !config.emailFrom) throw new BadRequestException('Resend is not configured');
        const response = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { authorization: `Bearer ${resendApiKey}`, 'content-type': 'application/json', 'Idempotency-Key': event.id },
          body: JSON.stringify({ from: config.emailFrom, to: config.emailRecipients, subject, text }),
          redirect: 'error', signal: AbortSignal.timeout(10_000),
        });
        if (!response.ok) throw Object.assign(new Error('Resend rejected request'), { code: `HTTP_${response.status}` });
        return;
      }
      if (config.emailTransport === 'ses') {
        if (!config.emailFrom || !config.sesRegion) throw new BadRequestException('SES is not configured');
        const { sesAccessKeyId, sesSecretAccessKey } = await this.settings.getEmailCredentials();
        const client = new SESv2Client({
          region: config.sesRegion,
          ...(sesAccessKeyId && sesSecretAccessKey ? { credentials: { accessKeyId: sesAccessKeyId, secretAccessKey: sesSecretAccessKey } } : {}),
        });
        try {
          await client.send(new SendEmailCommand({
            FromEmailAddress: config.emailFrom,
            Destination: { ToAddresses: config.emailRecipients },
            Content: { Simple: { Subject: { Data: subject }, Body: { Text: { Data: text } } } },
          }));
        } finally {
          client.destroy();
        }
        return;
      }
      const host = this.env.get<string>('SCOPE_SMTP_HOST');
      const from = this.env.get<string>('SCOPE_SMTP_FROM');
      if (!host || !from) throw new BadRequestException('SMTP is not configured');
      const port = Number(this.env.get('SCOPE_SMTP_PORT', 587));
      const user = this.env.get<string>('SCOPE_SMTP_USER');
      const password = this.env.get<string>('SCOPE_SMTP_PASSWORD');
      const transport = nodemailer.createTransport({
        host, port, secure: this.env.get('SCOPE_SMTP_SECURE', 'false') === 'true',
        requireTLS: this.env.get('SCOPE_SMTP_REQUIRE_TLS', 'true') === 'true',
        auth: user ? { user, pass: password ?? '' } : undefined,
        connectionTimeout: 10_000, greetingTimeout: 10_000, socketTimeout: 10_000,
        disableFileAccess: true, disableUrlAccess: true,
      });
      try {
        await transport.sendMail({
          from, to: config.emailRecipients,
          subject, text,
          messageId: `<${event.id}@scope.local>`,
        });
      } finally {
        transport.close();
      }
      return;
    }

    const url = await this.settings.getProviderUrl(provider);
    if (!url) throw new BadRequestException(`${provider} provider is not configured`);
    const body = provider === 'discord'
      ? { content: `**[Scope] ${event.severity.toUpperCase()}** — ${event.message}\n${event.time}`, allowed_mentions: { parse: [] } }
      : event;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-scope-event-id': event.id },
      body: JSON.stringify(body), redirect: 'error', signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) throw Object.assign(new Error('Provider rejected request'), { code: `HTTP_${response.status}` });
  }

  async listDeliveries(limit: number) {
    return this.deliveries.find({ order: { createdAt: 'DESC' }, take: Math.min(Math.max(limit || 30, 1), 100) });
  }
}
