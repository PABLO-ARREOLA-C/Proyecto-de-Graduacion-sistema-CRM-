"use client";

import { useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import { toast } from "sonner";
import { routeService, type RouteStatus, type StopStatus } from "@/services/routeService";

const routeLabels: Record<RouteStatus, string> = {
  PLANIFICADA: "Planificada", EN_CURSO: "En curso", COMPLETADA: "Completada", CANCELADA: "Cancelada",
};
const stopLabels: Record<StopStatus, string> = {
  PENDIENTE: "Pendiente", EN_RUTA: "En ruta", COMPLETADO: "Completada", CANCELADO: "Cancelada",
};
const button = "rounded-lg border px-4 py-2 text-sm disabled:opacity-50";

function message(error: unknown) {
  if (isAxiosError<{ message?: string | string[] }>(error)) {
    const value = error.response?.data?.message;
    if (Array.isArray(value)) return value.join(", ");
    if (value) return value;
  }
  return "No fue posible completar la operación. Actualiza e intenta nuevamente.";
}

export default function MyRoutePage() {
  const { data: session, status } = useSession();
  const client = useQueryClient();
  const [date, setDate] = useState(() => new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Guatemala", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date()));
  const isDriver = session?.user?.role === "DRIVER";
  const query = useQuery({
    queryKey: ["logistics", "my-routes", session?.user?.id],
    queryFn: routeService.getMine,
    enabled: isDriver,
  });
  const action = useMutation({
    mutationFn: ({ id, kind }: { id: string; kind: "start" | "complete" }) =>
      kind === "start" ? routeService.start(id) : routeService.complete(id),
    onSuccess: async (_data, variables) => {
      await Promise.all([
        client.invalidateQueries({ queryKey: ["logistics"] }),
        client.invalidateQueries({ queryKey: ["orders"] }),
      ]);
      toast.success(variables.kind === "start" ? "Ruta iniciada" : "Ruta completada");
    },
    onError: async (error) => {
      toast.error(message(error));
      await client.invalidateQueries({ queryKey: ["logistics"] });
    },
  });
  const routes = (query.data ?? []).filter((route) => route.fecha.slice(0, 10) === date || route.estado === "EN_CURSO");
  if (status === "loading") return <p>Cargando sesión...</p>;
  if (!isDriver) return <p>Esta vista está disponible para repartidores.</p>;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
        <h1 className="text-3xl font-bold">Ruta del día</h1>
        <p className="mt-1 text-sm text-slate-500">Tus rutas de la fecha seleccionada y todas tus rutas en curso.</p>
        </div>
        <Link href="/routes?create=1" className={`${button} bg-slate-950 text-white`}>
          Crear ruta
        </Link>
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-sm">Fecha
          <input type="date" required value={date} onChange={(event) => setDate(event.target.value)}
            className="mt-1 block rounded-lg border bg-white px-3 py-2" />
        </label>
        <button className={button} disabled={query.isFetching || action.isPending} onClick={() => query.refetch()}>
          {query.isFetching ? "Actualizando..." : "Actualizar"}
        </button>
      </div>
      {query.isPending ? <p>Cargando rutas...</p> : query.isError ? (
        <p role="alert" className="text-red-700">{message(query.error)}</p>
      ) : routes.length === 0 ? <p>No tienes rutas para esta fecha ni rutas en curso.</p> : routes.map((route) => {
        const completed = route.detalles.filter((stop) => stop.estado === "COMPLETADO").length;
        const unconfirmed = route.detalles.filter((stop) => stop.pedido.estado !== "CONFIRMADO");
        const canStart = route.detalles.length > 0 && unconfirmed.length === 0;
        const canComplete = route.detalles.length > 0 && completed === route.detalles.length;
        return (
          <section key={route.idRuta} className="space-y-4 rounded-2xl border bg-white p-5">
            <div>
              <p className="text-sm text-slate-500">{route.codigoRuta} · {route.fecha.slice(0, 10)}</p>
              <h2 className="text-xl font-bold">{route.nombre}</h2>
              <p>{routeLabels[route.estado]} · {completed} de {route.detalles.length} paradas completadas</p>
              {route.observaciones && <p className="whitespace-pre-wrap text-sm">{route.observaciones}</p>}
            </div>
            {route.detalles.length === 0 && <p>La ruta aún no tiene pedidos asignados.</p>}
            <ol className="space-y-3">
              {[...route.detalles].sort((a, b) => a.ordenParada - b.ordenParada).map((stop) => (
                <li key={stop.idDetalleRuta} className="space-y-1 rounded-lg border p-4 text-sm">
                  <h3 className="font-semibold">Parada {stop.ordenParada} · {stop.pedido.numeroPedido} · {stopLabels[stop.estado]}</h3>
                  <p>{stop.pedido.cliente.nombre} · {stop.pedido.cliente.telefono}</p>
                  <p>{stop.pedido.direccion.direccion}</p>
                  {stop.pedido.direccion.referencia && <p>Referencia: {stop.pedido.direccion.referencia}</p>}
                  <p>Hora estimada: {stop.horaEstimada?.slice(11, 16) || "Sin asignar"}</p>
                  <p>Estado del pedido: {stop.pedido.estado}</p>
                  <ul>{stop.pedido.detalles.map((product) => <li key={product.idDetalle}>{product.producto.nombre}: {product.cantidad}</li>)}</ul>
                </li>
              ))}
            </ol>
            {route.estado === "PLANIFICADA" && <>
              {unconfirmed.length > 0 && <p className="text-sm text-amber-700">Confirma estos pedidos antes de iniciar: {unconfirmed.map((stop) => stop.pedido.numeroPedido).join(", ")}. <Link href="/orders" className="underline">Ir a Pedidos</Link></p>}
              <button className={`${button} bg-slate-950 text-white`} disabled={action.isPending || !canStart}
                onClick={() => { if (window.confirm(`¿Iniciar la ruta ${route.nombre}?`)) action.mutate({ id: route.idRuta, kind: "start" }); }}>
                {action.isPending && action.variables?.id === route.idRuta ? "Guardando..." : "Iniciar ruta"}
              </button>
            </>}
            {route.estado === "EN_CURSO" && <div className="space-y-3">
              <Link href={`/deliveries?route=${encodeURIComponent(route.idRuta)}`} className={`${button} inline-block`}>Registrar entregas e incidencias</Link>
              {!canComplete && <p className="text-sm text-slate-600">Completa las entregas de todas las paradas para finalizar la ruta.</p>}
              <button className={`${button} ml-2 bg-green-700 text-white`} disabled={action.isPending || !canComplete}
                onClick={() => { if (window.confirm(`¿Completar la ruta ${route.nombre}?`)) action.mutate({ id: route.idRuta, kind: "complete" }); }}>
                {action.isPending && action.variables?.id === route.idRuta ? "Guardando..." : "Completar ruta"}
              </button>
            </div>}
          </section>
        );
      })}
    </div>
  );
}
