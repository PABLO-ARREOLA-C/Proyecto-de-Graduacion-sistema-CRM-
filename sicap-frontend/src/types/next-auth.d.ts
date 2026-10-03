import "next-auth";
import "next-auth/jwt";

export type UserRole = "ADMIN" | "DRIVER" | "CLIENT";

declare module "next-auth" {
  interface User {
    id: string;
    role: UserRole;
    accessToken: string;
  }

  interface Session {
    user: {
      id: string;
      role: UserRole;
      accessToken: string;
      email?: string | null;
      name?: string | null;
      image?: string | null;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    role?: UserRole;
    accessToken?: string;
  }
}