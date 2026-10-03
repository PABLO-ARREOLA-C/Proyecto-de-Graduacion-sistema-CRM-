import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { Request } from 'express';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CrmService } from './crm.service';
import {
  CreateProspectDto,
  ProspectProductDto,
} from './dto/create-prospect.dto';
import { UpdateProspectDto } from './dto/update-prospect.dto';
import { CreateInteractionDto } from './dto/create-interaction.dto';
import { CreateFollowUpDto } from './dto/create-follow-up.dto';
import { UpdateFollowUpDto } from './dto/update-follow-up.dto';

interface AuthenticatedRequest extends Request {
  user: {
    idUsuario: string;
    correo: string;
    nombre: string;
    idRol: number;
    rol: string;
  };
}

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('Administrador', 'Repartidor')
@Controller('crm')
export class CrmController {
  constructor(private readonly crmService: CrmService) {}

  @Post('prospects')
  create(@Body() dto: CreateProspectDto, @Req() request: AuthenticatedRequest) {
    return this.crmService.create(dto, request.user.idUsuario);
  }

  @Get('prospects')
  findAll() {
    return this.crmService.findAll();
  }

  @Get('prospects/:id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.crmService.findOne(id);
  }

  @Patch('prospects/:id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateProspectDto,
  ) {
    return this.crmService.update(id, dto);
  }

  @Post('prospects/:id/products')
  addProduct(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ProspectProductDto,
  ) {
    return this.crmService.addProduct(id, dto);
  }

  @Delete('prospects/:id/products/:relationId')
  removeProduct(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('relationId', ParseUUIDPipe) relationId: string,
  ) {
    return this.crmService.removeProduct(id, relationId);
  }

  @Post('prospects/:id/interactions')
  createInteraction(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateInteractionDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.crmService.createInteraction(id, request.user.idUsuario, dto);
  }

  @Get('prospects/:id/interactions')
  findInteractions(@Param('id', ParseUUIDPipe) id: string) {
    return this.crmService.findInteractions(id);
  }

  @Post('prospects/:id/follow-ups')
  createFollowUp(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateFollowUpDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.crmService.createFollowUp(id, request.user.idUsuario, dto);
  }

  @Get('prospects/:id/follow-ups')
  findFollowUps(@Param('id', ParseUUIDPipe) id: string) {
    return this.crmService.findFollowUps(id);
  }

  @Patch('prospects/:id/follow-ups/:followUpId')
  updateFollowUp(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('followUpId', ParseUUIDPipe) followUpId: string,
    @Body() dto: UpdateFollowUpDto,
  ) {
    return this.crmService.updateFollowUp(id, followUpId, dto);
  }
}
