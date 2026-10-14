import { BadRequestException } from '@nestjs/common';
import { NotificationSettingsService, parsePolicy } from './notification-settings.service';
import { DEFAULT_NOTIFICATION_CONFIG } from './notification.types';

const policy = () => structuredClone(DEFAULT_NOTIFICATION_CONFIG);

describe('notification settings', () => {
  it('rejects invalid thresholds and provider switches', () => {
    expect(() => parsePolicy({ ...policy(), rules: { ...policy().rules, cpuPct: 101 } })).toThrow(BadRequestException);
    expect(() => parsePolicy({ ...policy(), rules: { ...policy().rules, offlineAfterSec: 10.5 } })).toThrow(BadRequestException);
    expect(() => parsePolicy({ ...policy(), providers: { ...policy().providers, email: 'yes' } })).toThrow(BadRequestException);
  });

  it('keeps global provider switches and enable flag authoritative over device overrides', async () => {
    const global = policy();
    global.enabled = true;
    global.providers.webhook = true;
    const override = policy();
    override.enabled = true;
    override.providers.webhook = true;
    override.providers.email = true;
    const service = new NotificationSettingsService(
      { findOneBy: jest.fn().mockResolvedValue({ id: 1, config: global }) } as any,
      { findOneBy: jest.fn().mockResolvedValue({ config: override }) } as any,
      {} as any,
      { get: jest.fn() } as any,
    );
    expect((await service.effectiveFor('device-1')).policy.providers).toEqual({ webhook: true, email: false, discord: false });
    global.enabled = false;
    expect((await service.effectiveFor('device-1')).policy.enabled).toBe(false);
  });

  it('encrypts provider destinations and does not return them from settings reads', async () => {
    let saved: any = null;
    const repo = {
      findOneBy: jest.fn().mockImplementation(async () => saved),
      upsert: jest.fn().mockImplementation(async (row) => { saved = row }),
    };
    const service = new NotificationSettingsService(
      repo as any, {} as any, {} as any,
      { get: jest.fn().mockImplementation((name) => name === 'MFA_ENCRYPTION_SECRET' ? 'test-secret' : undefined) } as any,
    );
    const config = policy();
    config.providers.webhook = true;
    await service.updateGlobal({ config, webhookUrl: 'https://alerts.example.com/hook' });
    expect(saved.webhookUrlEncrypted).not.toContain('alerts.example.com');
    expect(await service.getProviderUrl('webhook')).toBe('https://alerts.example.com/hook');
    expect(JSON.stringify(await service.getPublicGlobal())).not.toContain('alerts.example.com');
  });

  it('stores Resend and SES credentials encrypted and keeps them out of public settings', async () => {
    let saved: any = null;
    const repo = {
      findOneBy: jest.fn().mockImplementation(async () => saved),
      upsert: jest.fn().mockImplementation(async (row) => { saved = row }),
    };
    const service = new NotificationSettingsService(repo as any, {} as any, {} as any, {
      get: jest.fn().mockImplementation((name) => name === 'MFA_ENCRYPTION_SECRET' ? 'test-secret' : undefined),
    } as any);
    const config = policy();
    config.providers.email = true;
    config.emailTransport = 'resend';
    config.emailFrom = 'alerts@example.com';
    config.emailRecipients = ['ops@example.com'];
    await service.updateGlobal({ config, resendApiKey: 're_secret' });
    expect(saved.resendApiKeyEncrypted).not.toContain('re_secret');
    expect((await service.getEmailCredentials()).resendApiKey).toBe('re_secret');
    expect(JSON.stringify(await service.getPublicGlobal())).not.toContain('re_secret');
    config.emailTransport = 'ses';
    config.sesRegion = 'eu-west-1';
    await service.updateGlobal({ config, sesAccessKeyId: 'AKIATEST', sesSecretAccessKey: 'secret-test' });
    expect((await service.getPublicGlobal()).sesCredentialsConfigured).toBe(true);
    expect((await service.getEmailCredentials()).sesSecretAccessKey).toBe('secret-test');
    await expect(service.updateGlobal({ config, sesSecretAccessKey: null })).rejects.toThrow(BadRequestException);
  });
});
