"use client";

import { useEffect, useState, type ElementType } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Banknote, CheckCircle2, Clock3, Package, ShoppingCart, Users, WalletCards } from "lucide-react";
import { clientService } from "@/services/clientService";
import { orderService, type OrderStatus } from "@/services/orderService";
import { routeService, type DeliveryRoute, type RouteStatus } from "@/services/routeService";
import { financeService } from "@/services/financeService";
import type { UserRole } from "@/types/next-auth";
import { ClientHome } from "@/components/client-portal/ClientHome";

const today = () => new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Guatemala", year: "numeric", month: "2-digit", day: "2-digit",
}).format(new Date());
const money = (value: number) => new Intl.NumberFormat("es-GT", { style: "currency", currency: "GTQ" }).format(value);
const dateLabel = (value: string) => value.split("-").reverse().join("/");
const button = "inline-block rounded-lg border px-4 py-2 text-sm disabled:opacity-50";
const orderLabels: Record<OrderStatus, string> = {
  PENDIENTE: "Pendiente", CONFIRMADO: "Confirmado", EN_RUTA: "En ruta", ENTREGADO: "Entregado", CANCELADO: "Cancelado",
};
const routeLabels: Record<RouteStatus, string> = {
  PLANIFICADA: "Planificada", EN_CURSO: "En curso", COMPLETADA: "Completada", CANCELADA: "Cancelada",
};

function Metric({ title, value, description, icon: Icon }: {
  title: string; value: string; description: string; icon: ElementType;
}) {
  return <div className="rounded-xl border bg-card p-5 shadow-sm">
    <div className="flex items-start justify-between gap-4">
      <div><p className="text-sm font-medium text-muted-foreground">{title}</p>
        <p className="mt-2 text-3xl font-bold tracking-tight">{value}</p>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </div>
      <div className="rounded-xl bg-primary/10 p-3 text-primary"><Icon className="h-6 w-6" /></div>
    </div>
  </div>;
}

function QueryError({ onRetry, children }: { onRetry: () => void; children: React.ReactNode }) {
  return <div role="alert" className="space-y-2 rounded-lg border border-red-200 p-4 text-sm">
    <p>{children}</p><button type="button" className={button} onClick={onRetry}>Reintentar</button>
  </div>;
}

function RouteCards({ routes, isDriver }: { routes: DeliveryRoute[]; isDriver: boolean }) {
  if (routes.length === 0) return <p className="text-sm text-muted-foreground">No hay rutas para hoy ni rutas en curso.</p>;
  return <div className="space-y-3">{routes.slice(0, 5).map((route) => {
    const completed = route.detalles.filter((stop) => stop.estado === "COMPLETADO").length;
    const progress = route.detalles.length ? Math.round(completed / route.detalles.length * 100) : 0;
    return <article key={route.idRuta} className="space-y-3 rounded-lg border p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div><h3 className="font-semibold">{route.nombre}</h3>
          <p className="text-sm text-muted-foreground">{route.codigoRuta} · {dateLabel(route.fecha.slice(0, 10))}</p>
          {!isDriver && <p className="text-sm text-muted-foreground">{route.repartidor.nombre}</p>}
        </div><span className="rounded-full bg-primary/10 px-2 py-1 text-xs">{routeLabels[route.estado]}</span>
      </div>
      <div>
        <p className="mb-2 text-sm">{completed} de {route.detalles.length} paradas completadas · {progress}%</p>
        <div role="progressbar" aria-label={`Progreso de ${route.nombre}`} aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}
          className="h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${progress}%` }} /></div>
      </div>
      {isDriver && route.estado === "EN_CURSO" && <Link href={`/deliveries?route=${encodeURIComponent(route.idRuta)}`} className="text-sm font-medium text-primary underline">Registrar entregas</Link>}
    </article>;
  })}{routes.length > 5 && <p className="text-sm text-muted-foreground">Se muestran 5 de {routes.length} rutas.</p>}</div>;
}

export function LiveDashboard({ role, userId, name }: {
  role: UserRole; userId: string; name: string; email: string;
}) {
  const [day, setDay] = useState(today);
  const client = useQueryClient();
  const isAdmin = role === "ADMIN";
  const isDriver = role === "DRIVER";
  useEffect(() => {
    const timer = window.setInterval(() => setDay(today()), 60_000);
    return () => window.clearInterval(timer);
  }, []);
  const clients = useQuery({ queryKey: ["clients"], queryFn: clientService.getAll, enabled: isAdmin, refetchInterval: 60_000 });
  const orders = useQuery({ queryKey: ["orders"], queryFn: orderService.getAll, enabled: isAdmin, refetchInterval: 60_000 });
  const routes = useQuery({
    queryKey: isDriver ? ["logistics", "my-routes", userId] : ["logistics", "routes"],
    queryFn: isDriver ? routeService.getMine : routeService.getAll,
    enabled: isAdmin || isDriver,
    refetchInterval: 60_000,
  });
  const finances = useQuery({
    queryKey: ["finances", "summary", "day", day],
    queryFn: () => financeService.getSummary({ fechaInicio: day, fechaFin: day }),
    enabled: isAdmin,
    refetchInterval: 60_000,
  });
  const dailyRoutes = (routes.data ?? []).filter((route) => route.estado !== "CANCELADA" &&
    (route.fecha.slice(0, 10) === day || route.estado === "EN_CURSO"));
  const stops = dailyRoutes.flatMap((route) => route.detalles).filter((stop) => stop.estado !== "CANCELADO");
  const assignedIds = new Set(stops.map((stop) => stop.idPedido));
  const deliveredIds = new Set(stops.filter((stop) => stop.estado === "COMPLETADO").map((stop) => stop.idPedido));
  const scheduled = (orders.data ?? []).filter((order) => order.fechaEntregaSolicitada.slice(0, 10) === day && order.estado !== "CANCELADO").length;
  const recent = [...(orders.data ?? [])].sort((a, b) => Date.parse(b.fechaPedido) - Date.parse(a.fechaPedido)).slice(0, 5);
  const refreshing = (isAdmin && (clients.isFetching || orders.isFetching || finances.isFetching)) || ((isAdmin || isDriver) && routes.isFetching);
  const reload = () => Promise.all([
    ...(isAdmin ? [client.invalidateQueries({ queryKey: ["clients"] }), client.invalidateQueries({ queryKey: ["orders"] }), client.invalidateQueries({ queryKey: ["finances"] })] : []),
    ...((isAdmin || isDriver) ? [client.invalidateQueries({ queryKey: ["logistics"] })] : []),
  ]);
  const countValue = (pending: boolean, failed: boolean, value: number) => pending ? "…" : failed ? "—" : String(value);

  return <div className="space-y-6">
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div><h1 className="text-3xl font-bold tracking-tight">{isAdmin ? "Dashboard administrativo" : isDriver ? "Inicio del repartidor" : "Bienvenido a Purificadora Rehobot"}</h1>
        <p className="mt-1 text-muted-foreground">{name ? `Hola, ${name}. ` : ""}{isAdmin || isDriver ? `${dateLabel(day)} · Guatemala` : "Información de tu cuenta."}</p>
      </div>
      {(isAdmin || isDriver) && <button className={button} disabled={refreshing} onClick={() => reload()}>{refreshing ? "Actualizando..." : "Actualizar"}</button>}
    </header>
    {isAdmin && <>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric title="Clientes activos" value={countValue(clients.isPending, clients.isError, clients.data?.length ?? 0)} description="Total de clientes activos registrados" icon={Users} />
        <Metric title="Pedidos programados hoy" value={countValue(orders.isPending, orders.isError, scheduled)} description="Según fecha solicitada; excluye cancelados" icon={ShoppingCart} />
        <Metric title="Ingresos de hoy" value={finances.isPending ? "…" : finances.isError ? "—" : money(finances.data?.ingresos ?? 0)} description="Cobros registrados hoy en Guatemala" icon={Banknote} />
        <Metric title="Cuentas por cobrar" value={finances.isPending ? "…" : finances.isError ? "—" : money(finances.data?.cuentasPorCobrar ?? 0)} description="Saldo pendiente de todas las cuentas de crédito" icon={WalletCards} />
      </div>
      {clients.isError && <QueryError onRetry={() => { clients.refetch(); }}>No fue posible consultar los clientes activos.</QueryError>}
      {finances.isError && <QueryError onRetry={() => { finances.refetch(); }}>No fue posible consultar el resumen financiero.</QueryError>}
      <div className="grid gap-6 xl:grid-cols-2">
        <section className="space-y-4 rounded-xl border bg-card p-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-lg font-semibold">Pedidos recientes</h2><Link href="/orders" className="text-sm text-primary underline">Ver pedidos</Link></div>
          <p className="text-sm text-muted-foreground">Los cinco pedidos creados más recientemente.</p>
          {orders.isPending ? <p>Cargando pedidos...</p> : orders.isError ? <QueryError onRetry={() => { orders.refetch(); }}>No fue posible consultar los pedidos.</QueryError> : recent.length === 0 ? <p className="text-sm text-muted-foreground">Todavía no hay pedidos registrados.</p> : recent.map((order) => <article key={order.idPedido} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-4">
            <div><p className="font-medium">{order.numeroPedido}</p><p className="text-sm text-muted-foreground">{order.cliente.nombre}</p><p className="text-sm">{money(Number(order.total))}</p></div>
            <span className="text-sm">{orderLabels[order.estado]}</span>
          </article>)}
        </section>
        <section className="space-y-4 rounded-xl border bg-card p-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-lg font-semibold">Rutas de hoy y en curso</h2><Link href="/routes" className="text-sm text-primary underline">Ver rutas</Link></div>
          {routes.isPending ? <p>Cargando rutas...</p> : routes.isError ? <QueryError onRetry={() => { routes.refetch(); }}>No fue posible consultar las rutas.</QueryError> : <RouteCards routes={dailyRoutes} isDriver={false} />}
        </section>
      </div>
    </>}
    {isDriver && <>
      <div className="grid gap-4 sm:grid-cols-3">
        <Metric title="Pedidos asignados" value={countValue(routes.isPending, routes.isError, assignedIds.size)} description="En tus rutas de hoy y las que siguen en curso" icon={Package} />
        <Metric title="Entregados" value={countValue(routes.isPending, routes.isError, deliveredIds.size)} description="Pedidos con parada completada en esas rutas" icon={CheckCircle2} />
        <Metric title="Pendientes" value={countValue(routes.isPending, routes.isError, assignedIds.size - deliveredIds.size)} description="Pedidos asignados que aún no se han entregado" icon={Clock3} />
      </div>
      <section className="space-y-4 rounded-xl border bg-card p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-lg font-semibold">Tus rutas de hoy y en curso</h2><Link href="/my-route" className={button}>Abrir Ruta del día</Link></div>
        {routes.isPending ? <p>Cargando rutas...</p> : routes.isError ? <QueryError onRetry={() => { routes.refetch(); }}>No fue posible consultar tus rutas.</QueryError> : <RouteCards routes={dailyRoutes} isDriver />}
      </section>
    </>}
    {role === "CLIENT" && <ClientHome />}
  </div>;
}
