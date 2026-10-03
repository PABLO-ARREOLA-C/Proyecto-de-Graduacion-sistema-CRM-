import { IsInt, IsOptional, IsString, Matches, Min } from 'class-validator';

export class UpdateRouteDetailDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  ordenParada?: number;

  @IsOptional()
  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, {
    message: 'horaEstimada debe tener formato HH:mm',
  })
  horaEstimada?: string;
}
