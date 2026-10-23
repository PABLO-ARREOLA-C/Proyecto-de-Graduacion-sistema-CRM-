import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { ClientsService } from '../clients/clients.service';
import { CreateClientAddressDto } from '../clients/dto/create-client-address.dto';
import { UpdateClientAddressDto } from '../clients/dto/update-client-address.dto';
import { ClientPortalService } from './client-portal.service';
import { SaveProfileDto } from './dto/save-profile.dto';

type PortalRequest = { user: { idUsuario: string } };

@Controller('client-portal')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('Cliente')
export class ClientPortalController {
  constructor(
    private readonly portal: ClientPortalService,
    private readonly clients: ClientsService,
  ) {}

  @Get('profile')
  profile(@Req() req: PortalRequest) {
    return this.portal.getProfile(req.user.idUsuario);
  }

  @Patch('profile')
  save(@Req() req: PortalRequest, @Body() dto: SaveProfileDto) {
    return this.portal.saveProfile(req.user.idUsuario, dto);
  }

  @Get('orders')
  orders(@Req() req: PortalRequest) {
    return this.portal.getOrders(req.user.idUsuario);
  }

  @Get('orders/:id')
  order(@Req() req: PortalRequest, @Param('id', ParseUUIDPipe) id: string) {
    return this.portal.getOrder(req.user.idUsuario, id);
  }

  @Post('addresses')
  async addAddress(
    @Req() req: PortalRequest,
    @Body() dto: CreateClientAddressDto,
  ) {
    const profile = await this.portal.requireProfile(req.user.idUsuario);
    if (!dto.direccion.trim())
      throw new BadRequestException('Ingresa una dirección');
    return this.clients.createAddress(profile.idCliente, dto);
  }

  @Patch('addresses/:id')
  async updateAddress(
    @Req() req: PortalRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateClientAddressDto,
  ) {
    const profile = await this.portal.requireProfile(req.user.idUsuario);
    if (dto.direccion !== undefined && !dto.direccion.trim())
      throw new BadRequestException('Ingresa una dirección');
    return this.clients.updateAddress(profile.idCliente, id, dto);
  }

  @Delete('addresses/:id')
  async removeAddress(
    @Req() req: PortalRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const profile = await this.portal.requireProfile(req.user.idUsuario);
    return this.clients.removeAddress(profile.idCliente, id);
  }
}
