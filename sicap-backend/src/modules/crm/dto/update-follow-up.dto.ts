import {
  IsDateString,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class UpdateFollowUpDto {
  @IsOptional()
  @IsDateString()
  fechaProgramada?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(1000)
  descripcion?: string;

  @IsOptional()
  @IsIn(['PENDIENTE', 'COMPLETADO', 'CANCELADO'])
  estado?: string;
}
