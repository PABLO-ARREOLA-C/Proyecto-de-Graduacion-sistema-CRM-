import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../../prisma/prisma.service';

interface JwtPayload {
  sub: string;
  correo: string;
  rol: string;
  idRol: number;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    const secret = configService.get<string>('JWT_SECRET');

    if (!secret) {
      throw new Error('JWT_SECRET no está definido en el archivo .env');
    }

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret,
    });
  }

  async validate(payload: JwtPayload) {
    const usuario = await this.prisma.usuario.findUnique({
      where: {
        idUsuario: payload.sub,
      },
      include: {
        rol: true,
      },
    });

    if (!usuario || !usuario.estado || !usuario.rol.estado) {
      throw new UnauthorizedException('Usuario no autorizado');
    }

    return {
      idUsuario: usuario.idUsuario,
      correo: usuario.correo,
      nombre: usuario.nombre,
      idRol: usuario.idRol,
      rol: usuario.rol.nombre,
    };
  }
}
