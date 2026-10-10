'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { DataTable } from '@/components/ui/data-table';

import { ClientFormModal } from '@/components/clients/ClientFormModal';
import { columns } from '@/components/clients/columns';

import {
  Client,
  ClientCreateData,
  clientService,
} from '@/services/clientService';

function getErrorMessage(error: unknown): string {
  if (
    typeof error === 'object' &&
    error !== null &&
    'response' in error
  ) {
    const axiosError = error as {
      response?: {
        data?: {
          message?: string | string[];
        };
      };
    };

    const message = axiosError.response?.data?.message;

    if (Array.isArray(message)) {
      return message.join(', ');
    }

    if (message) {
      return message;
    }
  }

  return 'Ocurrió un error inesperado';
}

export default function ClientsPage() {
  const queryClient = useQueryClient();

  const [modalOpen, setModalOpen] = useState(false);
  const [selectedClient, setSelectedClient] =
    useState<Client | null>(null);

  const {
    data: clients = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ['clients'],
    queryFn: clientService.getAll,
  });

  const createMutation = useMutation({
    mutationFn: (data: ClientCreateData) =>
      clientService.create(data),

    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['clients'],
      });

      toast.success('Cliente creado correctamente');

      setModalOpen(false);
      setSelectedClient(null);
    },

    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: Partial<Client>;
    }) => clientService.update(id, data),

    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['clients'],
      });

      toast.success('Cliente actualizado correctamente');

      setModalOpen(false);
      setSelectedClient(null);
    },

    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      clientService.delete(id),

    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['clients'],
      });

      toast.success('Cliente desactivado correctamente');
    },

    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });

  const handleNewClient = () => {
    setSelectedClient(null);
    setModalOpen(true);
  };

  const handleEdit = (client: Client) => {
    setSelectedClient(client);
    setModalOpen(true);
  };

  const handleDelete = (client: Client) => {
    const confirmed = window.confirm(
      `¿Desea desactivar al cliente ${client.name}?`,
    );

    if (!confirmed) {
      return;
    }

    deleteMutation.mutate(client.id);
  };

 const clientColumns = columns(
  handleEdit,
  handleDelete,
);

  const handleSubmit = async (
    data: ClientCreateData,
  ) => {
    if (selectedClient) {
      await updateMutation.mutateAsync({
        id: selectedClient.id,
        data,
      });

      return;
    }

    await createMutation.mutateAsync(data);
  };

  if (isLoading) {
    return <div>Cargando clientes...</div>;
  }

  if (error) {
    return (
      <div className="text-red-500">
        Error al cargar los clientes.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">
            Clientes
          </h1>

          <p className="text-sm text-muted-foreground">
            Gestión de clientes de Purificadora Rehobot.
          </p>
        </div>

        <Button onClick={handleNewClient}>
          <Plus className="mr-2 h-4 w-4" />
          Nuevo Cliente
        </Button>
      </div>

      <DataTable
        columns={clientColumns}
        data={clients}
      />

      <ClientFormModal
        open={modalOpen}
        onOpenChange={(open) => {
          setModalOpen(open);

          if (!open) {
            setSelectedClient(null);
          }
        }}
        onSubmit={handleSubmit}
        initialData={selectedClient}
      />
    </div>
  );
}