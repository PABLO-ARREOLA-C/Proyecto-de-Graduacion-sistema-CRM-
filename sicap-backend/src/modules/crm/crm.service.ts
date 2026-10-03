import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateProspectDto,
  ProspectProductDto,
} from './dto/create-prospect.dto';
import { UpdateProspectDto } from './dto/update-prospect.dto';
import { CreateInteractionDto } from './dto/create-interaction.dto';
import { CreateFollowUpDto } from './dto/create-follow-up.dto';
import { UpdateFollowUpDto } from './dto/update-follow-up.dto';

@Injectable()
export class CrmService {
  constructor(private readonly prisma: PrismaService) {}

  private readonly prospectInclude = {
    responsable: {
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
    productos: {
      include: {
        producto: true,
      },
    },
  } satisfies Prisma.ProspectoInclude;

  private async validateResponsible(idResponsable: string) {
    const usuario = await this.prisma.usuario.findUnique({
      where: { idUsuario: idResponsable },
      include: { rol: true },
    });

    if (!usuario || !usuario.estado) {
      throw new BadRequestException(
        'El usuario responsable no existe o está inactivo',
      );
    }

    if (!usuario.rol.estado) {
      throw new BadRequestException(
        'El rol del usuario responsable está inactivo',
      );
    }

    if (!['Administrador', 'Repartidor'].includes(usuario.rol.nombre)) {
      throw new BadRequestException(
        'El responsable debe tener rol Administrador o Repartidor',
      );
    }

    return usuario;
  }

  private async validateProducts(productos: ProspectProductDto[]) {
    if (productos.length === 0) {
      return;
    }

    const ids = productos.map((producto) => producto.idProducto);

    if (new Set(ids).size !== ids.length) {
      throw new BadRequestException(
        'No se puede agregar el mismo producto más de una vez',
      );
    }

    const encontrados = await this.prisma.producto.findMany({
      where: {
        idProducto: { in: ids },
        estado: true,
      },
      select: {
        idProducto: true,
      },
    });

    if (encontrados.length !== ids.length) {
      throw new BadRequestException(
        'Uno o más productos no existen o están inactivos',
      );
    }
  }

  async create(dto: CreateProspectDto, currentUserId: string) {
    const responsableId = dto.idResponsable ?? currentUserId;

    await this.validateResponsible(responsableId);

    if (dto.productos) {
      await this.validateProducts(dto.productos);
    }

    return this.prisma.prospecto.create({
      data: {
        nombre: dto.nombre.trim(),
        telefono: dto.telefono.trim(),
        correo: dto.correo?.trim().toLowerCase(),
        direccion: dto.direccion?.trim(),
        interes: dto.interes?.trim(),
        estado: dto.estado ?? 'NUEVO',
        idResponsable: responsableId,
        productos:
          dto.productos && dto.productos.length > 0
            ? {
                create: dto.productos.map((producto) => ({
                  idProducto: producto.idProducto,
                  cantidadEstimada: producto.cantidadEstimada,
                })),
              }
            : undefined,
      },
      include: this.prospectInclude,
    });
  }

  async findAll() {
    return this.prisma.prospecto.findMany({
      include: this.prospectInclude,
      orderBy: {
        fechaCreacion: 'desc',
      },
    });
  }

  async findOne(idProspecto: string) {
    const prospecto = await this.prisma.prospecto.findUnique({
      where: { idProspecto },
      include: {
        ...this.prospectInclude,
        interacciones: {
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
            fechaHora: 'desc',
          },
        },
        seguimientos: {
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
            fechaProgramada: 'asc',
          },
        },
      },
    });

    if (!prospecto) {
      throw new NotFoundException('Prospecto no encontrado');
    }

    return prospecto;
  }

  async update(idProspecto: string, dto: UpdateProspectDto) {
    await this.findOne(idProspecto);

    if (dto.idResponsable) {
      await this.validateResponsible(dto.idResponsable);
    }

    return this.prisma.prospecto.update({
      where: { idProspecto },
      data: {
        nombre: dto.nombre?.trim(),
        telefono: dto.telefono?.trim(),
        correo: dto.correo?.trim().toLowerCase(),
        direccion: dto.direccion?.trim(),
        interes: dto.interes?.trim(),
        estado: dto.estado,
        idResponsable: dto.idResponsable,
      },
      include: this.prospectInclude,
    });
  }

  async addProduct(idProspecto: string, dto: ProspectProductDto) {
    await this.findOne(idProspecto);
    await this.validateProducts([dto]);

    const existente = await this.prisma.prospectoProducto.findUnique({
      where: {
        idProspecto_idProducto: {
          idProspecto,
          idProducto: dto.idProducto,
        },
      },
    });

    if (existente) {
      throw new BadRequestException(
        'El producto ya está asociado al prospecto',
      );
    }

    return this.prisma.prospectoProducto.create({
      data: {
        idProspecto,
        idProducto: dto.idProducto,
        cantidadEstimada: dto.cantidadEstimada,
      },
      include: {
        producto: true,
      },
    });
  }

  async removeProduct(idProspecto: string, idProspectoProducto: string) {
    await this.findOne(idProspecto);

    const relacion = await this.prisma.prospectoProducto.findFirst({
      where: {
        idProspectoProducto,
        idProspecto,
      },
    });

    if (!relacion) {
      throw new NotFoundException(
        'Producto asociado al prospecto no encontrado',
      );
    }

    await this.prisma.prospectoProducto.delete({
      where: { idProspectoProducto },
    });

    return {
      message: 'Producto eliminado del prospecto correctamente',
    };
  }

  async createInteraction(
    idProspecto: string,
    idUsuario: string,
    dto: CreateInteractionDto,
  ) {
    await this.findOne(idProspecto);

    return this.prisma.interaccionCrm.create({
      data: {
        idProspecto,
        idUsuario,
        tipo: dto.tipo,
        descripcion: dto.descripcion.trim(),
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

  async findInteractions(idProspecto: string) {
    await this.findOne(idProspecto);

    return this.prisma.interaccionCrm.findMany({
      where: { idProspecto },
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
        fechaHora: 'desc',
      },
    });
  }

  async createFollowUp(
    idProspecto: string,
    idUsuario: string,
    dto: CreateFollowUpDto,
  ) {
    await this.findOne(idProspecto);

    const fechaProgramada = new Date(dto.fechaProgramada);

    if (Number.isNaN(fechaProgramada.getTime())) {
      throw new BadRequestException('Fecha programada inválida');
    }

    return this.prisma.seguimientoCrm.create({
      data: {
        idProspecto,
        idUsuario,
        fechaProgramada,
        descripcion: dto.descripcion?.trim(),
        estado: 'PENDIENTE',
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

  async findFollowUps(idProspecto: string) {
    await this.findOne(idProspecto);

    return this.prisma.seguimientoCrm.findMany({
      where: { idProspecto },
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
        fechaProgramada: 'asc',
      },
    });
  }

  async updateFollowUp(
    idProspecto: string,
    idSeguimiento: string,
    dto: UpdateFollowUpDto,
  ) {
    await this.findOne(idProspecto);

    const seguimiento = await this.prisma.seguimientoCrm.findFirst({
      where: {
        idSeguimiento,
        idProspecto,
      },
    });

    if (!seguimiento) {
      throw new NotFoundException('Seguimiento CRM no encontrado');
    }

    if (
      seguimiento.estado === 'COMPLETADO' ||
      seguimiento.estado === 'CANCELADO'
    ) {
      throw new BadRequestException(
        'No se puede modificar un seguimiento finalizado',
      );
    }

    const fechaProgramada = dto.fechaProgramada
      ? new Date(dto.fechaProgramada)
      : undefined;

    let fechaCompletado: Date | null | undefined;

    if (dto.estado === 'COMPLETADO') {
      fechaCompletado = new Date();
    } else if (dto.estado === 'CANCELADO') {
      fechaCompletado = null;
    }

    return this.prisma.seguimientoCrm.update({
      where: { idSeguimiento },
      data: {
        fechaProgramada,
        descripcion: dto.descripcion?.trim(),
        estado: dto.estado,
        fechaCompletado,
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
