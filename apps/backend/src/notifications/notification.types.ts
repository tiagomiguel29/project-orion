export type NotificationProvider = 'webhook' | 'discord' | 'email';
export type EmailTransport = 'smtp' | 'resend' | 'ses';
export type NotificationRule = 'offline' | 'cpu' | 'ram' | 'disk' | 'temperature';

export interface NotificationRules {
  offline: boolean;
  offlineAfterSec: number;
  recovery: boolean;
  cpuPct: number;
  ramPct: number;
  diskPct: number;
  temperatureC: number;
}

export interface NotificationChannels {
  webhook: boolean;
  discord: boolean;
  email: boolean;
}

export interface NotificationPolicy {
  enabled: boolean;
  rules: NotificationRules;
  providers: NotificationChannels;
}

export interface GlobalNotificationConfig extends NotificationPolicy {
  emailRecipients: string[];
  emailTransport: EmailTransport;
  emailFrom: string;
  sesRegion: string;
}

export interface NotificationEventPayload {
  id: string;
  deviceId: string;
  deviceName: string;
  type: string;
  severity: 'info' | 'warning' | 'critical';
  message: string;
  time: string;
  labels: Record<string, string>;
}

export const DEFAULT_NOTIFICATION_CONFIG: GlobalNotificationConfig = {
  enabled: false,
  rules: { offline: true, offlineAfterSec: 20, recovery: true, cpuPct: 85, ramPct: 85, diskPct: 90, temperatureC: 80 },
  providers: { webhook: false, discord: false, email: false },
  emailRecipients: [],
  emailTransport: 'smtp',
  emailFrom: '',
  sesRegion: '',
};

export const NOTIFICATION_PROVIDERS: NotificationProvider[] = ['webhook', 'discord', 'email'];
