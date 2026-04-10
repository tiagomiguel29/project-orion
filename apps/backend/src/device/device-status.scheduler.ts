import { Injectable, Logger } from '@nestjs/common';
import { CronExpression, Interval } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { DeviceService } from './device.service';

@Injectable()
export class DeviceStatusScheduler {
  private readonly logger = new Logger(DeviceStatusScheduler.name);

  constructor(
    private readonly devices: DeviceService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Runs every 5 seconds. Marks devices offline if they have not been seen recently.
   *
   * OFFLINE_AFTER_SEC default: 20 seconds
   */
  @Interval(5000)
  async run() {
    const offlineAfterSec = Number(this.config.get('OFFLINE_AFTER_SEC', 20));
    const offlineBefore = new Date(Date.now() - offlineAfterSec * 1000);

    const count = await this.devices.markStaleDevicesOffline(offlineBefore);
    if (count > 0) {
      this.logger.log(`marked offline: ${count}`);
    }
  }
}
