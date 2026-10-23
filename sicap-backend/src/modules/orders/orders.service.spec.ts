import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { OrdersService } from './orders.service';

describe('Order financial consistency', () => {
  const findUnique = jest.fn();
  const update = jest.fn();
  const findAddress = jest.fn();
  const transaction = jest.fn();
  let service: OrdersService;
  const base = {
    idPedido: 'order',
    idCliente: 'client',
    estado: 'CONFIRMADO',
    tipoVenta: 'CONTADO',
    pagos: [],
    cuentaPorCobrar: null,
  };
  beforeEach(() => {
    jest.clearAllMocks();
    findUnique.mockReset().mockResolvedValue({ ...base });
    update.mockReset().mockResolvedValue({ idPedido: 'order' });
    findAddress.mockReset().mockResolvedValue({ idDireccion: 'address' });
    transaction
      .mockReset()
      .mockImplementation((callback: (tx: unknown) => Promise<unknown>) =>
        callback({
          pedido: { findUnique, update },
          direccionCliente: { findFirst: findAddress },
        }),
      );
    service = new OrdersService({
      $transaction: transaction,
    } as unknown as PrismaService);
  });

  it.each([
    ['CONTADO', 'CREDITO'],
    ['CREDITO', 'CONTADO'],
  ])('allows %s to %s before financial activity', async (from, to) => {
    findUnique.mockResolvedValue({ ...base, tipoVenta: from });
    await service.update('order', { tipoVenta: to });
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { tipoVenta: to } }),
    );
    expect(transaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    });
  });

  it.each([
    ['CONTADO', [{ idPago: 'payment' }], null],
    ['CREDITO', [{ idPago: 'payment' }], null],
    ['CREDITO', [], { idCuenta: 'account' }],
    ['CREDITO', [{ idPago: 'payment' }], { idCuenta: 'account' }],
    ['CONTADO', [], { idCuenta: 'legacy-account' }],
  ])(
    'rejects changes with existing financial records: %s %j %j',
    async (tipoVenta, pagos, cuentaPorCobrar) => {
      findUnique.mockResolvedValue({
        ...base,
        tipoVenta,
        pagos,
        cuentaPorCobrar,
      });
      await expect(
        service.update('order', {
          tipoVenta: tipoVenta === 'CONTADO' ? 'CREDITO' : 'CONTADO',
          observaciones: 'must not be saved',
        }),
      ).rejects.toThrow(BadRequestException);
      expect(update).not.toHaveBeenCalled();
    },
  );

  it.each([undefined, 'CONTADO'])(
    'allows other edits with payments if sale type is unchanged: %s',
    async (tipoVenta) => {
      findUnique.mockResolvedValue({ ...base, pagos: [{ idPago: 'payment' }] });
      await service.update('order', { tipoVenta, observaciones: '  Note  ' });
      expect(update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { ...(tipoVenta ? { tipoVenta } : {}), observaciones: 'Note' },
        }),
      );
    },
  );

  it.each(['ENTREGADO', 'CANCELADO'])(
    'preserves final order restrictions: %s',
    async (estado) => {
      findUnique.mockResolvedValue({ ...base, estado });
      await expect(
        service.update('order', { observaciones: 'Note' }),
      ).rejects.toThrow(BadRequestException);
      expect(update).not.toHaveBeenCalled();
    },
  );

  it('rejects missing orders', async () => {
    findUnique.mockResolvedValue(null);
    await expect(service.update('missing', {})).rejects.toThrow(
      NotFoundException,
    );
  });

  it('preserves validation of address ownership', async () => {
    findAddress.mockResolvedValue(null);
    await expect(
      service.update('order', { idDireccion: 'foreign' }),
    ).rejects.toThrow(BadRequestException);
    expect(findAddress).toHaveBeenCalledWith({
      where: { idDireccion: 'foreign', idCliente: 'client', estado: true },
    });
    expect(update).not.toHaveBeenCalled();
  });

  it('rechecks financial records after a serialization conflict', async () => {
    update.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError('conflict', {
        code: 'P2034',
        clientVersion: 'test',
      }),
    );
    findUnique
      .mockResolvedValueOnce(base)
      .mockResolvedValueOnce({ ...base, pagos: [{ idPago: 'new-payment' }] });
    await expect(
      service.update('order', { tipoVenta: 'CREDITO' }),
    ).rejects.toThrow(BadRequestException);
    expect(transaction).toHaveBeenCalledTimes(2);
    expect(update).toHaveBeenCalledTimes(1);
  });

  it('returns 409 if contention persists', async () => {
    transaction.mockRejectedValue(
      Object.assign(
        new Error('conflict', { cause: { kind: 'TransactionWriteConflict' } }),
        { name: 'DriverAdapterError' },
      ),
    );
    await expect(service.update('order', {})).rejects.toThrow(
      ConflictException,
    );
    expect(transaction).toHaveBeenCalledTimes(3);
  });
});
