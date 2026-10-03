'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Order } from '@/services/orderService';

// Esquema con tipos correctos
const orderSchema = z.object({
  clientId: z.string().min(1, 'Cliente es requerido'),
  clientName: z.string().min(1, 'Nombre del cliente es requerido'),
  date: z.string().min(1, 'Fecha es requerida'),
  total: z.number().positive('Total debe ser positivo'), // ¡cambiamos a number()!
  status: z.enum(['pending', 'processing', 'delivered', 'cancelled']),
  address: z.string().min(1, 'Dirección es requerida'),
});

type OrderFormValues = z.infer<typeof orderSchema>;

interface OrderFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: OrderFormValues) => void;
  initialData?: Order | null;
}

export function OrderFormModal({
  open,
  onOpenChange,
  onSubmit,
  initialData,
}: OrderFormModalProps) {
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<OrderFormValues>({
    resolver: zodResolver(orderSchema),
    defaultValues: {
      clientId: '',
      clientName: '',
      date: new Date().toISOString().split('T')[0],
      total: 0,
      status: 'pending',
      address: '',
    },
  });

  useEffect(() => {
    if (initialData) {
      reset({
        clientId: initialData.clientId,
        clientName: initialData.clientName,
        date: initialData.date,
        total: initialData.total,
        status: initialData.status,
        address: initialData.address,
      });
    } else {
      reset({
        clientId: '',
        clientName: '',
        date: new Date().toISOString().split('T')[0],
        total: 0,
        status: 'pending',
        address: '',
      });
    }
  }, [initialData, reset]);

  // Este handler se pasa directamente a handleSubmit, sin envolver
  const onFormSubmit = (data: OrderFormValues) => {
    onSubmit(data);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{initialData ? 'Editar Pedido' : 'Nuevo Pedido'}</DialogTitle>
          <DialogDescription>
            Completa los datos del pedido.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onFormSubmit)}>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="clientName" className="text-right">
                Cliente
              </Label>
              <Input
                id="clientName"
                {...register('clientName')}
                className="col-span-3"
              />
              {errors.clientName && (
                <p className="col-span-3 col-start-2 text-sm text-red-500">
                  {errors.clientName.message}
                </p>
              )}
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="date" className="text-right">
                Fecha
              </Label>
              <Input
                id="date"
                type="date"
                {...register('date')}
                className="col-span-3"
              />
              {errors.date && (
                <p className="col-span-3 col-start-2 text-sm text-red-500">
                  {errors.date.message}
                </p>
              )}
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="total" className="text-right">
                Total
              </Label>
              <Input
                id="total"
                type="number"
                step="0.01"
                {...register('total', { valueAsNumber: true })} // ← importante: convertir a número
                className="col-span-3"
              />
              {errors.total && (
                <p className="col-span-3 col-start-2 text-sm text-red-500">
                  {errors.total.message}
                </p>
              )}
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="status" className="text-right">
                Estado
              </Label>
              <Select
                onValueChange={(value) => setValue('status', value as 'pending' | 'processing' | 'delivered' | 'cancelled')}
                defaultValue={initialData?.status || 'pending'}
              >
                <SelectTrigger className="col-span-3">
                  <SelectValue placeholder="Selecciona estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pendiente</SelectItem>
                  <SelectItem value="processing">En proceso</SelectItem>
                  <SelectItem value="delivered">Entregado</SelectItem>
                  <SelectItem value="cancelled">Cancelado</SelectItem>
                </SelectContent>
              </Select>
              {errors.status && (
                <p className="col-span-3 col-start-2 text-sm text-red-500">
                  {errors.status.message}
                </p>
              )}
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="address" className="text-right">
                Dirección
              </Label>
              <Input
                id="address"
                {...register('address')}
                className="col-span-3"
              />
              {errors.address && (
                <p className="col-span-3 col-start-2 text-sm text-red-500">
                  {errors.address.message}
                </p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Guardando...' : 'Guardar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}