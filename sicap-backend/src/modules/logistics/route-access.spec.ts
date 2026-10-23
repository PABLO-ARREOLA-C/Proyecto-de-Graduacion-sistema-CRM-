import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PrismaService } from '../prisma/prisma.service';
import { LogisticsController } from './logistics.controller';
import { LogisticsService } from './logistics.service';
import { RouteAccessGuard } from './route-access.guard';

describe('Route authorization over HTTP', () => {
  const routeId = '11111111-1111-4111-8111-111111111111';
  const stopId = '22222222-2222-4222-8222-222222222222';
  const driverId = '33333333-3333-4333-8333-333333333333';
  const otherDriverId = '44444444-4444-4444-8444-444444444444';
  let app: INestApplication<App>;
  const findUnique = jest.fn();
  const service = {
    findAll: jest.fn(),
    findMine: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    addOrder: jest.fn(),
    moveStop: jest.fn(),
    updateDetail: jest.fn(),
    removeOrder: jest.fn(),
    startRoute: jest.fn(),
    completeRoute: jest.fn(),
    createDelivery: jest.fn(),
  };

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [LogisticsController],
      providers: [
        RouteAccessGuard,
        { provide: LogisticsService, useValue: service },
        { provide: PrismaService, useValue: { ruta: { findUnique } } },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate(context: import('@nestjs/common').ExecutionContext) {
          const req = context.switchToHttp().getRequest<{
            headers: Record<string, string>;
            user: { idUsuario: string; rol: string };
          }>();
          req.user = {
            idUsuario: driverId,
            rol: req.headers['x-test-role'] ?? 'Repartidor',
          };
          return true;
        },
      })
      .compile();
    app = module.createNestApplication();
    await app.init();
  });
  afterAll(async () => {
    await app.close();
  });
  beforeEach(() => {
    jest.clearAllMocks();
    findUnique.mockResolvedValue({ idRepartidor: otherDriverId });
    for (const mock of Object.values(service)) mock.mockResolvedValue([]);
  });

  it('filters the general list for drivers', async () => {
    await request(app.getHttpServer()).get('/logistics/routes').expect(200);
    expect(service.findMine).toHaveBeenCalledWith(driverId);
    expect(service.findAll).not.toHaveBeenCalled();
  });

  it('retains the full list for administrators', async () => {
    await request(app.getHttpServer())
      .get('/logistics/routes')
      .set('x-test-role', 'Administrador')
      .expect(200);
    expect(service.findAll).toHaveBeenCalled();
    expect(service.findMine).not.toHaveBeenCalled();
  });

  const operations = [
    ['get', '', 'findOne'],
    ['patch', '', 'update'],
    ['post', '/orders', 'addOrder'],
    ['post', `/details/${stopId}/move`, 'moveStop'],
    ['patch', `/details/${stopId}`, 'updateDetail'],
    ['delete', `/details/${stopId}`, 'removeOrder'],
    ['post', '/start', 'startRoute'],
    ['post', '/complete', 'completeRoute'],
    ['post', `/details/${stopId}/deliveries`, 'createDelivery'],
  ] as const;

  it.each(operations)(
    'rejects %s %s on another driver route',
    async (method, suffix, handler) => {
      await request(app.getHttpServer())
        [method](`/logistics/routes/${routeId}${suffix}`)
        .send({})
        .expect(403);
      expect(service[handler]).not.toHaveBeenCalled();
    },
  );

  it.each(operations)(
    'allows %s %s on the assigned route',
    async (method, suffix, handler) => {
      findUnique.mockResolvedValue({ idRepartidor: driverId });
      await request(app.getHttpServer())
        [method](`/logistics/routes/${routeId}${suffix}`)
        .send({})
        .expect(method === 'post' ? 201 : 200);
      expect(service[handler]).toHaveBeenCalled();
    },
  );

  it.each(['post', 'patch'] as const)(
    'prevents assigning another driver with %s',
    async (method) => {
      findUnique.mockResolvedValue({ idRepartidor: driverId });
      await request(app.getHttpServer())
        [method](`/logistics/routes${method === 'patch' ? `/${routeId}` : ''}`)
        .send({ idRepartidor: otherDriverId })
        .expect(403);
      expect(service.create).not.toHaveBeenCalled();
      expect(service.update).not.toHaveBeenCalled();
    },
  );

  it('allows creating a route assigned to oneself', async () => {
    await request(app.getHttpServer())
      .post('/logistics/routes')
      .send({ idRepartidor: driverId })
      .expect(201);
    expect(service.create).toHaveBeenCalled();
  });

  it('allows administrator reassignment', async () => {
    await request(app.getHttpServer())
      .patch(`/logistics/routes/${routeId}`)
      .set('x-test-role', 'Administrador')
      .send({ idRepartidor: otherDriverId })
      .expect(200);
    expect(service.update).toHaveBeenCalledWith(routeId, {
      idRepartidor: otherDriverId,
    });
  });

  it('rejects missing routes', async () => {
    findUnique.mockResolvedValue(null);
    await request(app.getHttpServer())
      .get(`/logistics/routes/${routeId}`)
      .expect(404);
  });

  it('rejects invalid identifiers before querying PostgreSQL', async () => {
    await request(app.getHttpServer())
      .get('/logistics/routes/invalid')
      .expect(400);
    expect(findUnique).not.toHaveBeenCalled();
  });

  it('rejects customer access', async () => {
    await request(app.getHttpServer())
      .get('/logistics/routes')
      .set('x-test-role', 'Cliente')
      .expect(403);
    expect(service.findAll).not.toHaveBeenCalled();
    expect(service.findMine).not.toHaveBeenCalled();
  });
});
