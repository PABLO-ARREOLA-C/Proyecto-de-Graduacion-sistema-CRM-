import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { ExecutionContext } from '@nestjs/common';
import { defer, lastValueFrom } from 'rxjs';
import { AuditService } from '../src/modules/audit/audit.service';
import { AuditInterceptor } from '../src/modules/audit/audit.interceptor';
import { AuditQueryDto } from '../src/modules/audit/dto/audit-query.dto';
import type { PrismaService } from '../src/modules/prisma/prisma.service';

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error('DATABASE_URL requerida');
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
  });
  const rollback = new Error('ROLLBACK_AUDIT_CHECK');
  try {
    await prisma.$transaction(
      async (tx) => {
        const role = await tx.rol.findFirstOrThrow({
          where: { nombre: 'Administrador', estado: true },
        });
        const suffix = randomUUID().replaceAll('-', '').slice(0, 12);
        const user = await tx.usuario.create({
          data: {
            nombre: 'Temporary audit actor',
            correo: `${suffix}@example.invalid`,
            passwordHash: 'not-a-login-hash',
            idRol: role.idRol,
          },
        });
        const product = await tx.producto.create({
          data: {
            codigo: `AUD-${suffix}`,
            nombre: 'Before audit check',
            precioActual: 1,
            estado: false,
          },
        });
        const service = new AuditService(tx as unknown as PrismaService);
        const interceptor = new AuditInterceptor(service);
        const context = {
          getType: () => 'http',
          switchToHttp: () => ({
            getRequest: () => ({
              method: 'PATCH',
              path: `/products/${product.idProducto}`,
              params: { id: product.idProducto },
              user: { idUsuario: user.idUsuario },
              body: {
                nombre: 'After audit check',
                password: 'secret-that-must-not-be-logged',
              },
            }),
          }),
        } as unknown as ExecutionContext;
        await lastValueFrom(
          interceptor.intercept(context, {
            handle: () =>
              defer(() =>
                tx.producto.update({
                  where: { idProducto: product.idProducto },
                  data: { nombre: 'After audit check' },
                }),
              ),
          }),
        );
        const events = await service.list(
          Object.assign(new AuditQueryDto(), {
            userId: user.idUsuario,
            action: 'ACTUALIZAR',
            table: 'productos',
            search: product.idProducto,
          }),
        );
        assert.equal(events.total, 1);
        assert.equal(events.data[0].registroId, product.idProducto);
        assert.equal(events.data[0].usuario?.idUsuario, user.idUsuario);
        assert.equal(events.data[0].datosAnteriores, null);
        assert.equal(
          JSON.stringify(events.data).includes(
            'secret-that-must-not-be-logged',
          ),
          false,
        );
        assert.equal(typeof events.data[0].idAuditoria, 'string');
        throw rollback;
      },
      { timeout: 30000 },
    );
  } catch (error) {
    if (error !== rollback) throw error;
    console.log(
      'Audit PostgreSQL check passed: successful product update recorded with actor, query filters and secret exclusion; fixtures rolled back.',
    );
  } finally {
    await prisma.$disconnect();
  }
}
void main().catch((error: unknown) => {
  console.error(
    error instanceof Error ? error.message : 'Audit database check failed',
  );
  process.exitCode = 1;
});
