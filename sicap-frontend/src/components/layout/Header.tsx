"use client";

import { signOut, useSession } from "next-auth/react";
import {
  LogOut,
  Menu,
  UserRound,
} from "lucide-react";

import { Button } from "@/components/ui/button";

function getRoleName(role?: string) {
  switch (role) {
    case "ADMIN":
      return "Administrador";
    case "DRIVER":
      return "Repartidor";
    case "CLIENT":
      return "Cliente";
    default:
      return "Usuario";
  }
}

export default function Header() {
  const { data: session } = useSession();

  return (
    <header className="sticky top-0 z-30 border-b bg-white/95 backdrop-blur">
      <div className="flex h-18 items-center justify-between px-4 md:px-6 lg:px-8">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            aria-label="Abrir menú"
          >
            <Menu className="h-5 w-5" />
          </Button>

          <div>
            <p className="text-sm text-muted-foreground">
              Bienvenido
            </p>

            <p className="font-semibold">
              {session?.user?.name ||
                session?.user?.email ||
                "Usuario"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden items-center gap-3 sm:flex">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary">
              <UserRound className="h-5 w-5" />
            </div>

            <div className="text-right">
              <p className="text-sm font-medium">
                {getRoleName(session?.user?.role)}
              </p>

              <p className="max-w-45 truncate text-xs text-muted-foreground">
                {session?.user?.email}
              </p>
            </div>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              signOut({
                callbackUrl: "/login",
              })
            }
          >
            <LogOut className="mr-2 h-4 w-4" />
            <span className="hidden sm:inline">
              Cerrar sesión
            </span>
          </Button>
        </div>
      </div>
    </header>
  );
}