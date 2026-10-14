import { IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class CreateDeviceDto {
  @IsString()
  @MinLength(3)
  @MaxLength(64)
  @Matches(/^[A-Za-z0-9][A-Za-z0-9._-]*$/)
  externalId: string; // what agent will use as AGENT_DEVICE_ID and JWT sub

  @IsOptional()
  @IsString()
  hostname?: string;
}
