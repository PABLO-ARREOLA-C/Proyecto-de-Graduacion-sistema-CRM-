import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { NotFoundException } from '@nestjs/common';
import { ClientPortalService } from '../src/modules/client-portal/client-portal.service';
import type { PrismaService } from '../src/modules/prisma/prisma.service';

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error('DATABASE_URL requerida');
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
  });
  const rollback = new Error('ROLLBACK_PORTAL_CHECK');
  try {
    await prisma.$transaction(
      async (tx) => {
        const rol = await tx.rol.findFirstOrThrow({
          where: { nombre: 'Cliente', estado: true },
        });
        const suffix = randomUUID().replaceAll('-', '').slice(0, 12);
        const fixture = async (label: string) => {
          const user = await tx.usuario.create({
            data: {
              idRol: rol.idRol,
              nombre: `Portal check ${label}`,
              correo: `${suffix}-${label}@example.invalid`,
              passwordHash: 'not-a-login-hash',
            },
          });
          const profile = await tx.cliente.create({
            data: {
              idUsuario: user.idUsuario,
              nombre: `Portal check ${label}`,
              telefono: '00000000',
            },
          });
          const address = await tx.direccionCliente.create({
            data: {
              idCliente: profile.idCliente,
              direccion: 'Temporary test address',
            },
          });
          const order = await tx.pedido.create({
            data: {
              numeroPedido: `CHECK-${suffix}-${label}`,
              idCliente: profile.idCliente,
              idDireccion: address.idDireccion,
              fechaEntregaSolicitada: new Date('2026-10-17T00:00:00.000Z'),
              tipoVenta: 'CONTADO',
              estado: 'CONFIRMADO',
              total: 10,
              historialEstados: {
                create: {
                  estadoNuevo: 'CONFIRMADO',
                  cambiadoPor: user.idUsuario,
                },
              },
              pagos: { create: { monto: 3, registradoPor: user.idUsuario } },
            },
          });
          return { user, profile, order };
        };
        const a = await fixture('a');
        const b = await fixture('b');
        const portal = new ClientPortalService(tx as unknown as PrismaService);
        const visible = await portal.getOrders(a.user.idUsuario);
        assert.equal(visible.length, 1);
        assert.equal(visible[0].idPedido, a.order.idPedido);
        assert.equal(visible[0].totalPagado, 3);
        assert.equal(visible[0].saldoPendiente, 7);
        assert.equal(
          typeof visible[0].historialEstados[0].idHistorial,
          'string',
        );
        await assert.rejects(
          () => portal.getOrder(a.user.idUsuario, b.order.idPedido),
          NotFoundException,
        );
        assert.equal(
          (await portal.getProfile(b.user.idUsuario))?.idCliente,
          b.profile.idCliente,
        );
        throw rollback;
      },
      { timeout: 15000 },
    );
  } catch (error) {
    if (error !== rollback) throw error;
    console.log(
      'Portal PostgreSQL check passed: own data, balances, foreign order rejected; all fixtures rolled back.',
    );
  } finally {
    await prisma.$disconnect();
  }
}

void main().catch((error: unknown) => {
  console.error(
    error instanceof Error ? error.message : 'Portal database check failed',
  );
  process.exitCode = 1;
});
