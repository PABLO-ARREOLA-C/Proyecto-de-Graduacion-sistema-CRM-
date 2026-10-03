import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';

@Injectable()
export class OrdersService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateOrderDto, registradoPor: string) {
    const cliente = await this.prisma.cliente.findUnique({
      where: { idCliente: dto.idCliente },
    });

    if (!cliente || !cliente.estado) {
      throw new BadRequestException(
        'El cliente no existe o se encuentra inactivo',
      );
    }

    const direccion = await this.prisma.direccionCliente.findFirst({
      where: {
        idDireccion: dto.idDireccion,
        idCliente: dto.idCliente,
        estado: true,
      },
    });

    if (!direccion) {
      throw new BadRequestException(
        'La direcciÃ³n no pertenece al cliente o se encuentra inactiva',
      );
    }

    const idsProductos = dto.detalles.map((detalle) => detalle.idProducto);

    if (new Set(idsProductos).size !== idsProductos.length) {
      throw new BadRequestException(
        'No se puede repetir un producto dentro del mismo pedido',
      );
    }

    const productos = await this.prisma.producto.findMany({
      where: {
        idProducto: {
          in: idsProductos,
        },
        estado: true,
      },
    });

    if (productos.length !== idsProductos.length) {
      throw new BadRequestException(
        'Uno o mÃ¡s productos no existen o se encuentran inactivos',
      );
    }

    const productosMap = new Map(
      productos.map((producto) => [producto.idProducto, producto]),
    );

    let total = new Prisma.Decimal(0);

    const detalles = dto.detalles.map((detalle) => {
      const producto = productosMap.get(detalle.idProducto);

      if (!producto) {
        throw new BadRequestException('Producto no encontrado');
      }

      const subtotal = producto.precioActual.mul(detalle.cantidad);

      total = total.add(subtotal);

      return {
        idProducto: detalle.idProducto,
        cantidad: detalle.cantidad,
        precioUnitario: producto.precioActual,
      };
    });

    const numeroPedido = await this.generateOrderNumber();

    const fechaEntregaSolicitada = this.parseDate(dto.fechaEntregaSolicitada);

    return this.prisma.$transaction(async (tx) => {
      return tx.pedido.create({
        data: {
          numeroPedido,
          idCliente: dto.idCliente,
          idDireccion: dto.idDireccion,
          registradoPor,
          fechaEntregaSolicitada,
          tipoVenta: dto.tipoVenta,
          estado: 'PENDIENTE',
          total,
          observaciones: dto.observaciones?.trim(),

          detalles: {
            create: detalles,
          },

          historialEstados: {
            create: {
              cambiadoPor: registradoPor,
              estadoAnterior: null,
              estadoNuevo: 'PENDIENTE',
              observaciones: 'Pedido registrado',
            },
          },
        },
        include: this.orderInclude(),
      });
    });
  }

  async findAll() {
    return this.prisma.pedido.findMany({
      include: this.orderInclude(),
      orderBy: {
        fechaPedido: 'desc',
      },
    });
  }

  async findOne(idPedido: string) {
    const pedido = await this.prisma.pedido.findUnique({
      where: {
        idPedido,
      },
      include: this.orderInclude(),
    });

    if (!pedido) {
      throw new NotFoundException('Pedido no encontrado');
    }

    return pedido;
  }

  async update(idPedido: string, dto: UpdateOrderDto) {
    const pedido = await this.ensureOrderExists(idPedido);

    if (pedido.estado === 'ENTREGADO' || pedido.estado === 'CANCELADO') {
      throw new BadRequestException(
        'No se puede modificar un pedido entregado o cancelado',
      );
    }

    if (dto.idDireccion !== undefined) {
      const direccion = await this.prisma.direccionCliente.findFirst({
        where: {
          idDireccion: dto.idDireccion,
          idCliente: pedido.idCliente,
          estado: true,
        },
      });

      if (!direccion) {
        throw new BadRequestException(
          'La direcciÃ³n no pertenece al cliente o se encuentra inactiva',
        );
      }
    }

    const data: Prisma.PedidoUpdateInput = {};

    if (dto.idDireccion !== undefined) {
      data.direccion = {
        connect: {
          idDireccion: dto.idDireccion,
        },
      };
    }

    if (dto.fechaEntregaSolicitada !== undefined) {
      data.fechaEntregaSolicitada = this.parseDate(dto.fechaEntregaSolicitada);
    }

    if (dto.tipoVenta !== undefined) {
      data.tipoVenta = dto.tipoVenta;
    }

    if (dto.observaciones !== undefined) {
      data.observaciones = dto.observaciones.trim();
    }

    return this.prisma.pedido.update({
      where: {
        idPedido,
      },
      data,
      include: this.orderInclude(),
    });
  }

  async updateStatus(
    idPedido: string,
    dto: UpdateOrderStatusDto,
    cambiadoPor: string,
  ) {
    const pedido = await this.ensureOrderExists(idPedido);

    if (dto.estado === 'EN_RUTA' || dto.estado === 'ENTREGADO') {
      throw new BadRequestException(
        'Los estados EN_RUTA y ENTREGADO solo pueden ser gestionados por el módulo de logística',
      );
    }

    if (pedido.estado === dto.estado) {
      throw new BadRequestException(
        `El pedido ya se encuentra en estado ${dto.estado}`,
      );
    }

    if (pedido.estado === 'ENTREGADO' || pedido.estado === 'CANCELADO') {
      throw new BadRequestException(
        'No se puede cambiar el estado de un pedido finalizado',
      );
    }

    this.validateStatusTransition(pedido.estado, dto.estado);

    return this.prisma.$transaction(async (tx) => {
      await tx.historialEstadoPedido.create({
        data: {
          idPedido,
          cambiadoPor,
          estadoAnterior: pedido.estado,
          estadoNuevo: dto.estado,
          observaciones: dto.observaciones?.trim(),
        },
      });

      return tx.pedido.update({
        where: {
          idPedido,
        },
        data: {
          estado: dto.estado,
        },
        include: this.orderInclude(),
      });
    });
  }

  async findHistory(idPedido: string) {
    await this.ensureOrderExists(idPedido);

    return this.prisma.historialEstadoPedido.findMany({
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
        fechaHora: 'asc',
      },
    });
  }

  private async ensureOrderExists(idPedido: string) {
    const pedido = await this.prisma.pedido.findUnique({
      where: {
        idPedido,
      },
    });

    if (!pedido) {
      throw new NotFoundException('Pedido no encontrado');
    }

    return pedido;
  }

  private validateStatusTransition(estadoActual: string, estadoNuevo: string) {
    const transitions: Record<string, string[]> = {
      PENDIENTE: ['CONFIRMADO', 'CANCELADO'],
      CONFIRMADO: ['EN_RUTA', 'CANCELADO'],
      EN_RUTA: ['ENTREGADO', 'CANCELADO'],
      ENTREGADO: [],
      CANCELADO: [],
    };

    const permitidos = transitions[estadoActual];

    if (!permitidos?.includes(estadoNuevo)) {
      throw new BadRequestException(
        `No se permite cambiar el pedido de ${estadoActual} a ${estadoNuevo}`,
      );
    }
  }

  private async generateOrderNumber() {
    const year = new Date().getFullYear();

    const count = await this.prisma.pedido.count();

    return `PED-${year}-${String(count + 1).padStart(6, '0')}`;
  }

  private parseDate(value: string): Date {
    return new Date(`${value}T00:00:00.000Z`);
  }

  private orderInclude() {
    return {
      cliente: {
        select: {
          idCliente: true,
          nombre: true,
          telefono: true,
        },
      },
      direccion: true,
      usuarioRegistro: {
        select: {
          idUsuario: true,
          nombre: true,
          correo: true,
        },
      },
      detalles: {
        include: {
          producto: true,
        },
      },
      historialEstados: {
        orderBy: {
          fechaHora: 'asc' as const,
        },
      },
    };
  }
}
