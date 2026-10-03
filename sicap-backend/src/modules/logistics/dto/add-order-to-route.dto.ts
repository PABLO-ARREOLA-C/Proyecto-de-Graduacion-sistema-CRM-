import {
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Min,
} from 'class-validator';

export class AddOrderToRouteDto {
  @IsUUID()
  idPedido!: string;

  @IsInt()
  @Min(1)
  ordenParada!: number;

  @IsOptional()
  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, {
    message: 'horaEstimada debe tener formato HH:mm',
  })
  horaEstimada?: string;
}
