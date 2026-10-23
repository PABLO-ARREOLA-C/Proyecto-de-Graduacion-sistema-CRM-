import api from "@/lib/axios";

export interface AuditEvent {
  idAuditoria: string; accion: string; tablaAfectada: string; registroId: string | null; fechaHora: string;
  datosAnteriores: unknown; datosNuevos: unknown;
  usuario: { idUsuario: string; nombre: string; correo: string } | null;
}
export interface AuditFilters {
  from?: string; to?: string; action?: string; table?: string; userId?: string; search?: string;
  page: number; pageSize: number;
}
export const auditService = {
  getEvents: async (params: AuditFilters) => (await api.get<{ data: AuditEvent[]; total: number; page: number; pageSize: number; pages: number }>("/audit", { params })).data,
  getOptions: async () => (await api.get<{ actions: string[]; tables: string[]; users: Array<{ idUsuario: string; nombre: string; correo: string }> }>("/audit/options")).data,
};
