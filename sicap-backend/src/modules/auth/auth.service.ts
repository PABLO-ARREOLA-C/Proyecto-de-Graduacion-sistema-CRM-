import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async login(dto: LoginDto) {
    const correo = dto.correo.trim().toLowerCase();

    const usuario = await this.prisma.usuario.findUnique({
      where: {
        correo,
      },
      include: {
        rol: true,
      },
    });

    if (!usuario) {
      throw new UnauthorizedException('Correo o contraseña incorrectos');
    }

    if (!usuario.estado) {
      throw new UnauthorizedException('El usuario se encuentra inactivo');
    }

    if (!usuario.rol.estado) {
      throw new UnauthorizedException('El rol del usuario está inactivo');
    }

    const passwordValida = await bcrypt.compare(
      dto.password,
      usuario.passwordHash,
    );

    if (!passwordValida) {
      throw new UnauthorizedException('Correo o contraseña incorrectos');
    }

    const fechaUltimaConexion = new Date();

    await this.prisma.usuario.update({
      where: {
        idUsuario: usuario.idUsuario,
      },
      data: {
        fechaUltimaConexion,
      },
    });

    const payload = {
      sub: usuario.idUsuario,
      correo: usuario.correo,
      rol: usuario.rol.nombre,
      idRol: usuario.idRol,
    };

    const accessToken = await this.jwtService.signAsync(payload);

    return {
      accessToken,
      tokenType: 'Bearer',
      usuario: {
        idUsuario: usuario.idUsuario,
        nombre: usuario.nombre,
        correo: usuario.correo,
        estado: usuario.estado,
        fechaUltimaConexion,
        rol: {
          idRol: usuario.rol.idRol,
          nombre: usuario.rol.nombre,
        },
      },
    };
  }
}
