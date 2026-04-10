import { Exclude, Expose } from "class-transformer";

@Exclude()
export class MeDto {
  @Expose()
  id: string;

  @Expose()
  name: string;

  @Expose()
  email: string;

  @Expose()
  role: string;
}