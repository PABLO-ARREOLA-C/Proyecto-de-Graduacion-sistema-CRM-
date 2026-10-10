'use client';

import { useState } from 'react';
import {
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { DataTable } from '@/components/ui/data-table';

import { OrderFormModal } from '@/components/orders/OrderFormModal';
import { getColumns } from '@/components/orders/columns';

import {
  CreateOrderPayload,
  Order,
  UpdateOrderPayload,
  orderService,
} from '@/services/orderService';

function getErrorMessage(error: unknown): string {
  if (
    typeof error === 'object' &&
    error !== null &&
    'response' in error
  ) {
    const response = (
      error as {
        response?: {
          data?: {
            message?: string | string[];
          };
        };
      }
    ).response;

    const message = response?.data?.message;

    if (Array.isArray(message)) {
      return message.join(', ');
    }

    if (typeof message === 'string') {
      return message;
    }
  }

  if (error instanceof Error) {
    return error.message;
  }

  return 'Ocurrió un error inesperado.';
}

export default function OrdersPage() {
  const queryClient = useQueryClient();

  const [modalOpen, setModalOpen] =
    useState(false);

  const [selectedOrder, setSelectedOrder] =
    useState<Order | null>(null);

  const {
    data: orders = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ['orders'],
    queryFn: orderService.getAll,
  });

  const createMutation = useMutation({
    mutationFn: (
      data: CreateOrderPayload,
    ) => orderService.create(data),

    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ['orders'],
      });

      toast.success(
        'Pedido creado correctamente.',
      );

      setSelectedOrder(null);
      setModalOpen(false);
    },

    onError: (mutationError) => {
      toast.error(
        getErrorMessage(mutationError),
      );
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: UpdateOrderPayload;
    }) => orderService.update(id, data),

    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ['orders'],
      });

      toast.success(
        'Pedido actualizado correctamente.',
      );

      setSelectedOrder(null);
      setModalOpen(false);
    },

    onError: (mutationError) => {
      toast.error(
        getErrorMessage(mutationError),
      );
    },
  });

  const statusMutation = useMutation({
    mutationFn: ({
      id,
      estado,
      observaciones,
    }: {
      id: string;
      estado:
        | 'PENDIENTE'
        | 'CONFIRMADO'
        | 'CANCELADO';
      observaciones?: string;
    }) =>
      orderService.updateStatus(id, {
        estado,
        observaciones,
      }),

    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ['orders'],
      });
    },

    onError: (mutationError) => {
      toast.error(
        getErrorMessage(mutationError),
      );
    },
  });

  const handleNewOrder = () => {
    setSelectedOrder(null);
    setModalOpen(true);
  };

  const handleEdit = (order: Order) => {
    setSelectedOrder(order);
    setModalOpen(true);
  };

  const handleConfirm = async (
    order: Order,
  ) => {
    const confirmed = window.confirm(
      `¿Desea confirmar el pedido ${order.numeroPedido}?`,
    );

    if (!confirmed) {
      return;
    }

    try {
      await statusMutation.mutateAsync({
        id: order.idPedido,
        estado: 'CONFIRMADO',
        observaciones:
          'Pedido confirmado desde el sistema web.',
      });

      toast.success(
        'Pedido confirmado correctamente.',
      );
    } catch {
      // El mensaje se muestra en onError.
    }
  };

  const handleCancel = async (
    order: Order,
  ) => {
    const confirmed = window.confirm(
      `¿Desea cancelar el pedido ${order.numeroPedido}?`,
    );

    if (!confirmed) {
      return;
    }

    try {
      await statusMutation.mutateAsync({
        id: order.idPedido,
        estado: 'CANCELADO',
        observaciones:
          'Pedido cancelado desde el sistema web.',
      });

      toast.success(
        'Pedido cancelado correctamente.',
      );
    } catch {
      // El mensaje se muestra en onError.
    }
  };

  const handleSubmit = async (
    data:
      | CreateOrderPayload
      | UpdateOrderPayload,
  ) => {
    if (selectedOrder) {
      await updateMutation.mutateAsync({
        id: selectedOrder.idPedido,
        data: data as UpdateOrderPayload,
      });

      return;
    }

    await createMutation.mutateAsync(
      data as CreateOrderPayload,
    );
  };

  const orderColumns = getColumns({
    onEdit: handleEdit,
    onConfirm: handleConfirm,
    onCancel: handleCancel,
  });

  if (isLoading) {
    return (
      <div className="p-6">
        Cargando pedidos...
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <p className="font-medium text-destructive">
          Error al cargar los pedidos.
        </p>

        <p className="mt-2 text-sm text-muted-foreground">
          {getErrorMessage(error)}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">
            Pedidos
          </h1>

          <p className="mt-1 text-sm text-muted-foreground">
            Gestión de pedidos registrados en el
            sistema.
          </p>
        </div>

        <Button onClick={handleNewOrder}>
          <Plus className="mr-2 h-4 w-4" />
          Nuevo Pedido
        </Button>
      </div>

      <DataTable
        columns={orderColumns}
        data={orders}
      />

      <OrderFormModal
        open={modalOpen}
        onOpenChange={(open) => {
          setModalOpen(open);

          if (!open) {
            setSelectedOrder(null);
          }
        }}
        onSubmit={handleSubmit}
        initialData={selectedOrder}
      />
    </div>
  );
}