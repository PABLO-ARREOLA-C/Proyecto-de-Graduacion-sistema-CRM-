import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { Prisma } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';

import { CreateReceivableDto } from './dto/create-receivable.dto';

import { CreatePaymentDto } from './dto/create-payment.dto';

import { CreateExpenseCategoryDto } from './dto/create-expense-category.dto';

import { UpdateExpenseCategoryDto } from './dto/update-expense-category.dto';

import { CreateFinancialMovementDto } from './dto/create-financial-movement.dto';

import { FinancialSummaryQueryDto } from './dto/financial-summary-query.dto';

import { OrderPaymentStatusQueryDto } from './dto/order-payment-status-query.dto';

// ============================================================

// INCLUDE DE CUENTAS POR COBRAR

// ============================================================

const receivableInclude = {
  pedido: {
    include: {
      cliente: true,

      detalles: {
        include: {
          producto: true,
        },
      },

      pagos: {
        orderBy: {
          fechaPago: 'asc',
        },

        include: {
          usuario: {
            select: {
              idUsuario: true,

              nombre: true,

              correo: true,
            },
          },
        },
      },
    },
  },
} satisfies Prisma.CuentaPorCobrarInclude;

// ============================================================

// TIPO GENERADO AUTOMÁTICAMENTE POR PRISMA

// ============================================================

type CuentaPorCobrarCompleta = Prisma.CuentaPorCobrarGetPayload<{
  include: typeof receivableInclude;
}>;

type EstadoCalculadoCuenta = 'PENDIENTE' | 'VENCIDA' | 'PAGADA';

@Injectable()
export class FinancesService {
  constructor(private readonly prisma: PrismaService) {}

  // ============================================================

  // UTILIDADES

  // ============================================================

  private decimalToNumber(value: Prisma.Decimal | number): number {
    return Number(value);
  }

  private calculatePaidAmount(pagos: Array<{ monto: Prisma.Decimal }>): number {
    return pagos.reduce(
      (total, pago) => total + this.decimalToNumber(pago.monto),

      0,
    );
  }

  private startOfToday(): Date {
    const hoy = new Date();

    hoy.setHours(0, 0, 0, 0);

    return hoy;
  }

  private normalizeDate(date: Date): Date {
    const normalizedDate = new Date(date);

    normalizedDate.setHours(0, 0, 0, 0);

    return normalizedDate;
  }

  private parseGuatemalaDate(value: string, endOfDay = false): Date {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);

    if (!match) {
      throw new BadRequestException(
        'La fecha debe tener el formato YYYY-MM-DD',
      );
    }

    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);

    const fechaBase = new Date(Date.UTC(year, month - 1, day));

    if (
      fechaBase.getUTCFullYear() !== year ||
      fechaBase.getUTCMonth() !== month - 1 ||
      fechaBase.getUTCDate() !== day
    ) {
      throw new BadRequestException('La fecha no es válida');
    }

    // Guatemala utiliza UTC-6 durante todo el año.
    // 00:00:00 en Guatemala = 06:00:00 UTC.
    if (!endOfDay) {
      return new Date(Date.UTC(year, month - 1, day, 6, 0, 0, 0));
    }

    // 23:59:59.999 en Guatemala = 05:59:59.999 UTC del día siguiente.
    return new Date(Date.UTC(year, month - 1, day + 1, 5, 59, 59, 999));
  }

  private calculateReceivableStatus(
    cuenta: CuentaPorCobrarCompleta,

    saldoPendiente: number,
  ): EstadoCalculadoCuenta {
    if (saldoPendiente <= 0 || cuenta.estado === 'PAGADA') {
      return 'PAGADA';
    }

    const hoy = this.startOfToday();

    const fechaVencimiento = this.normalizeDate(cuenta.fechaVencimiento);

    if (fechaVencimiento < hoy) {
      return 'VENCIDA';
    }

    return 'PENDIENTE';
  }

  private buildReceivableResponse(cuenta: CuentaPorCobrarCompleta) {
    const pagos = cuenta.pedido.pagos;

    const montoOriginal = this.decimalToNumber(cuenta.montoOriginal);

    const totalPagado = this.calculatePaidAmount(pagos);

    const saldoPendiente = Math.max(
      0,

      Number((montoOriginal - totalPagado).toFixed(2)),
    );

    const estadoCalculado = this.calculateReceivableStatus(
      cuenta,

      saldoPendiente,
    );

    return {
      ...cuenta,

      montoOriginal,

      totalPagado: Number(totalPagado.toFixed(2)),

      saldoPendiente,

      estadoCalculado,
    };
  }

  // ============================================================

  // CUENTAS POR COBRAR

  // ============================================================

  async createReceivable(dto: CreateReceivableDto, idUsuario: string) {
    const usuario = await this.prisma.usuario.findUnique({
      where: {
        idUsuario,
      },

      include: {
        rol: true,
      },
    });

    if (!usuario || !usuario.estado) {
      throw new BadRequestException(
        'El usuario que registra la operación no está activo',
      );
    }

    const pedido = await this.prisma.pedido.findUnique({
      where: {
        idPedido: dto.idPedido,
      },

      include: {
        cuentaPorCobrar: true,
      },
    });

    if (!pedido) {
      throw new NotFoundException('Pedido no encontrado');
    }

    if (pedido.tipoVenta !== 'CREDITO') {
      throw new BadRequestException(
        'Solo los pedidos a crédito pueden generar una cuenta por cobrar',
      );
    }

    if (pedido.estado === 'CANCELADO') {
      throw new BadRequestException(
        'No se puede generar una cuenta por cobrar para un pedido cancelado',
      );
    }

    if (pedido.cuentaPorCobrar) {
      throw new ConflictException('El pedido ya tiene una cuenta por cobrar');
    }

    const fechaVencimiento = new Date(dto.fechaVencimiento);

    if (Number.isNaN(fechaVencimiento.getTime())) {
      throw new BadRequestException('La fecha de vencimiento no es válida');
    }

    const hoy = this.startOfToday();

    const vencimiento = this.normalizeDate(fechaVencimiento);

    if (vencimiento < hoy) {
      throw new BadRequestException(
        'La fecha de vencimiento no puede ser anterior a la fecha actual',
      );
    }

    const cuenta = await this.prisma.cuentaPorCobrar.create({
      data: {
        idPedido: pedido.idPedido,

        montoOriginal: pedido.total,

        fechaVencimiento,

        estado: 'PENDIENTE',
      },

      include: receivableInclude,
    });

    return this.buildReceivableResponse(cuenta);
  }

  async findAllReceivables() {
    const cuentas = await this.prisma.cuentaPorCobrar.findMany({
      include: receivableInclude,

      orderBy: [
        {
          fechaVencimiento: 'asc',
        },

        {
          fechaCreacion: 'desc',
        },
      ],
    });

    return cuentas.map((cuenta) => this.buildReceivableResponse(cuenta));
  }

  async findOverdueReceivables() {
    const hoy = this.startOfToday();

    const cuentas = await this.prisma.cuentaPorCobrar.findMany({
      where: {
        estado: {
          not: 'PAGADA',
        },

        fechaVencimiento: {
          lt: hoy,
        },
      },

      include: receivableInclude,

      orderBy: [
        {
          fechaVencimiento: 'asc',
        },

        {
          fechaCreacion: 'asc',
        },
      ],
    });

    return cuentas

      .map((cuenta) => this.buildReceivableResponse(cuenta))

      .filter(
        (cuenta) =>
          cuenta.saldoPendiente > 0 && cuenta.estadoCalculado === 'VENCIDA',
      );
  }

  async findOneReceivable(idCuenta: string) {
    const cuenta = await this.prisma.cuentaPorCobrar.findUnique({
      where: {
        idCuenta,
      },

      include: receivableInclude,
    });

    if (!cuenta) {
      throw new NotFoundException('Cuenta por cobrar no encontrada');
    }

    return this.buildReceivableResponse(cuenta);
  }

  // ============================================================

  // PAGOS DE CUENTAS POR COBRAR

  // ============================================================

  async createPayment(
    idCuenta: string,

    dto: CreatePaymentDto,

    idUsuario: string,
  ) {
    const cuenta = await this.prisma.cuentaPorCobrar.findUnique({
      where: {
        idCuenta,
      },

      include: {
        pedido: {
          include: {
            pagos: true,
          },
        },
      },
    });

    if (!cuenta) {
      throw new NotFoundException('Cuenta por cobrar no encontrada');
    }

    if (cuenta.estado === 'PAGADA') {
      throw new BadRequestException(
        'La cuenta por cobrar ya se encuentra pagada',
      );
    }

    if (cuenta.pedido.estado === 'CANCELADO') {
      throw new BadRequestException(
        'No se pueden registrar pagos para un pedido cancelado',
      );
    }

    const usuario = await this.prisma.usuario.findUnique({
      where: {
        idUsuario,
      },
    });

    if (!usuario || !usuario.estado) {
      throw new BadRequestException(
        'El usuario que registra el pago no está activo',
      );
    }

    const montoOriginal = this.decimalToNumber(cuenta.montoOriginal);

    const totalPagado = this.calculatePaidAmount(cuenta.pedido.pagos);

    const saldoPendiente = Number((montoOriginal - totalPagado).toFixed(2));

    const montoPago = Number(dto.monto.toFixed(2));

    if (montoPago <= 0) {
      throw new BadRequestException(
        'El monto del pago debe ser mayor que cero',
      );
    }

    if (saldoPendiente <= 0) {
      throw new BadRequestException(
        'La cuenta por cobrar no tiene saldo pendiente',
      );
    }

    if (montoPago > saldoPendiente) {
      throw new BadRequestException(
        `El pago excede el saldo pendiente de Q${saldoPendiente.toFixed(2)}`,
      );
    }

    const nuevoSaldo = Number((saldoPendiente - montoPago).toFixed(2));

    const resultado = await this.prisma.$transaction(async (tx) => {
      const pago = await tx.pago.create({
        data: {
          idPedido: cuenta.idPedido,

          registradoPor: idUsuario,

          monto: new Prisma.Decimal(montoPago),

          observaciones: dto.observaciones?.trim() || null,
        },

        include: {
          usuario: {
            select: {
              idUsuario: true,

              nombre: true,

              correo: true,
            },
          },
        },
      });

      const movimiento = await tx.movimientoFinanciero.create({
        data: {
          tipo: 'INGRESO',

          idCategoria: null,

          monto: new Prisma.Decimal(montoPago),

          concepto: `Pago de ${cuenta.pedido.numeroPedido}`,

          descripcion:
            dto.observaciones?.trim() ||
            `Pago en efectivo registrado para el pedido ${cuenta.pedido.numeroPedido}`,

          registradoPor: idUsuario,
        },
      });

      const cuentaActualizada = await tx.cuentaPorCobrar.update({
        where: {
          idCuenta,
        },

        data: {
          estado: nuevoSaldo === 0 ? 'PAGADA' : 'PENDIENTE',
        },
      });

      return {
        pago,

        movimiento,

        cuenta: cuentaActualizada,

        totalPagado: Number((totalPagado + montoPago).toFixed(2)),

        saldoPendiente: nuevoSaldo,
      };
    });

    return resultado;
  }

  // ============================================================

  // PAGOS DE PEDIDOS AL CONTADO

  // ============================================================

  async createCashPayment(
    idPedido: string,

    dto: CreatePaymentDto,

    idUsuario: string,
  ) {
    const pedido = await this.prisma.pedido.findUnique({
      where: {
        idPedido,
      },

      include: {
        pagos: true,

        cuentaPorCobrar: true,
      },
    });

    if (!pedido) {
      throw new NotFoundException('Pedido no encontrado');
    }

    if (pedido.tipoVenta !== 'CONTADO') {
      throw new BadRequestException(
        'Este endpoint solo permite registrar pagos de pedidos al contado',
      );
    }

    if (pedido.estado === 'CANCELADO') {
      throw new BadRequestException(
        'No se pueden registrar pagos para un pedido cancelado',
      );
    }

    if (pedido.cuentaPorCobrar) {
      throw new BadRequestException(
        'Un pedido al contado no debe tener una cuenta por cobrar',
      );
    }

    const usuario = await this.prisma.usuario.findUnique({
      where: {
        idUsuario,
      },
    });

    if (!usuario || !usuario.estado) {
      throw new BadRequestException(
        'El usuario que registra el pago no está activo',
      );
    }

    const totalPedido = this.decimalToNumber(pedido.total);

    const totalPagado = this.calculatePaidAmount(pedido.pagos);

    const saldoPendiente = Number((totalPedido - totalPagado).toFixed(2));

    const montoPago = Number(dto.monto.toFixed(2));

    if (montoPago <= 0) {
      throw new BadRequestException(
        'El monto del pago debe ser mayor que cero',
      );
    }

    if (saldoPendiente <= 0) {
      throw new BadRequestException(
        'El pedido al contado ya se encuentra pagado',
      );
    }

    if (montoPago > saldoPendiente) {
      throw new BadRequestException(
        `El pago excede el saldo pendiente de Q${saldoPendiente.toFixed(2)}`,
      );
    }

    const nuevoTotalPagado = Number((totalPagado + montoPago).toFixed(2));

    const nuevoSaldo = Number((totalPedido - nuevoTotalPagado).toFixed(2));

    return this.prisma.$transaction(async (tx) => {
      const pago = await tx.pago.create({
        data: {
          idPedido: pedido.idPedido,

          registradoPor: idUsuario,

          monto: new Prisma.Decimal(montoPago),

          observaciones: dto.observaciones?.trim() || null,
        },

        include: {
          usuario: {
            select: {
              idUsuario: true,

              nombre: true,

              correo: true,
            },
          },
        },
      });

      const movimiento = await tx.movimientoFinanciero.create({
        data: {
          tipo: 'INGRESO',

          idCategoria: null,

          monto: new Prisma.Decimal(montoPago),

          concepto: `Pago de ${pedido.numeroPedido}`,

          descripcion:
            dto.observaciones?.trim() ||
            `Pago en efectivo registrado para el pedido ${pedido.numeroPedido}`,

          registradoPor: idUsuario,
        },
      });

      return {
        pago,

        movimiento,

        pedido: {
          idPedido: pedido.idPedido,

          numeroPedido: pedido.numeroPedido,

          tipoVenta: pedido.tipoVenta,

          estado: pedido.estado,

          total: totalPedido,
        },

        totalPagado: nuevoTotalPagado,

        saldoPendiente: nuevoSaldo,

        pagado: nuevoSaldo === 0,
      };
    });
  }

  // ============================================================

  // CONSULTA DE PAGOS POR PEDIDO

  // ============================================================

  async findPaymentsByOrder(idPedido: string) {
    const pedido = await this.prisma.pedido.findUnique({
      where: {
        idPedido,
      },

      select: {
        idPedido: true,

        numeroPedido: true,

        total: true,
      },
    });

    if (!pedido) {
      throw new NotFoundException('Pedido no encontrado');
    }

    const pagos = await this.prisma.pago.findMany({
      where: {
        idPedido,
      },

      include: {
        usuario: {
          select: {
            idUsuario: true,

            nombre: true,

            correo: true,
          },
        },
      },

      orderBy: {
        fechaPago: 'asc',
      },
    });

    const totalPagado = pagos.reduce(
      (total, pago) => total + this.decimalToNumber(pago.monto),

      0,
    );

    return {
      pedido: {
        ...pedido,

        total: this.decimalToNumber(pedido.total),
      },

      totalPagado: Number(totalPagado.toFixed(2)),

      pagos,
    };
  }

  // ============================================================

  // CATEGORÍAS DE EGRESO

  // ============================================================

  async createExpenseCategory(dto: CreateExpenseCategoryDto) {
    const nombre = dto.nombre.trim();

    const existente = await this.prisma.categoriaEgreso.findFirst({
      where: {
        nombre: {
          equals: nombre,

          mode: 'insensitive',
        },
      },
    });

    if (existente) {
      throw new ConflictException(
        'Ya existe una categoría de egreso con ese nombre',
      );
    }

    return this.prisma.categoriaEgreso.create({
      data: {
        nombre,

        descripcion: dto.descripcion?.trim() || null,

        estado: true,
      },
    });
  }

  async findAllExpenseCategories() {
    return this.prisma.categoriaEgreso.findMany({
      orderBy: {
        nombre: 'asc',
      },
    });
  }

  async updateExpenseCategory(
    idCategoria: number,

    dto: UpdateExpenseCategoryDto,
  ) {
    const categoria = await this.prisma.categoriaEgreso.findUnique({
      where: {
        idCategoria,
      },
    });

    if (!categoria) {
      throw new NotFoundException('Categoría de egreso no encontrada');
    }

    if (dto.nombre !== undefined) {
      const nombre = dto.nombre.trim();

      const duplicada = await this.prisma.categoriaEgreso.findFirst({
        where: {
          nombre: {
            equals: nombre,

            mode: 'insensitive',
          },

          NOT: {
            idCategoria,
          },
        },
      });

      if (duplicada) {
        throw new ConflictException(
          'Ya existe otra categoría de egreso con ese nombre',
        );
      }
    }

    return this.prisma.categoriaEgreso.update({
      where: {
        idCategoria,
      },

      data: {
        ...(dto.nombre !== undefined && {
          nombre: dto.nombre.trim(),
        }),

        ...(dto.descripcion !== undefined && {
          descripcion: dto.descripcion.trim() || null,
        }),

        ...(dto.estado !== undefined && {
          estado: dto.estado,
        }),
      },
    });
  }

  // ============================================================

  // ESTADO DE PAGO DE UN PEDIDO

  // ============================================================

  async getOrderPaymentStatus(idPedido: string) {
    const pedido = await this.prisma.pedido.findUnique({
      where: {
        idPedido,
      },

      include: {
        pagos: {
          select: {
            monto: true,

            fechaPago: true,
          },

          orderBy: {
            fechaPago: 'asc',
          },
        },

        cuentaPorCobrar: true,
      },
    });

    if (!pedido) {
      throw new NotFoundException('Pedido no encontrado');
    }

    const totalPedido = this.decimalToNumber(pedido.total);

    const totalPagado = this.calculatePaidAmount(pedido.pagos);

    const saldoPendiente = Math.max(
      0,

      Number((totalPedido - totalPagado).toFixed(2)),
    );

    let estadoPago: 'PENDIENTE' | 'PARCIAL' | 'PAGADO';

    if (saldoPendiente === 0) {
      estadoPago = 'PAGADO';
    } else if (totalPagado > 0) {
      estadoPago = 'PARCIAL';
    } else {
      estadoPago = 'PENDIENTE';
    }

    let estadoCuentaPorCobrar: 'PENDIENTE' | 'VENCIDA' | 'PAGADA' | null = null;

    if (pedido.cuentaPorCobrar) {
      if (saldoPendiente === 0 || pedido.cuentaPorCobrar.estado === 'PAGADA') {
        estadoCuentaPorCobrar = 'PAGADA';
      } else {
        const hoy = this.startOfToday();

        const fechaVencimiento = this.normalizeDate(
          pedido.cuentaPorCobrar.fechaVencimiento,
        );

        estadoCuentaPorCobrar =
          fechaVencimiento < hoy ? 'VENCIDA' : 'PENDIENTE';
      }
    }

    return {
      pedido: {
        idPedido: pedido.idPedido,

        numeroPedido: pedido.numeroPedido,

        tipoVenta: pedido.tipoVenta,

        estado: pedido.estado,

        total: totalPedido,
      },

      totalPagado: Number(totalPagado.toFixed(2)),

      saldoPendiente,

      estadoPago,

      cuentaPorCobrar: pedido.cuentaPorCobrar
        ? {
            idCuenta: pedido.cuentaPorCobrar.idCuenta,

            fechaVencimiento: pedido.cuentaPorCobrar.fechaVencimiento,

            estado: pedido.cuentaPorCobrar.estado,

            estadoCalculado: estadoCuentaPorCobrar,
          }
        : null,
    };
  }

  // ============================================================

  // ESTADO FINANCIERO DE TODOS LOS PEDIDOS

  // ============================================================

  async findOrdersPaymentStatus(query: OrderPaymentStatusQueryDto) {
    const pedidos = await this.prisma.pedido.findMany({
      where: {
        ...(query.estadoPedido
          ? {
              estado: query.estadoPedido,
            }
          : {}),

        ...(query.tipoVenta
          ? {
              tipoVenta: query.tipoVenta,
            }
          : {}),
      },

      include: {
        pagos: {
          select: {
            monto: true,
          },
        },

        cuentaPorCobrar: {
          select: {
            idCuenta: true,

            fechaVencimiento: true,

            estado: true,
          },
        },
      },

      orderBy: {
        fechaPedido: 'desc',
      },
    });

    const resultados = pedidos.map((pedido) => {
      const total = this.decimalToNumber(pedido.total);

      const totalPagado = this.calculatePaidAmount(pedido.pagos);

      const saldoPendiente = Math.max(
        0,

        Number((total - totalPagado).toFixed(2)),
      );

      let estadoPago: 'PENDIENTE' | 'PARCIAL' | 'PAGADO';

      if (saldoPendiente === 0) {
        estadoPago = 'PAGADO';
      } else if (totalPagado > 0) {
        estadoPago = 'PARCIAL';
      } else {
        estadoPago = 'PENDIENTE';
      }

      let estadoCuentaPorCobrar: 'PENDIENTE' | 'VENCIDA' | 'PAGADA' | null =
        null;

      if (pedido.cuentaPorCobrar) {
        if (
          saldoPendiente === 0 ||
          pedido.cuentaPorCobrar.estado === 'PAGADA'
        ) {
          estadoCuentaPorCobrar = 'PAGADA';
        } else {
          const hoy = this.startOfToday();

          const fechaVencimiento = this.normalizeDate(
            pedido.cuentaPorCobrar.fechaVencimiento,
          );

          estadoCuentaPorCobrar =
            fechaVencimiento < hoy ? 'VENCIDA' : 'PENDIENTE';
        }
      }

      return {
        idPedido: pedido.idPedido,

        numeroPedido: pedido.numeroPedido,

        fechaPedido: pedido.fechaPedido,

        tipoVenta: pedido.tipoVenta,

        estadoPedido: pedido.estado,

        total,

        totalPagado: Number(totalPagado.toFixed(2)),

        saldoPendiente,

        estadoPago,

        cuentaPorCobrar: pedido.cuentaPorCobrar
          ? {
              idCuenta: pedido.cuentaPorCobrar.idCuenta,

              fechaVencimiento: pedido.cuentaPorCobrar.fechaVencimiento,

              estado: pedido.cuentaPorCobrar.estado,

              estadoCalculado: estadoCuentaPorCobrar,
            }
          : null,
      };
    });

    const pedidosFiltrados = query.estadoPago
      ? resultados.filter(
          (resultado) => resultado.estadoPago === query.estadoPago,
        )
      : resultados;

    const resumen = pedidosFiltrados.reduce(
      (acumulador, pedido) => {
        acumulador.totalPedidos += pedido.total;

        acumulador.totalPagado += pedido.totalPagado;

        acumulador.saldoPendiente += pedido.saldoPendiente;

        return acumulador;
      },

      {
        cantidadPedidos: 0,

        totalPedidos: 0,

        totalPagado: 0,

        saldoPendiente: 0,
      },
    );

    resumen.cantidadPedidos = pedidosFiltrados.length;

    resumen.totalPedidos = Number(resumen.totalPedidos.toFixed(2));

    resumen.totalPagado = Number(resumen.totalPagado.toFixed(2));

    resumen.saldoPendiente = Number(resumen.saldoPendiente.toFixed(2));

    return {
      filtros: {
        estadoPedido: query.estadoPedido ?? null,

        estadoPago: query.estadoPago ?? null,

        tipoVenta: query.tipoVenta ?? null,
      },

      resumen,

      pedidos: pedidosFiltrados,
    };
  }

  // ============================================================

  // EGRESOS

  // ============================================================

  async createExpense(dto: CreateFinancialMovementDto, idUsuario: string) {
    const usuario = await this.prisma.usuario.findUnique({
      where: {
        idUsuario,
      },
    });

    if (!usuario || !usuario.estado) {
      throw new BadRequestException(
        'El usuario que registra el egreso no está activo',
      );
    }

    const categoria = await this.prisma.categoriaEgreso.findUnique({
      where: {
        idCategoria: dto.idCategoria,
      },
    });

    if (!categoria) {
      throw new NotFoundException('Categoría de egreso no encontrada');
    }

    if (!categoria.estado) {
      throw new BadRequestException('La categoría de egreso está inactiva');
    }

    return this.prisma.movimientoFinanciero.create({
      data: {
        tipo: 'EGRESO',

        idCategoria: categoria.idCategoria,

        monto: new Prisma.Decimal(dto.monto),

        concepto: dto.concepto.trim(),

        descripcion: dto.descripcion?.trim() || null,

        registradoPor: idUsuario,
      },

      include: {
        categoria: true,

        usuario: {
          select: {
            idUsuario: true,

            nombre: true,

            correo: true,
          },
        },
      },
    });
  }

  // ============================================================

  // MOVIMIENTOS FINANCIEROS

  // ============================================================

  async findAllMovements() {
    return this.prisma.movimientoFinanciero.findMany({
      include: {
        categoria: true,

        usuario: {
          select: {
            idUsuario: true,

            nombre: true,

            correo: true,
          },
        },
      },

      orderBy: {
        fechaMovimiento: 'desc',
      },
    });
  }

  // ============================================================

  // RESUMEN FINANCIERO

  // ============================================================

  async getSummary(query: FinancialSummaryQueryDto) {
    let fechaInicio: Date | undefined;
    let fechaFin: Date | undefined;

    if (query.fechaInicio) {
      fechaInicio = this.parseGuatemalaDate(query.fechaInicio);
    }

    if (query.fechaFin) {
      fechaFin = this.parseGuatemalaDate(query.fechaFin, true);
    }

    if (fechaInicio && fechaFin && fechaInicio > fechaFin) {
      throw new BadRequestException(
        'La fecha de inicio no puede ser posterior a la fecha final',
      );
    }

    const filtroFecha: Prisma.DateTimeFilter = {};

    if (fechaInicio) {
      filtroFecha.gte = fechaInicio;
    }

    if (fechaFin) {
      filtroFecha.lte = fechaFin;
    }

    const [movimientos, cuentas] = await Promise.all([
      this.prisma.movimientoFinanciero.findMany({
        where:
          fechaInicio || fechaFin
            ? {
                fechaMovimiento: filtroFecha,
              }
            : undefined,

        select: {
          tipo: true,

          monto: true,
        },
      }),

      this.prisma.cuentaPorCobrar.findMany({
        include: {
          pedido: {
            include: {
              pagos: {
                select: {
                  monto: true,
                },
              },
            },
          },
        },
      }),
    ]);

    let ingresos = 0;

    let egresos = 0;

    for (const movimiento of movimientos) {
      const monto = this.decimalToNumber(movimiento.monto);

      if (movimiento.tipo === 'INGRESO') {
        ingresos += monto;
      }

      if (movimiento.tipo === 'EGRESO') {
        egresos += monto;
      }
    }

    let cuentasPorCobrar = 0;

    let cuentasVencidas = 0;

    let cantidadCuentasVencidas = 0;

    const hoy = this.startOfToday();

    for (const cuenta of cuentas) {
      const montoOriginal = this.decimalToNumber(cuenta.montoOriginal);

      const totalPagado = this.calculatePaidAmount(cuenta.pedido.pagos);

      const saldoPendiente = Math.max(
        0,

        Number((montoOriginal - totalPagado).toFixed(2)),
      );

      cuentasPorCobrar += saldoPendiente;

      const fechaVencimiento = this.normalizeDate(cuenta.fechaVencimiento);

      if (
        saldoPendiente > 0 &&
        cuenta.estado !== 'PAGADA' &&
        fechaVencimiento < hoy
      ) {
        cuentasVencidas += saldoPendiente;

        cantidadCuentasVencidas++;
      }
    }

    return {
      periodo: {
        fechaInicio: query.fechaInicio ?? null,

        fechaFin: query.fechaFin ?? null,
      },

      ingresos: Number(ingresos.toFixed(2)),

      egresos: Number(egresos.toFixed(2)),

      balance: Number((ingresos - egresos).toFixed(2)),

      cuentasPorCobrar: Number(cuentasPorCobrar.toFixed(2)),

      cuentasVencidas: Number(cuentasVencidas.toFixed(2)),

      cantidadCuentasVencidas,
    };
  }
}
