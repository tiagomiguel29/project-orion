import { SESv2Client, SendEmailCommand } from '@aws-sdk/client-sesv2';
import { NotificationDeliveryService } from './notification-delivery.service';

describe('notification delivery', () => {
  const settings = {
    getProviderUrl: jest.fn().mockImplementation(async (provider) => provider === 'discord'
      ? 'https://discord.com/api/webhooks/123/secret'
      : 'https://alerts.example.com/hook'),
    getGlobal: jest.fn(),
    getEmailCredentials: jest.fn(),
  };
  const service = new NotificationDeliveryService({} as any, {} as any, {} as any, settings as any, {} as any);
  afterEach(() => jest.restoreAllMocks());

  it('sends a structured webhook test event with an idempotency header', async () => {
    const send = jest.spyOn(global, 'fetch').mockResolvedValue({ ok: true } as Response);
    await service.sendTest('webhook');
    expect(send).toHaveBeenCalledWith('https://alerts.example.com/hook', expect.objectContaining({
      method: 'POST', redirect: 'error',
      headers: expect.objectContaining({ 'x-scope-event-id': expect.any(String) }),
    }));
    const body = JSON.parse((send.mock.calls[0][1] as RequestInit).body as string);
    expect(body).toMatchObject({ type: 'alert.test', deviceName: 'Scope' });
  });

  it('disables Discord mentions and rejects a failed provider response', async () => {
    const send = jest.spyOn(global, 'fetch').mockResolvedValueOnce({ ok: true } as Response)
      .mockResolvedValueOnce({ ok: false, status: 429 } as Response);
    await service.sendTest('discord');
    const body = JSON.parse((send.mock.calls[0][1] as RequestInit).body as string);
    expect(body.allowed_mentions).toEqual({ parse: [] });
    await expect(service.sendTest('discord')).rejects.toMatchObject({ code: 'HTTP_429' });
  });

  it('sends Resend email with the alert ID as its idempotency key', async () => {
    settings.getGlobal.mockResolvedValue({ emailTransport: 'resend', emailFrom: 'alerts@example.com', emailRecipients: ['ops@example.com'] });
    settings.getEmailCredentials.mockResolvedValue({ resendApiKey: 're_test' });
    const send = jest.spyOn(global, 'fetch').mockResolvedValue({ ok: true } as Response);
    await service.sendTest('email');
    expect(send).toHaveBeenCalledWith('https://api.resend.com/emails', expect.objectContaining({
      headers: expect.objectContaining({ authorization: 'Bearer re_test', 'Idempotency-Key': expect.any(String) }),
    }));
    const body = JSON.parse((send.mock.calls[0][1] as RequestInit).body as string);
    expect(body).toMatchObject({ from: 'alerts@example.com', to: ['ops@example.com'] });
  });

  it('sends SES email to the selected region with the configured sender', async () => {
    settings.getGlobal.mockResolvedValue({ emailTransport: 'ses', emailFrom: 'alerts@example.com', sesRegion: 'eu-west-1', emailRecipients: ['ops@example.com'] });
    settings.getEmailCredentials.mockResolvedValue({ sesAccessKeyId: 'AKIATEST', sesSecretAccessKey: 'secret-test' });
    const send = jest.spyOn(SESv2Client.prototype, 'send').mockResolvedValue({} as never);
    await service.sendTest('email');
    const command = send.mock.calls[0][0] as SendEmailCommand;
    expect(command).toBeInstanceOf(SendEmailCommand);
    expect(command.input).toMatchObject({ FromEmailAddress: 'alerts@example.com', Destination: { ToAddresses: ['ops@example.com'] } });
  });
});
