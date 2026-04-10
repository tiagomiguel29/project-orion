import { IsEmail, IsString, MinLength } from 'class-validator';

export class RegisterFirstDto {
  @IsString()
  name: string;

  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  password: string;
}
