import { IsDateString, IsUUID } from 'class-validator';

export class CreateReceivableDto {
  @IsUUID()
  idPedido!: string;

  @IsDateString()
  fechaVencimiento!: string;
}
