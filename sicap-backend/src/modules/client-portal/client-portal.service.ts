import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SaveProfileDto } from './dto/save-profile.dto';

const profileSelect = {
  idCliente: true,
  nombre: true,
  telefono: true,
  correo: true,
  nit: true,
  estado: true,
  direcciones: {
    where: { estado: true },
    orderBy: { fechaCreacion: 'asc' as const },
    select: {
      idDireccion: true,
      direccion: true,
      referencia: true,
      zona: true,
    },
  },
} satisfies Prisma.ClienteSelect;

const orderSelect = {
  idPedido: true,
  numeroPedido: true,
  fechaPedido: true,
  fechaEntregaSolicitada: true,
  estado: true,
  tipoVenta: true,
  total: true,
  direccion: { select: { direccion: true, referencia: true, zona: true } },
  detalles: {
    select: {
      idDetalle: true,
      cantidad: true,
      precioUnitario: true,
      producto: { select: { nombre: true } },
    },
  },
  pagos: {
    orderBy: { fechaPago: 'asc' as const },
    select: { idPago: true, monto: true, fechaPago: true },
  },
  cuentaPorCobrar: { select: { fechaVencimiento: true } },
  historialEstados: {
    orderBy: { fechaHora: 'asc' as const },
    select: {
      idHistorial: true,
      estadoAnterior: true,
      estadoNuevo: true,
      fechaHora: true,
    },
  },
} satisfies Prisma.PedidoSelect;
type OwnOrder = Prisma.PedidoGetPayload<{ select: typeof orderSelect }>;

@Injectable()
export class ClientPortalService {
  constructor(private readonly prisma: PrismaService) {}

  async getProfile(idUsuario: string) {
    const profile = await this.prisma.cliente.findUnique({
      where: { idUsuario },
      select: profileSelect,
    });
    if (profile && !profile.estado)
      throw new ForbiddenException(
        'Tu ficha de cliente está inactiva. Contacta a la administración.',
      );
    return profile;
  }

  async requireProfile(idUsuario: string) {
    const profile = await this.getProfile(idUsuario);
    if (!profile)
      throw new NotFoundException(
        'Completa Mi información o solicita vincular tu ficha de cliente.',
      );
    return profile;
  }

  async saveProfile(idUsuario: string, dto: SaveProfileDto) {
    if (dto.nombre.trim().length < 2 || dto.telefono.trim().length < 8) {
      throw new BadRequestException('Revisa el nombre y el teléfono.');
    }
    try {
      return await this.prisma.$transaction(
        async (tx) => {
          const existing = await tx.cliente.findUnique({
            where: { idUsuario },
            select: { estado: true },
          });
          if (existing && !existing.estado)
            throw new ForbiddenException('Tu ficha de cliente está inactiva.');
          const account = await tx.usuario.findUnique({
            where: { idUsuario },
            select: { correo: true },
          });
          if (!account) throw new NotFoundException('Cuenta no encontrada');
          const data = {
            nombre: dto.nombre.trim(),
            telefono: dto.telefono.trim(),
            nit: dto.nit?.trim(),
          };
          return tx.cliente.upsert({
            where: { idUsuario },
            create: { ...data, idUsuario, correo: account.correo },
            update: data,
            select: profileSelect,
          });
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        ['P2002', 'P2034'].includes(error.code)
      ) {
        throw new ConflictException(
          'Tu ficha cambió. Actualiza antes de guardar nuevamente.',
        );
      }
      throw error;
    }
  }

  async getOrders(idUsuario: string) {
    const profile = await this.requireProfile(idUsuario);
    const orders = await this.prisma.pedido.findMany({
      where: { idCliente: profile.idCliente },
      select: orderSelect,
      orderBy: { fechaPedido: 'desc' },
    });
    return orders.map((order) => this.presentOrder(order));
  }

  async getOrder(idUsuario: string, idPedido: string) {
    const profile = await this.requireProfile(idUsuario);
    const order = await this.prisma.pedido.findFirst({
      where: { idPedido, idCliente: profile.idCliente },
      select: orderSelect,
    });
    if (!order) throw new NotFoundException('Pedido no encontrado');
    return this.presentOrder(order);
  }

  private presentOrder(order: OwnOrder) {
    const totalPagado = Number(
      order.pagos
        .reduce((sum, payment) => sum + Number(payment.monto), 0)
        .toFixed(2),
    );
    const saldoPendiente = Math.max(
      0,
      Number((Number(order.total) - totalPagado).toFixed(2)),
    );
    return {
      ...order,
      totalPagado,
      saldoPendiente,
      estadoPago:
        saldoPendiente === 0
          ? 'PAGADO'
          : totalPagado > 0
            ? 'PARCIAL'
            : 'PENDIENTE',
      historialEstados: order.historialEstados.map((item) => ({
        ...item,
        idHistorial: item.idHistorial.toString(),
      })),
    };
  }
}
