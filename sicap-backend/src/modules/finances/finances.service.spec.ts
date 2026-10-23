import { BadRequestException, ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { FinancesService } from './finances.service';
import { PrismaService } from '../prisma/prisma.service';

describe('FinancesService receivable dates', () => {
  const findMany = jest.fn();
  const create = jest.fn();
  const findOrder = jest.fn();
  let service: FinancesService;

  function account(day: string) {
    return {
      idCuenta: 'account',
      idPedido: 'order',
      montoOriginal: new Prisma.Decimal(100),
      fechaVencimiento: new Date(`${day}T00:00:00.000Z`),
      estado: 'PENDIENTE',
      pedido: { pagos: [] },
    };
  }

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2026-10-17T15:00:00.000Z'));
    findMany.mockReset();
    create
      .mockReset()
      .mockImplementation(({ data }: { data: { fechaVencimiento: Date } }) =>
        Promise.resolve(
          account(data.fechaVencimiento.toISOString().slice(0, 10)),
        ),
      );
    findOrder.mockReset().mockResolvedValue({
      idPedido: 'order',
      tipoVenta: 'CREDITO',
      estado: 'CONFIRMADO',
      total: new Prisma.Decimal(100),
      cuentaPorCobrar: null,
      pagos: [],
    });
    const tx = {
      usuario: { findUnique: jest.fn().mockResolvedValue({ estado: true }) },
      pedido: { findUnique: findOrder },
      cuentaPorCobrar: { findMany, create },
    };
    service = new FinancesService({
      ...tx,
      $transaction: jest.fn((callback: (client: unknown) => Promise<unknown>) =>
        callback(tx),
      ),
    } as unknown as PrismaService);
  });

  afterEach(() => jest.useRealTimers());

  it('only marks dates before today in Guatemala as overdue', async () => {
    findMany.mockResolvedValue([
      account('2026-10-16'),
      account('2026-10-17'),
      account('2026-10-18'),
    ]);
    const result = await service.findAllReceivables();
    expect(result.map((item) => item.estadoCalculado)).toEqual([
      'VENCIDA',
      'PENDIENTE',
      'PENDIENTE',
    ]);
  });

  it('keeps Guatemala calendar day before UTC midnight boundary changes locally', async () => {
    jest.setSystemTime(new Date('2026-10-18T02:00:00.000Z'));
    findMany.mockResolvedValue([account('2026-10-17')]);
    expect((await service.findAllReceivables())[0].estadoCalculado).toBe(
      'PENDIENTE',
    );
    jest.setSystemTime(new Date('2026-10-18T06:00:00.000Z'));
    expect((await service.findAllReceivables())[0].estadoCalculado).toBe(
      'VENCIDA',
    );
  });

  it.each(['2026-10-17', '2026-10-17T00:00:00-06:00'])(
    'accepts a due date of today: %s',
    async (fechaVencimiento) => {
      const result = await service.createReceivable(
        { idPedido: 'order', fechaVencimiento },
        'user',
      );
      expect(result.fechaVencimiento.toISOString()).toBe(
        '2026-10-17T00:00:00.000Z',
      );
      expect(result.estadoCalculado).toBe('PENDIENTE');
    },
  );

  it.each(['2026-10-16', '2026-02-30'])(
    'rejects past or invalid due dates: %s',
    async (fechaVencimiento) => {
      await expect(
        service.createReceivable(
          { idPedido: 'order', fechaVencimiento },
          'user',
        ),
      ).rejects.toThrow(BadRequestException);
      expect(create).not.toHaveBeenCalled();
    },
  );

  it('rejects creating a receivable without outstanding balance', async () => {
    findOrder.mockResolvedValue({
      idPedido: 'order',
      tipoVenta: 'CREDITO',
      estado: 'CONFIRMADO',
      total: new Prisma.Decimal(100),
      cuentaPorCobrar: null,
      pagos: [{ monto: new Prisma.Decimal(100) }],
    });
    await expect(
      service.createReceivable(
        { idPedido: 'order', fechaVencimiento: '2026-10-17' },
        'user',
      ),
    ).rejects.toThrow(BadRequestException);
    expect(create).not.toHaveBeenCalled();
  });

  it('returns conflict for a concurrent duplicate receivable', async () => {
    create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('duplicate account', {
        code: 'P2002',
        clientVersion: 'test',
      }),
    );
    await expect(
      service.createReceivable(
        { idPedido: 'order', fechaVencimiento: '2026-10-17' },
        'user',
      ),
    ).rejects.toThrow(ConflictException);
  });

  it('uses the DATE boundary for overdue queries', async () => {
    findMany.mockResolvedValue([]);
    await service.findOverdueReceivables();
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          estado: { not: 'PAGADA' },
          fechaVencimiento: { lt: new Date('2026-10-17T00:00:00.000Z') },
        },
      }),
    );
  });
});
