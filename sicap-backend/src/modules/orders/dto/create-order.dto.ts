import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateOrderItemDto {
  @IsUUID()
  idProducto!: string;

  @IsInt()
  @Min(1)
  cantidad!: number;
}

export class CreateOrderDto {
  @IsUUID()
  idCliente!: string;

  @IsUUID()
  idDireccion!: string;

  @IsDateString()
  fechaEntregaSolicitada!: string;

  @IsString()
  @IsIn(['CONTADO', 'CREDITO'])
  tipoVenta!: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  observaciones?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateOrderItemDto)
  detalles!: CreateOrderItemDto[];
}
