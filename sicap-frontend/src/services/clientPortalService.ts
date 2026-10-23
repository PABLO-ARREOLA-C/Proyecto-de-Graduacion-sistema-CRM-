import api from "@/lib/axios";
import type { OrderStatus } from "@/services/orderService";

export interface OwnAddress { idDireccion: string; direccion: string; referencia: string | null; zona: string | null }
export interface OwnProfile {
  idCliente: string; nombre: string; telefono: string; correo: string | null; nit: string | null; estado: boolean; direcciones: OwnAddress[];
}
export interface OwnOrder {
  idPedido: string; numeroPedido: string; fechaPedido: string; fechaEntregaSolicitada: string;
  estado: OrderStatus; tipoVenta: "CONTADO" | "CREDITO"; total: number | string;
  totalPagado: number; saldoPendiente: number; estadoPago: "PENDIENTE" | "PARCIAL" | "PAGADO";
  direccion: { direccion: string; referencia: string | null; zona: string | null };
  detalles: Array<{ idDetalle: string; cantidad: number; precioUnitario: number | string; producto: { nombre: string } }>;
  pagos: Array<{ idPago: string; monto: number | string; fechaPago: string }>;
  cuentaPorCobrar: { fechaVencimiento: string } | null;
  historialEstados: Array<{ idHistorial: string; estadoAnterior: string | null; estadoNuevo: string; fechaHora: string }>;
}
export interface OwnProfilePayload { nombre: string; telefono: string; nit: string }
export interface OwnAddressPayload { direccion: string; referencia: string; zona: string }
export const clientPortalService = {
  getProfile: async () => (await api.get<OwnProfile | null>("/client-portal/profile")).data || null,
  saveProfile: async (payload: OwnProfilePayload) => (await api.patch<OwnProfile>("/client-portal/profile", payload)).data,
  getOrders: async () => (await api.get<OwnOrder[]>("/client-portal/orders")).data,
  addAddress: async (payload: OwnAddressPayload) => { await api.post("/client-portal/addresses", payload); },
  updateAddress: async (id: string, payload: OwnAddressPayload) => { await api.patch(`/client-portal/addresses/${id}`, payload); },
  removeAddress: async (id: string) => { await api.delete(`/client-portal/addresses/${id}`); },
};
