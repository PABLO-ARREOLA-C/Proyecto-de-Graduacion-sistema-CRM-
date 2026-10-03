import {
  IsBoolean,
  IsEmail,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateUserDto {
  @IsInt()
  idRol!: number;

  @IsString()
  @MinLength(3)
  @MaxLength(100)
  nombre!: string;

  @IsEmail()
  @MaxLength(100)
  correo!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(100)
  password!: string;

  @IsOptional()
  @IsBoolean()
  estado?: boolean;
}
