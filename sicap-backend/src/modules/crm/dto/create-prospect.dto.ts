import {
  ArrayUnique,
  IsArray,
  IsEmail,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class ProspectProductDto {
  @IsUUID()
  idProducto!: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  cantidadEstimada?: number;
}

export class CreateProspectDto {
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  nombre!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(20)
  telefono!: string;

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

  @IsOptional()
  @IsArray()
  @ArrayUnique((producto: ProspectProductDto) => producto.idProducto)
  @ValidateNested({ each: true })
  @Type(() => ProspectProductDto)
  productos?: ProspectProductDto[];
}
