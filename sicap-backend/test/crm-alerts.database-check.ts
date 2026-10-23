import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { PurchaseAlertsService } from '../src/modules/crm/purchase-alerts.service';
import { PurchaseAlertQueryDto } from '../src/modules/crm/dto/purchase-alert-query.dto';
import { guatemalaDay } from '../src/modules/crm/purchase-patterns';
import type { PrismaService } from '../src/modules/prisma/prisma.service';

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error('DATABASE_URL requerida');
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
  });
  const rollback = new Error('ROLLBACK_CRM_ALERT_CHECK');
  try {
    await prisma.$transaction(
      async (tx) => {
        const role = await tx.rol.findFirstOrThrow({
          where: { nombre: 'Repartidor', estado: true },
        });
        const suffix = randomUUID().replaceAll('-', '').slice(0, 12);
        const actor = await tx.usuario.create({
          data: {
            nombre: `CRM check ${suffix}`,
            correo: `${suffix}@example.invalid`,
            passwordHash: 'not-a-login-hash',
            idRol: role.idRol,
          },
        });
        const client = await tx.cliente.create({
          data: { nombre: `CRM check ${suffix}`, telefono: '00000000' },
        });
        const address = await tx.direccionCliente.create({
          data: {
            idCliente: client.idCliente,
            direccion: 'Temporary CRM check',
          },
        });
        const product = await tx.producto.create({
          data: {
            codigo: `CRM-${suffix}`,
            nombre: `CRM check ${suffix}`,
            precioActual: 1,
          },
        });
        const today = guatemalaDay(new Date());
        const friday = new Date(`${today}T00:00:00Z`);
        friday.setUTCDate(friday.getUTCDate() - 1);
        while (friday.getUTCDay() !== 5)
          friday.setUTCDate(friday.getUTCDate() - 1);
        const priorFriday = new Date(friday);
        priorFriday.setUTCDate(priorFriday.getUTCDate() - 7);
        const tuesday = new Date(friday);
        tuesday.setUTCDate(tuesday.getUTCDate() - 3);
        const route = await tx.ruta.create({
          data: {
            codigoRuta: `CRM-${suffix}`,
            nombre: 'Temporary CRM check',
            fecha: friday,
            idRepartidor: actor.idUsuario,
            estado: 'COMPLETADA',
          },
        });
        let position = 0;
        async function order(
          day: Date,
          quantity: number,
          estado = 'ENTREGADO',
        ) {
          position++;
          const date = day.toISOString().slice(0, 10);
          const pedido = await tx.pedido.create({
            data: {
              numeroPedido: `CRM-${suffix}-${position}`,
              idCliente: client.idCliente,
              idDireccion: address.idDireccion,
              fechaPedido: new Date(`${date}T12:00:00-06:00`),
              fechaEntregaSolicitada: day,
              tipoVenta: 'CONTADO',
              estado,
              total: quantity,
              detalles: {
                create: {
                  idProducto: product.idProducto,
                  cantidad: quantity,
                  precioUnitario: 1,
                },
              },
            },
          });
          if (estado === 'ENTREGADO') {
            const detail = await tx.detalleRuta.create({
              data: {
                idRuta: route.idRuta,
                idPedido: pedido.idPedido,
                ordenParada: position,
                estado: 'COMPLETADO',
              },
            });
            await tx.entrega.create({
              data: {
                idPedido: pedido.idPedido,
                idDetalleRuta: detail.idDetalleRuta,
                idRepartidor: actor.idUsuario,
                numeroIntento: 1,
                fechaHora: new Date(`${date}T16:00:00-06:00`),
                estado: 'ENTREGADO',
              },
            });
          }
          return pedido;
        }
        await order(friday, 8);
        await order(priorFriday, 4);
        await order(tuesday, 5);
        await order(tuesday, 1000, 'CANCELADO');
        await order(tuesday, 1000, 'PENDIENTE');
        const service = new PurchaseAlertsService(
          tx as unknown as PrismaService,
        );
        const query = Object.assign(new PurchaseAlertQueryDto(), {
          search: suffix,
          dias: 30,
        });
        const admin = await service.list(query, {
          idUsuario: actor.idUsuario,
          rol: 'Administrador',
        });
        assert.equal(admin.total, 1);
        assert.equal(admin.data[0].diaSemana, 5);
        assert.equal(admin.data[0].unidadesDia, 12);
        assert.equal(admin.data[0].totalUnidades, 17);
        assert.equal(admin.data[0].promedioDia, 6);
        assert.equal(admin.data[0].fechasCompra, 3);
        const own = await service.list(query, {
          idUsuario: actor.idUsuario,
          rol: 'Repartidor',
        });
        assert.equal(own.total, 1);
        const other = await service.list(query, {
          idUsuario: randomUUID(),
          rol: 'Repartidor',
        });
        assert.equal(other.total, 0);
        await tx.cliente.update({
          where: { idCliente: client.idCliente },
          data: { estado: false },
        });
        assert.equal(
          (
            await service.list(query, {
              idUsuario: actor.idUsuario,
              rol: 'Administrador',
            })
          ).total,
          0,
        );
        await tx.cliente.update({
          where: { idCliente: client.idCliente },
          data: { estado: true },
        });
        await tx.producto.update({
          where: { idProducto: product.idProducto },
          data: { estado: false },
        });
        assert.equal(
          (
            await service.list(query, {
              idUsuario: actor.idUsuario,
              rol: 'Administrador',
            })
          ).total,
          0,
        );
        throw rollback;
      },
      { timeout: 30000 },
    );
  } catch (error) {
    if (error !== rollback) throw error;
    console.log(
      'CRM alerts PostgreSQL check passed: correct weekday/quantities, cancelled/pending excluded, own-delivery scope and inactive records verified. All fixtures rolled back.',
    );
  } finally {
    await prisma.$disconnect();
  }
}
void main().catch((error: unknown) => {
  console.error(
    error instanceof Error ? error.message : 'CRM database check failed',
  );
  process.exitCode = 1;
});
