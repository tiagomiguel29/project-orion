import { Exclude, Expose } from 'class-transformer';

@Exclude()
export class TotpSetupStartDto {
  @Expose()
  secret: string;

  @Expose()
  uri: string;

  @Expose()
  issuer: string;

  @Expose()
  accountName: string;
}
