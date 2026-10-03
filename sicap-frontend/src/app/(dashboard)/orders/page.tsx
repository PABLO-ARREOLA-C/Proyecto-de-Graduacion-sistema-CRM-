'use client';

import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { DataTable } from '@/components/ui/data-table';
import { columns } from '@/components/orders/columns';
import { useQuery } from '@tanstack/react-query';
import { orderService } from '@/services/orderService';

export default function OrdersPage() {
  const { data: orders, isLoading, error } = useQuery({
    queryKey: ['orders'],
    queryFn: orderService.getAll,
  });

  if (isLoading) return <div>Cargando...</div>;
  if (error) return <div>Error al cargar pedidos</div>;

  const handleNewOrder = () => {
    console.log('Abrir modal para nuevo pedido (próximamente)');
    // Aquí irá la lógica para abrir el formulario
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Pedidos</h1>
        <Button onClick={handleNewOrder}>
          <Plus className="mr-2 h-4 w-4" /> Nuevo Pedido
        </Button>
      </div>
      <DataTable columns={columns} data={orders || []} />
    </div>
  );
}