import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class SaveProfileDto {
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  nombre!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(20)
  telefono!: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  nit?: string;
}
