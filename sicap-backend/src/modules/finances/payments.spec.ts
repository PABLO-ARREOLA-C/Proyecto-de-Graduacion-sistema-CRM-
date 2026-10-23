import { BadRequestException, ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { validate } from 'class-validator';
import { FinancesService } from './finances.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePaymentDto } from './dto/create-payment.dto';

describe('Payment transaction recovery', () => {
  const transaction = jest.fn();
  const dto = {
    idOperacion: '11111111-1111-4111-8111-111111111111',
    monto: 10,
  };
  let service: FinancesService;
  beforeEach(() => {
    transaction.mockReset();
    service = new FinancesService({
      $transaction: transaction,
    } as unknown as PrismaService);
  });

  const conflicts = [
    new Prisma.PrismaClientKnownRequestError('serialization', {
      code: 'P2034',
      clientVersion: 'test',
    }),
    new Prisma.PrismaClientKnownRequestError('duplicate key', {
      code: 'P2002',
      clientVersion: 'test',
    }),
    Object.assign(
      new Error('TransactionWriteConflict', {
        cause: { kind: 'TransactionWriteConflict' },
      }),
      { name: 'DriverAdapterError' },
    ),
  ];
  it.each(conflicts)(
    'retries a rolled back transaction: %s',
    async (conflict) => {
      const result = { reutilizado: true };
      transaction.mockRejectedValueOnce(conflict).mockResolvedValueOnce(result);
      expect(await service.createCashPayment('order', dto, 'user')).toBe(
        result,
      );
      expect(transaction).toHaveBeenCalledTimes(2);
      expect(transaction).toHaveBeenLastCalledWith(expect.any(Function), {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      });
    },
  );

  it('bounds retries and returns conflict when the order remains busy', async () => {
    transaction.mockRejectedValue(conflicts[0]);
    await expect(service.createPayment('account', dto, 'user')).rejects.toThrow(
      ConflictException,
    );
    expect(transaction).toHaveBeenCalledTimes(3);
  });

  it('does not retry validation failures', async () => {
    transaction.mockRejectedValue(new BadRequestException('No balance'));
    await expect(
      service.createCashPayment('order', dto, 'user'),
    ).rejects.toThrow(BadRequestException);
    expect(transaction).toHaveBeenCalledTimes(1);
  });

  it.each([0, -1, 0.001, NaN, Infinity])(
    'rejects an invalid amount %s before writing',
    async (monto) => {
      await expect(
        service.createCashPayment('order', { ...dto, monto }, 'user'),
      ).rejects.toThrow(BadRequestException);
      expect(transaction).not.toHaveBeenCalled();
    },
  );

  it.each([undefined, '', 'invalid'])(
    'requires a valid operation UUID: %s',
    async (idOperacion) => {
      const errors = await validate(
        Object.assign(new CreatePaymentDto(), { monto: 10, idOperacion }),
      );
      expect(errors.some((error) => error.property === 'idOperacion')).toBe(
        true,
      );
    },
  );
});
