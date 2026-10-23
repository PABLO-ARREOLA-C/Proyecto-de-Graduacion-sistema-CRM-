import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PurchaseAlertQueryDto } from './dto/purchase-alert-query.dto';
import {
  guatemalaDay,
  purchasePatterns,
  type PurchaseWeekday,
} from './purchase-patterns';

@Injectable()
export class PurchaseAlertsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(
    query: PurchaseAlertQueryDto,
    user: { idUsuario: string; rol: string },
  ) {
    const now = new Date();
    const hoy = guatemalaDay(now);
    const start = new Date(`${hoy}T00:00:00Z`);
    start.setUTCDate(start.getUTCDate() - query.dias + 1);
    const desde = start.toISOString().slice(0, 10);
    const startInstant = new Date(`${desde}T00:00:00-06:00`);
    const text = `%${(query.search?.trim() ?? '').replace(/[\\%_]/g, '\\$&')}%`;
    const scope =
      user.rol === 'Administrador'
        ? Prisma.empty
        : Prisma.sql`
      AND EXISTS (SELECT 1 FROM entregas e WHERE e.id_pedido = p.id_pedido
        AND e.estado = 'ENTREGADO' AND e.id_repartidor = ${user.idUsuario}::uuid)`;
    // Agrupa en PostgreSQL; ningun pedido, pago o dato de prospectos viaja al navegador.
    const rows = await this.prisma.$queryRaw<PurchaseWeekday[]>(Prisma.sql`
      SELECT c.id_cliente AS "idCliente", c.nombre AS cliente, c.telefono,
        pr.id_producto AS "idProducto", pr.nombre AS producto,
        EXTRACT(DOW FROM p.fecha_pedido AT TIME ZONE 'America/Guatemala')::int AS "diaSemana",
        SUM(d.cantidad)::double precision AS unidades,
        COUNT(DISTINCT (p.fecha_pedido AT TIME ZONE 'America/Guatemala')::date)::int AS fechas,
        MAX((p.fecha_pedido AT TIME ZONE 'America/Guatemala')::date)::text AS "ultimaCompra"
      FROM pedidos p
      JOIN clientes c ON c.id_cliente = p.id_cliente
      JOIN detalle_pedido d ON d.id_pedido = p.id_pedido
      JOIN productos pr ON pr.id_producto = d.id_producto
      WHERE p.estado = 'ENTREGADO' AND c.estado = true AND pr.estado = true
        AND p.fecha_pedido >= ${startInstant} AND p.fecha_pedido <= ${now}
        AND (c.nombre ILIKE ${text} OR pr.nombre ILIKE ${text})
        ${scope}
      GROUP BY c.id_cliente, c.nombre, c.telefono, pr.id_producto, pr.nombre,
        EXTRACT(DOW FROM p.fecha_pedido AT TIME ZONE 'America/Guatemala')
    `);
    const all = purchasePatterns(rows, hoy);
    const filtered =
      query.diaSemana === undefined
        ? all
        : all.filter((alert) => alert.diaSemana === query.diaSemana);
    const pageSize = 25;
    return {
      hoy,
      desde,
      hasta: hoy,
      dias: query.dias,
      alcance: user.rol === 'Administrador' ? 'GENERAL' : 'ENTREGAS_PROPIAS',
      total: filtered.length,
      page: query.page,
      pageSize,
      data: filtered.slice((query.page - 1) * pageSize, query.page * pageSize),
    };
  }
}
