import { IsIn, IsOptional } from 'class-validator';

export class OrderPaymentStatusQueryDto {
  @IsOptional()
  @IsIn(['PENDIENTE', 'CONFIRMADO', 'EN_RUTA', 'ENTREGADO', 'CANCELADO'])
  estadoPedido?: string;

  @IsOptional()
  @IsIn(['PENDIENTE', 'PARCIAL', 'PAGADO'])
  estadoPago?: string;

  @IsOptional()
  @IsIn(['CONTADO', 'CREDITO'])
  tipoVenta?: string;
}
