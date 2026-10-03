import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';

import { AddOrderToRouteDto } from './dto/add-order-to-route.dto';
import { CreateDeliveryDto } from './dto/create-delivery.dto';
import { CreateDeliveryIncidentDto } from './dto/create-delivery-incident.dto';
import { CreateRouteDto } from './dto/create-route.dto';
import { UpdateDeliveryStatusDto } from './dto/update-delivery-status.dto';
import { UpdateRouteDetailDto } from './dto/update-route-detail.dto';
import { UpdateRouteDto } from './dto/update-route.dto';

@Injectable()
export class LogisticsService {
  constructor(private readonly prisma: PrismaService) {}

  private readonly routeInclude = {
    repartidor: {
      select: {
        idUsuario: true,
        nombre: true,
        correo: true,
        estado: true,
        rol: {
          select: {
            idRol: true,
            nombre: true,
          },
        },
      },
    },
    detalles: {
      include: {
        pedido: {
          include: {
            cliente: true,
            direccion: true,
            detalles: {
              include: {
                producto: true,
              },
            },
          },
        },
      },
      orderBy: {
        ordenParada: 'asc' as const,
      },
    },
  } satisfies Prisma.RutaInclude;

  private parseDateOnly(fecha: string): Date {
    return new Date(`${fecha.substring(0, 10)}T00:00:00.000Z`);
  }

  private parseTime(hora?: string): Date | undefined {
    if (!hora) {
      return undefined;
    }

    return new Date(`1970-01-01T${hora}:00.000Z`);
  }

  private async validateDriver(idRepartidor: string) {
    const usuario = await this.prisma.usuario.findUnique({
      where: {
        idUsuario: idRepartidor,
      },
      include: {
        rol: true,
      },
    });

    if (!usuario || !usuario.estado) {
      throw new BadRequestException('El repartidor no existe o está inactivo');
    }

    if (!usuario.rol.estado || usuario.rol.nombre !== 'Repartidor') {
      throw new BadRequestException(
        'El usuario seleccionado debe tener rol Repartidor activo',
      );
    }

    return usuario;
  }

  private async generateRouteCode(fecha: Date): Promise<string> {
    const year = fecha.getUTCFullYear();

    const count = await this.prisma.ruta.count({
      where: {
        codigoRuta: {
          startsWith: `RUT-${year}-`,
        },
      },
    });

    return `RUT-${year}-${String(count + 1).padStart(6, '0')}`;
  }

  // ==========================================================
  // RUTAS
  // ==========================================================

  async create(dto: CreateRouteDto) {
    await this.validateDriver(dto.idRepartidor);

    const fecha = this.parseDateOnly(dto.fecha);
    const codigoRuta = await this.generateRouteCode(fecha);

    try {
      return await this.prisma.ruta.create({
        data: {
          codigoRuta,
          nombre: dto.nombre.trim(),
          fecha,
          idRepartidor: dto.idRepartidor,
          estado: 'PLANIFICADA',
          observaciones: dto.observaciones?.trim(),
        },
        include: this.routeInclude,
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('Ya existe una ruta con ese código');
      }

      throw error;
    }
  }

  async findAll() {
    return this.prisma.ruta.findMany({
      include: this.routeInclude,
      orderBy: [
        {
          fecha: 'desc',
        },
        {
          fechaCreacion: 'desc',
        },
      ],
    });
  }

  async findOne(idRuta: string) {
    const ruta = await this.prisma.ruta.findUnique({
      where: {
        idRuta,
      },
      include: this.routeInclude,
    });

    if (!ruta) {
      throw new NotFoundException('Ruta no encontrada');
    }

    return ruta;
  }

  async update(idRuta: string, dto: UpdateRouteDto) {
    const ruta = await this.findOne(idRuta);

    if (ruta.estado === 'COMPLETADA' || ruta.estado === 'CANCELADA') {
      throw new BadRequestException(
        'No se puede modificar una ruta finalizada',
      );
    }

    /*
     * El estado de una ruta no debe cambiarse mediante el PATCH
     * genérico. Debe administrarse mediante startRoute y
     * completeRoute.
     */
    if (dto.estado !== undefined) {
      throw new BadRequestException(
        'El estado de la ruta se administra mediante las operaciones de inicio y finalización',
      );
    }

    if (dto.idRepartidor) {
      await this.validateDriver(dto.idRepartidor);
    }

    return this.prisma.ruta.update({
      where: {
        idRuta,
      },
      data: {
        nombre: dto.nombre?.trim(),
        fecha: dto.fecha ? this.parseDateOnly(dto.fecha) : undefined,
        idRepartidor: dto.idRepartidor,
        observaciones: dto.observaciones?.trim(),
      },
      include: this.routeInclude,
    });
  }

  // ==========================================================
  // DETALLE DE RUTA
  // ==========================================================

  async addOrder(idRuta: string, dto: AddOrderToRouteDto) {
    const ruta = await this.findOne(idRuta);

    if (ruta.estado !== 'PLANIFICADA') {
      throw new BadRequestException(
        'Solo se pueden agregar pedidos a una ruta planificada',
      );
    }

    const pedido = await this.prisma.pedido.findUnique({
      where: {
        idPedido: dto.idPedido,
      },
    });

    if (!pedido) {
      throw new NotFoundException('Pedido no encontrado');
    }

    if (pedido.estado === 'ENTREGADO' || pedido.estado === 'CANCELADO') {
      throw new BadRequestException(
        'No se puede agregar un pedido entregado o cancelado a una ruta',
      );
    }

    const pedidoAsignado = await this.prisma.detalleRuta.findFirst({
      where: {
        idPedido: dto.idPedido,
        ruta: {
          estado: {
            in: ['PLANIFICADA', 'EN_CURSO'],
          },
        },
      },
    });

    if (pedidoAsignado) {
      throw new ConflictException('El pedido ya pertenece a una ruta activa');
    }

    try {
      return await this.prisma.detalleRuta.create({
        data: {
          idRuta,
          idPedido: dto.idPedido,
          ordenParada: dto.ordenParada,
          estado: 'PENDIENTE',
          horaEstimada: this.parseTime(dto.horaEstimada),
        },
        include: {
          pedido: {
            include: {
              cliente: true,
              direccion: true,
              detalles: {
                include: {
                  producto: true,
                },
              },
            },
          },
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          'El pedido o el orden de parada ya está registrado en esta ruta',
        );
      }

      throw error;
    }
  }

  async updateDetail(
    idRuta: string,
    idDetalleRuta: string,
    dto: UpdateRouteDetailDto,
  ) {
    const ruta = await this.findOne(idRuta);

    if (ruta.estado === 'COMPLETADA' || ruta.estado === 'CANCELADA') {
      throw new BadRequestException(
        'No se puede modificar una ruta finalizada',
      );
    }

    const detalle = await this.prisma.detalleRuta.findFirst({
      where: {
        idDetalleRuta,
        idRuta,
      },
    });

    if (!detalle) {
      throw new NotFoundException('Detalle de ruta no encontrado');
    }

    try {
      return await this.prisma.detalleRuta.update({
        where: {
          idDetalleRuta,
        },
        data: {
          ordenParada: dto.ordenParada,
          horaEstimada:
            dto.horaEstimada !== undefined
              ? this.parseTime(dto.horaEstimada)
              : undefined,
        },
        include: {
          pedido: {
            include: {
              cliente: true,
              direccion: true,
            },
          },
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          'Ya existe otra parada con ese orden en la ruta',
        );
      }

      throw error;
    }
  }

  async removeOrder(idRuta: string, idDetalleRuta: string) {
    const ruta = await this.findOne(idRuta);

    if (ruta.estado !== 'PLANIFICADA') {
      throw new BadRequestException(
        'Solo se pueden retirar pedidos de una ruta planificada',
      );
    }

    const detalle = await this.prisma.detalleRuta.findFirst({
      where: {
        idDetalleRuta,
        idRuta,
      },
      include: {
        entregas: true,
      },
    });

    if (!detalle) {
      throw new NotFoundException('Detalle de ruta no encontrado');
    }

    if (detalle.entregas.length > 0) {
      throw new BadRequestException(
        'No se puede retirar una parada que ya tiene intentos de entrega',
      );
    }

    await this.prisma.detalleRuta.delete({
      where: {
        idDetalleRuta,
      },
    });

    return {
      message: 'Pedido retirado de la ruta correctamente',
    };
  }

  // ==========================================================
  // INICIO DE RUTA
  // ==========================================================

  async startRoute(idRuta: string, idUsuario: string) {
    const ruta = await this.findOne(idRuta);

    if (ruta.estado !== 'PLANIFICADA') {
      throw new BadRequestException(
        'Solo se puede iniciar una ruta planificada',
      );
    }

    if (ruta.idRepartidor !== idUsuario) {
      throw new BadRequestException(
        'Solo el repartidor asignado puede iniciar esta ruta',
      );
    }

    if (ruta.detalles.length === 0) {
      throw new BadRequestException('No se puede iniciar una ruta sin pedidos');
    }

    return this.prisma.$transaction(async (tx) => {
      for (const detalle of ruta.detalles) {
        const pedido = await tx.pedido.findUnique({
          where: {
            idPedido: detalle.idPedido,
          },
        });

        if (!pedido) {
          throw new NotFoundException('Pedido no encontrado');
        }

        if (pedido.estado !== 'CONFIRMADO') {
          throw new BadRequestException(
            `El pedido ${pedido.numeroPedido} debe estar CONFIRMADO antes de iniciar la ruta`,
          );
        }

        await tx.historialEstadoPedido.create({
          data: {
            idPedido: pedido.idPedido,
            cambiadoPor: idUsuario,
            estadoAnterior: pedido.estado,
            estadoNuevo: 'EN_RUTA',
            observaciones: `Pedido incorporado a la ruta ${ruta.codigoRuta}`,
          },
        });

        await tx.pedido.update({
          where: {
            idPedido: pedido.idPedido,
          },
          data: {
            estado: 'EN_RUTA',
          },
        });

        await tx.detalleRuta.update({
          where: {
            idDetalleRuta: detalle.idDetalleRuta,
          },
          data: {
            estado: 'EN_RUTA',
          },
        });
      }

      return tx.ruta.update({
        where: {
          idRuta,
        },
        data: {
          estado: 'EN_CURSO',
        },
        include: this.routeInclude,
      });
    });
  }

  // ==========================================================
  // FINALIZACIÓN DE RUTA
  // ==========================================================

  async completeRoute(idRuta: string, idUsuario: string) {
    const ruta = await this.findOne(idRuta);

    if (ruta.estado !== 'EN_CURSO') {
      throw new BadRequestException(
        'Solo se puede completar una ruta que esté EN_CURSO',
      );
    }

    if (ruta.idRepartidor !== idUsuario) {
      throw new BadRequestException(
        'Solo el repartidor asignado puede completar esta ruta',
      );
    }

    if (ruta.detalles.length === 0) {
      throw new BadRequestException(
        'No se puede completar una ruta sin paradas',
      );
    }

    const paradasPendientes = ruta.detalles.filter(
      (detalle) => detalle.estado !== 'COMPLETADO',
    );

    if (paradasPendientes.length > 0) {
      throw new BadRequestException(
        `La ruta no puede completarse porque existen ${paradasPendientes.length} parada(s) pendientes`,
      );
    }

    return this.prisma.ruta.update({
      where: {
        idRuta,
      },
      data: {
        estado: 'COMPLETADA',
      },
      include: this.routeInclude,
    });
  }

  // ==========================================================
  // ENTREGAS
  // ==========================================================

  async createDelivery(
    idRuta: string,
    idDetalleRuta: string,
    idUsuario: string,
    dto: CreateDeliveryDto,
  ) {
    const ruta = await this.findOne(idRuta);

    if (ruta.estado !== 'EN_CURSO') {
      throw new BadRequestException(
        'La ruta debe estar en curso para registrar una entrega',
      );
    }

    if (ruta.idRepartidor !== idUsuario) {
      throw new BadRequestException(
        'Solo el repartidor asignado puede registrar entregas',
      );
    }

    const detalleRuta = await this.prisma.detalleRuta.findFirst({
      where: {
        idDetalleRuta,
        idRuta,
      },
      include: {
        pedido: {
          include: {
            detalles: true,
          },
        },
        entregas: {
          orderBy: {
            numeroIntento: 'asc',
          },
        },
      },
    });

    if (!detalleRuta) {
      throw new NotFoundException('Detalle de ruta no encontrado');
    }

    if (detalleRuta.estado === 'COMPLETADO') {
      throw new BadRequestException(
        'La parada ya fue completada y no admite nuevos intentos',
      );
    }

    if (detalleRuta.estado === 'CANCELADO') {
      throw new BadRequestException(
        'La parada está cancelada y no admite nuevos intentos',
      );
    }

    /*
     * EN_RUTA = primer intento o parada activa.
     * PENDIENTE = parada que vuelve de un intento NO_ENTREGADO.
     */
    if (
      detalleRuta.estado !== 'EN_RUTA' &&
      detalleRuta.estado !== 'PENDIENTE'
    ) {
      throw new BadRequestException(
        'La parada no está disponible para registrar una entrega',
      );
    }

    if (detalleRuta.pedido.estado !== 'EN_RUTA') {
      throw new BadRequestException(
        'El pedido debe estar EN_RUTA para registrar un intento de entrega',
      );
    }

    /*
     * Nunca permitimos dos intentos abiertos simultáneamente
     * para la misma parada.
     */
    const intentoPendiente = detalleRuta.entregas.find(
      (entrega) => entrega.estado === 'PENDIENTE',
    );

    if (intentoPendiente) {
      throw new ConflictException(
        'Ya existe un intento de entrega pendiente para esta parada',
      );
    }

    const detallesPedido = new Map(
      detalleRuta.pedido.detalles.map((detalle) => [
        detalle.idDetalle,
        detalle,
      ]),
    );

    const idsRecibidos = new Set<string>();

    for (const detalle of dto.detalles) {
      if (idsRecibidos.has(detalle.idDetallePedido)) {
        throw new BadRequestException(
          'No se puede repetir un detalle de pedido',
        );
      }

      idsRecibidos.add(detalle.idDetallePedido);

      const detallePedido = detallesPedido.get(detalle.idDetallePedido);

      if (!detallePedido) {
        throw new BadRequestException(
          'Uno de los detalles no pertenece al pedido de esta parada',
        );
      }

      if (detalle.cantidadEntregada > detallePedido.cantidad) {
        throw new BadRequestException(
          'La cantidad entregada no puede superar la cantidad solicitada',
        );
      }
    }

    /*
     * Se utiliza el número de intento máximo registrado,
     * no simplemente la cantidad de filas.
     */
    const ultimoIntento = detalleRuta.entregas.reduce(
      (maximo, entrega) => Math.max(maximo, entrega.numeroIntento),
      0,
    );

    const numeroIntento = ultimoIntento + 1;

    return this.prisma.$transaction(async (tx) => {
      /*
       * Si la parada estaba pendiente debido a un
       * NO_ENTREGADO anterior, el nuevo intento la
       * reactiva automáticamente.
       */
      if (detalleRuta.estado === 'PENDIENTE') {
        await tx.detalleRuta.update({
          where: {
            idDetalleRuta,
          },
          data: {
            estado: 'EN_RUTA',
          },
        });
      }

      return tx.entrega.create({
        data: {
          idPedido: detalleRuta.idPedido,
          idDetalleRuta,
          idRepartidor: idUsuario,
          numeroIntento,
          fechaHora: new Date(),
          estado: 'PENDIENTE',
          observaciones: dto.observaciones?.trim(),

          detalles: {
            create: dto.detalles.map((detalle) => ({
              idDetallePedido: detalle.idDetallePedido,
              cantidadEntregada: detalle.cantidadEntregada,
            })),
          },
        },
        include: {
          detalles: {
            include: {
              detallePedido: {
                include: {
                  producto: true,
                },
              },
            },
          },
          repartidor: {
            select: {
              idUsuario: true,
              nombre: true,
              correo: true,
            },
          },
          incidencias: true,
        },
      });
    });
  }

  async updateDeliveryStatus(
    idEntrega: string,
    idUsuario: string,
    dto: UpdateDeliveryStatusDto,
  ) {
    const entrega = await this.prisma.entrega.findUnique({
      where: {
        idEntrega,
      },
      include: {
        detalleRuta: {
          include: {
            ruta: true,
          },
        },
        pedido: true,
        detalles: {
          include: {
            detallePedido: true,
          },
        },
      },
    });

    if (!entrega) {
      throw new NotFoundException('Entrega no encontrada');
    }

    if (entrega.detalleRuta.ruta.idRepartidor !== idUsuario) {
      throw new BadRequestException(
        'Solo el repartidor asignado puede actualizar esta entrega',
      );
    }

    if (entrega.detalleRuta.ruta.estado !== 'EN_CURSO') {
      throw new BadRequestException(
        'La ruta debe estar EN_CURSO para actualizar una entrega',
      );
    }

    if (entrega.estado !== 'PENDIENTE') {
      throw new BadRequestException('La entrega ya fue finalizada');
    }

    if (dto.estado === 'ENTREGADO') {
      const cantidades = new Map(
        entrega.detalles.map((detalle) => [
          detalle.idDetallePedido,
          detalle.cantidadEntregada,
        ]),
      );

      const detallesPedido = await this.prisma.detallePedido.findMany({
        where: {
          idPedido: entrega.idPedido,
        },
      });

      for (const detallePedido of detallesPedido) {
        const cantidadEntregada = cantidades.get(detallePedido.idDetalle) ?? 0;

        if (cantidadEntregada !== detallePedido.cantidad) {
          throw new BadRequestException(
            'Para marcar la entrega como ENTREGADO deben entregarse completamente todos los productos del pedido',
          );
        }
      }
    }

    return this.prisma.$transaction(async (tx) => {
      const entregaActualizada = await tx.entrega.update({
        where: {
          idEntrega,
        },
        data: {
          estado: dto.estado,
          observaciones: dto.observaciones?.trim() ?? entrega.observaciones,
        },
      });

      if (dto.estado === 'ENTREGADO') {
        await tx.detalleRuta.update({
          where: {
            idDetalleRuta: entrega.idDetalleRuta,
          },
          data: {
            estado: 'COMPLETADO',
          },
        });

        /*
         * El pedido debe continuar EN_RUTA hasta
         * que una entrega se complete.
         */
        if (entrega.pedido.estado !== 'EN_RUTA') {
          throw new BadRequestException(
            'El pedido debe estar EN_RUTA para finalizar su entrega',
          );
        }

        await tx.historialEstadoPedido.create({
          data: {
            idPedido: entrega.idPedido,
            cambiadoPor: idUsuario,
            estadoAnterior: entrega.pedido.estado,
            estadoNuevo: 'ENTREGADO',
            observaciones:
              dto.observaciones?.trim() ?? 'Pedido entregado correctamente',
          },
        });

        await tx.pedido.update({
          where: {
            idPedido: entrega.idPedido,
          },
          data: {
            estado: 'ENTREGADO',
          },
        });
      }

      if (dto.estado === 'NO_ENTREGADO') {
        /*
         * El intento se cierra como NO_ENTREGADO,
         * pero el pedido permanece EN_RUTA.
         * La parada queda PENDIENTE para admitir
         * automáticamente un nuevo intento.
         */
        await tx.detalleRuta.update({
          where: {
            idDetalleRuta: entrega.idDetalleRuta,
          },
          data: {
            estado: 'PENDIENTE',
          },
        });
      }

      return entregaActualizada;
    });
  }

  // ==========================================================
  // INCIDENCIAS
  // ==========================================================

  async createIncident(
    idEntrega: string,
    idUsuario: string,
    dto: CreateDeliveryIncidentDto,
  ) {
    const entrega = await this.prisma.entrega.findUnique({
      where: {
        idEntrega,
      },
      include: {
        detalleRuta: {
          include: {
            ruta: true,
          },
        },
      },
    });

    if (!entrega) {
      throw new NotFoundException('Entrega no encontrada');
    }

    if (entrega.detalleRuta.ruta.idRepartidor !== idUsuario) {
      throw new BadRequestException(
        'Solo el repartidor asignado puede registrar incidencias',
      );
    }

    return this.prisma.incidencia.create({
      data: {
        idEntrega,
        tipo: dto.tipo.trim(),
        descripcion: dto.descripcion.trim(),
        registradoPor: idUsuario,
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
  }
}
