import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditQueryDto } from './dto/audit-query.dto';
import { redactAuditData } from './audit-data';

const selection = {
  idAuditoria: true,
  accion: true,
  tablaAfectada: true,
  registroId: true,
  fechaHora: true,
  datosAnteriores: true,
  datosNuevos: true,
  usuario: { select: { idUsuario: true, nombre: true, correo: true } },
} satisfies Prisma.AuditoriaSelect;

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  record(input: {
    idUsuario: string;
    accion: string;
    tablaAfectada: string;
    registroId: string | null;
    datosNuevos: Prisma.InputJsonObject;
  }) {
    return this.prisma.auditoria.create({ data: input });
  }

  async options() {
    const [actions, tables, users] = await Promise.all([
      this.prisma.auditoria.findMany({
        distinct: ['accion'],
        select: { accion: true },
        orderBy: { accion: 'asc' },
      }),
      this.prisma.auditoria.findMany({
        distinct: ['tablaAfectada'],
        select: { tablaAfectada: true },
        orderBy: { tablaAfectada: 'asc' },
      }),
      this.prisma.usuario.findMany({
        select: { idUsuario: true, nombre: true, correo: true },
        orderBy: { nombre: 'asc' },
      }),
    ]);
    return {
      actions: actions.map((item) => item.accion),
      tables: tables.map((item) => item.tablaAfectada),
      users,
    };
  }

  private boundary(day: string, end = false) {
    const parsed = new Date(`${day}T06:00:00.000Z`);
    if (
      Number.isNaN(parsed.getTime()) ||
      parsed.toISOString().slice(0, 10) !== day
    )
      throw new BadRequestException('La fecha no es válida');
    if (end) parsed.setTime(parsed.getTime() + 86400000 - 1);
    return parsed;
  }

  async list(query: AuditQueryDto) {
    const from = query.from ? this.boundary(query.from) : undefined;
    const to = query.to ? this.boundary(query.to, true) : undefined;
    if (from && to && from > to)
      throw new BadRequestException(
        'El inicio no puede ser posterior al final',
      );
    const search = query.search?.trim();
    const where: Prisma.AuditoriaWhereInput = {
      ...(from || to ? { fechaHora: { gte: from, lte: to } } : {}),
      ...(query.action ? { accion: query.action } : {}),
      ...(query.table ? { tablaAfectada: query.table } : {}),
      ...(query.userId ? { idUsuario: query.userId } : {}),
      ...(search
        ? {
            OR: [
              { registroId: { contains: search, mode: 'insensitive' } },
              { accion: { contains: search, mode: 'insensitive' } },
              { tablaAfectada: { contains: search, mode: 'insensitive' } },
              {
                usuario: {
                  is: {
                    OR: [
                      { nombre: { contains: search, mode: 'insensitive' } },
                      { correo: { contains: search, mode: 'insensitive' } },
                    ],
                  },
                },
              },
            ],
          }
        : {}),
    };
    const [rows, total] = await Promise.all([
      this.prisma.auditoria.findMany({
        where,
        select: selection,
        orderBy: [{ fechaHora: 'desc' }, { idAuditoria: 'desc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.auditoria.count({ where }),
    ]);
    return {
      data: rows.map((row) => ({
        ...row,
        idAuditoria: row.idAuditoria.toString(),
        datosAnteriores: redactAuditData(row.datosAnteriores),
        datosNuevos: redactAuditData(row.datosNuevos),
      })),
      total,
      page: query.page,
      pageSize: query.pageSize,
      pages: Math.max(1, Math.ceil(total / query.pageSize)),
    };
  }
}
