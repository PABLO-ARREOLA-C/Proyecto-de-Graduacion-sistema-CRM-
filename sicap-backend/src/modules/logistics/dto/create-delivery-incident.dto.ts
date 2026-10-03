import { IsString, MaxLength, MinLength } from 'class-validator';

export class CreateDeliveryIncidentDto {
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  tipo!: string;

  @IsString()
  @MinLength(3)
  @MaxLength(1000)
  descripcion!: string;
}
