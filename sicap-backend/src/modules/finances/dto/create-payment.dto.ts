import {
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreatePaymentDto {
  @IsUUID()
  idOperacion!: string;

  @Type(() => Number)
  @IsNumber({
    maxDecimalPlaces: 2,
  })
  @Min(0.01)
  monto!: number;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  observaciones?: string;
}
