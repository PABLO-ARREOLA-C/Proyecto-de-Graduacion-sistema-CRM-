import {
  ArrayMinSize,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateDeliveryDetailDto {
  @IsUUID()
  idDetallePedido!: string;

  @IsInt()
  @Min(0)
  cantidadEntregada!: number;
}

export class CreateDeliveryDto {
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  observaciones?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateDeliveryDetailDto)
  detalles!: CreateDeliveryDetailDto[];
}
