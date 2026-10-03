"use client";

import type { ElementType } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";

import {
  BadgePercent,
  ChartNoAxesCombined,
  ClipboardList,
  ContactRound,
  History,
  House,
  LayoutDashboard,
  MapPinned,
  Package,
  PackageCheck,
  Route,
  ShoppingBag,
  ShoppingCart,
  UserCog,
  UserRound,
  Users,
  WalletCards,
} from "lucide-react";

import { cn } from "@/lib/utils";
import type { UserRole } from "@/types/next-auth";

interface MenuItem {
  href: string;
  label: string;
  icon: ElementType;
  roles: UserRole[];
}

const menuItems: MenuItem[] = [
  {
    label: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
    roles: ["ADMIN"],
  },
  {
    label: "Inicio",
    href: "/dashboard",
    icon: House,
    roles: ["DRIVER", "CLIENT"],
  },
  {
    label: "Clientes",
    href: "/clients",
    icon: Users,
    roles: ["ADMIN", "DRIVER"],
  },
  {
    label: "Pedidos",
    href: "/orders",
    icon: ShoppingCart,
    roles: ["ADMIN", "DRIVER"],
  },
  {
    label: "CRM",
    href: "/crm",
    icon: ContactRound,
    roles: ["ADMIN", "DRIVER"],
  },
  {
    label: "Rutas",
    href: "/routes",
    icon: Route,
    roles: ["ADMIN"],
  },
  {
    label: "Ruta del día",
    href: "/my-route",
    icon: MapPinned,
    roles: ["DRIVER"],
  },
  {
    label: "Entregas",
    href: "/deliveries",
    icon: PackageCheck,
    roles: ["ADMIN", "DRIVER"],
  },
  {
    label: "Productos",
    href: "/products",
    icon: Package,
    roles: ["ADMIN"],
  },
  {
    label: "Finanzas",
    href: "/finance",
    icon: WalletCards,
    roles: ["ADMIN"],
  },
  {
    label: "Promociones",
    href: "/promotions",
    icon: BadgePercent,
    roles: ["ADMIN"],
  },
  {
    label: "Reportes",
    href: "/reports",
    icon: ChartNoAxesCombined,
    roles: ["ADMIN"],
  },
  {
    label: "Usuarios",
    href: "/users",
    icon: UserCog,
    roles: ["ADMIN"],
  },
  {
    label: "Auditoría",
    href: "/audit",
    icon: ClipboardList,
    roles: ["ADMIN"],
  },
  {
    label: "Mi información",
    href: "/my-profile",
    icon: UserRound,
    roles: ["CLIENT"],
  },
  {
    label: "Mis pedidos",
    href: "/my-orders",
    icon: ShoppingBag,
    roles: ["CLIENT"],
  },
  {
    label: "Historial",
    href: "/history",
    icon: History,
    roles: ["CLIENT"],
  },
];

function getRoleLabel(role?: UserRole) {
  switch (role) {
    case "ADMIN":
      return "Administrador";

    case "DRIVER":
      return "Repartidor";

    case "CLIENT":
      return "Cliente";

    default:
      return "Cargando...";
  }
}

export default function Sidebar() {
  const pathname = usePathname();
  const { data: session, status } = useSession();

  const role = session?.user?.role;

  const visibleItems = role
    ? menuItems.filter((item) => item.roles.includes(role))
    : [];

  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-72 flex-col bg-sidebar text-sidebar-foreground lg:flex">
      {/* Encabezado */}
      <div className="border-b border-sidebar-border px-6 py-6">
        <Link
          href="/dashboard"
          className="flex items-center gap-3"
        >
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/10">
            <span className="text-xl font-bold text-white">
              R
            </span>
          </div>

          <div>
            <p className="font-bold leading-tight text-white">
              Purificadora
            </p>

            <p className="text-lg font-bold leading-tight text-white">
              Rehobot
            </p>
          </div>
        </Link>
      </div>

      {/* Título del menú */}
      <div className="px-4 py-4">
        <p className="px-3 text-xs font-semibold uppercase tracking-wider text-white/50">
          Menú principal
        </p>
      </div>

      {/* Navegación */}
      <nav className="flex-1 space-y-1 overflow-y-auto px-3 pb-5">
        {status === "loading" ? (
          <div className="px-4 py-3 text-sm text-white/60">
            Cargando menú...
          </div>
        ) : (
          visibleItems.map((item) => {
            const Icon = item.icon;

            const active =
              pathname === item.href ||
              (item.href !== "/dashboard" &&
                pathname.startsWith(`${item.href}/`));

            return (
              <Link
                key={`${item.label}-${item.href}`}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium transition-colors",
                  active
                    ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-sm"
                    : "text-white/80 hover:bg-white/10 hover:text-white",
                )}
              >
                <Icon className="h-5 w-5 shrink-0" />

                <span>{item.label}</span>
              </Link>
            );
          })
        )}
      </nav>

      {/* Información de la sesión */}
      <div className="border-t border-sidebar-border p-4">
        <div className="rounded-xl bg-white/5 p-4">
          <p className="text-xs text-white/60">
            Sesión actual
          </p>

          <p className="mt-1 text-sm font-semibold text-white">
            {getRoleLabel(role)}
          </p>

          {session?.user?.name && (
            <p className="mt-1 truncate text-xs text-white/60">
              {session.user.name}
            </p>
          )}
        </div>
      </div>
    </aside>
  );
}