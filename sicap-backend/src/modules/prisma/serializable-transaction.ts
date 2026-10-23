import { ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from './prisma.service';

export async function serializableTransaction<T>(
  prisma: PrismaService,
  operation: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await prisma.$transaction(operation, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      });
    } catch (error) {
      const cause = error instanceof Error ? error.cause : undefined;
      const adapterConflict =
        error instanceof Error &&
        error.name === 'DriverAdapterError' &&
        typeof cause === 'object' &&
        cause !== null &&
        'kind' in cause &&
        cause.kind === 'TransactionWriteConflict';
      if (
        !adapterConflict &&
        !(
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2034'
        )
      )
        throw error;
      if (attempt >= 2)
        throw new ConflictException(
          'El pedido cambió durante la operación. Actualiza y vuelve a intentarlo.',
        );
    }
  }
}
