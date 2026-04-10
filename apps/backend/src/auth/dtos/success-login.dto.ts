import { Exclude, Expose } from "class-transformer";

@Exclude()
export class SuccessLoginDto {
  @Expose()
  token: string;

  @Expose()
  user: {
    id: string;
    name: string;
    email: string;
    role: string;
  };
}