
import api from "@/lib/axios";

export interface RouteUser {
  idUsuario: string;
  nombre: string;
  correo: string;
  estado: boolean;
  rol: {
    idRol: number;
    nombre: string;
  };
}

export const routeUserService = {
  getDrivers: async (): Promise<RouteUser[]> => {
    const { data } = await api.get<RouteUser[]>("/users");

    return data.filter(
      (user) =>
        user.estado &&
        user.rol.nombre === "Repartidor"
    );
  },
};
