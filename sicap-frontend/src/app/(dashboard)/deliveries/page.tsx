"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import { toast } from "sonner";
import { routeService, type DeliveryRoute, type RouteStop, type DeliveryAttempt } from "@/services/routeService";

const field = "mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2";
const button = "rounded-lg border px-3 py-2 text-sm disabled:opacity-50";
const labels = { PENDIENTE: "Pendiente", ENTREGADO: "Entregado", NO_ENTREGADO: "No entregado" };

function errorMessage(error: unknown) {
  if (isAxiosError<{ message?: string | string[] }>(error)) {
    const message = error.response?.data?.message;
    if (Array.isArray(message)) return message.join(", ");
    if (message) return message;
  }
  return "No fue posible guardar. Actualiza la ruta antes de reintentar.";
}

function IncidentForm({ attempt, onSave, disabled }: {
  attempt: DeliveryAttempt;
  onSave: (id: string, tipo: string, descripcion: string) => void;
  disabled: boolean;
}) {
  const [tipo, setTipo] = useState("");
  const [descripcion, setDescripcion] = useState("");
  return (
    <form className="mt-3 space-y-2" onSubmit={(event) => {
      event.preventDefault();
      if (!disabled && tipo.trim().length >= 2 && descripcion.trim().length >= 3) {
        onSave(attempt.idEntrega, tipo.trim(), descripcion.trim());
      }
    }}>
      <fieldset disabled={disabled} className="space-y-2">
        <legend className="text-sm font-medium">Agregar incidencia</legend>
        <label className="block text-sm">Tipo
          <input required minLength={2} maxLength={50} value={tipo}
            placeholder="Ej. Cliente ausente" onChange={(e) => setTipo(e.target.value)} className={field} />
        </label>
        <label className="block text-sm">Descripción
          <textarea required minLength={3} maxLength={1000} value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)} className={field} />
        </label>
        <button className={button} disabled={disabled || tipo.trim().length < 2 || descripcion.trim().length < 3}>
          Guardar incidencia
        </button>
      </fieldset>
    </form>
  );
}

function DeliveryStop({ route, stop, canWrite }: { route: DeliveryRoute; stop: RouteStop; canWrite: boolean }) {
  const client = useQueryClient();
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState("");
  const [incidentVersion, setIncidentVersion] = useState(0);
  const attempts = stop.entregas ?? [];
  const pending = attempts.find((attempt) => attempt.estado === "PENDIENTE");
  const products = stop.pedido.detalles;
  const refresh = async () => {
    await Promise.all([
      client.invalidateQueries({ queryKey: ["logistics"] }),
      client.invalidateQueries({ queryKey: ["orders"] }),
    ]);
  };
  const create = useMutation({
    mutationFn: () => routeService.createDelivery(route.idRuta, stop.idDetalleRuta, {
      observaciones: notes.trim(),
      detalles: products.map((product) => ({
        idDetallePedido: product.idDetalle,
        cantidadEntregada: Number(quantities[product.idDetalle] ?? "0"),
      })),
    }),
    onSuccess: async () => {
      setQuantities({}); setNotes("");
      await refresh(); toast.success("Intento registrado. Selecciona el resultado para finalizarlo.");
    },
    onError: async (error) => { toast.error(errorMessage(error)); await refresh(); },
  });
  const finish = useMutation({
    mutationFn: ({ id, estado }: { id: string; estado: "ENTREGADO" | "NO_ENTREGADO" }) =>
      routeService.updateDeliveryStatus(id, { estado }),
    onSuccess: async () => { await refresh(); toast.success("Resultado de entrega guardado"); },
    onError: async (error) => { toast.error(errorMessage(error)); await refresh(); },
  });
  const incident = useMutation({
    mutationFn: ({ id, tipo, descripcion }: { id: string; tipo: string; descripcion: string }) =>
      routeService.createIncident(id, { tipo, descripcion }),
    onSuccess: async () => { setIncidentVersion((value) => value + 1); await refresh(); toast.success("Incidencia registrada"); },
    onError: async (error) => { toast.error(errorMessage(error)); await refresh(); },
  });
  const busy = create.isPending || finish.isPending || incident.isPending;
  const canAttempt = canWrite && route.estado === "EN_CURSO" &&
    (stop.estado === "EN_RUTA" || stop.estado === "PENDIENTE") && stop.pedido.estado === "EN_RUTA";
  const validQuantities = products.length > 0 && products.every((product) => {
    const raw = quantities[product.idDetalle] ?? "0";
    const value = Number(raw);
    return raw !== "" && Number.isInteger(value) && value >= 0 && value <= product.cantidad;
  });

  return (
    <section className="space-y-4 rounded-xl border bg-white p-5">
      <div>
        <h2 className="text-lg font-semibold">Parada {stop.ordenParada} · {stop.pedido.numeroPedido}</h2>
        <p>{stop.pedido.cliente.nombre} · {stop.pedido.cliente.telefono}</p>
        <p className="text-sm text-slate-600">{stop.pedido.direccion.direccion}</p>
        <p className="text-sm">{stop.estado === "COMPLETADO" ? "Completada" : stop.estado === "CANCELADO" ? "Cancelada" : "Pendiente de entrega"}
          {" · Hora estimada: "}{stop.horaEstimada?.slice(11, 16) || "Sin asignar"}</p>
      </div>
      <ul className="text-sm">
        {products.map((product) => <li key={product.idDetalle}>{product.producto.nombre}: {product.cantidad} solicitados</li>)}
      </ul>
      {canAttempt && !pending && (
        <form className="space-y-3 rounded-lg bg-slate-50 p-4" onSubmit={(event) => {
          event.preventDefault();
          if (!busy && validQuantities) create.mutate();
        }}>
          <fieldset disabled={busy} className="space-y-3">
            <legend className="font-semibold">Nuevo intento</legend>
            <p className="text-sm text-slate-600">Indica las cantidades de este intento. Una entrega completa requiere todos los productos.</p>
            <button type="button" className={button} onClick={() => setQuantities(Object.fromEntries(products.map((p) => [p.idDetalle, String(p.cantidad)])))}>
              Completar cantidades solicitadas
            </button>
            {products.map((product) => (
              <label key={product.idDetalle} className="block text-sm">{product.producto.nombre} · entregados de {product.cantidad}
                <input type="number" required min={0} max={product.cantidad} step={1}
                  value={quantities[product.idDetalle] ?? "0"} className={field}
                  onChange={(event) => setQuantities({ ...quantities, [product.idDetalle]: event.target.value })} />
              </label>
            ))}
            <label className="block text-sm">Observaciones
              <textarea maxLength={1000} value={notes} onChange={(event) => setNotes(event.target.value)} className={field} />
            </label>
            <button className={`${button} bg-slate-950 text-white`} disabled={busy || !validQuantities}>
              {create.isPending ? "Guardando..." : "Registrar intento"}
            </button>
          </fieldset>
        </form>
      )}
      <div className="space-y-3">
        <h3 className="font-semibold">Intentos ({attempts.length})</h3>
        {attempts.length === 0 && <p className="text-sm text-slate-500">Sin intentos registrados.</p>}
        {attempts.map((attempt) => {
          const complete = products.length > 0 && products.every((p) =>
            attempt.detalles.find((d) => d.idDetallePedido === p.idDetalle)?.cantidadEntregada === p.cantidad);
          return (
            <article key={attempt.idEntrega} className="space-y-2 rounded-lg border p-4">
              <p className="font-medium">Intento {attempt.numeroIntento} · {labels[attempt.estado]}</p>
              <p className="text-sm text-slate-500">{new Date(attempt.fechaHora).toLocaleString("es-GT")}</p>
              {attempt.detalles.map((detail) => <p key={detail.idDetallePedido} className="text-sm">
                {products.find((p) => p.idDetalle === detail.idDetallePedido)?.producto.nombre ?? "Producto"}: {detail.cantidadEntregada} entregados
              </p>)}
              {attempt.observaciones && <p className="whitespace-pre-wrap text-sm">{attempt.observaciones}</p>}
              {canAttempt && attempt.estado === "PENDIENTE" && (
                <div className="space-y-2">
                  <p className="text-sm">Finaliza este intento antes de registrar otro. Las cantidades guardadas no se pueden editar.</p>
                  {!complete && <p className="text-sm text-amber-700">Faltan productos para marcar como entregado. El backend requiere la entrega completa en un intento.</p>}
                  <div className="flex flex-wrap gap-2">
                    {(["ENTREGADO", "NO_ENTREGADO"] as const).map((estado) => (
                      <button key={estado} className={button} disabled={busy || (estado === "ENTREGADO" && !complete)}
                        onClick={() => {
                          if (window.confirm(`¿Finalizar el intento como ${labels[estado].toLowerCase()}?`)) finish.mutate({ id: attempt.idEntrega, estado });
                        }}>
                        {finish.isPending && finish.variables?.id === attempt.idEntrega ? "Guardando..." : labels[estado]}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <h4 className="text-sm font-medium">Incidencias</h4>
              {attempt.incidencias.length === 0 && <p className="text-sm text-slate-500">Sin incidencias.</p>}
              {attempt.incidencias.map((item) => <p key={item.idIncidencia} className="whitespace-pre-wrap text-sm"><strong>{item.tipo}:</strong> {item.descripcion}</p>)}
              {canWrite && route.estado === "EN_CURSO" && (
                <IncidentForm key={`${attempt.idEntrega}:${incidentVersion}`} attempt={attempt} disabled={busy}
                  onSave={(id, tipo, descripcion) => incident.mutate({ id, tipo, descripcion })} />
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}

function DeliveriesContent() {
  const searchParams = useSearchParams();
  const { data: session, status } = useSession();
  const isAdmin = session?.user?.role === "ADMIN";
  const isDriver = session?.user?.role === "DRIVER";
  const [routeId, setRouteId] = useState(searchParams.get("route") ?? "");
  const query = useQuery({ queryKey: isDriver ? ["logistics", "my-routes", session?.user?.id] : ["logistics", "routes"], queryFn: isDriver ? routeService.getMine : routeService.getAll, enabled: isAdmin || isDriver });
  const routes = (query.data ?? []).filter((route) => isAdmin || route.idRepartidor === session?.user?.id);
  const selected = routes.find((route) => route.idRuta === routeId);
  if (status === "loading") return <p>Cargando sesión...</p>;
  if (!isAdmin && !isDriver) return <p>No tienes permisos para acceder a Entregas.</p>;
  return (
    <div className="space-y-6">
      <div><h1 className="text-3xl font-bold">Entregas</h1>
        <p className="mt-1 text-sm text-slate-500">Cantidades entregadas, resultados e incidencias por parada.</p>
      </div>
      {query.isPending ? <p>Cargando rutas...</p> : query.isError ? (
        <div role="alert"><p>{errorMessage(query.error)}</p><button className={button} onClick={() => query.refetch()}>Reintentar</button></div>
      ) : routes.length === 0 ? <p>No hay rutas disponibles.</p> : (
        <label className="block max-w-xl text-sm">Ruta
          <select className={field} value={routeId} onChange={(event) => setRouteId(event.target.value)}>
            <option value="">Selecciona una ruta</option>
            {routes.map((route) => <option key={route.idRuta} value={route.idRuta}>{route.codigoRuta} · {route.nombre} · {route.fecha.slice(0, 10)} · {route.estado}</option>)}
          </select>
        </label>
      )}
      {selected && !query.isError && <>
        <p className="text-sm">Repartidor: {selected.repartidor.nombre}. {selected.estado === "PLANIFICADA" ? (isDriver ? "Inicia la ruta desde Ruta del día para registrar entregas." : "El repartidor asignado debe iniciar la ruta para registrar entregas.") : selected.estado === "EN_CURSO" ? "El repartidor asignado puede registrar las entregas." : "Consulta de ruta finalizada."}{" "}
          <Link href={isDriver ? "/my-route" : "/routes"} className="underline">{isDriver ? "Ir a Ruta del día" : "Ir a Rutas"}</Link>
        </p>
        {selected.detalles.length === 0 && <p>Esta ruta no tiene paradas.</p>}
        {[...selected.detalles].sort((a, b) => a.ordenParada - b.ordenParada).map((stop) => (
          <DeliveryStop key={`${selected.idRuta}:${stop.idDetalleRuta}`} route={selected} stop={stop}
            canWrite={isDriver && selected.idRepartidor === session?.user?.id} />
        ))}
      </>}
    </div>
  );
}

export default function DeliveriesPage() {
  return <Suspense fallback={<p>Cargando entregas...</p>}><DeliveriesContent /></Suspense>;
}
