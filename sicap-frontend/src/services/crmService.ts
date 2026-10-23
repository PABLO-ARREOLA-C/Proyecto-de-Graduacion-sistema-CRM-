
import api from "@/lib/axios";

export type ProspectStatus =
  | "NUEVO"
  | "CONTACTADO"
  | "INTERESADO"
  | "CONVERTIDO"
  | "DESCARTADO";

export type FollowUpStatus =
  | "PENDIENTE"
  | "COMPLETADO"
  | "CANCELADO";

export type InteractionType =
  | "LLAMADA"
  | "WHATSAPP"
  | "VISITA"
  | "OTRO";

export interface CrmUser {
  idUsuario: string;
  nombre: string;
  correo: string;
}

export interface ProspectProduct {
  idProspectoProducto: string;
  idProducto: string;
  cantidadEstimada: number | null;
  producto: {
    idProducto: string;
    nombre: string;
    precioActual: number | string;
  };
}

export interface CrmInteraction {
  idInteraccion: string;
  tipo: InteractionType;
  descripcion: string;
  fechaHora: string;
  usuario: CrmUser;
}

export interface CrmFollowUp {
  idSeguimiento: string;
  fechaProgramada: string;
  descripcion: string | null;
  estado: FollowUpStatus;
  fechaCompletado: string | null;
  usuario: CrmUser;
}

export interface Prospect {
  idProspecto: string;
  nombre: string;
  telefono: string;
  correo: string | null;
  direccion: string | null;
  interes: string | null;
  estado: ProspectStatus;
  idResponsable: string;
  fechaCreacion: string;
  responsable: CrmUser;
  productos: ProspectProduct[];
  interacciones?: CrmInteraction[];
  seguimientos?: CrmFollowUp[];
}

export interface ProspectPayload {
  nombre: string;
  telefono: string;
  correo?: string;
  direccion?: string;
  interes?: string;
  estado?: ProspectStatus;
  idResponsable?: string;
  productos?: Array<{
    idProducto: string;
    cantidadEstimada?: number;
  }>;
}

export interface InteractionPayload {
  tipo: InteractionType;
  descripcion: string;
}

export interface FollowUpPayload {
  fechaProgramada: string;
  descripcion?: string;
}

export interface PurchaseAlert {
  idCliente: string;
  cliente: string;
  telefono: string;
  idProducto: string;
  producto: string;
  diaSemana: number;
  unidadesDia: number;
  totalUnidades: number;
  fechasDia: number;
  fechasCompra: number;
  promedioDia: number;
  porcentaje: number;
  ultimaCompra: string;
  proximaFecha: string;
  diasHastaCompra: number;
}

export interface PurchaseAlertResponse {
  hoy: string; desde: string; hasta: string; dias: number;
  alcance: 'GENERAL' | 'ENTREGAS_PROPIAS';
  total: number; page: number; pageSize: number; data: PurchaseAlert[];
}

export const crmService = {
  getPurchaseAlerts: async (params: { dias: number; page: number; search?: string; diaSemana?: number }) => {
    const { data } = await api.get<PurchaseAlertResponse>('/crm/purchase-alerts', { params });
    return data;
  },
  getProspects: async (): Promise<Prospect[]> => {
    const { data } = await api.get<Prospect[]>("/crm/prospects");
    return data;
  },

  getProspect: async (id: string): Promise<Prospect> => {
    const { data } = await api.get<Prospect>(
      `/crm/prospects/${id}`
    );
    return data;
  },

  createProspect: async (
    payload: ProspectPayload
  ): Promise<Prospect> => {
    const { data } = await api.post<Prospect>(
      "/crm/prospects",
      payload
    );
    return data;
  },

  updateProspect: async (
    id: string,
    payload: Partial<ProspectPayload>
  ): Promise<Prospect> => {
    const { data } = await api.patch<Prospect>(
      `/crm/prospects/${id}`,
      payload
    );
    return data;
  },

  addProduct: async (
    id: string,
    payload: { idProducto: string; cantidadEstimada?: number }
  ) => {
    const { data } = await api.post(
      `/crm/prospects/${id}/products`,
      payload
    );
    return data;
  },

  removeProduct: async (
    id: string,
    relationId: string
  ) => {
    const { data } = await api.delete(
      `/crm/prospects/${id}/products/${relationId}`
    );
    return data;
  },

  getInteractions: async (
    id: string
  ): Promise<CrmInteraction[]> => {
    const { data } = await api.get<CrmInteraction[]>(
      `/crm/prospects/${id}/interactions`
    );
    return data;
  },

  createInteraction: async (
    id: string,
    payload: InteractionPayload
  ): Promise<CrmInteraction> => {
    const { data } = await api.post<CrmInteraction>(
      `/crm/prospects/${id}/interactions`,
      payload
    );
    return data;
  },

  getFollowUps: async (
    id: string
  ): Promise<CrmFollowUp[]> => {
    const { data } = await api.get<CrmFollowUp[]>(
      `/crm/prospects/${id}/follow-ups`
    );
    return data;
  },

  createFollowUp: async (
    id: string,
    payload: FollowUpPayload
  ): Promise<CrmFollowUp> => {
    const { data } = await api.post<CrmFollowUp>(
      `/crm/prospects/${id}/follow-ups`,
      payload
    );
    return data;
  },

  updateFollowUp: async (
    id: string,
    followUpId: string,
    payload: Partial<FollowUpPayload> & {
      estado?: FollowUpStatus;
    }
  ): Promise<CrmFollowUp> => {
    const { data } = await api.patch<CrmFollowUp>(
      `/crm/prospects/${id}/follow-ups/${followUpId}`,
      payload
    );
    return data;
  },
};
