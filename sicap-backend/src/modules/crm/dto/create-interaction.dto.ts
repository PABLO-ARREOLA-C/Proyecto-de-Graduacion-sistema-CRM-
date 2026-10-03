import { IsIn, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateInteractionDto {
  @IsIn(['LLAMADA', 'WHATSAPP', 'VISITA', 'OTRO'])
  tipo!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(2000)
  descripcion!: string;
}
