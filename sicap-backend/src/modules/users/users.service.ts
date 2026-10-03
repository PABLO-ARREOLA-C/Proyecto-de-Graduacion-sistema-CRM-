import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateUserDto) {
    const correo = dto.correo.trim().toLowerCase();

    const rol = await this.prisma.rol.findUnique({
      where: {
        idRol: dto.idRol,
      },
    });

    if (!rol || !rol.estado) {
      throw new NotFoundException('El rol indicado no existe o está inactivo');
    }

    const usuarioExistente = await this.prisma.usuario.findUnique({
      where: {
        correo,
      },
    });

    if (usuarioExistente) {
      throw new ConflictException(
        'Ya existe un usuario registrado con ese correo',
      );
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);

    try {
      return await this.prisma.usuario.create({
        data: {
          idRol: dto.idRol,
          nombre: dto.nombre.trim(),
          correo,
          passwordHash,
          estado: dto.estado ?? true,
        },
        select: this.usuarioSelect,
      });
    } catch (error) {
      this.handlePrismaError(error);
      throw error;
    }
  }

  async findAll() {
    return this.prisma.usuario.findMany({
      select: this.usuarioSelect,
      orderBy: {
        fechaCreacion: 'desc',
      },
    });
  }

  async findOne(idUsuario: string) {
    const usuario = await this.prisma.usuario.findUnique({
      where: {
        idUsuario,
      },
      select: this.usuarioSelect,
    });

    if (!usuario) {
      throw new NotFoundException('Usuario no encontrado');
    }

    return usuario;
  }

  async findByEmail(correo: string) {
    return this.prisma.usuario.findUnique({
      where: {
        correo: correo.trim().toLowerCase(),
      },
      include: {
        rol: true,
      },
    });
  }

  async update(idUsuario: string, dto: UpdateUserDto) {
    await this.ensureUserExists(idUsuario);

    if (dto.idRol !== undefined) {
      const rol = await this.prisma.rol.findUnique({
        where: {
          idRol: dto.idRol,
        },
      });

      if (!rol || !rol.estado) {
        throw new NotFoundException(
          'El rol indicado no existe o está inactivo',
        );
      }
    }

    const data: Prisma.UsuarioUpdateInput = {};

    if (dto.idRol !== undefined) {
      data.rol = {
        connect: {
          idRol: dto.idRol,
        },
      };
    }

    if (dto.nombre !== undefined) {
      data.nombre = dto.nombre.trim();
    }

    if (dto.correo !== undefined) {
      data.correo = dto.correo.trim().toLowerCase();
    }

    if (dto.password !== undefined) {
      data.passwordHash = await bcrypt.hash(dto.password, 12);
    }

    if (dto.estado !== undefined) {
      data.estado = dto.estado;
    }

    try {
      return await this.prisma.usuario.update({
        where: {
          idUsuario,
        },
        data,
        select: this.usuarioSelect,
      });
    } catch (error) {
      this.handlePrismaError(error);
      throw error;
    }
  }

  async remove(idUsuario: string) {
    await this.ensureUserExists(idUsuario);

    return this.prisma.usuario.update({
      where: {
        idUsuario,
      },
      data: {
        estado: false,
      },
      select: this.usuarioSelect,
    });
  }

  private async ensureUserExists(idUsuario: string) {
    const usuario = await this.prisma.usuario.findUnique({
      where: {
        idUsuario,
      },
      select: {
        idUsuario: true,
      },
    });

    if (!usuario) {
      throw new NotFoundException('Usuario no encontrado');
    }
  }

  private handlePrismaError(error: unknown) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new ConflictException(
        'Ya existe un usuario registrado con esos datos únicos',
      );
    }
  }

  private readonly usuarioSelect = {
    idUsuario: true,
    nombre: true,
    correo: true,
    estado: true,
    fechaCreacion: true,
    fechaUltimaConexion: true,
    rol: {
      select: {
        idRol: true,
        nombre: true,
      },
    },
  } satisfies Prisma.UsuarioSelect;
}
