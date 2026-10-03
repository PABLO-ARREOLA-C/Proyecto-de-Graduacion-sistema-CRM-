import {
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';

export class UpdateProspectDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  nombre?: string;

  @IsOptional()
  @IsString()
  @MinLength(8)
  @MaxLength(20)
  telefono?: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(100)
  correo?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  direccion?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  interes?: string;

  @IsOptional()
  @IsIn(['NUEVO', 'CONTACTADO', 'INTERESADO', 'CONVERTIDO', 'DESCARTADO'])
  estado?: string;

  @IsOptional()
  @IsUUID()
  idResponsable?: string;
}
