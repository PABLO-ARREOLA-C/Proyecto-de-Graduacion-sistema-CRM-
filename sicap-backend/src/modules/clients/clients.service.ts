import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateClientAddressDto } from './dto/create-client-address.dto';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientAddressDto } from './dto/update-client-address.dto';
import { UpdateClientDto } from './dto/update-client.dto';

@Injectable()
export class ClientsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateClientDto) {
    return this.prisma.cliente.create({
      data: {
        nombre: dto.nombre.trim(),
        telefono: dto.telefono.trim(),
        correo: dto.correo?.trim().toLowerCase(),
        nit: dto.nit?.trim(),
        estado: dto.estado ?? true,
      },
      include: {
        direcciones: true,
      },
    });
  }

  async findAll() {
    return this.prisma.cliente.findMany({
      include: {
        direcciones: {
          where: {
            estado: true,
          },
          orderBy: {
            fechaCreacion: 'desc',
          },
        },
      },
      orderBy: {
        fechaCreacion: 'desc',
      },
    });
  }

  async findOne(idCliente: string) {
    const cliente = await this.prisma.cliente.findUnique({
      where: {
        idCliente,
      },
      include: {
        direcciones: {
          orderBy: {
            fechaCreacion: 'desc',
          },
        },
      },
    });

    if (!cliente) {
      throw new NotFoundException('Cliente no encontrado');
    }

    return cliente;
  }

  async update(idCliente: string, dto: UpdateClientDto) {
    await this.ensureClientExists(idCliente);

    const data: Prisma.ClienteUpdateInput = {};

    if (dto.nombre !== undefined) {
      data.nombre = dto.nombre.trim();
    }

    if (dto.telefono !== undefined) {
      data.telefono = dto.telefono.trim();
    }

    if (dto.correo !== undefined) {
      data.correo = dto.correo.trim().toLowerCase();
    }

    if (dto.nit !== undefined) {
      data.nit = dto.nit.trim();
    }

    if (dto.estado !== undefined) {
      data.estado = dto.estado;
    }

    return this.prisma.cliente.update({
      where: {
        idCliente,
      },
      data,
      include: {
        direcciones: true,
      },
    });
  }

  async remove(idCliente: string) {
    await this.ensureClientExists(idCliente);

    return this.prisma.cliente.update({
      where: {
        idCliente,
      },
      data: {
        estado: false,
      },
      include: {
        direcciones: true,
      },
    });
  }

  async createAddress(idCliente: string, dto: CreateClientAddressDto) {
    await this.ensureClientExists(idCliente);

    return this.prisma.direccionCliente.create({
      data: {
        idCliente,
        direccion: dto.direccion.trim(),
        referencia: dto.referencia?.trim(),
        zona: dto.zona?.trim(),
        latitud:
          dto.latitud !== undefined
            ? new Prisma.Decimal(dto.latitud)
            : undefined,
        longitud:
          dto.longitud !== undefined
            ? new Prisma.Decimal(dto.longitud)
            : undefined,
        estado: dto.estado ?? true,
      },
    });
  }

  async findAddresses(idCliente: string) {
    await this.ensureClientExists(idCliente);

    return this.prisma.direccionCliente.findMany({
      where: {
        idCliente,
      },
      orderBy: {
        fechaCreacion: 'desc',
      },
    });
  }

  async updateAddress(
    idCliente: string,
    idDireccion: string,
    dto: UpdateClientAddressDto,
  ) {
    await this.ensureClientExists(idCliente);

    const direccion = await this.prisma.direccionCliente.findFirst({
      where: {
        idDireccion,
        idCliente,
      },
    });

    if (!direccion) {
      throw new NotFoundException('Dirección no encontrada para este cliente');
    }

    const data: Prisma.DireccionClienteUpdateInput = {};

    if (dto.direccion !== undefined) {
      data.direccion = dto.direccion.trim();
    }

    if (dto.referencia !== undefined) {
      data.referencia = dto.referencia.trim();
    }

    if (dto.zona !== undefined) {
      data.zona = dto.zona.trim();
    }

    if (dto.latitud !== undefined) {
      data.latitud = new Prisma.Decimal(dto.latitud);
    }

    if (dto.longitud !== undefined) {
      data.longitud = new Prisma.Decimal(dto.longitud);
    }

    if (dto.estado !== undefined) {
      data.estado = dto.estado;
    }

    return this.prisma.direccionCliente.update({
      where: {
        idDireccion,
      },
      data,
    });
  }

  async removeAddress(idCliente: string, idDireccion: string) {
    await this.ensureClientExists(idCliente);

    const direccion = await this.prisma.direccionCliente.findFirst({
      where: {
        idDireccion,
        idCliente,
      },
    });

    if (!direccion) {
      throw new NotFoundException('Dirección no encontrada para este cliente');
    }

    return this.prisma.direccionCliente.update({
      where: {
        idDireccion,
      },
      data: {
        estado: false,
      },
    });
  }

  private async ensureClientExists(idCliente: string) {
    const cliente = await this.prisma.cliente.findUnique({
      where: {
        idCliente,
      },
      select: {
        idCliente: true,
      },
    });

    if (!cliente) {
      throw new NotFoundException('Cliente no encontrado');
    }

    return cliente;
  }
}
