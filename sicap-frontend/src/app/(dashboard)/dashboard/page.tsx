import { getServerSession } from "next-auth/next";
import { redirect } from "next/navigation";
import {
  Banknote,
  CheckCircle2,
  Clock3,
  MapPinned,
  Package,
  Route,
  ShoppingCart,
  UserRound,
  Users,
  WalletCards,
} from "lucide-react";

import { authOptions } from "@/app/api/auth/[...nextauth]/route";

type MetricCardProps = {
  title: string;
  value: string;
  description: string;
  icon: React.ElementType;
};

function MetricCard({
  title,
  value,
  description,
  icon: Icon,
}: MetricCardProps) {
  return (
    <div className="rounded-xl border bg-card p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <p className="mt-2 text-3xl font-bold tracking-tight">{value}</p>
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        </div>

        <div className="rounded-xl bg-primary/10 p-3 text-primary">
          <Icon className="h-6 w-6" />
        </div>
      </div>
    </div>
  );
}

function DemoBadge() {
  return (
    <span className="inline-flex rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">
      Pre-Alpha · Datos demostrativos
    </span>
  );
}

function AdminDashboard() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Dashboard administrativo
          </h1>
          <p className="mt-1 text-muted-foreground">
            Resumen general de la operación de Purificadora Rehobot.
          </p>
        </div>

        <DemoBadge />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          title="Clientes activos"
          value="120"
          description="Clientes registrados"
          icon={Users}
        />

        <MetricCard
          title="Pedidos del día"
          value="18"
          description="Pedidos programados"
          icon={ShoppingCart}
        />

        <MetricCard
          title="Ingresos"
          value="Q 1,850"
          description="Pagos registrados"
          icon={Banknote}
        />

        <MetricCard
          title="Cuentas por cobrar"
          value="Q 740"
          description="Ventas pendientes de pago"
          icon={WalletCards}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <div className="mb-5">
            <h2 className="text-lg font-semibold">Pedidos recientes</h2>
            <p className="text-sm text-muted-foreground">
              Ejemplo visual para el prototipo Pre-Alpha.
            </p>
          </div>

          <div className="space-y-4">
            {[
              ["PED-001", "Cliente demostrativo 1", "En ruta"],
              ["PED-002", "Cliente demostrativo 2", "Pendiente"],
              ["PED-003", "Cliente demostrativo 3", "Entregado"],
            ].map(([order, client, status]) => (
              <div
                key={order}
                className="flex items-center justify-between rounded-lg border p-4"
              >
                <div>
                  <p className="font-medium">{order}</p>
                  <p className="text-sm text-muted-foreground">{client}</p>
                </div>

                <span className="text-sm font-medium">{status}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <div className="mb-5">
            <h2 className="text-lg font-semibold">Ruta del día</h2>
            <p className="text-sm text-muted-foreground">
              Seguimiento general de entregas.
            </p>
          </div>

          <div className="space-y-4">
            <div className="flex items-center gap-4 rounded-lg bg-muted/50 p-4">
              <Route className="h-8 w-8 text-primary" />

              <div>
                <p className="font-semibold">Ruta demostrativa</p>
                <p className="text-sm text-muted-foreground">
                  Cuilapa, Santa Rosa
                </p>
              </div>
            </div>

            <div>
              <div className="mb-2 flex justify-between text-sm">
                <span>Progreso de entregas</span>
                <span>58%</span>
              </div>

              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div className="h-full w-[58%] rounded-full bg-primary" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function DriverDashboard() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Inicio del repartidor
          </h1>
          <p className="mt-1 text-muted-foreground">
            Consulta los pedidos y entregas correspondientes a tu jornada.
          </p>
        </div>

        <DemoBadge />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <MetricCard
          title="Pedidos asignados"
          value="8"
          description="Pedidos de la jornada"
          icon={Package}
        />

        <MetricCard
          title="Entregados"
          value="3"
          description="Pedidos completados"
          icon={CheckCircle2}
        />

        <MetricCard
          title="Pendientes"
          value="5"
          description="Entregas por realizar"
          icon={Clock3}
        />
      </div>

      <div className="rounded-xl border bg-card p-6 shadow-sm">
        <div className="flex items-start gap-4">
          <div className="rounded-xl bg-primary/10 p-3 text-primary">
            <MapPinned className="h-6 w-6" />
          </div>

          <div>
            <h2 className="text-lg font-semibold">Ruta del día</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Desde esta sección el repartidor podrá consultar la ruta,
              registrar clientes y pedidos, y actualizar manualmente el estado
              de las entregas.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function ClientDashboard() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Bienvenido a Purificadora Rehobot
          </h1>
          <p className="mt-1 text-muted-foreground">
            Consulta tu información y el historial de tus pedidos.
          </p>
        </div>

        <DemoBadge />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <MetricCard
          title="Pedidos"
          value="6"
          description="Pedidos registrados"
          icon={ShoppingCart}
        />

        <MetricCard
          title="Último pedido"
          value="Entregado"
          description="Estado del pedido más reciente"
          icon={CheckCircle2}
        />

        <MetricCard
          title="Mi información"
          value="Activa"
          description="Información del cliente"
          icon={UserRound}
        />
      </div>

      <div className="rounded-xl border bg-card p-6 shadow-sm">
        <h2 className="text-lg font-semibold">Mis pedidos</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Aquí podrás consultar tus pedidos y su historial.
        </p>
      </div>
    </div>
  );
}

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/login");
  }

  switch (session.user.role) {
    case "ADMIN":
      return <AdminDashboard />;

    case "DRIVER":
      return <DriverDashboard />;

    case "CLIENT":
      return <ClientDashboard />;

    default:
      redirect("/login");
  }
}