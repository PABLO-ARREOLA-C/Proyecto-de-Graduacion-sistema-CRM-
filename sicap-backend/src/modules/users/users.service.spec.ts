import { BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from './users.service';

describe('UsersService client linking', () => {
  const findUser = jest.fn();
  const findClient = jest.fn();
  const updateClients = jest.fn();
  let service: UsersService;
  beforeEach(() => {
    findUser.mockReset().mockResolvedValue({ rol: { nombre: 'Cliente' } });
    findClient.mockReset().mockResolvedValue({ estado: true, idUsuario: null });
    updateClients.mockReset().mockResolvedValue({ count: 1 });
    const tx = {
      usuario: { findUnique: findUser },
      cliente: { findUnique: findClient, updateMany: updateClients },
    };
    service = new UsersService({
      usuario: { findUnique: findUser },
      $transaction: (callback: (value: typeof tx) => unknown) => callback(tx),
    } as unknown as PrismaService);
  });
  it('does not steal a profile already linked to another account', async () => {
    findClient.mockResolvedValue({ estado: true, idUsuario: 'other-user' });
    await expect(service.linkClient('user', 'client')).rejects.toThrow(
      ConflictException,
    );
    expect(updateClients).not.toHaveBeenCalled();
  });
  it('rejects linking profiles to staff accounts', async () => {
    findUser.mockResolvedValue({ rol: { nombre: 'Administrador' } });
    await expect(service.linkClient('user', 'client')).rejects.toThrow(
      BadRequestException,
    );
    expect(updateClients).not.toHaveBeenCalled();
  });
  it('only assigns a profile that is still unlinked at write time', async () => {
    await service.linkClient('user', 'client');
    expect(updateClients).toHaveBeenLastCalledWith({
      where: { idCliente: 'client', idUsuario: null, estado: true },
      data: { idUsuario: 'user' },
    });
  });
  it('rejects when the target was assigned concurrently', async () => {
    updateClients
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 0 });
    await expect(service.linkClient('user', 'client')).rejects.toThrow(
      ConflictException,
    );
  });
  it('unlinks without selecting a profile belonging to another user', async () => {
    await service.linkClient('user', null);
    expect(updateClients).toHaveBeenCalledTimes(1);
    expect(updateClients).toHaveBeenCalledWith({
      where: { idUsuario: 'user' },
      data: { idUsuario: null },
    });
  });
});
