import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { ClientsService } from './clients.service';
import { CreateClientAddressDto } from './dto/create-client-address.dto';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientAddressDto } from './dto/update-client-address.dto';
import { UpdateClientDto } from './dto/update-client.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('Administrador', 'Repartidor')
@Controller('clients')
export class ClientsController {
  constructor(private readonly clientsService: ClientsService) {}

  @Post()
  create(@Body() dto: CreateClientDto) {
    return this.clientsService.create(dto);
  }

  @Get()
  findAll() {
    return this.clientsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.clientsService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateClientDto,
  ) {
    return this.clientsService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.clientsService.remove(id);
  }

  @Post(':id/addresses')
  createAddress(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: CreateClientAddressDto,
  ) {
    return this.clientsService.createAddress(id, dto);
  }

  @Get(':id/addresses')
  findAddresses(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.clientsService.findAddresses(id);
  }

  @Patch(':id/addresses/:addressId')
  updateAddress(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Param('addressId', new ParseUUIDPipe())
    addressId: string,
    @Body() dto: UpdateClientAddressDto,
  ) {
    return this.clientsService.updateAddress(id, addressId, dto);
  }

  @Delete(':id/addresses/:addressId')
  removeAddress(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Param('addressId', new ParseUUIDPipe())
    addressId: string,
  ) {
    return this.clientsService.removeAddress(id, addressId);
  }
}
