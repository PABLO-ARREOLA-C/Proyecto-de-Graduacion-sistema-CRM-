import {
  IsDateString,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  IsUUID,
} from 'class-validator';

export class UpdateOrderDto {
  @IsOptional()
  @IsUUID()
  idDireccion?: string;

  @IsOptional()
  @IsDateString()
  fechaEntregaSolicitada?: string;

  @IsOptional()
  @IsString()
  @IsIn(['CONTADO', 'CREDITO'])
  tipoVenta?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  observaciones?: string;
}
