import api from "@/lib/axios";

export interface BackendClientAddress {
  idDireccion: string;
  idCliente: string;
  direccion: string;
  referencia?: string | null;
  zona?: string | null;
  latitud?: string | number | null;
  longitud?: string | number | null;
  estado: boolean;
  fechaCreacion?: string;
}

interface BackendClient {
  idCliente: string;
  nombre: string;
  telefono: string;
  correo?: string | null;
  nit?: string | null;
  estado: boolean;
  fechaCreacion: string;
  direcciones?: BackendClientAddress[];
}

export interface Client {
  id: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  createdAt: string;
  nit?: string;
  active?: boolean;
  addressId?: string;
  addresses: BackendClientAddress[];
}

export interface ClientCreateData {
  name: string;
  email: string;
  phone: string;
  address: string;
}

function mapClient(client: BackendClient): Client {
  const activeAddresses =
    client.direcciones?.filter((address) => address.estado) ?? [];

  const primaryAddress =
    activeAddresses[0] ??
    client.direcciones?.[0];

  return {
    id: client.idCliente,
    name: client.nombre,
    email: client.correo ?? "",
    phone: client.telefono,
    address: primaryAddress?.direccion ?? "",
    createdAt: client.fechaCreacion,
    nit: client.nit ?? "",
    active: client.estado,
    addressId: primaryAddress?.idDireccion,
    addresses: activeAddresses,
  };
}

export const clientService = {
  getAll: async (): Promise<Client[]> => {
    const response = await api.get<BackendClient[]>("/clients");

    return response.data
      .map(mapClient)
      .filter((client) => client.active);
  },

  getById: async (id: string): Promise<Client> => {
    const response = await api.get<BackendClient>(`/clients/${id}`);

    return mapClient(response.data);
  },

  create: async (data: ClientCreateData): Promise<Client> => {
    const clientResponse = await api.post<BackendClient>("/clients", {
      nombre: data.name,
      telefono: data.phone,
      correo: data.email || undefined,
      estado: true,
    });

    const createdClient = clientResponse.data;

    if (data.address.trim()) {
      await api.post(
        `/clients/${createdClient.idCliente}/addresses`,
        {
          direccion: data.address.trim(),
          estado: true,
        },
      );
    }

    return clientService.getById(createdClient.idCliente);
  },

  update: async (
    id: string,
    data: Partial<Client>,
  ): Promise<Client> => {
    await api.patch(`/clients/${id}`, {
      nombre: data.name,
      telefono: data.phone,
      correo: data.email || undefined,
    });

    const currentClient = await clientService.getById(id);

    if (data.address !== undefined) {
      const address = data.address.trim();

      if (currentClient.addressId) {
        await api.patch(
          `/clients/${id}/addresses/${currentClient.addressId}`,
          {
            direccion: address,
          },
        );
      } else if (address) {
        await api.post(`/clients/${id}/addresses`, {
          direccion: address,
          estado: true,
        });
      }
    }

    return clientService.getById(id);
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/clients/${id}`);
  },
};