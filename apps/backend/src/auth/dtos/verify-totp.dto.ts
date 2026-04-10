import { IsString, MinLength } from 'class-validator';

export class VerifyTotpDto {
  @IsString()
  @MinLength(6)
  code: string;
}
