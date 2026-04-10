import { Exclude, Expose } from 'class-transformer';



@Exclude()
export class SetupRequiredDto {
  @Expose()
  setupRequired: boolean;
}
