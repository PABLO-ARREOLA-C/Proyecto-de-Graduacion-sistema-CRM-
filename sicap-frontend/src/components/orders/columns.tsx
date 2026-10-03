'use client';

import { ColumnDef } from '@tanstack/react-table';
import { Order } from '@/services/orderService';
import { Button } from '@/components/ui/button';
import { MoreHorizontal } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export const columns: ColumnDef<Order>[] = [
  {
    accessorKey: 'clientName',
    header: 'Cliente',
  },
  {
    accessorKey: 'date',
    header: 'Fecha',
    cell: ({ row }) => {
      const date = new Date(row.getValue('date'));
      return date.toLocaleDateString('es-GT');
    },
  },
  {
    accessorKey: 'total',
    header: 'Total',
    cell: ({ row }) => {
      const total = parseFloat(row.getValue('total'));
      const formatted = new Intl.NumberFormat('es-GT', {
        style: 'currency',
        currency: 'GTQ',
      }).format(total);
      return formatted;
    },
  },
  {
    accessorKey: 'status',
    header: 'Estado',
    cell: ({ row }) => {
      const status = row.getValue('status') as string;
      const statusMap: Record<string, string> = {
        pending: 'Pendiente',
        processing: 'En proceso',
        delivered: 'Entregado',
        cancelled: 'Cancelado',
      };
      return statusMap[status] || status;
    },
  },
  {
    accessorKey: 'address',
    header: 'Dirección',
  },
  {
    id: 'actions',
    cell: ({ row }) => {
      const order = row.original;
      return (
        <DropdownMenu>
         <DropdownMenuTrigger>
  <Button variant="ghost" className="h-8 w-8 p-0">
    <MoreHorizontal className="h-4 w-4" />
  </Button>
</DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Acciones</DropdownMenuLabel>
            <DropdownMenuItem onClick={() => console.log('Editar', order)}>
              Editar
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => console.log('Eliminar', order)}>
              Eliminar
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      );
    },
  },
];