import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';

import { FinancesService } from './finances.service';

import { CreateReceivableDto } from './dto/create-receivable.dto';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { CreateExpenseCategoryDto } from './dto/create-expense-category.dto';
import { UpdateExpenseCategoryDto } from './dto/update-expense-category.dto';
import { CreateFinancialMovementDto } from './dto/create-financial-movement.dto';
import { FinancialSummaryQueryDto } from './dto/financial-summary-query.dto';
import { OrderPaymentStatusQueryDto } from './dto/order-payment-status-query.dto';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

interface AuthenticatedRequest {
  user: {
    idUsuario: string;
    correo: string;
    rol: string;
    idRol: number;
  };
}

@Controller('finances')
@UseGuards(JwtAuthGuard, RolesGuard)
export class FinancesController {
  constructor(private readonly financesService: FinancesService) {}

  // ============================================================
  // CUENTAS POR COBRAR
  // ============================================================

  @Post('receivables')
  @Roles('Administrador', 'Repartidor')
  createReceivable(
    @Body() dto: CreateReceivableDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.financesService.createReceivable(dto, req.user.idUsuario);
  }

  @Get('receivables')
  @Roles('Administrador', 'Repartidor')
  findAllReceivables() {
    return this.financesService.findAllReceivables();
  }

  // Esta ruta debe estar antes de receivables/:id para evitar
  // que "overdue" sea interpretado como un UUID.
  @Get('receivables/overdue')
  @Roles('Administrador', 'Repartidor')
  findOverdueReceivables() {
    return this.financesService.findOverdueReceivables();
  }

  @Get('receivables/:id')
  @Roles('Administrador', 'Repartidor')
  findOneReceivable(@Param('id', ParseUUIDPipe) id: string) {
    return this.financesService.findOneReceivable(id);
  }

  // ============================================================
  // PAGOS DE CUENTAS POR COBRAR
  // ============================================================

  @Post('receivables/:id/payments')
  @Roles('Administrador', 'Repartidor')
  createPayment(
    @Param('id', ParseUUIDPipe) idCuenta: string,
    @Body() dto: CreatePaymentDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.financesService.createPayment(
      idCuenta,
      dto,
      req.user.idUsuario,
    );
  }

  // ============================================================
  // ESTADO FINANCIERO DE TODOS LOS PEDIDOS
  // ============================================================

  // IMPORTANTE:
  // Esta ruta debe estar antes de orders/:idPedido/... para evitar
  // que "payment-status" sea interpretado como idPedido.
  @Get('orders/payment-status')
  @Roles('Administrador', 'Repartidor')
  findOrdersPaymentStatus(@Query() query: OrderPaymentStatusQueryDto) {
    return this.financesService.findOrdersPaymentStatus(query);
  }

  // ============================================================
  // PAGOS DE PEDIDOS AL CONTADO
  // ============================================================

  @Post('orders/:idPedido/payments')
  @Roles('Administrador', 'Repartidor')
  createCashPayment(
    @Param('idPedido', ParseUUIDPipe) idPedido: string,
    @Body() dto: CreatePaymentDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.financesService.createCashPayment(
      idPedido,
      dto,
      req.user.idUsuario,
    );
  }

  // ============================================================
  // CONSULTA DE PAGOS POR PEDIDO
  // ============================================================

  @Get('orders/:idPedido/payments')
  @Roles('Administrador', 'Repartidor')
  findPaymentsByOrder(@Param('idPedido', ParseUUIDPipe) idPedido: string) {
    return this.financesService.findPaymentsByOrder(idPedido);
  }

  // ============================================================
  // ESTADO DE PAGO DE UN PEDIDO
  // ============================================================

  @Get('orders/:idPedido/payment-status')
  @Roles('Administrador', 'Repartidor')
  getOrderPaymentStatus(@Param('idPedido', ParseUUIDPipe) idPedido: string) {
    return this.financesService.getOrderPaymentStatus(idPedido);
  }

  // ============================================================
  // CATEGORÍAS DE EGRESO
  // ============================================================

  @Post('expense-categories')
  @Roles('Administrador')
  createExpenseCategory(@Body() dto: CreateExpenseCategoryDto) {
    return this.financesService.createExpenseCategory(dto);
  }

  @Get('expense-categories')
  @Roles('Administrador', 'Repartidor')
  findAllExpenseCategories() {
    return this.financesService.findAllExpenseCategories();
  }

  @Patch('expense-categories/:id')
  @Roles('Administrador')
  updateExpenseCategory(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateExpenseCategoryDto,
  ) {
    return this.financesService.updateExpenseCategory(id, dto);
  }

  // ============================================================
  // EGRESOS
  // ============================================================

  @Post('expenses')
  @Roles('Administrador')
  createExpense(
    @Body() dto: CreateFinancialMovementDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.financesService.createExpense(dto, req.user.idUsuario);
  }

  // ============================================================
  // MOVIMIENTOS FINANCIEROS
  // ============================================================

  @Get('movements')
  @Roles('Administrador')
  findAllMovements() {
    return this.financesService.findAllMovements();
  }

  // ============================================================
  // RESUMEN FINANCIERO
  // ============================================================

  @Get('summary')
  @Roles('Administrador')
  getSummary(@Query() query: FinancialSummaryQueryDto) {
    return this.financesService.getSummary(query);
  }
}
