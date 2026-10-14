import { IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class RedeemPairingDto {
  @IsString()
  @Matches(/^[A-Za-z0-9_-]{32}$/)
  code: string;

  @IsString()
  @MinLength(3)
  @MaxLength(64)
  @Matches(/^[A-Za-z0-9][A-Za-z0-9._-]*$/)
  deviceId: string;
}
