import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';

export class LoginDto {
  @IsEmail()
  @MaxLength(100)
  correo!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(100)
  password!: string;
}
