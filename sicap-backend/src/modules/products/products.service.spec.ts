import { BadRequestException, NotFoundException } from '@nestjs/common';
import { validate } from 'class-validator';
import { PrismaService } from '../prisma/prisma.service';
import { UpdatePromotionDto } from './dto/update-promotion.dto';
import { ProductsService } from './products.service';

describe('ProductsService promotion dates', () => {
  const update = jest.fn();
  const create = jest.fn();
  const findPromotion = jest.fn();
  let service: ProductsService;
  beforeEach(() => {
    update.mockReset().mockResolvedValue({});
    create.mockReset().mockResolvedValue({});
    findPromotion.mockReset().mockResolvedValue({
      fechaInicio: new Date('2026-10-01T00:00:00.000Z'),
      fechaFin: new Date('2026-10-31T00:00:00.000Z'),
    });
    service = new ProductsService({
      producto: {
        findUnique: jest.fn().mockResolvedValue({ idProducto: 'product' }),
      },
      promocion: { findFirst: findPromotion, create, update },
    } as unknown as PrismaService);
  });
  it('clears a stored end date when null is supplied', async () => {
    await service.updatePromotion('product', 'promotion', { fechaFin: null });
    expect(update).toHaveBeenCalledWith({
      where: { idPromocion: 'promotion' },
      data: { fechaFin: null },
    });
    expect(
      await validate(
        Object.assign(new UpdatePromotionDto(), { fechaFin: null }),
      ),
    ).toHaveLength(0);
  });
  it('preserves the end date when it is omitted', async () => {
    await service.updatePromotion('product', 'promotion', {
      nombre: 'New name',
    });
    expect(update).toHaveBeenCalledWith({
      where: { idPromocion: 'promotion' },
      data: { nombre: 'New name' },
    });
  });
  it('allows a start date after the previous end when removing that end date', async () => {
    await service.updatePromotion('product', 'promotion', {
      fechaInicio: '2026-11-01',
      fechaFin: null,
    });
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          fechaInicio: new Date('2026-11-01T00:00:00.000Z'),
          fechaFin: null,
        },
      }),
    );
  });
  it('rejects an end before the start without writes', async () => {
    await expect(
      service.updatePromotion('product', 'promotion', {
        fechaFin: '2026-09-30',
      }),
    ).rejects.toThrow(BadRequestException);
    expect(update).not.toHaveBeenCalled();
  });
  it.each(['2026-02-30', 'invalid'])(
    'rejects invalid date %s without writes',
    async (fechaInicio) => {
      await expect(
        service.createPromotion('product', {
          nombre: 'Test promotion',
          cantidadRequerida: 2,
          cantidadBonificada: 1,
          fechaInicio,
        }),
      ).rejects.toThrow(BadRequestException);
      expect(create).not.toHaveBeenCalled();
    },
  );
  it('supports start and end on the same calendar day', async () => {
    await service.createPromotion('product', {
      nombre: 'One day',
      cantidadRequerida: 2,
      cantidadBonificada: 1,
      fechaInicio: '2026-10-17',
      fechaFin: '2026-10-17',
    });
    const calls = create.mock.calls as Array<
      [{ data: { fechaInicio: Date; fechaFin: Date } }]
    >;
    const saved = calls[0][0];
    expect(saved.data.fechaInicio).toEqual(
      new Date('2026-10-17T00:00:00.000Z'),
    );
    expect(saved.data.fechaFin).toEqual(new Date('2026-10-17T00:00:00.000Z'));
  });
  it('rejects a promotion outside the requested product', async () => {
    findPromotion.mockResolvedValue(null);
    await expect(
      service.updatePromotion('other-product', 'promotion', { estado: true }),
    ).rejects.toThrow(NotFoundException);
    expect(findPromotion).toHaveBeenCalledWith({
      where: { idProducto: 'other-product', idPromocion: 'promotion' },
    });
    expect(update).not.toHaveBeenCalled();
  });
});
