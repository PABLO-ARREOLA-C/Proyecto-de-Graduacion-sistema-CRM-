import api from "@/lib/axios";

export interface Promotion {
  idPromocion: string; idProducto: string; nombre: string;
  cantidadRequerida: number; cantidadBonificada: number;
  fechaInicio: string; fechaFin: string | null; estado: boolean;
}
export interface PromotionPayload {
  nombre: string; cantidadRequerida: number; cantidadBonificada: number;
  fechaInicio: string; fechaFin?: string | null;
}
export const promotionService = {
  getByProduct: async (id: string) => (await api.get<Promotion[]>(`/products/${id}/promotions`)).data,
  create: async (id: string, payload: PromotionPayload) => (await api.post<Promotion>(`/products/${id}/promotions`, payload)).data,
  update: async (id: string, promotionId: string, payload: Partial<PromotionPayload> & { estado?: boolean }) =>
    (await api.patch<Promotion>(`/products/${id}/promotions/${promotionId}`, payload)).data,
  deactivate: async (id: string, promotionId: string) => {
    return (await api.delete<Promotion>(`/products/${id}/promotions/${promotionId}`)).data;
  },
};
