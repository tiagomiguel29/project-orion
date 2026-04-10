import { IsObject, IsOptional, IsString } from 'class-validator';
import type { RegistrationResponseJSON } from '@simplewebauthn/server';

export class VerifyPasskeyRegistrationDto {
  @IsObject()
  response: RegistrationResponseJSON;

  @IsOptional()
  @IsString()
  name?: string;
}
