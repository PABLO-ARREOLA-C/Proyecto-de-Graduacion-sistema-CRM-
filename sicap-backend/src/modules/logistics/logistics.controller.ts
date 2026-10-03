import {
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
import type { Request } from 'express';

import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';

import { AddOrderToRouteDto } from './dto/add-order-to-route.dto';
import { CreateDeliveryDto } from './dto/create-delivery.dto';
import { CreateDeliveryIncidentDto } from './dto/create-delivery-incident.dto';
import { CreateRouteDto } from './dto/create-route.dto';
import { UpdateDeliveryStatusDto } from './dto/update-delivery-status.dto';
import { UpdateRouteDetailDto } from './dto/update-route-detail.dto';
import { UpdateRouteDto } from './dto/update-route.dto';

import { LogisticsService } from './logistics.service';

type AuthenticatedRequest = Request & {
  user: {
    idUsuario: string;
    correo: string;
    nombre: string;
    idRol: number;
    rol: string;
  };
};

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('Administrador', 'Repartidor')
@Controller('logistics')
export class LogisticsController {
  constructor(private readonly logisticsService: LogisticsService) {}

  // ==========================================================
  // RUTAS
  // ==========================================================

  @Post('routes')
  createRoute(@Body() dto: CreateRouteDto) {
    return this.logisticsService.create(dto);
  }

  @Get('routes')
  findRoutes() {
    return this.logisticsService.findAll();
  }

  @Get('routes/:id')
  findRoute(@Param('id', ParseUUIDPipe) id: string) {
    return this.logisticsService.findOne(id);
  }

  @Patch('routes/:id')
  updateRoute(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateRouteDto,
  ) {
    return this.logisticsService.update(id, dto);
  }

  // ==========================================================
  // DETALLE DE RUTA
  // ==========================================================

  @Post('routes/:id/orders')
  addOrder(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AddOrderToRouteDto,
  ) {
    return this.logisticsService.addOrder(id, dto);
  }

  @Patch('routes/:id/details/:detailId')
  updateDetail(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('detailId', ParseUUIDPipe) detailId: string,
    @Body() dto: UpdateRouteDetailDto,
  ) {
    return this.logisticsService.updateDetail(id, detailId, dto);
  }

  @Delete('routes/:id/details/:detailId')
  removeOrder(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('detailId', ParseUUIDPipe) detailId: string,
  ) {
    return this.logisticsService.removeOrder(id, detailId);
  }

  // ==========================================================
  // CICLO DE VIDA DE LA RUTA
  // ==========================================================

  @Post('routes/:id/start')
  startRoute(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.logisticsService.startRoute(id, request.user.idUsuario);
  }

  @Post('routes/:id/complete')
  completeRoute(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.logisticsService.completeRoute(id, request.user.idUsuario);
  }

  // ==========================================================
  // ENTREGAS
  // ==========================================================

  @Post('routes/:id/details/:detailId/deliveries')
  createDelivery(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('detailId', ParseUUIDPipe) detailId: string,
    @Req() request: AuthenticatedRequest,
    @Body() dto: CreateDeliveryDto,
  ) {
    return this.logisticsService.createDelivery(
      id,
      detailId,
      request.user.idUsuario,
      dto,
    );
  }

  @Patch('deliveries/:deliveryId/status')
  updateDeliveryStatus(
    @Param('deliveryId', ParseUUIDPipe) deliveryId: string,
    @Req() request: AuthenticatedRequest,
    @Body() dto: UpdateDeliveryStatusDto,
  ) {
    return this.logisticsService.updateDeliveryStatus(
      deliveryId,
      request.user.idUsuario,
      dto,
    );
  }

  // ==========================================================
  // INCIDENCIAS
  // ==========================================================

  @Post('deliveries/:deliveryId/incidents')
  createIncident(
    @Param('deliveryId', ParseUUIDPipe) deliveryId: string,
    @Req() request: AuthenticatedRequest,
    @Body() dto: CreateDeliveryIncidentDto,
  ) {
    return this.logisticsService.createIncident(
      deliveryId,
      request.user.idUsuario,
      dto,
    );
  }
}
