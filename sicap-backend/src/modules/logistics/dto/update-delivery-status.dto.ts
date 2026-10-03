import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateDeliveryStatusDto {
  @IsIn(['ENTREGADO', 'NO_ENTREGADO'])
  estado!: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  observaciones?: string;
}
