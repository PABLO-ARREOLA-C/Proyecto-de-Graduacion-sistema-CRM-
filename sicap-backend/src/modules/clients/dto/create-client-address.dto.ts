import {
  IsBoolean,
  IsLatitude,
  IsLongitude,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreateClientAddressDto {
  @IsString()
  @MaxLength(255)
  direccion!: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  referencia?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  zona?: string;

  @IsOptional()
  @IsNumber()
  @IsLatitude()
  latitud?: number;

  @IsOptional()
  @IsNumber()
  @IsLongitude()
  longitud?: number;

  @IsOptional()
  @IsBoolean()
  estado?: boolean;
}
