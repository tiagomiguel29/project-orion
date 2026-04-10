import { IsOptional, IsString, MinLength } from 'class-validator';

export class CreateDeviceDto {
  @IsString()
  @MinLength(3)
  externalId: string; // what agent will use as AGENT_DEVICE_ID and JWT sub

  @IsOptional()
  @IsString()
  hostname?: string;
}
