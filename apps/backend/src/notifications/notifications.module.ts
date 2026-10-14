import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { DeviceEntity } from '../device/entities/device.entity';
import { EventEntity } from '../device/entities/event.entity';
import { RealtimeModule } from '../realtime/realtime.module';
import { NotificationController } from './notification.controller';
import { NotificationDeliveryService } from './notification-delivery.service';
import { NotificationEventsService } from './notification-events.service';
import { DeviceNotificationSettingsEntity } from './entities/device-notification-settings.entity';
import { NotificationDeliveryEntity } from './entities/notification-delivery.entity';
import { NotificationRuleStateEntity } from './entities/notification-rule-state.entity';
import { NotificationSettingsEntity } from './entities/notification-settings.entity';
import { NotificationSettingsService } from './notification-settings.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([DeviceEntity, EventEntity, DeviceNotificationSettingsEntity, NotificationDeliveryEntity, NotificationRuleStateEntity, NotificationSettingsEntity]),
    AuthModule,
    RealtimeModule,
  ],
  controllers: [NotificationController],
  providers: [NotificationSettingsService, NotificationEventsService, NotificationDeliveryService],
  exports: [NotificationSettingsService, NotificationEventsService],
})
export class NotificationsModule {}
