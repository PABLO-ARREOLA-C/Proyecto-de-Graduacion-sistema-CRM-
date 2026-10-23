import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class PurchaseAlertQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsIn([30, 90, 180])
  dias = 90;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100000)
  page = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(6)
  diaSemana?: number;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;
}
