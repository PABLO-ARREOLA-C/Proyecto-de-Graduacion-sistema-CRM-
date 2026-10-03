import NextAuth, { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import type { UserRole } from "@/types/next-auth";

interface BackendLoginResponse {
  accessToken: string;
  tokenType: string;
  usuario: {
    idUsuario: string;
    nombre: string;
    correo: string;
    estado: boolean;
    fechaUltimaConexion: string | null;
    rol: {
      idRol: number;
      nombre: string;
    };
  };
}

function mapBackendRole(role: string): UserRole {
  switch (role.trim().toLowerCase()) {
    case "administrador":
      return "ADMIN";

    case "repartidor":
      return "DRIVER";

    case "cliente":
      return "CLIENT";

    default:
      return "CLIENT";
  }
}

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Credentials",

      credentials: {
        email: {
          label: "Correo electrónico",
          type: "email",
        },
        password: {
          label: "Contraseña",
          type: "password",
        },
      },

      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        const apiUrl = process.env.NEXT_PUBLIC_API_URL;

        if (!apiUrl) {
          console.error("NEXT_PUBLIC_API_URL no está configurada.");
          return null;
        }

        try {
          const response = await fetch(`${apiUrl}/auth/login`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              correo: credentials.email.trim().toLowerCase(),
              password: credentials.password,
            }),
            cache: "no-store",
          });

          if (!response.ok) {
            console.error(
              `Error de autenticación del backend: ${response.status}`,
            );
            return null;
          }

          const data = (await response.json()) as BackendLoginResponse;

          if (!data.accessToken || !data.usuario) {
            console.error("Respuesta de autenticación incompleta.");
            return null;
          }

          if (!data.usuario.estado) {
            console.error("El usuario está inactivo.");
            return null;
          }

          return {
            id: data.usuario.idUsuario,
            email: data.usuario.correo,
            name: data.usuario.nombre,
            role: mapBackendRole(data.usuario.rol.nombre),
            accessToken: data.accessToken,
          };
        } catch (error) {
          console.error("No fue posible conectar con el backend:", error);
          return null;
        }
      },
    }),
  ],

  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.accessToken = user.accessToken;
      }

      return token;
    },

    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id ?? "";
        session.user.role = token.role ?? "CLIENT";
        session.user.accessToken = token.accessToken ?? "";
      }

      return session;
    },
  },

  session: {
    strategy: "jwt",
  },

  pages: {
    signIn: "/login",
  },

  secret: process.env.NEXTAUTH_SECRET,
};

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };