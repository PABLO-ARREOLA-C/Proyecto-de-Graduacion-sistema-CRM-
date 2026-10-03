import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateOrderStatusDto {
  @IsString()
  @IsIn(['PENDIENTE', 'CONFIRMADO', 'CANCELADO'])
  estado!: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  observaciones?: string;
}
