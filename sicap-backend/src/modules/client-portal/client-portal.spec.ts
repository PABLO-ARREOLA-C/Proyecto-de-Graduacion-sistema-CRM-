import {
  ExecutionContext,
  INestApplication,
  ValidationPipe,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';
import { Prisma } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { ClientsService } from '../clients/clients.service';
import { PrismaService } from '../prisma/prisma.service';
import { ClientPortalController } from './client-portal.controller';
import { ClientPortalService } from './client-portal.service';

describe('Client portal ownership (HTTP with simulated authenticated identities)', () => {
  let app: INestApplication<App>;
  const ownAddress = '11111111-1111-4111-8111-111111111111';
  const otherAddress = '22222222-2222-4222-8222-222222222222';
  const ownId = '33333333-3333-4333-8333-333333333333';
  const otherId = '44444444-4444-4444-8444-444444444444';
  const makeOrder = (idPedido: string, idCliente: string) => ({
    idPedido,
    idCliente,
    numeroPedido: idPedido,
    total: new Prisma.Decimal(100),
    pagos: [
      {
        idPago: 'payment',
        monto: new Prisma.Decimal(25),
        fechaPago: new Date(),
      },
    ],
    historialEstados: [
      {
        idHistorial: BigInt(1),
        estadoNuevo: 'CONFIRMADO',
        fechaHora: new Date(),
      },
    ],
  });
  const orders = [makeOrder(ownId, 'client-a'), makeOrder(otherId, 'client-b')];
  const addresses = [
    { idDireccion: ownAddress, idCliente: 'client-a' },
    { idDireccion: otherAddress, idCliente: 'client-b' },
  ];
  const findProfile = jest.fn();
  const saveProfile = jest.fn();
  const updateAddress = jest.fn();

  beforeAll(async () => {
    const prisma = {
      cliente: { findUnique: findProfile, upsert: saveProfile },
      usuario: {
        findUnique: jest.fn().mockResolvedValue({ correo: 'own@example.test' }),
      },
      pedido: {
        findMany: jest.fn(({ where }: { where: { idCliente: string } }) =>
          Promise.resolve(
            orders.filter((item) => item.idCliente === where.idCliente),
          ),
        ),
        findFirst: jest.fn(
          ({ where }: { where: { idCliente: string; idPedido: string } }) =>
            Promise.resolve(
              orders.find(
                (item) =>
                  item.idCliente === where.idCliente &&
                  item.idPedido === where.idPedido,
              ) ?? null,
            ),
        ),
      },
      direccionCliente: {
        findFirst: jest.fn(
          ({ where }: { where: { idDireccion: string; idCliente: string } }) =>
            Promise.resolve(
              addresses.find(
                (item) =>
                  item.idDireccion === where.idDireccion &&
                  item.idCliente === where.idCliente,
              ) ?? null,
            ),
        ),
        update: updateAddress,
      },
    };
    const module = await Test.createTestingModule({
      controllers: [ClientPortalController],
      providers: [
        ClientPortalService,
        ClientsService,
        RolesGuard,
        {
          provide: PrismaService,
          useValue: {
            ...prisma,
            $transaction: (callback: (tx: typeof prisma) => unknown) =>
              callback(prisma),
          },
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate(context: ExecutionContext) {
          const req = context
            .switchToHttp()
            .getRequest<{ headers: Record<string, string>; user: unknown }>();
          req.user = {
            idUsuario: 'user-a',
            rol: req.headers['x-test-role'] ?? 'Cliente',
          };
          return true;
        },
      })
      .compile();
    app = module.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
  });

  beforeEach(() => {
    findProfile
      .mockReset()
      .mockImplementation(
        ({ where }: { where: { idUsuario?: string; idCliente?: string } }) =>
          Promise.resolve(
            where.idUsuario === 'user-a' || where.idCliente === 'client-a'
              ? {
                  idCliente: 'client-a',
                  estado: true,
                  nombre: 'Own client',
                  direcciones: [],
                }
              : null,
          ),
      );
    saveProfile
      .mockReset()
      .mockResolvedValue({ idCliente: 'client-a', estado: true });
    updateAddress.mockReset().mockResolvedValue({ idDireccion: ownAddress });
  });
  afterAll(async () => app.close());

  it('lists only orders from the linked profile even with another user ID in query parameters', async () => {
    const result = await request(app.getHttpServer())
      .get('/client-portal/orders?idUsuario=user-b')
      .expect(200);
    const body = result.body as Array<{
      idPedido: string;
      totalPagado: number;
      saldoPendiente: number;
      historialEstados: Array<{ idHistorial: string }>;
    }>;
    expect(body).toHaveLength(1);
    expect(body[0]).toMatchObject({
      idPedido: ownId,
      totalPagado: 25,
      saldoPendiente: 75,
    });
    expect(body[0].historialEstados[0].idHistorial).toBe('1');
  });
  it('returns not found for another client order ID', async () => {
    await request(app.getHttpServer())
      .get(`/client-portal/orders/${otherId}`)
      .expect(404);
    await request(app.getHttpServer())
      .get(`/client-portal/orders/${ownId}`)
      .expect(200);
  });
  it('rejects arbitrary ownership fields on profile updates', async () => {
    await request(app.getHttpServer())
      .patch('/client-portal/profile')
      .send({ nombre: 'Own client', telefono: '12345678', idUsuario: 'user-b' })
      .expect(400);
    expect(saveProfile).not.toHaveBeenCalled();
  });
  it('updates only the profile identified by the authenticated user', async () => {
    await request(app.getHttpServer())
      .patch('/client-portal/profile')
      .send({ nombre: 'Own client', telefono: '12345678', nit: '' })
      .expect(200);
    expect(saveProfile).toHaveBeenCalledWith(
      expect.objectContaining({ where: { idUsuario: 'user-a' } }),
    );
  });
  it('rejects address edits and removal belonging to another client', async () => {
    await request(app.getHttpServer())
      .patch(`/client-portal/addresses/${otherAddress}`)
      .send({ direccion: 'Another address' })
      .expect(404);
    await request(app.getHttpServer())
      .delete(`/client-portal/addresses/${otherAddress}`)
      .expect(404);
    expect(updateAddress).not.toHaveBeenCalled();
    await request(app.getHttpServer())
      .patch(`/client-portal/addresses/${ownAddress}`)
      .send({ direccion: 'Own address' })
      .expect(200);
  });
  it('does not query orders for accounts without a linked profile', async () => {
    findProfile.mockResolvedValue(null);
    await request(app.getHttpServer()).get('/client-portal/orders').expect(404);
  });
  it('rejects inactive client profiles', async () => {
    findProfile.mockResolvedValue({ idCliente: 'client-a', estado: false });
    await request(app.getHttpServer())
      .get('/client-portal/profile')
      .expect(403);
  });
  it.each(['Administrador', 'Repartidor'])(
    'rejects role %s from the client portal',
    async (role) => {
      await request(app.getHttpServer())
        .get('/client-portal/orders')
        .set('x-test-role', role)
        .expect(403);
    },
  );
});
