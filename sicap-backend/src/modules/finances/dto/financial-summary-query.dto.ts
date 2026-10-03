import { IsDateString, IsOptional } from 'class-validator';

export class FinancialSummaryQueryDto {
  @IsOptional()
  @IsDateString()
  fechaInicio?: string;

  @IsOptional()
  @IsDateString()
  fechaFin?: string;
}
