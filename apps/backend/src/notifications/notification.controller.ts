import { BadRequestException, Body, Controller, Delete, ForbiddenException, Get, Injectable, Param, Post, Put, Query, UseGuards, CanActivate, ExecutionContext } from '@nestjs/common';
import { JwtGuard } from '../auth/jwt.guard';
import { NotificationDeliveryService } from './notification-delivery.service';
import { NotificationEventsService } from './notification-events.service';
import { NotificationSettingsService } from './notification-settings.service';
import { NOTIFICATION_PROVIDERS, NotificationProvider } from './notification.types';

@Injectable()
class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    if (context.switchToHttp().getRequest().user?.role !== 'admin') throw new ForbiddenException('Admin access required');
    return true;
  }
}

@Controller('notifications')
@UseGuards(JwtGuard, AdminGuard)
export class NotificationController {
  constructor(
    private readonly settings: NotificationSettingsService,
    private readonly events: NotificationEventsService,
    private readonly delivery: NotificationDeliveryService,
  ) {}

  @Get('settings')
  getSettings() { return this.settings.getPublicGlobal(); }

  @Put('settings')
  updateSettings(@Body() body: unknown) { return this.settings.updateGlobal(body); }

  @Get('devices/:externalId/settings')
  getDeviceSettings(@Param('externalId') externalId: string) { return this.settings.getDeviceSettings(externalId); }

  @Put('devices/:externalId/settings')
  updateDeviceSettings(@Param('externalId') externalId: string, @Body() body: unknown) {
    return this.settings.updateDevice(externalId, body);
  }

  @Delete('devices/:externalId/settings')
  deleteDeviceSettings(@Param('externalId') externalId: string) { return this.settings.deleteDevice(externalId); }

  @Get('events')
  listEvents(@Query('limit') limit?: string, @Query('deviceId') deviceId?: string) {
    return this.events.listEvents(this.limit(limit), deviceId);
  }

  @Get('deliveries')
  listDeliveries(@Query('limit') limit?: string) { return this.delivery.listDeliveries(this.limit(limit)); }

  @Post('test/:provider')
  async sendTest(@Param('provider') provider: string) {
    if (!NOTIFICATION_PROVIDERS.includes(provider as NotificationProvider)) throw new BadRequestException('Unknown provider');
    await this.delivery.sendTest(provider as NotificationProvider);
    return { sent: true };
  }

  private limit(value?: string): number {
    if (value === undefined) return 50;
    const limit = Number(value);
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw new BadRequestException('limit must be between 1 and 100');
    return limit;
  }
}
