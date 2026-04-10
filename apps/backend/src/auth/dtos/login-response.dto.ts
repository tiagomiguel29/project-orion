import { Exclude, Expose } from 'class-transformer';

export type MfaMethod = 'passkey' | 'totp';

@Exclude()
export class LoginResponseDto {
  @Expose()
  mfaRequired: boolean;

  @Expose()
  token?: string;

  @Expose()
  user?: {
    id: string;
    name: string;
    email: string;
    role: string;
  };

  @Expose()
  pendingToken?: string;

  @Expose()
  availableMethods?: MfaMethod[];
}
