'use client';

import type { ColumnDef } from '@tanstack/react-table';
import { MoreHorizontal } from 'lucide-react';

import type { Order } from '@/services/orderService';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface OrderColumnsProps {
  onEdit: (order: Order) => void;
  onConfirm: (order: Order) => void;
  onCancel: (order: Order) => void;
}

function formatCurrency(value: number | string): string {
  const amount = Number(value);

  if (Number.isNaN(amount)) {
    return 'Q 0.00';
  }

  return new Intl.NumberFormat('es-GT', {
    style: 'currency',
    currency: 'GTQ',
  }).format(amount);
}

function formatDate(value?: string | null): string {
  if (!value) {
    return '—';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '—';
  }

  return date.toLocaleDateString('es-GT');
}

function formatStatus(status: Order['estado']): string {
  const statusMap: Record<Order['estado'], string> = {
    PENDIENTE: 'Pendiente',
    CONFIRMADO: 'Confirmado',
    EN_RUTA: 'En ruta',
    ENTREGADO: 'Entregado',
    CANCELADO: 'Cancelado',
  };

  return statusMap[status] ?? status;
}

function formatSaleType(type: Order['tipoVenta']): string {
  return type === 'CREDITO' ? 'Crédito' : 'Contado';
}

export function getColumns({
  onEdit,
  onConfirm,
  onCancel,
}: OrderColumnsProps): ColumnDef<Order>[] {
  return [
    {
      accessorKey: 'numeroPedido',
      header: 'No. Pedido',
      cell: ({ row }) => (
        <span className="font-medium">
          {row.original.numeroPedido}
        </span>
      ),
    },
    {
      id: 'cliente',
      header: 'Cliente',
      cell: ({ row }) =>
        row.original.cliente?.nombre ?? '—',
    },
    {
      id: 'fechaPedido',
      header: 'Fecha',
      cell: ({ row }) =>
        formatDate(row.original.fechaPedido),
    },
    {
      accessorKey: 'total',
      header: 'Total',
      cell: ({ row }) =>
        formatCurrency(row.original.total),
    },
    {
      accessorKey: 'tipoVenta',
      header: 'Tipo de venta',
      cell: ({ row }) =>
        formatSaleType(row.original.tipoVenta),
    },
    {
      accessorKey: 'estado',
      header: 'Estado',
      cell: ({ row }) =>
        formatStatus(row.original.estado),
    },
    {
      id: 'direccion',
      header: 'Dirección',
      cell: ({ row }) =>
        row.original.direccion?.direccion ?? '—',
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => {
        const order = row.original;

        const isFinalized =
          order.estado === 'ENTREGADO' ||
          order.estado === 'CANCELADO';

        return (
          <DropdownMenu>
            <DropdownMenuTrigger
              className="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-accent hover:text-accent-foreground"
              aria-label={`Acciones del pedido ${order.numeroPedido}`}
            >
              <MoreHorizontal className="h-4 w-4" />
            </DropdownMenuTrigger>

            <DropdownMenuContent align="end">
             

              {!isFinalized && (
                <DropdownMenuItem
                  onClick={() => onEdit(order)}
                >
                  Editar
                </DropdownMenuItem>
              )}

              {order.estado === 'PENDIENTE' && (
                <DropdownMenuItem
                  onClick={() => onConfirm(order)}
                >
                  Confirmar pedido
                </DropdownMenuItem>
              )}

              {!isFinalized && (
                <>
                  <DropdownMenuSeparator />

                  <DropdownMenuItem
                    onClick={() => onCancel(order)}
                    className="text-destructive focus:text-destructive"
                  >
                    Cancelar pedido
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
    },
  ];
}