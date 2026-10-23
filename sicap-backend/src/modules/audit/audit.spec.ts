import {
  ExecutionContext,
  INestApplication,
  Logger,
  ValidationPipe,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { lastValueFrom, of, throwError } from 'rxjs';
import request from 'supertest';
import type { App } from 'supertest/types';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { PrismaService } from '../prisma/prisma.service';
import { AuditController } from './audit.controller';
import { AuditInterceptor } from './audit.interceptor';
import { AuditService } from './audit.service';
import { auditInput, auditResult, redactAuditData } from './audit-data';
import { AuditQueryDto } from './dto/audit-query.dto';

describe('Audit credentials', () => {
  it('omits passwords and unknown data but records that a user password changed', () => {
    expect(
      auditInput(
        {
          nombre: 'Name',
          password: 'private-password',
          accessToken: 'private-token',
          custom: { password: 'secret' },
        },
        true,
      ),
    ).toEqual({ nombre: 'Name', contrasenaModificada: true });
  });
  it('does not copy tokens, hashes or unrelated nested data from login responses', () => {
    expect(
      auditResult({
        accessToken: 'token',
        usuario: {
          idUsuario: 'user',
          passwordHash: 'hash',
          rol: { nombre: 'Administrador' },
        },
      }),
    ).toEqual({ usuario: { idUsuario: 'user' } });
  });
  it('redacts credentials in old nested records', () => {
    expect(
      redactAuditData({
        nested: [
          { passwordHash: 'hash', authorization: 'token', nombre: 'Safe' },
        ],
        contrasenaModificada: true,
      }),
    ).toEqual({
      nested: [
        { passwordHash: '[OCULTO]', authorization: '[OCULTO]', nombre: 'Safe' },
      ],
      contrasenaModificada: true,
    });
  });
});

describe('Audit interceptor', () => {
  const record = jest.fn();
  let interceptor: AuditInterceptor;
  function context(
    method: string,
    path: string,
    body: unknown = {},
    authenticated = true,
  ) {
    return {
      getType: () => 'http',
      switchToHttp: () => ({
        getRequest: () => ({
          method,
          path,
          body,
          params: { id: 'resource' },
          ...(authenticated ? { user: { idUsuario: 'actor' } } : {}),
        }),
      }),
    } as unknown as ExecutionContext;
  }
  beforeEach(() => {
    record.mockReset().mockResolvedValue({});
    interceptor = new AuditInterceptor({ record } as unknown as AuditService);
  });
  it('records the authenticated actor and the affected product after success', async () => {
    const result = { idProducto: 'product', nombre: 'Edited' };
    expect(
      await lastValueFrom(
        interceptor.intercept(
          context('PATCH', '/products/product', { nombre: 'Edited' }),
          { handle: () => of(result) },
        ),
      ),
    ).toBe(result);
    expect(record).toHaveBeenCalledWith({
      idUsuario: 'actor',
      accion: 'ACTUALIZAR',
      tablaAfectada: 'productos',
      registroId: 'product',
      datosNuevos: {
        solicitud: { nombre: 'Edited' },
        resultado: { idProducto: 'product' },
      },
    });
  });
  it('records login identity from the successful response without logging its password or token', async () => {
    await lastValueFrom(
      interceptor.intercept(
        context(
          'POST',
          '/auth/login',
          { correo: 'a@example.test', password: 'private-password' },
          false,
        ),
        {
          handle: () =>
            of({
              accessToken: 'private-token',
              usuario: { idUsuario: 'login-user' },
            }),
        },
      ),
    );
    const calls = JSON.stringify(record.mock.calls);
    expect(calls).not.toContain('private-password');
    expect(calls).not.toContain('private-token');
    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({
        idUsuario: 'login-user',
        accion: 'INICIO_SESION',
        registroId: 'login-user',
      }),
    );
  });
  it('uses the payment ID from nested payment responses', async () => {
    await lastValueFrom(
      interceptor.intercept(
        context('POST', '/finances/orders/order/payments', { monto: 10 }),
        {
          handle: () => of({ pago: { idPago: 'payment' }, saldoPendiente: 20 }),
        },
      ),
    );
    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({
        accion: 'REGISTRAR_PAGO',
        tablaAfectada: 'pagos',
        registroId: 'payment',
      }),
    );
  });
  it('does not record read queries or failed operations as successes', async () => {
    await lastValueFrom(
      interceptor.intercept(context('GET', '/audit'), { handle: () => of([]) }),
    );
    await expect(
      lastValueFrom(
        interceptor.intercept(context('PATCH', '/users/user'), {
          handle: () => throwError(() => new Error('rejected')),
        }),
      ),
    ).rejects.toThrow('rejected');
    expect(record).not.toHaveBeenCalled();
  });
  it('does not record an idempotent payment replay as another payment', async () => {
    const result = { pago: { idPago: 'payment' }, reutilizado: true };
    expect(
      await lastValueFrom(
        interceptor.intercept(
          context('POST', '/finances/orders/order/payments'),
          { handle: () => of(result) },
        ),
      ),
    ).toBe(result);
    expect(record).not.toHaveBeenCalled();
  });
  it('preserves a successful business response if the audit insert fails', async () => {
    record.mockRejectedValue(new Error('audit storage failure'));
    const logger = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => {});
    try {
      const result = { idPago: 'payment' };
      expect(
        await lastValueFrom(
          interceptor.intercept(
            context('POST', '/finances/orders/order/payments'),
            { handle: () => of(result) },
          ),
        ),
      ).toBe(result);
      expect(logger).toHaveBeenCalled();
    } finally {
      logger.mockRestore();
    }
  });
});

describe('Audit dates and pagination', () => {
  const findMany = jest.fn();
  const count = jest.fn();
  let service: AuditService;
  beforeEach(() => {
    findMany.mockReset().mockResolvedValue([]);
    count.mockReset().mockResolvedValue(0);
    service = new AuditService({
      auditoria: { findMany, count },
    } as unknown as PrismaService);
  });
  it('uses inclusive Guatemala date limits and bounded pages', async () => {
    await service.list(
      Object.assign(new AuditQueryDto(), {
        from: '2026-10-17',
        to: '2026-10-17',
        page: 2,
        pageSize: 25,
      }),
    );
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 25,
        take: 25,
        where: {
          fechaHora: {
            gte: new Date('2026-10-17T06:00:00.000Z'),
            lte: new Date('2026-10-18T05:59:59.999Z'),
          },
        },
      }),
    );
  });
  it.each([{ from: '2026-02-30' }, { from: '2026-10-18', to: '2026-10-17' }])(
    'rejects invalid period %s before querying',
    async (period) => {
      await expect(
        service.list(Object.assign(new AuditQueryDto(), period)),
      ).rejects.toThrow();
      expect(findMany).not.toHaveBeenCalled();
    },
  );
});

describe('Audit administrator access (HTTP with simulated identities)', () => {
  let app: INestApplication<App>;
  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [AuditController],
      providers: [
        AuditService,
        RolesGuard,
        {
          provide: PrismaService,
          useValue: {
            auditoria: {
              findMany: jest.fn().mockResolvedValue([]),
              count: jest.fn().mockResolvedValue(0),
            },
            usuario: { findMany: jest.fn().mockResolvedValue([]) },
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
            idUsuario: 'actor',
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
  afterAll(async () => app.close());
  it('allows administrators to query events and options', async () => {
    await request(app.getHttpServer())
      .get('/audit')
      .set('x-test-role', 'Administrador')
      .expect(200);
    await request(app.getHttpServer())
      .get('/audit/options')
      .set('x-test-role', 'Administrador')
      .expect(200);
  });
  it.each(['Cliente', 'Repartidor'])('rejects role %s', async (role) => {
    await request(app.getHttpServer())
      .get('/audit')
      .set('x-test-role', role)
      .expect(403);
  });
  it.each(['page=0', 'pageSize=101', 'userId=invalid'])(
    'rejects invalid query %s',
    async (query) => {
      await request(app.getHttpServer())
        .get(`/audit?${query}`)
        .set('x-test-role', 'Administrador')
        .expect(400);
    },
  );
});
