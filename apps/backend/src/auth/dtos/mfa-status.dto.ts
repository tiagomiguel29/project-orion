import { Exclude, Expose } from 'class-transformer';
import { MfaMethod } from './login-response.dto';

@Exclude()
export class PasskeyDto {
  @Expose()
  id: string;

  @Expose()
  name: string;

  @Expose()
  deviceType: string | null;

  @Expose()
  backedUp: boolean;

  @Expose()
  createdAt: Date;

  @Expose()
  lastUsedAt: Date | null;
}

@Exclude()
export class MfaStatusDto {
  @Expose()
  totpEnabled: boolean;

  @Expose()
  availableMethods: MfaMethod[];

  @Expose()
  passkeys: PasskeyDto[];
}
