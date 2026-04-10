import { Expose, Type } from 'class-transformer';
import { DeviceCardDto } from './device-card.dto';

export class DashboardTotalsDto {
  @Expose()
  total: number;

  @Expose()
  online: number;

  @Expose()
  offline: number;

  @Expose()
  warning: number;
}

export class ListDevicesResponseDto {
  @Expose()
  @Type(() => DashboardTotalsDto)
  totals: DashboardTotalsDto;

  @Expose()
  @Type(() => DeviceCardDto)
  devices: DeviceCardDto[];
}
