import {
  IsDateString,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateFollowUpDto {
  @IsDateString()
  fechaProgramada!: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(1000)
  descripcion?: string;
}
