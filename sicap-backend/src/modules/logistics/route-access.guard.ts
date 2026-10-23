import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { isUUID } from 'class-validator';
import { PrismaService } from '../prisma/prisma.service';

type RouteRequest = {
  user?: { idUsuario: string; rol: string };
  params: { id?: string };
  body?: { idRepartidor?: unknown };
};

@Injectable()
export class RouteAccessGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RouteRequest>();
    const user = request.user;
    if (!user) throw new ForbiddenException('Usuario no autenticado');
    if (user.rol === 'Administrador') return true;
    if (user.rol !== 'Repartidor') throw new ForbiddenException();

    // La creación y edición solo pueden conservar la asignación propia.
    const assignedDriver = request.body?.idRepartidor;
    if (assignedDriver !== undefined && assignedDriver !== user.idUsuario) {
      throw new ForbiddenException(
        'Solo el Administrador puede asignar otro repartidor',
      );
    }

    // Los endpoints de rutas usan :id; entregas conserva sus controles propios.
    const idRuta = request.params.id;
    if (!idRuta) return true;
    if (!isUUID(idRuta))
      throw new BadRequestException('El identificador de ruta debe ser UUID');
    const route = await this.prisma.ruta.findUnique({
      where: { idRuta },
      select: { idRepartidor: true },
    });
    if (!route) throw new NotFoundException('Ruta no encontrada');
    if (route.idRepartidor !== user.idUsuario) {
      throw new ForbiddenException('Solo puede acceder a sus propias rutas');
    }
    return true;
  }
}
