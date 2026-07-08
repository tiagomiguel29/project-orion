import { Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { DeviceService } from './device.service';
import { RedisLockService } from '../common/redis/redis-lock.service';

const DEVICE_STATUS_INTERVAL_MS = 5000;
const DEVICE_STATUS_LOCK_KEY = 'scheduler:device-status';

@Injectable()
export class DeviceStatusScheduler {
  private readonly logger = new Logger(DeviceStatusScheduler.name);

  constructor(
    private readonly devices: DeviceService,
    private readonly config: ConfigService,
    private readonly lock: RedisLockService,
  ) {}

  /**
   * Runs every 5 seconds. Marks devices offline if they have not been seen
   * recently (OFFLINE_AFTER_SEC, default 20s).
   *
   * The @Interval fires on every replica, so the actual sweep is guarded by a
   * Redis lock — only one instance runs it per tick, avoiding duplicate offline
   * events and redundant writes. The lock TTL is just under the interval so a
   * crashed holder can't wedge it.
   */
  @Interval(DEVICE_STATUS_INTERVAL_MS)
  async run() {
    await this.lock.withLock(
      DEVICE_STATUS_LOCK_KEY,
      DEVICE_STATUS_INTERVAL_MS - 1000,
      async () => {
        const offlineAfterSec = Number(this.config.get('OFFLINE_AFTER_SEC', 20));
        const offlineBefore = new Date(Date.now() - offlineAfterSec * 1000);

        const count = await this.devices.markStaleDevicesOffline(offlineBefore);
        if (count > 0) {
          this.logger.log(`marked offline: ${count}`);
        }
      },
    );
  }
}
