import {
  ExecutionContext,
  INestApplication,
  ValidationPipe,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PrismaService } from '../prisma/prisma.service';
import { CrmController } from './crm.controller';
import { CrmService } from './crm.service';
import { PurchaseAlertsService } from './purchase-alerts.service';
import {
  guatemalaDay,
  purchasePatterns,
  type PurchaseWeekday,
} from './purchase-patterns';

const row = (extra: Partial<PurchaseWeekday> = {}): PurchaseWeekday => ({
  idCliente: 'client',
  cliente: 'Client',
  telefono: '00000000',
  idProducto: 'product',
  producto: 'Product',
  diaSemana: 5,
  unidades: 12,
  fechas: 2,
  ultimaCompra: '2026-10-16',
  ...extra,
});
const pattern = [
  row(),
  row({ diaSemana: 2, unidades: 5, fechas: 1, ultimaCompra: '2026-10-20' }),
];

describe('Weekly purchase patterns', () => {
  it('finds the peak day and explains the supporting quantities', () => {
    expect(purchasePatterns(pattern, '2026-10-22')).toEqual([
      expect.objectContaining({
        diaSemana: 5,
        unidadesDia: 12,
        totalUnidades: 17,
        fechasDia: 2,
        fechasCompra: 3,
        promedioDia: 6,
        porcentaje: 71,
        proximaFecha: '2026-10-23',
        diasHastaCompra: 1,
        ultimaCompra: '2026-10-20',
      }),
    ]);
  });
  it('allows a pattern entirely concentrated on one weekday if repeated on three dates', () => {
    expect(purchasePatterns([row({ fechas: 3 })], '2026-10-22')).toHaveLength(
      1,
    );
  });
  it.each(
    (
      [
        [row({ fechas: 1 })],
        [row()],
        [row({ fechas: 1 }), row({ diaSemana: 2, unidades: 5, fechas: 2 })],
        [row(), row({ diaSemana: 2, unidades: 12, fechas: 2 })],
        [row({ unidades: 0, fechas: 3 })],
        [row({ ultimaCompra: '2026-09-01', fechas: 3 })],
        [
          row(),
          row({ diaSemana: 1, unidades: 11 }),
          row({ diaSemana: 2, unidades: 11 }),
        ],
      ] as PurchaseWeekday[][]
    ).map((rows) => [rows] as const),
  )(
    'does not invent a pattern for insufficient, tied, weak or inactive history: %j',
    (rows) => {
      expect(purchasePatterns(rows, '2026-10-22')).toEqual([]);
    },
  );
  it('keeps clients and products separate', () => {
    expect(
      purchasePatterns(
        [row(), row({ idProducto: 'other', fechas: 1 })],
        '2026-10-22',
      ),
    ).toEqual([]);
    expect(
      purchasePatterns(
        [row(), row({ idCliente: 'other', fechas: 1 })],
        '2026-10-22',
      ),
    ).toEqual([]);
  });
  it('marks today and wraps Sunday into the next week and month', () => {
    expect(purchasePatterns(pattern, '2026-10-23')[0].diasHastaCompra).toBe(0);
    expect(
      purchasePatterns(
        [row({ diaSemana: 0, fechas: 3, ultimaCompra: '2026-10-25' })],
        '2026-10-31',
      )[0].proximaFecha,
    ).toBe('2026-11-01');
  });
  it('handles Guatemala midnight without using the UTC weekday', () => {
    expect(guatemalaDay(new Date('2026-10-23T05:59:59Z'))).toBe('2026-10-22');
    expect(guatemalaDay(new Date('2026-10-23T06:00:00Z'))).toBe('2026-10-23');
  });
  it('accepts the inclusive 28-day activity boundary', () => {
    expect(
      purchasePatterns(
        [row({ fechas: 3, ultimaCompra: '2026-09-24' })],
        '2026-10-22',
      ),
    ).toHaveLength(1);
    expect(
      purchasePatterns(
        [row({ fechas: 3, ultimaCompra: '2026-09-23' })],
        '2026-10-22',
      ),
    ).toHaveLength(0);
  });
});

describe('CRM purchase alerts HTTP (simulated identities)', () => {
  let app: INestApplication<App>;
  const queryRaw = jest.fn<
    Promise<PurchaseWeekday[]>,
    [{ values: unknown[]; strings: string[] }]
  >();
  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [CrmController],
      providers: [
        PurchaseAlertsService,
        { provide: PrismaService, useValue: { $queryRaw: queryRaw } },
        { provide: CrmService, useValue: {} },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate(context: ExecutionContext) {
          const req = context.switchToHttp().getRequest<{
            headers: Record<string, string>;
            user: { idUsuario: string; rol: string };
          }>();
          req.user = {
            idUsuario: '33333333-3333-4333-8333-333333333333',
            rol: req.headers['x-role'] ?? 'Administrador',
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
  afterAll(async () => {
    await app.close();
  });
  beforeEach(() => {
    jest
      .useFakeTimers({
        doNotFake: ['nextTick', 'setImmediate', 'setTimeout', 'clearTimeout'],
      })
      .setSystemTime(new Date('2026-10-22T18:00:00Z'));
    queryRaw.mockReset().mockResolvedValue(pattern);
  });
  afterEach(() => jest.useRealTimers());
  it('returns server-calculated patterns and period', async () => {
    const response = await request(app.getHttpServer())
      .get('/crm/purchase-alerts')
      .expect(200);
    expect(response.body).toEqual(
      expect.objectContaining({
        total: 1,
        alcance: 'GENERAL',
        hoy: '2026-10-22',
        desde: '2026-07-25',
        page: 1,
        pageSize: 25,
      }),
    );
  });
  it('scopes drivers with their authenticated ID in a bound SQL parameter', async () => {
    const response = await request(app.getHttpServer())
      .get('/crm/purchase-alerts')
      .set('x-role', 'Repartidor')
      .expect(200);
    expect(response.body).toEqual(
      expect.objectContaining({ alcance: 'ENTREGAS_PROPIAS' }),
    );
    const sql = queryRaw.mock.calls[0][0];
    expect(sql.values).toContain('33333333-3333-4333-8333-333333333333');
    expect(sql.strings.join('')).toContain('e.id_repartidor');
    expect(sql.strings.join('')).toContain('EXISTS');
  });
  it('rejects customer access without querying data', async () => {
    await request(app.getHttpServer())
      .get('/crm/purchase-alerts')
      .set('x-role', 'Cliente')
      .expect(403);
    expect(queryRaw).not.toHaveBeenCalled();
  });
  it.each([
    'dias=0',
    'dias=999999',
    'page=0',
    'diaSemana=7',
    'diaSemana=1.5',
    'idUsuario=another',
    'search=' + 'x'.repeat(101),
  ])('rejects invalid or owner-supplied queries: %s', async (query) => {
    await request(app.getHttpServer())
      .get(`/crm/purchase-alerts?${query}`)
      .expect(400);
    expect(queryRaw).not.toHaveBeenCalled();
  });
  it('filters by weekday and returns an explicit empty result', async () => {
    const response = await request(app.getHttpServer())
      .get('/crm/purchase-alerts?diaSemana=1')
      .expect(200);
    expect(response.body).toEqual(
      expect.objectContaining({ data: [], total: 0 }),
    );
  });
  it('paginates after calculating all patterns', async () => {
    queryRaw.mockResolvedValue(
      Array.from({ length: 26 }, (_, i) =>
        pattern.map((value) => ({ ...value, idCliente: `client-${i}` })),
      ).flat(),
    );
    const response = await request(app.getHttpServer())
      .get('/crm/purchase-alerts?page=2')
      .expect(200);
    const body = response.body as { total: number; data: unknown[] };
    expect(body.total).toBe(26);
    expect(body.data).toHaveLength(1);
  });
  it('binds search text and escapes wildcard characters', async () => {
    await request(app.getHttpServer())
      .get('/crm/purchase-alerts')
      .query({ search: "a%_'b" })
      .expect(200);
    const sql = queryRaw.mock.calls[0][0];
    expect(sql.values).toContain("%a\\%\\_'b%");
    expect(sql.strings.join('')).not.toContain("a%_'b");
  });
});
