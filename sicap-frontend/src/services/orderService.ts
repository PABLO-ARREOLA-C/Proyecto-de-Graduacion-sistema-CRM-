import api from '@/lib/axios';

export type OrderStatus =
  | 'PENDIENTE'
  | 'CONFIRMADO'
  | 'EN_RUTA'
  | 'ENTREGADO'
  | 'CANCELADO';

export type SaleType = 'CONTADO' | 'CREDITO';

export interface OrderProduct {
  idProducto: string;
  codigo: string;
  nombre: string;
  descripcion?: string | null;
  precioActual: number | string;
  estado: boolean;
}

export interface OrderDetail {
  idDetallePedido: string;
  idPedido: string;
  idProducto: string;
  cantidad: number;
  precioUnitario: number | string;
  producto: OrderProduct;
}

export interface OrderAddress {
  idDireccion: string;
  idCliente: string;
  direccion: string;
  referencia?: string | null;
  zona?: string | null;
  latitud?: number | string | null;
  longitud?: number | string | null;
  estado: boolean;
}

export interface OrderClient {
  idCliente: string;
  nombre: string;
  telefono: string;
}

export interface Order {
  idPedido: string;
  numeroPedido: string;
  idCliente: string;
  idDireccion: string;
  registradoPor?: string | null;
  fechaPedido: string;
  fechaEntregaSolicitada: string;
  tipoVenta: SaleType;
  estado: OrderStatus;
  total: number | string;
  observaciones?: string | null;

  cliente: OrderClient;
  direccion: OrderAddress;
  detalles: OrderDetail[];

  usuarioRegistro?: {
    idUsuario: string;
    nombre: string;
    correo: string;
  } | null;

  historialEstados?: Array<{
    idHistorial?: string;
    estadoAnterior?: string | null;
    estadoNuevo: string;
    observaciones?: string | null;
    fechaHora: string;
  }>;
}

export interface CreateOrderItem {
  idProducto: string;
  cantidad: number;
}

export interface CreateOrderPayload {
  idCliente: string;
  idDireccion: string;
  fechaEntregaSolicitada: string;
  tipoVenta: SaleType;
  observaciones?: string;
  detalles: CreateOrderItem[];
}

export interface UpdateOrderPayload {
  idDireccion?: string;
  fechaEntregaSolicitada?: string;
  tipoVenta?: SaleType;
  observaciones?: string;
}

export interface UpdateOrderStatusPayload {
  estado: 'PENDIENTE' | 'CONFIRMADO' | 'CANCELADO';
  observaciones?: string;
}

export const orderService = {
  getAll: async (): Promise<Order[]> => {
    const response = await api.get<Order[]>('/orders');
    return response.data;
  },

  getById: async (idPedido: string): Promise<Order> => {
    const response = await api.get<Order>(`/orders/${idPedido}`);
    return response.data;
  },

  create: async (data: CreateOrderPayload): Promise<Order> => {
    const response = await api.post<Order>('/orders', data);
    return response.data;
  },

  update: async (
    idPedido: string,
    data: UpdateOrderPayload,
  ): Promise<Order> => {
    const response = await api.patch<Order>(`/orders/${idPedido}`, data);
    return response.data;
  },

  updateStatus: async (
    idPedido: string,
    data: UpdateOrderStatusPayload,
  ): Promise<Order> => {
    const response = await api.patch<Order>(
      `/orders/${idPedido}/status`,
      data,
    );

    return response.data;
  },

  getHistory: async (idPedido: string) => {
    const response = await api.get(`/orders/${idPedido}/history`);
    return response.data;
  },
};