import api from "@/lib/axios";

export interface UserRoleOption { idRol: number; nombre: string }
export interface ManagedUser {
  idUsuario: string;
  nombre: string;
  correo: string;
  estado: boolean;
  fechaCreacion: string;
  fechaUltimaConexion: string | null;
  rol: UserRoleOption;
  cliente: { idCliente: string; nombre: string; estado: boolean } | null;
}
export interface UserPayload {
  nombre: string;
  correo: string;
  idRol: number;
  password?: string;
}
export const userService = {
  linkClient: async (id: string, idCliente: string | null) => {
    const { data } = await api.patch<ManagedUser>(`/users/${id}/client-profile`, { idCliente });
    return data;
  },
  getAll: async () => {
    const { data } = await api.get<ManagedUser[]>("/users");
    return data;
  },
  getRoles: async () => {
    const { data } = await api.get<UserRoleOption[]>("/users/roles");
    return data;
  },
  create: async (payload: UserPayload & { password: string }) => {
    const { data } = await api.post<ManagedUser>("/users", payload);
    return data;
  },
  update: async (id: string, payload: Partial<UserPayload> & { estado?: boolean }) => {
    const { data } = await api.patch<ManagedUser>(`/users/${id}`, payload);
    return data;
  },
  deactivate: async (id: string) => {
    const { data } = await api.delete<ManagedUser>(`/users/${id}`);
    return data;
  },
};
