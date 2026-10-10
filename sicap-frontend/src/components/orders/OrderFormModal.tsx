'use client';

import { useEffect, useMemo } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQuery } from '@tanstack/react-query';

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

import { clientService } from '@/services/clientService';
import { productService } from '@/services/productService';

import {
  CreateOrderPayload,
  Order,
  UpdateOrderPayload,
} from '@/services/orderService';

const orderSchema = z.object({
  idCliente: z.string().min(1, 'Seleccione un cliente'),
  idDireccion: z.string().min(1, 'Seleccione una dirección'),
  fechaEntregaSolicitada: z
    .string()
    .min(1, 'Seleccione la fecha de entrega'),
  tipoVenta: z.enum(['CONTADO', 'CREDITO']),
  idProducto: z.string().min(1, 'Seleccione un producto'),
  cantidad: z
    .number()
    .int('La cantidad debe ser un número entero')
    .min(1, 'La cantidad mínima es 1'),
  observaciones: z
    .string()
    .max(1000, 'Máximo 1000 caracteres')
    .optional(),
});

type OrderFormValues = z.infer<typeof orderSchema>;

interface OrderFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (
    data: CreateOrderPayload | UpdateOrderPayload,
  ) => Promise<void>;
  initialData?: Order | null;
}

function getToday(): string {
  return new Date().toISOString().split('T')[0];
}

function formatDateForInput(value?: string | null): string {
  if (!value) {
    return getToday();
  }

  return value.split('T')[0];
}

export function OrderFormModal({
  open,
  onOpenChange,
  onSubmit,
  initialData,
}: OrderFormModalProps) {
  const {
    control,
    register,
    handleSubmit,
    reset,
    setValue,
    formState: {
      errors,
      isSubmitting,
    },
  } = useForm<OrderFormValues>({
    resolver: zodResolver(orderSchema),
    defaultValues: {
      idCliente: '',
      idDireccion: '',
      fechaEntregaSolicitada: getToday(),
      tipoVenta: 'CONTADO',
      idProducto: '',
      cantidad: 1,
      observaciones: '',
    },
  });

  const selectedClientId =
    useWatch({
      control,
      name: 'idCliente',
    }) ?? '';

  const selectedAddressId =
    useWatch({
      control,
      name: 'idDireccion',
    }) ?? '';

  const selectedProductId =
    useWatch({
      control,
      name: 'idProducto',
    }) ?? '';

  const quantity =
    useWatch({
      control,
      name: 'cantidad',
    }) ?? 1;

  const saleType =
    useWatch({
      control,
      name: 'tipoVenta',
    }) ?? 'CONTADO';

  const {
    data: clients = [],
    isLoading: loadingClients,
  } = useQuery({
    queryKey: ['clients'],
    queryFn: clientService.getAll,
    enabled: open,
  });

  const {
    data: products = [],
    isLoading: loadingProducts,
  } = useQuery({
    queryKey: ['products'],
    queryFn: productService.getAll,
    enabled: open,
  });

  const selectedClient = useMemo(
    () =>
      clients.find(
        (client) => client.id === selectedClientId,
      ),
    [clients, selectedClientId],
  );

  const selectedProduct = useMemo(
    () =>
      products.find(
        (product) =>
          product.idProducto === selectedProductId,
      ),
    [products, selectedProductId],
  );

  const estimatedTotal = useMemo(() => {
    if (!selectedProduct) {
      return 0;
    }

    const price = Number(selectedProduct.precioActual);
    const qty = Number(quantity);

    if (
      Number.isNaN(price) ||
      Number.isNaN(qty)
    ) {
      return 0;
    }

    return price * qty;
  }, [selectedProduct, quantity]);

  useEffect(() => {
    if (!open) {
      return;
    }

    if (initialData) {
      reset({
        idCliente: initialData.idCliente,
        idDireccion: initialData.idDireccion,
        fechaEntregaSolicitada: formatDateForInput(
          initialData.fechaEntregaSolicitada,
        ),
        tipoVenta: initialData.tipoVenta,
        idProducto:
          initialData.detalles?.[0]?.idProducto ?? '',
        cantidad:
          initialData.detalles?.[0]?.cantidad ?? 1,
        observaciones:
          initialData.observaciones ?? '',
      });

      return;
    }

    reset({
      idCliente: '',
      idDireccion: '',
      fechaEntregaSolicitada: getToday(),
      tipoVenta: 'CONTADO',
      idProducto: '',
      cantidad: 1,
      observaciones: '',
    });
  }, [initialData, open, reset]);

  const handleClientChange = (
    value: string | null,
  ) => {
    const clientId = value ?? '';

    setValue('idCliente', clientId, {
      shouldValidate: true,
    });

    setValue('idDireccion', '', {
      shouldValidate: false,
    });
  };

  const handleAddressChange = (
    value: string | null,
  ) => {
    setValue('idDireccion', value ?? '', {
      shouldValidate: true,
    });
  };

  const handleProductChange = (
    value: string | null,
  ) => {
    setValue('idProducto', value ?? '', {
      shouldValidate: true,
    });
  };

  const handleSaleTypeChange = (
    value: string | null,
  ) => {
    if (
      value !== 'CONTADO' &&
      value !== 'CREDITO'
    ) {
      return;
    }

    setValue('tipoVenta', value, {
      shouldValidate: true,
    });
  };

  const onFormSubmit = async (
    data: OrderFormValues,
  ) => {
    if (initialData) {
      const updatePayload: UpdateOrderPayload = {
        idDireccion: data.idDireccion,
        fechaEntregaSolicitada:
          data.fechaEntregaSolicitada,
        tipoVenta: data.tipoVenta,
        observaciones:
          data.observaciones?.trim() ?? '',
      };

      await onSubmit(updatePayload);
      onOpenChange(false);
      return;
    }

    const createPayload: CreateOrderPayload = {
      idCliente: data.idCliente,
      idDireccion: data.idDireccion,
      fechaEntregaSolicitada:
        data.fechaEntregaSolicitada,
      tipoVenta: data.tipoVenta,
      observaciones:
        data.observaciones?.trim() || undefined,
      detalles: [
        {
          idProducto: data.idProducto,
          cantidad: data.cantidad,
        },
      ],
    };

    await onSubmit(createPayload);
    onOpenChange(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
    >
      <DialogContent className="sm:max-w-150">
        <DialogHeader>
          <DialogTitle>
            {initialData
              ? 'Editar Pedido'
              : 'Nuevo Pedido'}
          </DialogTitle>

          <DialogDescription>
            {initialData
              ? 'Modifique los datos permitidos del pedido.'
              : 'Seleccione el cliente, la dirección y el producto.'}
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={handleSubmit(onFormSubmit)}
        >
          <div className="grid gap-5 py-4">

            {/* CLIENTE */}
            <div className="grid gap-2">
              <Label>Cliente</Label>

              <Select
                value={selectedClientId}
                onValueChange={handleClientChange}
                disabled={
                  Boolean(initialData) ||
                  loadingClients
                }
              >
                <SelectTrigger>
                  <SelectValue
                    placeholder={
                      loadingClients
                        ? 'Cargando clientes...'
                        : 'Seleccione un cliente'
                    }
                  />
                </SelectTrigger>

                <SelectContent>
                  {clients.map((client) => (
                    <SelectItem
                      key={client.id}
                      value={client.id}
                    >
                      {client.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {errors.idCliente && (
                <p className="text-sm text-red-500">
                  {errors.idCliente.message}
                </p>
              )}
            </div>

            {/* DIRECCIÓN */}
            <div className="grid gap-2">
              <Label>
                Dirección de entrega
              </Label>

              <Select
                value={selectedAddressId}
                onValueChange={
                  handleAddressChange
                }
                disabled={!selectedClientId}
              >
                <SelectTrigger>
                  <SelectValue
                    placeholder={
                      selectedClientId
                        ? 'Seleccione una dirección'
                        : 'Primero seleccione un cliente'
                    }
                  />
                </SelectTrigger>

                <SelectContent>
                  {selectedClient?.addresses.map(
                    (address) => (
                      <SelectItem
                        key={
                          address.idDireccion
                        }
                        value={
                          address.idDireccion
                        }
                      >
                        {address.direccion}
                      </SelectItem>
                    ),
                  )}
                </SelectContent>
              </Select>

              {errors.idDireccion && (
                <p className="text-sm text-red-500">
                  {errors.idDireccion.message}
                </p>
              )}

              {selectedClient &&
                selectedClient.addresses.length ===
                  0 && (
                  <p className="text-sm text-amber-600">
                    Este cliente no tiene
                    direcciones activas registradas.
                  </p>
                )}
            </div>

            {/* FECHA */}
            <div className="grid gap-2">
              <Label htmlFor="fechaEntregaSolicitada">
                Fecha de entrega solicitada
              </Label>

              <Input
                id="fechaEntregaSolicitada"
                type="date"
                {...register(
                  'fechaEntregaSolicitada',
                )}
              />

              {errors.fechaEntregaSolicitada && (
                <p className="text-sm text-red-500">
                  {
                    errors
                      .fechaEntregaSolicitada
                      .message
                  }
                </p>
              )}
            </div>

            {/* TIPO DE VENTA */}
            <div className="grid gap-2">
              <Label>Tipo de venta</Label>

              <Select
                value={saleType}
                onValueChange={
                  handleSaleTypeChange
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>

                <SelectContent>
                  <SelectItem value="CONTADO">
                    Contado
                  </SelectItem>

                  <SelectItem value="CREDITO">
                    Crédito
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* PRODUCTO */}
            {!initialData && (
              <>
                <div className="grid gap-2">
                  <Label>Producto</Label>

                  <Select
                    value={selectedProductId}
                    onValueChange={
                      handleProductChange
                    }
                    disabled={loadingProducts}
                  >
                    <SelectTrigger>
                      <SelectValue
                        placeholder={
                          loadingProducts
                            ? 'Cargando productos...'
                            : 'Seleccione un producto'
                        }
                      />
                    </SelectTrigger>

                    <SelectContent>
                      {products.map(
                        (product) => (
                          <SelectItem
                            key={
                              product.idProducto
                            }
                            value={
                              product.idProducto
                            }
                          >
                            {product.nombre} - Q
                            {Number(
                              product.precioActual,
                            ).toFixed(2)}
                          </SelectItem>
                        ),
                      )}
                    </SelectContent>
                  </Select>

                  {errors.idProducto && (
                    <p className="text-sm text-red-500">
                      {
                        errors.idProducto
                          .message
                      }
                    </p>
                  )}
                </div>

                {/* CANTIDAD */}
                <div className="grid gap-2">
                  <Label htmlFor="cantidad">
                    Cantidad
                  </Label>

                  <Input
                    id="cantidad"
                    type="number"
                    min={1}
                    step={1}
                    {...register('cantidad', {
                      valueAsNumber: true,
                    })}
                  />

                  {errors.cantidad && (
                    <p className="text-sm text-red-500">
                      {
                        errors.cantidad
                          .message
                      }
                    </p>
                  )}
                </div>

                {/* TOTAL ESTIMADO */}
                <div className="rounded-md border p-3">
                  <p className="text-sm text-muted-foreground">
                    Total estimado
                  </p>

                  <p className="text-xl font-semibold">
                    {new Intl.NumberFormat(
                      'es-GT',
                      {
                        style: 'currency',
                        currency: 'GTQ',
                      },
                    ).format(
                      estimatedTotal,
                    )}
                  </p>

                  <p className="mt-1 text-xs text-muted-foreground">
                    El total definitivo será
                    calculado por el servidor.
                  </p>
                </div>
              </>
            )}

            {/* OBSERVACIONES */}
            <div className="grid gap-2">
              <Label htmlFor="observaciones">
                Observaciones
              </Label>

              <textarea
                id="observaciones"
                rows={3}
                maxLength={1000}
                className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                placeholder="Observaciones opcionales..."
                {...register('observaciones')}
              />

              {errors.observaciones && (
                <p className="text-sm text-red-500">
                  {
                    errors.observaciones
                      .message
                  }
                </p>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() =>
                onOpenChange(false)
              }
            >
              Cancelar
            </Button>

            <Button
              type="submit"
              disabled={isSubmitting}
            >
              {isSubmitting
                ? 'Guardando...'
                : initialData
                  ? 'Guardar cambios'
                  : 'Crear pedido'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}