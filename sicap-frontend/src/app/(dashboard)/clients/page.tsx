"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { DataTable } from "@/components/ui/data-table";
import { columns } from "@/components/clients/columns";
import { clientService, Client } from "@/services/clientService";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ClientFormModal } from "@/components/clients/ClientFormModal";
import { ClientFormData } from "@/lib/validations/client";
import { toast } from "sonner";

export default function ClientsPage() {
  const [modalOpen, setModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);

  const queryClient = useQueryClient();

  const {
    data: clients,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["clients"],
    queryFn: clientService.getAll,
  });

  const createMutation = useMutation({
    mutationFn: clientService.create,

    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["clients"],
      });

      toast.success("Cliente creado exitosamente");
      setModalOpen(false);
      setEditingClient(null);
    },

    onError: (error) => {
      console.error(error);
      toast.error("Error al crear cliente");
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
        queryKey: ["clients"],
      });

      toast.success("Cliente actualizado");
      setModalOpen(false);
      setEditingClient(null);
    },

    onError: (error) => {
      console.error(error);
      toast.error("Error al actualizar cliente");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: clientService.delete,

    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["clients"],
      });

      toast.success("Cliente desactivado correctamente");
    },

    onError: (error) => {
      console.error(error);
      toast.error("Error al eliminar cliente");
    },
  });

  const handleCreate = (data: ClientFormData) => {
    createMutation.mutate(data);
  };

  const handleEdit = (client: Client) => {
    setEditingClient(client);
    setModalOpen(true);
  };

  const handleUpdate = (data: ClientFormData) => {
    if (!editingClient) return;

    updateMutation.mutate({
      id: editingClient.id,
      data,
    });
  };

  const handleDelete = (client: Client) => {
    const confirmed = window.confirm(
      `¿Deseas desactivar al cliente "${client.name}"?`,
    );

    if (!confirmed) return;

    deleteMutation.mutate(client.id);
  };

  const handleSubmit = (data: ClientFormData) => {
    if (editingClient) {
      handleUpdate(data);
    } else {
      handleCreate(data);
    }
  };

  const handleModalChange = (open: boolean) => {
    setModalOpen(open);

    if (!open) {
      setEditingClient(null);
    }
  };

  if (isLoading) {
    return <div>Cargando clientes...</div>;
  }

  if (error) {
    console.error(error);

    return (
      <div className="text-red-500">
        Error al cargar clientes.
      </div>
    );
  }

  const columnsWithActions = columns(
    handleEdit,
    handleDelete,
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">
          Clientes
        </h1>

        <Button
          onClick={() => {
            setEditingClient(null);
            setModalOpen(true);
          }}
        >
          <Plus className="mr-2 h-4 w-4" />
          Nuevo Cliente
        </Button>
      </div>

      <DataTable
        columns={columnsWithActions}
        data={clients ?? []}
      />

      <ClientFormModal
        open={modalOpen}
        onOpenChange={handleModalChange}
        onSubmit={handleSubmit}
        initialData={editingClient}
      />
    </div>
  );
}