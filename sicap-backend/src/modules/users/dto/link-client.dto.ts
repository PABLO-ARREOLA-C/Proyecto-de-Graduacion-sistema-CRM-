import { IsUUID, ValidateIf } from 'class-validator';

export class LinkClientDto {
  @ValidateIf((_object, value: unknown) => value !== null)
  @IsUUID()
  idCliente!: string | null;
}
