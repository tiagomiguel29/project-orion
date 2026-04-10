import { Expose, Type } from 'class-transformer';
import { DeviceDto } from './device.dto';

export class CreateDeviceResponseDto {
  @Expose()
  token: string;

  @Expose()
  @Type(() => DeviceDto)
  device: DeviceDto;
}
