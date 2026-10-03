import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProductDto } from './dto/create-product.dto';
import { CreatePromotionDto } from './dto/create-promotion.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { UpdatePromotionDto } from './dto/update-promotion.dto';

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateProductDto) {
    try {
      return await this.prisma.producto.create({
        data: {
          codigo: dto.codigo.trim().toUpperCase(),
          nombre: dto.nombre.trim(),
          descripcion: dto.descripcion?.trim(),
          precioActual: new Prisma.Decimal(dto.precioActual),
          estado: dto.estado ?? true,
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('Ya existe un producto con ese código');
      }

      throw error;
    }
  }

  async findAll() {
    return this.prisma.producto.findMany({
      include: {
        promociones: {
          orderBy: {
            fechaInicio: 'desc',
          },
        },
      },
      orderBy: {
        nombre: 'asc',
      },
    });
  }

  async findOne(idProducto: string) {
    const producto = await this.prisma.producto.findUnique({
      where: {
        idProducto,
      },
      include: {
        promociones: {
          orderBy: {
            fechaInicio: 'desc',
          },
        },
      },
    });

    if (!producto) {
      throw new NotFoundException('Producto no encontrado');
    }

    return producto;
  }

  async update(idProducto: string, dto: UpdateProductDto) {
    await this.ensureProductExists(idProducto);

    const data: Prisma.ProductoUpdateInput = {};

    if (dto.codigo !== undefined) {
      data.codigo = dto.codigo.trim().toUpperCase();
    }

    if (dto.nombre !== undefined) {
      data.nombre = dto.nombre.trim();
    }

    if (dto.descripcion !== undefined) {
      data.descripcion = dto.descripcion.trim();
    }

    if (dto.precioActual !== undefined) {
      data.precioActual = new Prisma.Decimal(dto.precioActual);
    }

    if (dto.estado !== undefined) {
      data.estado = dto.estado;
    }

    try {
      return await this.prisma.producto.update({
        where: {
          idProducto,
        },
        data,
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('Ya existe un producto con ese código');
      }

      throw error;
    }
  }

  async remove(idProducto: string) {
    await this.ensureProductExists(idProducto);

    return this.prisma.producto.update({
      where: {
        idProducto,
      },
      data: {
        estado: false,
      },
    });
  }

  async createPromotion(idProducto: string, dto: CreatePromotionDto) {
    await this.ensureProductExists(idProducto);

    const fechaInicio = this.parseDate(dto.fechaInicio);
    const fechaFin = dto.fechaFin ? this.parseDate(dto.fechaFin) : undefined;

    this.validateDateRange(fechaInicio, fechaFin);

    return this.prisma.promocion.create({
      data: {
        idProducto,
        nombre: dto.nombre.trim(),
        cantidadRequerida: dto.cantidadRequerida,
        cantidadBonificada: dto.cantidadBonificada,
        fechaInicio,
        fechaFin,
        estado: dto.estado ?? true,
      },
      include: {
        producto: true,
      },
    });
  }

  async findPromotions(idProducto: string) {
    await this.ensureProductExists(idProducto);

    return this.prisma.promocion.findMany({
      where: {
        idProducto,
      },
      orderBy: {
        fechaInicio: 'desc',
      },
    });
  }

  async updatePromotion(
    idProducto: string,
    idPromocion: string,
    dto: UpdatePromotionDto,
  ) {
    await this.ensureProductExists(idProducto);

    const promocion = await this.ensurePromotionBelongsToProduct(
      idProducto,
      idPromocion,
    );

    const data: Prisma.PromocionUpdateInput = {};

    if (dto.nombre !== undefined) {
      data.nombre = dto.nombre.trim();
    }

    if (dto.cantidadRequerida !== undefined) {
      data.cantidadRequerida = dto.cantidadRequerida;
    }

    if (dto.cantidadBonificada !== undefined) {
      data.cantidadBonificada = dto.cantidadBonificada;
    }

    const fechaInicio =
      dto.fechaInicio !== undefined
        ? this.parseDate(dto.fechaInicio)
        : promocion.fechaInicio;

    const fechaFin =
      dto.fechaFin !== undefined
        ? this.parseDate(dto.fechaFin)
        : promocion.fechaFin;

    this.validateDateRange(fechaInicio, fechaFin ?? undefined);

    if (dto.fechaInicio !== undefined) {
      data.fechaInicio = fechaInicio;
    }

    if (dto.fechaFin !== undefined) {
      data.fechaFin = fechaFin;
    }

    if (dto.estado !== undefined) {
      data.estado = dto.estado;
    }

    return this.prisma.promocion.update({
      where: {
        idPromocion,
      },
      data,
    });
  }

  async removePromotion(idProducto: string, idPromocion: string) {
    await this.ensureProductExists(idProducto);

    await this.ensurePromotionBelongsToProduct(idProducto, idPromocion);

    return this.prisma.promocion.update({
      where: {
        idPromocion,
      },
      data: {
        estado: false,
      },
    });
  }

  private async ensureProductExists(idProducto: string) {
    const producto = await this.prisma.producto.findUnique({
      where: {
        idProducto,
      },
      select: {
        idProducto: true,
      },
    });

    if (!producto) {
      throw new NotFoundException('Producto no encontrado');
    }

    return producto;
  }

  private async ensurePromotionBelongsToProduct(
    idProducto: string,
    idPromocion: string,
  ) {
    const promocion = await this.prisma.promocion.findFirst({
      where: {
        idPromocion,
        idProducto,
      },
    });

    if (!promocion) {
      throw new NotFoundException('Promoción no encontrada para este producto');
    }

    return promocion;
  }

  private parseDate(value: string): Date {
    return new Date(`${value}T00:00:00.000Z`);
  }

  private validateDateRange(fechaInicio: Date, fechaFin?: Date) {
    if (fechaFin && fechaFin < fechaInicio) {
      throw new BadRequestException(
        'La fecha de finalización no puede ser anterior a la fecha de inicio',
      );
    }
  }
}
