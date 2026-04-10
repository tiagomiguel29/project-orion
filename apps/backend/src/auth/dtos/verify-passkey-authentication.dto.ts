import { IsObject } from 'class-validator';
import type { AuthenticationResponseJSON } from '@simplewebauthn/server';

export class VerifyPasskeyAuthenticationDto {
  @IsObject()
  response: AuthenticationResponseJSON;
}
