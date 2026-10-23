
import api from "@/lib/axios";

export type RouteStatus =
  | "PLANIFICADA"
  | "EN_CURSO"
  | "COMPLETADA"
  | "CANCELADA";

export type StopStatus =
  | "PENDIENTE"
  | "EN_RUTA"
  | "COMPLETADO"
  | "CANCELADO";

export interface RouteDriver {
  idUsuario: string;
  nombre: string;
  correo: string;
  estado: boolean;
  rol: {
    idRol: number;
    nombre: string;
  };
}

export interface RouteOrderDetail {
  idDetalle: string;
  idProducto: string;
  cantidad: number;
  producto: {
    idProducto: string;
    nombre: string;
  };
}

export interface RouteStop {
  entregas: DeliveryAttempt[];
  idDetalleRuta: string;
  idPedido: string;
  ordenParada: number;
  estado: StopStatus;
  horaEstimada: string | null;
  pedido: {
    idPedido: string;
    numeroPedido: string;
    estado: string;
    cliente: {
      idCliente: string;
      nombre: string;
      telefono: string;
    };
    direccion: {
      idDireccion: string;
      direccion: string;
      referencia: string | null;
      latitud: number | string | null;
      longitud: number | string | null;
    };
    detalles: RouteOrderDetail[];
  };
}

export interface DeliveryAttempt {
  idEntrega: string;
  numeroIntento: number;
  fechaHora: string;
  estado: "PENDIENTE" | "ENTREGADO" | "NO_ENTREGADO";
  observaciones: string | null;
  detalles: Array<{ idDetallePedido: string; cantidadEntregada: number }>;
  incidencias: Array<{ idIncidencia: string; tipo: string; descripcion: string }>;
}

export interface DeliveryRoute {
  idRuta: string;
  codigoRuta: string;
  nombre: string;
  fecha: string;
  idRepartidor: string;
  estado: RouteStatus;
  observaciones: string | null;
  fechaCreacion: string;
  repartidor: RouteDriver;
  detalles: RouteStop[];
}

export interface CreateRoutePayload {
  nombre: string;
  fecha: string;
  idRepartidor: string;
  observaciones?: string;
}

export interface UpdateRoutePayload {
  nombre?: string;
  fecha?: string;
  idRepartidor?: string;
  observaciones?: string;
}

export interface AddOrderPayload {
  idPedido: string;
  ordenParada: number;
  horaEstimada?: string;
}

export interface DeliveryPayload {
  observaciones?: string;
  detalles: Array<{
    idDetallePedido: string;
    cantidadEntregada: number;
  }>;
}

export const routeService = {
  getMine: async (): Promise<DeliveryRoute[]> => {
    const { data } = await api.get<DeliveryRoute[]>("/logistics/my-routes");
    return data;
  },
  getAll: async (): Promise<DeliveryRoute[]> => {
    const { data } = await api.get<DeliveryRoute[]>(
      "/logistics/routes"
    );
    return data;
  },

  getById: async (id: string): Promise<DeliveryRoute> => {
    const { data } = await api.get<DeliveryRoute>(
      `/logistics/routes/${id}`
    );
    return data;
  },

  create: async (
    payload: CreateRoutePayload
  ): Promise<DeliveryRoute> => {
    const { data } = await api.post<DeliveryRoute>(
      "/logistics/routes",
      payload
    );
    return data;
  },

  update: async (
    id: string,
    payload: UpdateRoutePayload
  ): Promise<DeliveryRoute> => {
    const { data } = await api.patch<DeliveryRoute>(
      `/logistics/routes/${id}`,
      payload
    );
    return data;
  },

  addOrder: async (
    id: string,
    payload: AddOrderPayload
  ) => {
    const { data } = await api.post(
      `/logistics/routes/${id}/orders`,
      payload
    );
    return data;
  },

  moveStop: async (id: string, detailId: string, direction: 'UP' | 'DOWN') => {
    const { data } = await api.post(
      `/logistics/routes/${id}/details/${detailId}/move`, { direction },
    );
    return data;
  },

  updateStop: async (
    id: string,
    detailId: string,
    payload: {
      ordenParada?: number;
      horaEstimada?: string | null;
    }
  ) => {
    const { data } = await api.patch(
      `/logistics/routes/${id}/details/${detailId}`,
      payload
    );
    return data;
  },

  removeOrder: async (
    id: string,
    detailId: string
  ) => {
    const { data } = await api.delete(
      `/logistics/routes/${id}/details/${detailId}`
    );
    return data;
  },

  start: async (id: string): Promise<DeliveryRoute> => {
    const { data } = await api.post<DeliveryRoute>(
      `/logistics/routes/${id}/start`
    );
    return data;
  },

  complete: async (id: string): Promise<DeliveryRoute> => {
    const { data } = await api.post<DeliveryRoute>(
      `/logistics/routes/${id}/complete`
    );
    return data;
  },

  createDelivery: async (
    routeId: string,
    detailId: string,
    payload: DeliveryPayload
  ) => {
    const { data } = await api.post(
      `/logistics/routes/${routeId}/details/${detailId}/deliveries`,
      payload
    );
    return data;
  },

  updateDeliveryStatus: async (
    deliveryId: string,
    payload: {
      estado: "ENTREGADO" | "NO_ENTREGADO";
      observaciones?: string;
    }
  ) => {
    const { data } = await api.patch(
      `/logistics/deliveries/${deliveryId}/status`,
      payload
    );
    return data;
  },

  createIncident: async (
    deliveryId: string,
    payload: {
      tipo: string;
      descripcion: string;
    }
  ) => {
    const { data } = await api.post(
      `/logistics/deliveries/${deliveryId}/incidents`,
      payload
    );
    return data;
  },
};
