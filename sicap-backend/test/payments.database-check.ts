import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import {
  BadRequestException,
  ConflictException,
  ValidationPipe,
  type INestApplication,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';
import { JwtStrategy } from '../src/modules/auth/strategies/jwt.strategy';
import { FinancesController } from '../src/modules/finances/finances.controller';
import { FinancesService } from '../src/modules/finances/finances.service';
import { OrdersService } from '../src/modules/orders/orders.service';
import { OrdersController } from '../src/modules/orders/orders.controller';
import { PrismaService } from '../src/modules/prisma/prisma.service';

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error('DATABASE_URL requerida');
  // Todas las escrituras ocurren en un esquema aislado; no se tocan datos de public.
  const schema = `payment_check_${randomUUID().replaceAll('-', '')}`;
  const pool = new Pool({ connectionString });
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString }, { schema }),
  });
  let created = false;
  let app: INestApplication<App> | undefined;
  try {
    await pool.query(`CREATE SCHEMA "${schema}"`);
    created = true;
    for (const table of [
      'roles',
      'usuarios',
      'pedidos',
      'pagos',
      'cuentas_por_cobrar',
      'movimientos_financieros',
      'clientes',
      'direcciones_cliente',
      'detalle_pedido',
      'productos',
      'historial_estados_pedido',
    ]) {
      await pool.query(
        `CREATE TABLE "${schema}"."${table}" (LIKE public."${table}" INCLUDING ALL)`,
      );
    }
    await prisma.rol.create({ data: { idRol: 1, nombre: 'Administrador' } });
    const user = await prisma.usuario.create({
      data: {
        idRol: 1,
        nombre: 'Payment test',
        correo: 'payment@example.invalid',
        passwordHash: 'not-a-login-hash',
      },
    });
    const service = new FinancesService(prisma as unknown as PrismaService);
    const orders = new OrdersService(prisma as unknown as PrismaService);
    const client = await prisma.cliente.create({
      data: { nombre: 'Isolated check', telefono: '00000000' },
    });
    const address = await prisma.direccionCliente.create({
      data: { idCliente: client.idCliente, direccion: 'Isolated check' },
    });
    async function fixture(credit: boolean) {
      const pedido = await prisma.pedido.create({
        data: {
          numeroPedido: randomUUID().slice(0, 24),
          idCliente: client.idCliente,
          idDireccion: address.idDireccion,
          fechaEntregaSolicitada: new Date('2026-10-20'),
          tipoVenta: credit ? 'CREDITO' : 'CONTADO',
          estado: 'CONFIRMADO',
          total: 100,
        },
      });
      const cuenta = credit
        ? await prisma.cuentaPorCobrar.create({
            data: {
              idPedido: pedido.idPedido,
              montoOriginal: 100,
              fechaVencimiento: new Date('2026-12-31'),
              estado: 'PENDIENTE',
            },
          })
        : null;
      return {
        pedido,
        cuenta,
        pay: (
          monto: number,
          idOperacion = randomUUID(),
          actor = user.idUsuario,
        ) =>
          cuenta
            ? service.createPayment(
                cuenta.idCuenta,
                { monto, idOperacion },
                actor,
              )
            : service.createCashPayment(
                pedido.idPedido,
                { monto, idOperacion },
                actor,
              ),
      };
    }
    for (const credit of [false, true]) {
      const excess = await fixture(credit);
      const outcomes = await Promise.allSettled([
        excess.pay(80),
        excess.pay(80),
      ]);
      assert.equal(outcomes.filter((r) => r.status === 'fulfilled').length, 1);
      const rejected = outcomes.find((r) => r.status === 'rejected');
      assert(
        rejected?.status === 'rejected' &&
          (rejected.reason instanceof BadRequestException ||
            rejected.reason instanceof ConflictException),
      );
      assert.equal(
        await prisma.pago.count({
          where: { idPedido: excess.pedido.idPedido },
        }),
        1,
      );

      const duplicate = await fixture(credit);
      const key = randomUUID();
      const before = await prisma.movimientoFinanciero.count();
      const same = await Promise.all([
        duplicate.pay(100, key),
        duplicate.pay(100, key),
      ]);
      assert.equal(same[0].pago.idPago, same[1].pago.idPago);
      assert.equal(same.filter((r) => r.reutilizado).length, 1);
      assert.equal(await prisma.movimientoFinanciero.count(), before + 1);
      assert.equal(
        await prisma.pago.count({
          where: { idPedido: duplicate.pedido.idPedido },
        }),
        1,
      );
      assert((await duplicate.pay(100, key)).reutilizado);
      await assert.rejects(() => duplicate.pay(90, key), ConflictException);
      const another = await fixture(credit);
      await assert.rejects(() => another.pay(100, key), ConflictException);

      const split = await fixture(credit);
      await Promise.all([split.pay(40), split.pay(60)]);
      const aggregate = await prisma.pago.aggregate({
        where: { idPedido: split.pedido.idPedido },
        _sum: { monto: true },
      });
      assert.equal(Number(aggregate._sum.monto), 100);
      if (split.cuenta)
        assert.equal(
          (
            await prisma.cuentaPorCobrar.findUniqueOrThrow({
              where: { idCuenta: split.cuenta.idCuenta },
            })
          ).estado,
          'PAGADA',
        );

      const secondUser = await prisma.usuario.create({
        data: {
          idRol: 1,
          nombre: 'Other actor',
          correo: `${randomUUID()}@example.invalid`,
          passwordHash: 'not-a-login-hash',
        },
      });
      await assert.rejects(
        () => duplicate.pay(100, key, secondUser.idUsuario),
        ConflictException,
      );
      console.log(
        `${credit ? 'Credit' : 'Cash'}: concurrent overpayment rejected, duplicate persisted once, conflicting keys rejected, concurrent partial payments total 100.`,
      );
    }

    const failed = await fixture(false);
    const failing = new FinancesService({
      $transaction: (
        callback: (tx: unknown) => Promise<unknown>,
        options: object,
      ) =>
        prisma.$transaction(
          (tx) =>
            callback({
              ...tx,
              movimientoFinanciero: {
                create: () => {
                  throw new Error('SIMULATED_MOVEMENT_FAILURE');
                },
              },
            }),
          options,
        ),
    } as unknown as PrismaService);
    await assert.rejects(
      () =>
        failing.createCashPayment(
          failed.pedido.idPedido,
          { monto: 20, idOperacion: randomUUID() },
          user.idUsuario,
        ),
      /SIMULATED_MOVEMENT_FAILURE/,
    );
    assert.equal(
      await prisma.pago.count({ where: { idPedido: failed.pedido.idPedido } }),
      0,
    );
    console.log(
      'Rollback: failed movement leaves no payment. Public business data untouched.',
    );

    const convertible = await fixture(false);
    await orders.update(convertible.pedido.idPedido, { tipoVenta: 'CREDITO' });
    await orders.update(convertible.pedido.idPedido, { tipoVenta: 'CONTADO' });
    await convertible.pay(10);
    await assert.rejects(
      () =>
        orders.update(convertible.pedido.idPedido, { tipoVenta: 'CREDITO' }),
      BadRequestException,
    );
    await orders.update(convertible.pedido.idPedido, {
      tipoVenta: 'CONTADO',
      observaciones: 'Allowed edit',
    });
    assert.equal(
      (
        await prisma.pedido.findUniqueOrThrow({
          where: { idPedido: convertible.pedido.idPedido },
        })
      ).observaciones,
      'Allowed edit',
    );
    const withAccount = await fixture(true);
    await assert.rejects(
      () =>
        orders.update(withAccount.pedido.idPedido, { tipoVenta: 'CONTADO' }),
      BadRequestException,
    );

    const due = '2099-12-31';
    const paidCredit = await fixture(true);
    await paidCredit.pay(100);
    await prisma.cuentaPorCobrar.delete({
      where: { idCuenta: paidCredit.cuenta!.idCuenta },
    });
    await assert.rejects(
      () =>
        service.createReceivable(
          { idPedido: paidCredit.pedido.idPedido, fechaVencimiento: due },
          user.idUsuario,
        ),
      BadRequestException,
    );

    // Ambas operaciones compiten por el mismo pedido; solo una puede prevalecer.
    const paymentRace = await fixture(false);
    const racePayments = await Promise.allSettled([
      orders.update(paymentRace.pedido.idPedido, { tipoVenta: 'CREDITO' }),
      paymentRace.pay(10),
    ]);
    assert.equal(
      racePayments.filter((r) => r.status === 'fulfilled').length,
      1,
    );
    const afterPaymentRace = await prisma.pedido.findUniqueOrThrow({
      where: { idPedido: paymentRace.pedido.idPedido },
      include: { pagos: true },
    });
    assert(
      afterPaymentRace.tipoVenta === 'CONTADO' ||
        afterPaymentRace.pagos.length === 0,
    );

    const accountRace = await fixture(false);
    await orders.update(accountRace.pedido.idPedido, { tipoVenta: 'CREDITO' });
    const raceAccounts = await Promise.allSettled([
      orders.update(accountRace.pedido.idPedido, { tipoVenta: 'CONTADO' }),
      service.createReceivable(
        { idPedido: accountRace.pedido.idPedido, fechaVencimiento: due },
        user.idUsuario,
      ),
    ]);
    assert.equal(
      raceAccounts.filter((r) => r.status === 'fulfilled').length,
      1,
    );
    const afterAccountRace = await prisma.pedido.findUniqueOrThrow({
      where: { idPedido: accountRace.pedido.idPedido },
      include: { cuentaPorCobrar: true },
    });
    assert(
      afterAccountRace.tipoVenta === 'CREDITO' ||
        afterAccountRace.cuentaPorCobrar === null,
    );
    console.log(
      'Order consistency: changes allowed before financial activity, blocked after payment/account; other edits preserved; concurrent payment/account creation cannot leave an incompatible sale type.',
    );

    const secret = randomUUID();
    const module = await Test.createTestingModule({
      controllers: [FinancesController, OrdersController],
      providers: [
        JwtStrategy,
        {
          provide: ConfigService,
          useValue: {
            get: (key: string) => (key === 'JWT_SECRET' ? secret : undefined),
          },
        },
        { provide: PrismaService, useValue: prisma },
        { provide: FinancesService, useValue: service },
        { provide: OrdersService, useValue: orders },
      ],
    }).compile();
    app = module.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
    const token = new JwtService({ secret }).sign(
      { sub: user.idUsuario },
      { expiresIn: '5m' },
    );
    for (const credit of [false, true]) {
      const fixtureHttp = await fixture(credit);
      const path = fixtureHttp.cuenta
        ? `/finances/receivables/${fixtureHttp.cuenta.idCuenta}/payments`
        : `/finances/orders/${fixtureHttp.pedido.idPedido}/payments`;
      const body = { monto: 100, idOperacion: randomUUID() };
      await request(app.getHttpServer()).post(path).send(body).expect(401);
      await request(app.getHttpServer())
        .post(path)
        .auth(token, { type: 'bearer' })
        .send({ monto: 100 })
        .expect(400);
      const first: request.Response = await request(app.getHttpServer())
        .post(path)
        .auth(token, { type: 'bearer' })
        .send(body)
        .expect(201);
      const replay: request.Response = await request(app.getHttpServer())
        .post(path)
        .auth(token, { type: 'bearer' })
        .send(body)
        .expect(201);
      assert.equal(
        (first.body as { pago: { idPago: string } }).pago.idPago,
        body.idOperacion,
      );
      assert.equal((replay.body as { reutilizado: boolean }).reutilizado, true);
      await request(app.getHttpServer())
        .post(path)
        .auth(token, { type: 'bearer' })
        .send({ ...body, monto: 99 })
        .expect(409);
    }
    console.log(
      'HTTP with real test JWT: 401 without token, 400 without operation UUID, payment success, replay without duplicate and 409 for conflicting payload (cash and credit).',
    );
    await request(app.getHttpServer())
      .patch(`/orders/${convertible.pedido.idPedido}`)
      .auth(token, { type: 'bearer' })
      .send({ tipoVenta: 'CREDITO' })
      .expect(400);
    await request(app.getHttpServer())
      .patch(`/orders/${convertible.pedido.idPedido}`)
      .auth(token, { type: 'bearer' })
      .send({ observaciones: 'HTTP edit' })
      .expect(200);
    await request(app.getHttpServer())
      .patch(`/orders/${withAccount.pedido.idPedido}`)
      .auth(token, { type: 'bearer' })
      .send({ tipoVenta: 'CONTADO' })
      .expect(400);
    console.log(
      'HTTP order changes: 400 for paid/account-backed sale type conversion, 200 for other permitted edits.',
    );
  } finally {
    await app?.close();
    await prisma.$disconnect();
    if (created && /^payment_check_[a-f0-9]{32}$/.test(schema))
      await pool.query(`DROP SCHEMA "${schema}" CASCADE`);
    await pool.end();
  }
}
void main().catch((error: unknown) => {
  if (error instanceof assert.AssertionError) console.error(error.stack);
  if (error && typeof error === 'object') {
    const value = error as {
      name?: unknown;
      code?: unknown;
      cause?: { kind?: unknown; code?: unknown };
    };
    console.error({
      name: value.name,
      code: value.code,
      causeKind: value.cause?.kind,
      causeCode: value.cause?.code,
    });
  }
  console.error(
    error instanceof Error ? error.message : 'Payment database check failed',
  );
  process.exitCode = 1;
});
