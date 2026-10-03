import {
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateFinancialMovementDto {
  @Type(() => Number)
  @IsInt()
  idCategoria!: number;

  @Type(() => Number)
  @IsNumber({
    maxDecimalPlaces: 2,
  })
  @Min(0.01)
  monto!: number;

  @IsString()
  @MinLength(2)
  @MaxLength(150)
  concepto!: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  descripcion?: string;
}
