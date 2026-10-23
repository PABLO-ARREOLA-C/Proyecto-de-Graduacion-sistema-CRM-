import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { LogisticsService } from './logistics.service';
import { PrismaService } from '../prisma/prisma.service';
import { validate } from 'class-validator';
import { UpdateRouteDetailDto } from './dto/update-route-detail.dto';
import { LogisticsController } from './logistics.controller';

describe('Own routes', () => {
  it('scopes the query to the authenticated driver', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const service = new LogisticsService({
      ruta: { findMany },
    } as unknown as PrismaService);
    const controller = new LogisticsController(service);
    await controller.findMyRoutes({
      user: { idUsuario: 'driver-a' },
    } as Parameters<LogisticsController['findMyRoutes']>[0]);
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { idRepartidor: 'driver-a' } }),
    );
  });
});

describe('LogisticsService.updateDetail estimated time', () => {
  const update = jest.fn();
  let service: LogisticsService;

  beforeEach(() => {
    update.mockReset().mockResolvedValue({});
    service = new LogisticsService({
      ruta: {
        findUnique: jest.fn().mockResolvedValue({ estado: 'PLANIFICADA' }),
      },
      detalleRuta: {
        findFirst: jest.fn().mockResolvedValue({ idDetalleRuta: 'stop' }),
        update,
      },
    } as unknown as PrismaService);
  });

  it.each([
    ['00:00', new Date('1970-01-01T00:00:00.000Z')],
    ['23:59', new Date('1970-01-01T23:59:00.000Z')],
    [null, null],
    [undefined, undefined],
  ])(
    'handles time %s without changing the stop order',
    async (time, expected) => {
      await service.updateDetail('route', 'stop', { horaEstimada: time });
      expect(update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { horaEstimada: expected, ordenParada: undefined },
        }),
      );
    },
  );

  it.each(['00:00', '23:59', null, undefined])(
    'accepts valid DTO time %s',
    async (time) => {
      const dto = Object.assign(new UpdateRouteDetailDto(), {
        horaEstimada: time,
      });
      expect(await validate(dto)).toHaveLength(0);
    },
  );

  it.each(['24:00', '12:60', '', '9:30', 123])(
    'rejects invalid DTO time %s',
    async (time) => {
      const dto = Object.assign(new UpdateRouteDetailDto(), {
        horaEstimada: time,
      });
      expect((await validate(dto)).length).toBeGreaterThan(0);
    },
  );
});

describe('LogisticsService.moveStop', () => {
  let state: { idDetalleRuta: string; ordenParada: number }[];
  let status: string;
  let failAt: number;
  let writes: number;
  let service: LogisticsService;
  const transaction = jest.fn();

  beforeEach(() => {
    state = [
      { idDetalleRuta: 'a', ordenParada: 2 },
      { idDetalleRuta: 'b', ordenParada: 5 },
    ];
    status = 'PLANIFICADA';
    failAt = 0;
    writes = 0;
    transaction.mockReset();
    transaction.mockImplementation(
      async (callback: (tx: unknown) => Promise<unknown>) => {
        const draft = state.map((stop) => ({ ...stop }));
        const result = await callback({
          ruta: {
            findUnique: () =>
              Promise.resolve({
                estado: status,
                detalles: draft.map((stop) => ({ ...stop })),
              }),
          },
          detalleRuta: {
            update: ({
              where,
              data,
            }: {
              where: { idDetalleRuta: string };
              data: { ordenParada: number };
            }) => {
              writes++;
              if (writes === failAt) throw new Error('write failed');
              if (
                draft.some(
                  (stop) =>
                    stop.ordenParada === data.ordenParada &&
                    stop.idDetalleRuta !== where.idDetalleRuta,
                )
              )
                throw new Error('duplicate position');
              const stop = draft.find(
                (item) => item.idDetalleRuta === where.idDetalleRuta,
              )!;
              stop.ordenParada = data.ordenParada;
              return Promise.resolve({ ...stop });
            },
          },
        });
        state = draft;
        return result;
      },
    );
    service = new LogisticsService({
      $transaction: transaction,
    } as unknown as PrismaService);
  });

  it.each([
    ['a', 'DOWN'],
    ['b', 'UP'],
  ] as const)(
    'moves %s %s across gaps without duplicate positions',
    async (id, direction) => {
      await service.moveStop('route', id, direction);
      expect(state.map((stop) => stop.ordenParada)).toEqual([5, 2]);
      expect(transaction).toHaveBeenCalledWith(expect.any(Function), {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      });
    },
  );

  it.each(['EN_CURSO', 'COMPLETADA', 'CANCELADA'])(
    'rejects %s routes without writes',
    async (value) => {
      status = value;
      await expect(service.moveStop('route', 'a', 'DOWN')).rejects.toThrow(
        BadRequestException,
      );
      expect(writes).toBe(0);
    },
  );

  it.each([
    ['a', 'UP'],
    ['b', 'DOWN'],
  ] as const)('rejects moving %s %s past a boundary', async (id, direction) => {
    await expect(service.moveStop('route', id, direction)).rejects.toThrow(
      BadRequestException,
    );
    expect(writes).toBe(0);
  });

  it('rejects a stop outside the route', async () => {
    await expect(service.moveStop('route', 'other', 'UP')).rejects.toThrow(
      NotFoundException,
    );
    expect(writes).toBe(0);
  });

  it.each([2, 3])(
    'propagates failure on write %s so the transaction rolls back',
    async (step) => {
      failAt = step;
      await expect(service.moveStop('route', 'a', 'DOWN')).rejects.toThrow(
        'write failed',
      );
      expect(state.map((stop) => stop.ordenParada)).toEqual([2, 5]);
    },
  );
});
