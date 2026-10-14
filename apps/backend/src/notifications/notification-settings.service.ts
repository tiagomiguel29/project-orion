import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';
import { isIP } from 'net';
import { Repository } from 'typeorm';
import { DeviceEntity } from '../device/entities/device.entity';
import { DeviceNotificationSettingsEntity } from './entities/device-notification-settings.entity';
import { NotificationSettingsEntity } from './entities/notification-settings.entity';
import { DEFAULT_NOTIFICATION_CONFIG, GlobalNotificationConfig, NotificationPolicy } from './notification.types';

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new BadRequestException('Expected an object');
  return value as Record<string, unknown>;
}

function bool(value: unknown, name: string): boolean {
  if (typeof value !== 'boolean') throw new BadRequestException(`${name} must be true or false`);
  return value;
}

function range(value: unknown, name: string, min: number, max: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) {
    throw new BadRequestException(`${name} must be between ${min} and ${max}`);
  }
  return value;
}

function intRange(value: unknown, name: string, min: number, max: number): number {
  const number = range(value, name, min, max);
  if (!Number.isInteger(number)) throw new BadRequestException(`${name} must be a whole number`);
  return number;
}

export function parsePolicy(value: unknown): NotificationPolicy {
  const input = object(value);
  const rules = object(input.rules);
  const providers = object(input.providers);
  return {
    enabled: bool(input.enabled, 'enabled'),
    rules: {
      offline: bool(rules.offline, 'rules.offline'),
      offlineAfterSec: intRange(rules.offlineAfterSec, 'rules.offlineAfterSec', 10, 3600),
      recovery: bool(rules.recovery, 'rules.recovery'),
      cpuPct: range(rules.cpuPct, 'rules.cpuPct', 1, 100),
      ramPct: range(rules.ramPct, 'rules.ramPct', 1, 100),
      diskPct: range(rules.diskPct, 'rules.diskPct', 1, 100),
      temperatureC: range(rules.temperatureC, 'rules.temperatureC', 1, 150),
    },
    providers: {
      webhook: bool(providers.webhook, 'providers.webhook'),
      discord: bool(providers.discord, 'providers.discord'),
      email: bool(providers.email, 'providers.email'),
    },
  };
}

function parseGlobal(value: unknown): GlobalNotificationConfig {
  const input = object(value);
  const policy = parsePolicy(input);
  if (!Array.isArray(input.emailRecipients) || input.emailRecipients.length > 20 || input.emailRecipients.some((item) =>
    typeof item !== 'string' || item.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(item)
  )) throw new BadRequestException('emailRecipients must contain up to 20 valid email addresses');
  const emailTransport = input.emailTransport ?? 'smtp';
  if (!['smtp', 'resend', 'ses'].includes(emailTransport as string)) throw new BadRequestException('Invalid email transport');
  const emailFrom = input.emailFrom ?? '';
  if (typeof emailFrom !== 'string' || emailFrom.length > 254 || (emailFrom && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailFrom))) {
    throw new BadRequestException('emailFrom must be a valid email address');
  }
  const sesRegion = input.sesRegion ?? '';
  if (typeof sesRegion !== 'string' || (sesRegion && !/^[a-z0-9-]{3,30}$/.test(sesRegion))) {
    throw new BadRequestException('sesRegion must be a valid AWS region');
  }
  return { ...policy, emailRecipients: [...new Set(input.emailRecipients as string[])], emailTransport: emailTransport as GlobalNotificationConfig['emailTransport'], emailFrom, sesRegion };
}

function credential(value: unknown, name: string): string {
  if (typeof value !== 'string' || !value.trim() || value.length > 512) throw new BadRequestException(`${name} must be a non-empty string`);
  return value.trim();
}

function validateUrl(raw: unknown, discord: boolean): string {
  if (typeof raw !== 'string' || raw.length > 2048) throw new BadRequestException('A valid HTTPS URL is required');
  let url: URL;
  try { url = new URL(raw); } catch { throw new BadRequestException('A valid HTTPS URL is required'); }
  if (url.protocol !== 'https:' || url.username || url.password || url.hash) throw new BadRequestException('Use an HTTPS URL without credentials or a fragment');
  const host = url.hostname.toLowerCase();
  if (discord) {
    if (!['discord.com', 'discordapp.com'].includes(host) || !/^\/api\/webhooks\/\d+\/[^/]+\/?$/.test(url.pathname)) {
      throw new BadRequestException('Use a Discord webhook URL');
    }
  } else if (host === 'localhost' || host.endsWith('.local') || host.endsWith('.internal') || isIP(host)) {
    throw new BadRequestException('Webhook URL must use a public DNS hostname');
  }
  return url.toString();
}

@Injectable()
export class NotificationSettingsService {
  constructor(
    @InjectRepository(NotificationSettingsEntity) private readonly globalRepo: Repository<NotificationSettingsEntity>,
    @InjectRepository(DeviceNotificationSettingsEntity) private readonly overrideRepo: Repository<DeviceNotificationSettingsEntity>,
    @InjectRepository(DeviceEntity) private readonly deviceRepo: Repository<DeviceEntity>,
    private readonly env: ConfigService,
  ) {}

  private key(): Buffer {
    const secret = this.env.get<string>('MFA_ENCRYPTION_SECRET');
    if (!secret) throw new BadRequestException('MFA_ENCRYPTION_SECRET is required to store provider credentials');
    return createHash('sha256').update(`scope-notifications:${secret}`).digest();
  }

  private encrypt(value: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.key(), iv);
    const data = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
    return [iv, cipher.getAuthTag(), data].map((part) => part.toString('base64url')).join('.');
  }

  private decrypt(value: string): string {
    const [iv, tag, data] = value.split('.');
    const decipher = createDecipheriv('aes-256-gcm', this.key(), Buffer.from(iv, 'base64url'));
    decipher.setAuthTag(Buffer.from(tag, 'base64url'));
    return Buffer.concat([decipher.update(Buffer.from(data, 'base64url')), decipher.final()]).toString('utf8');
  }

  async getGlobalRow(): Promise<NotificationSettingsEntity | null> {
    return this.globalRepo.findOneBy({ id: 1 });
  }

  async getGlobal(): Promise<GlobalNotificationConfig> {
    const saved = (await this.getGlobalRow())?.config;
    return saved ? { ...this.defaults(), ...saved } : this.defaults();
  }

  private defaults(): GlobalNotificationConfig {
    const configured = Number(this.env.get('OFFLINE_AFTER_SEC', 20));
    const offlineAfterSec = Number.isFinite(configured) ? Math.round(Math.min(3600, Math.max(10, configured))) : 20;
    return { ...DEFAULT_NOTIFICATION_CONFIG, rules: { ...DEFAULT_NOTIFICATION_CONFIG.rules, offlineAfterSec } };
  }

  async getPublicGlobal() {
    const row = await this.getGlobalRow();
    return {
      config: row?.config ? { ...this.defaults(), ...row.config } : this.defaults(),
      webhookConfigured: !!row?.webhookUrlEncrypted,
      discordConfigured: !!row?.discordUrlEncrypted,
      smtpConfigured: !!this.env.get('SCOPE_SMTP_HOST') && !!this.env.get('SCOPE_SMTP_FROM'),
      resendConfigured: !!row?.resendApiKeyEncrypted,
      sesCredentialsConfigured: !!row?.sesAccessKeyIdEncrypted && !!row?.sesSecretAccessKeyEncrypted,
    };
  }

  async updateGlobal(input: unknown) {
    const body = object(input);
    const config = parseGlobal(body.config);
    const existing = await this.getGlobalRow();
    let webhookUrlEncrypted = existing?.webhookUrlEncrypted ?? null;
    let discordUrlEncrypted = existing?.discordUrlEncrypted ?? null;
    let resendApiKeyEncrypted = existing?.resendApiKeyEncrypted ?? null;
    let sesAccessKeyIdEncrypted = existing?.sesAccessKeyIdEncrypted ?? null;
    let sesSecretAccessKeyEncrypted = existing?.sesSecretAccessKeyEncrypted ?? null;
    if ('webhookUrl' in body) webhookUrlEncrypted = body.webhookUrl === null ? null : this.encrypt(validateUrl(body.webhookUrl, false));
    if ('discordUrl' in body) discordUrlEncrypted = body.discordUrl === null ? null : this.encrypt(validateUrl(body.discordUrl, true));
    if ('resendApiKey' in body) resendApiKeyEncrypted = body.resendApiKey === null ? null : this.encrypt(credential(body.resendApiKey, 'resendApiKey'));
    if ('sesAccessKeyId' in body) sesAccessKeyIdEncrypted = body.sesAccessKeyId === null ? null : this.encrypt(credential(body.sesAccessKeyId, 'sesAccessKeyId'));
    if ('sesSecretAccessKey' in body) sesSecretAccessKeyEncrypted = body.sesSecretAccessKey === null ? null : this.encrypt(credential(body.sesSecretAccessKey, 'sesSecretAccessKey'));
    if (!!sesAccessKeyIdEncrypted !== !!sesSecretAccessKeyEncrypted) throw new BadRequestException('Provide both SES access key ID and secret access key, or neither to use an IAM role');
    if (config.providers.webhook && !webhookUrlEncrypted) throw new BadRequestException('Configure a webhook URL before enabling webhooks');
    if (config.providers.discord && !discordUrlEncrypted) throw new BadRequestException('Configure a Discord webhook URL before enabling Discord');
    if (config.providers.email && !config.emailRecipients.length) throw new BadRequestException('Add at least one email recipient before enabling email');
    if (config.providers.email && config.emailTransport === 'smtp' && (!this.env.get('SCOPE_SMTP_HOST') || !this.env.get('SCOPE_SMTP_FROM'))) {
      throw new BadRequestException('Configure SMTP on every backend replica before enabling SMTP email');
    }
    if (config.providers.email && config.emailTransport === 'resend' && (!config.emailFrom || !resendApiKeyEncrypted)) {
      throw new BadRequestException('Configure a verified sender and Resend API key before enabling email');
    }
    if (config.providers.email && config.emailTransport === 'ses' && (!config.emailFrom || !config.sesRegion)) {
      throw new BadRequestException('Configure a verified sender and AWS region before enabling SES email');
    }
    await this.globalRepo.upsert({ id: 1, config, webhookUrlEncrypted, discordUrlEncrypted, resendApiKeyEncrypted, sesAccessKeyIdEncrypted, sesSecretAccessKeyEncrypted }, ['id']);
    return this.getPublicGlobal();
  }

  async getProviderUrl(provider: 'webhook' | 'discord'): Promise<string | null> {
    const row = await this.getGlobalRow();
    const encrypted = provider === 'webhook' ? row?.webhookUrlEncrypted : row?.discordUrlEncrypted;
    return encrypted ? this.decrypt(encrypted) : null;
  }

  async getEmailCredentials(): Promise<{ resendApiKey: string | null; sesAccessKeyId: string | null; sesSecretAccessKey: string | null }> {
    const row = await this.getGlobalRow();
    return {
      resendApiKey: row?.resendApiKeyEncrypted ? this.decrypt(row.resendApiKeyEncrypted) : null,
      sesAccessKeyId: row?.sesAccessKeyIdEncrypted ? this.decrypt(row.sesAccessKeyIdEncrypted) : null,
      sesSecretAccessKey: row?.sesSecretAccessKeyEncrypted ? this.decrypt(row.sesSecretAccessKeyEncrypted) : null,
    };
  }

  async findDevice(externalId: string): Promise<DeviceEntity> {
    const device = await this.deviceRepo.findOneBy({ externalId, isActive: true });
    if (!device) throw new NotFoundException('Device not found');
    return device;
  }

  async getDeviceOverride(deviceId: string): Promise<NotificationPolicy | null> {
    return (await this.overrideRepo.findOneBy({ deviceId }))?.config ?? null;
  }

  async getDeviceSettings(externalId: string) {
    const device = await this.findDevice(externalId);
    const global = await this.getGlobal();
    const override = await this.getDeviceOverride(device.id);
    return { override, effective: this.merge(global, override) };
  }

  async updateDevice(externalId: string, input: unknown) {
    const device = await this.findDevice(externalId);
    const config = parsePolicy(input);
    await this.overrideRepo.upsert({ deviceId: device.id, config }, ['deviceId']);
    return this.getDeviceSettings(externalId);
  }

  async deleteDevice(externalId: string) {
    const device = await this.findDevice(externalId);
    await this.overrideRepo.delete({ deviceId: device.id });
    return this.getDeviceSettings(externalId);
  }

  async effectiveFor(deviceId: string): Promise<{ policy: NotificationPolicy; global: GlobalNotificationConfig }> {
    const global = await this.getGlobal();
    const override = await this.getDeviceOverride(deviceId);
    return { policy: this.merge(global, override), global };
  }

  private merge(global: GlobalNotificationConfig, override: NotificationPolicy | null): NotificationPolicy {
    if (!override) return global;
    return {
      ...override,
      enabled: global.enabled && override.enabled,
      providers: {
        webhook: global.providers.webhook && override.providers.webhook,
        discord: global.providers.discord && override.providers.discord,
        email: global.providers.email && override.providers.email,
      },
    };
  }

  async offlineAfterSec(): Promise<number> {
    const config = await this.getGlobal();
    return config.rules.offlineAfterSec;
  }
}
