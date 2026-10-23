
"use client";

import { Suspense, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  CalendarDays,
  ClipboardList,
  MapPinned,
  Play,
  CheckCircle2,
  Plus,
  Search,
  X,
  Eye,
} from "lucide-react";
import { toast } from "sonner";
import { AddRouteOrderForm } from "@/components/routes/AddRouteOrderForm";

import {
  routeService,
  type DeliveryRoute,
  type RouteStatus,
  type UpdateRoutePayload,
} from "@/services/routeService";
import {
  routeUserService,
} from "@/services/routeUserService";

const statusLabels: Record<RouteStatus, string> = {
  PLANIFICADA: "Planificada",
  EN_CURSO: "En curso",
  COMPLETADA: "Completada",
  CANCELADA: "Cancelada",
};

const statusStyles: Record<RouteStatus, string> = {
  PLANIFICADA: "bg-blue-100 text-blue-700",
  EN_CURSO: "bg-amber-100 text-amber-700",
  COMPLETADA: "bg-green-100 text-green-700",
  CANCELADA: "bg-red-100 text-red-700",
};

const fieldClass =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm";

function getErrorMessage(error: unknown): string {
  if (typeof error === "object" && error !== null && "response" in error) {
    const response = (
      error as {
        response?: {
          data?: { message?: string | string[] };
        };
      }
    ).response;

    const message = response?.data?.message;

    if (Array.isArray(message)) return message.join(", ");
    if (typeof message === "string") return message;
  }

  return error instanceof Error
    ? error.message
    : "No fue posible completar la operación.";
}

function localToday(): string {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function routeDate(value: string): string {
  const date = value.slice(0, 10);
  const [year, month, day] = date.split("-");
  return year && month && day
    ? `${day}/${month}/${year}`
    : "—";
}

function Metric({
  title,
  value,
  icon,
}: {
  title: string;
  value: number;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border bg-white p-5">
      <div className="flex items-center justify-between">
        <span className="text-sm text-slate-600">{title}</span>
        <span className="text-slate-500">{icon}</span>
      </div>
      <div className="mt-5 text-3xl font-bold">{value}</div>
    </div>
  );
}

function StopTimeForm({ value, disabled, saving, onSave }: {
  value: string;
  disabled: boolean;
  saving: boolean;
  onSave: (time: string | null) => void;
}) {
  const [time, setTime] = useState(value);
  return (
    <form className="mt-3 flex flex-wrap items-end gap-2" onSubmit={(event) => {
      event.preventDefault();
      if (!disabled && time && time !== value) onSave(time);
    }}>
      <label className="text-sm">
        Hora estimada
        <input type="time" required value={time} disabled={disabled}
          onChange={(event) => setTime(event.target.value)}
          className={`${fieldClass} mt-1 block`} />
      </label>
      <button type="submit" disabled={disabled || !time || time === value}
        className="rounded-lg border px-3 py-2 disabled:opacity-50">
        {saving ? "Guardando..." : "Guardar hora"}
      </button>
      {value && (
        <button type="button" disabled={disabled} onClick={() => onSave(null)}
          className="rounded-lg border px-3 py-2 disabled:opacity-50">
          Quitar hora
        </button>
      )}
    </form>
  );
}

function RoutesContent() {
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const { data: session, status: sessionStatus } = useSession();

  const isAdmin = session?.user?.role === "ADMIN";
  const isDriver = session?.user?.role === "DRIVER";
  const userId = session?.user?.id ?? "";

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("TODAS");
  const [formOpen, setFormOpen] = useState(searchParams.get("create") === "1");
  const [editingRoute, setEditingRoute] = useState<DeliveryRoute | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [form, setForm] = useState({
    nombre: "",
    fecha: localToday(),
    idRepartidor: "",
    observaciones: "",
  });

  const {
    data: routes = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ["logistics", "routes"],
    queryFn: routeService.getAll,
    enabled: isAdmin || isDriver,
  });

  const { data: drivers = [] } = useQuery({
    queryKey: ["logistics", "drivers"],
    queryFn: routeUserService.getDrivers,
    enabled: isAdmin,
  });

  const {
    data: selectedRoute,
    isLoading: detailLoading,
  } = useQuery({
    queryKey: ["logistics", "route", selectedId],
    queryFn: () => routeService.getById(selectedId!),
    enabled: Boolean(selectedId),
  });

  const createMutation = useMutation({
    mutationFn: routeService.create,
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["logistics", "routes"],
      });
      toast.success("Ruta creada correctamente");
      setFormOpen(false);
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateRoutePayload }) =>
      routeService.update(id, payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["logistics"] });
      toast.success("Ruta actualizada correctamente");
      setFormOpen(false);
      setEditingRoute(null);
    },
    onError: async (err) => {
      toast.error(getErrorMessage(err));
      await queryClient.invalidateQueries({ queryKey: ["logistics"] });
    },
  });

  const savingRoute = createMutation.isPending || updateMutation.isPending;

  const stopTimeMutation = useMutation({
    mutationFn: ({ routeId, detailId, time }: {
      routeId: string; detailId: string; time: string | null;
    }) => routeService.updateStop(routeId, detailId, { horaEstimada: time }),
    onSuccess: async (_data, variables) => {
      await queryClient.invalidateQueries({ queryKey: ["logistics"] });
      toast.success(variables.time === null ? "Hora estimada eliminada" : "Hora estimada guardada");
    },
    onError: async (err) => {
      toast.error(getErrorMessage(err));
      await queryClient.invalidateQueries({ queryKey: ["logistics"] });
    },
  });

  const moveStopMutation = useMutation({
    mutationFn: ({ routeId, detailId, direction }: {
      routeId: string; detailId: string; direction: 'UP' | 'DOWN';
    }) => routeService.moveStop(routeId, detailId, direction),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["logistics"] });
      toast.success("Orden de paradas actualizado");
    },
    onError: async (err) => {
      toast.error(getErrorMessage(err));
      await queryClient.invalidateQueries({ queryKey: ["logistics"] });
    },
  });

  const removeOrderMutation = useMutation({
    mutationFn: ({ routeId, detailId }: { routeId: string; detailId: string }) =>
      routeService.removeOrder(routeId, detailId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["logistics"] });
      toast.success("Pedido retirado de la ruta");
    },
    onError: async (err) => {
      toast.error(getErrorMessage(err));
      await queryClient.invalidateQueries({ queryKey: ["logistics"] });
    },
  });

  const startMutation = useMutation({
    mutationFn: routeService.start,
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["logistics"],
      });
      toast.success("Ruta iniciada");
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const completeMutation = useMutation({
    mutationFn: routeService.complete,
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["logistics"],
      });
      toast.success("Ruta completada");
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

    // El backend limita la consulta a las rutas del repartidor.
    // Conservamos el filtro de asignación también en la vista.
  const visibleRoutes = useMemo(() => {
    const scoped = isDriver
      ? routes.filter((route) => route.idRepartidor === userId)
      : routes;

    const term = search.trim().toLowerCase();

    return scoped.filter((route) => {
      const matchesSearch =
        route.nombre.toLowerCase().includes(term) ||
        route.codigoRuta.toLowerCase().includes(term) ||
        route.repartidor?.nombre.toLowerCase().includes(term);

      const matchesStatus =
        statusFilter === "TODAS" ||
        route.estado === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [routes, isDriver, userId, search, statusFilter]);

  function openCreate() {
    setEditingRoute(null);
    setForm({
      nombre: "",
      fecha: localToday(),
      idRepartidor: isDriver ? userId : "",
      observaciones: "",
    });
    setFormOpen(true);
  }

  function openEdit(route: DeliveryRoute) {
    if (route.estado !== "PLANIFICADA") return;
    setEditingRoute(route);
    setForm({
      nombre: route.nombre,
      fecha: route.fecha.slice(0, 10),
      idRepartidor: route.idRepartidor,
      observaciones: route.observaciones ?? "",
    });
    setFormOpen(true);
  }

  function submitRoute(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (savingRoute) return;

    if (form.nombre.trim().length < 2) {
      toast.error("El nombre debe tener al menos 2 caracteres");
      return;
    }

    const idRepartidor = isDriver
      ? userId
      : form.idRepartidor;

    if (!idRepartidor) {
      toast.error("Selecciona un repartidor");
      return;
    }

    if (editingRoute) {
      const currentRoute = routes.find((route) => route.idRuta === editingRoute.idRuta);
      if (currentRoute && currentRoute.estado !== "PLANIFICADA") {
        toast.error("Solo se pueden editar rutas planificadas");
        return;
      }
      updateMutation.mutate({
        id: editingRoute.idRuta,
        payload: {
          nombre: form.nombre.trim(),
          fecha: form.fecha,
          observaciones: form.observaciones.trim(),
          ...(idRepartidor !== editingRoute.idRepartidor ? { idRepartidor } : {}),
        },
      });
      return;
    }

    createMutation.mutate({
      nombre: form.nombre.trim(),
      fecha: form.fecha,
      idRepartidor,
      ...(form.observaciones.trim()
        ? { observaciones: form.observaciones.trim() }
        : {}),
    });
  }

  const planned = visibleRoutes.filter(
    (route) => route.estado === "PLANIFICADA"
  ).length;

  const inProgress = visibleRoutes.filter(
    (route) => route.estado === "EN_CURSO"
  ).length;

  const completed = visibleRoutes.filter(
    (route) => route.estado === "COMPLETADA"
  ).length;

  if (sessionStatus === "loading") {
    return <p className="p-6">Cargando sesión...</p>;
  }

  if (!isAdmin && !isDriver) {
    return (
      <p className="p-6 text-red-600">
        No tienes permisos para acceder a Rutas.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Rutas</h1>
          <p className="mt-1 text-sm text-slate-500">
            Planificación y control de distribución de pedidos.
          </p>
        </div>

        <button
          onClick={openCreate}
          className="flex items-center gap-2 rounded-lg bg-slate-950 px-4 py-2 text-sm text-white"
        >
          <Plus size={18} />
          Nueva ruta
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric
          title="Total de rutas"
          value={visibleRoutes.length}
          icon={<MapPinned size={20} />}
        />
        <Metric
          title="Planificadas"
          value={planned}
          icon={<CalendarDays size={20} />}
        />
        <Metric
          title="En curso"
          value={inProgress}
          icon={<Play size={20} />}
        />
        <Metric
          title="Completadas"
          value={completed}
          icon={<CheckCircle2 size={20} />}
        />
      </div>

      <section className="overflow-hidden rounded-2xl border bg-white">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b p-5">
          <div>
            <h2 className="text-lg font-semibold">
              Rutas registradas
            </h2>
            <p className="text-sm text-slate-500">
              Consulta las rutas y sus pedidos asociados.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <div className="relative">
              <Search
                size={16}
                className="absolute left-3 top-3 text-slate-400"
              />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar ruta..."
                className={`${fieldClass} pl-9`}
              />
            </div>

            <select
              value={statusFilter}
              onChange={(event) =>
                setStatusFilter(event.target.value)
              }
              className={fieldClass}
            >
              <option value="TODAS">Todos los estados</option>
              {(
                [
                  "PLANIFICADA",
                  "EN_CURSO",
                  "COMPLETADA",
                  "CANCELADA",
                ] as RouteStatus[]
              ).map((status) => (
                <option key={status} value={status}>
                  {statusLabels[status]}
                </option>
              ))}
            </select>
          </div>
        </div>

        {isLoading ? (
          <p className="p-6">Cargando rutas...</p>
        ) : error ? (
          <p className="p-6 text-red-600">
            {getErrorMessage(error)}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="px-5 py-3">Código</th>
                  <th className="px-5 py-3">Ruta</th>
                  <th className="px-5 py-3">Fecha</th>
                  <th className="px-5 py-3">Repartidor</th>
                  <th className="px-5 py-3">Pedidos</th>
                  <th className="px-5 py-3">Estado</th>
                  <th className="px-5 py-3">Acciones</th>
                </tr>
              </thead>

              <tbody className="divide-y">
                {visibleRoutes.map((route: DeliveryRoute) => (
                  <tr key={route.idRuta}>
                    <td className="px-5 py-4 font-medium">
                      {route.codigoRuta}
                    </td>
                    <td className="px-5 py-4">
                      {route.nombre}
                    </td>
                    <td className="px-5 py-4">
                      {routeDate(route.fecha)}
                    </td>
                    <td className="px-5 py-4">
                      {route.repartidor?.nombre ?? "—"}
                    </td>
                    <td className="px-5 py-4">
                      {route.detalles.length}
                    </td>
                    <td className="px-5 py-4">
                      <span
                        className={`rounded-full px-2 py-1 text-xs ${statusStyles[route.estado]}`}
                      >
                        {statusLabels[route.estado]}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <button
                        onClick={() => setSelectedId(route.idRuta)}
                        className="flex items-center gap-1 rounded-lg border px-3 py-1.5 hover:bg-slate-50"
                      >
                        <Eye size={15} />
                        Ver
                      </button>
                    </td>
                  </tr>
                ))}

                {visibleRoutes.length === 0 && (
                  <tr>
                    <td
                      colSpan={7}
                      className="p-8 text-center text-slate-500"
                    >
                      No hay rutas para mostrar.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {formOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
            <div className="mb-5 flex justify-between">
              <h2 className="text-xl font-bold">
                {editingRoute ? "Editar ruta" : "Nueva ruta"}
              </h2>
              <button
                onClick={() => setFormOpen(false)}
                disabled={savingRoute}
                aria-label="Cerrar"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={submitRoute} className="space-y-4">
              <fieldset disabled={savingRoute} className="space-y-4">
              <label className="block text-sm">
                Nombre de la ruta *
                <input
                  required
                  minLength={2}
                  maxLength={100}
                  value={form.nombre}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      nombre: event.target.value,
                    })
                  }
                  className={`${fieldClass} mt-1`}
                />
              </label>

              <label className="block text-sm">
                Fecha *
                <input
                  required
                  type="date"
                  value={form.fecha}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      fecha: event.target.value,
                    })
                  }
                  className={`${fieldClass} mt-1`}
                />
              </label>

              {isAdmin ? (
                <label className="block text-sm">
                  Repartidor *
                  <select
                    required
                    value={form.idRepartidor}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        idRepartidor: event.target.value,
                      })
                    }
                    className={`${fieldClass} mt-1`}
                  >
                    <option value="">
                      Selecciona un repartidor
                    </option>
                    {editingRoute && !drivers.some((driver) => driver.idUsuario === editingRoute.idRepartidor) && (
                      <option value={editingRoute.idRepartidor}>
                        {editingRoute.repartidor.nombre} (asignado actualmente)
                      </option>
                    )}
                    {drivers.map((driver) => (
                      <option
                        key={driver.idUsuario}
                        value={driver.idUsuario}
                      >
                        {driver.nombre}
                      </option>
                    ))}
                  </select>
                </label>
              ) : (
                <p className="rounded-lg bg-slate-50 p-3 text-sm">
                  Repartidor asignado: {session?.user?.name}
                </p>
              )}

              <label className="block text-sm">
                Observaciones
                <textarea
                  maxLength={1000}
                  rows={3}
                  value={form.observaciones}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      observaciones: event.target.value,
                    })
                  }
                  className={`${fieldClass} mt-1`}
                />
              </label>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setFormOpen(false)}
                  className="rounded-lg border px-4 py-2"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingRoute}
                  className="rounded-lg bg-slate-950 px-4 py-2 text-white disabled:opacity-50"
                >
                  {savingRoute
                    ? "Guardando..."
                    : editingRoute ? "Guardar cambios" : "Crear ruta"}
                </button>
              </div>
              </fieldset>
            </form>
          </div>
        </div>
      )}

      {selectedId && !formOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-xl font-bold">
                Detalle de ruta
              </h2>
              <button
                onClick={() => setSelectedId(null)}
                aria-label="Cerrar detalle"
              >
                <X size={20} />
              </button>
            </div>

            {detailLoading || !selectedRoute ? (
              <p>Cargando ruta...</p>
            ) : (
              <div className="space-y-5">
                <div className="rounded-xl bg-slate-50 p-4">
                  <p className="font-semibold">
                    {selectedRoute.codigoRuta}
                  </p>
                  <h3 className="text-lg font-bold">
                    {selectedRoute.nombre}
                  </h3>
                  <p className="text-sm">
                    Fecha: {routeDate(selectedRoute.fecha)}
                  </p>
                  <p className="text-sm">
                    Repartidor: {selectedRoute.repartidor?.nombre}
                  </p>
                  <p className="text-sm">
                    Estado: {statusLabels[selectedRoute.estado]}
                  </p>
                  {selectedRoute.observaciones && (
                    <p className="whitespace-pre-wrap text-sm">
                      Observaciones: {selectedRoute.observaciones}
                    </p>
                  )}
                  {selectedRoute.estado === "PLANIFICADA" &&
                    (isAdmin || selectedRoute.idRepartidor === userId) && (
                      <button
                        type="button"
                        disabled={startMutation.isPending || moveStopMutation.isPending || removeOrderMutation.isPending || stopTimeMutation.isPending}
                        onClick={() => openEdit(selectedRoute)}
                        className="mt-3 rounded-lg border px-3 py-1.5 text-sm hover:bg-white disabled:opacity-50"
                      >
                        Editar ruta
                      </button>
                    )}
                </div>

                {selectedRoute.estado === "PLANIFICADA" && (
                  <AddRouteOrderForm
                    key={selectedRoute.idRuta}
                    route={selectedRoute}
                    routes={routes}
                    routesReady={!isLoading && !error}
                  />
                )}

                <div>
                  <h3 className="mb-3 flex items-center gap-2 font-semibold">
                    <ClipboardList size={18} />
                    Paradas ({selectedRoute.detalles.length})
                  </h3>

                  {selectedRoute.detalles.length === 0 ? (
                    <p className="rounded-lg border p-4 text-sm text-slate-500">
                      Todavía no hay pedidos asignados.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {[...selectedRoute.detalles].sort((a, b) => a.ordenParada - b.ordenParada).map((stop, index) => (
                        <div
                          key={stop.idDetalleRuta}
                          className="rounded-lg border p-3 text-sm"
                        >
                          <p className="font-medium">
                            Parada {stop.ordenParada}
                            {" — "}
                            {stop.pedido.numeroPedido}
                          </p>
                          <p>
                            Cliente: {stop.pedido.cliente.nombre}
                          </p>
                          <p>
                            Dirección: {stop.pedido.direccion.direccion}
                          </p>
                          <p>Estado: {stop.estado}</p>
                          <p>Hora estimada: {stop.horaEstimada?.slice(11, 16) || "Sin asignar"}</p>
                          {selectedRoute.estado === "PLANIFICADA" && (
                            <StopTimeForm
                              key={`${stop.idDetalleRuta}:${stop.horaEstimada ?? ""}`}
                              value={stop.horaEstimada?.slice(11, 16) ?? ""}
                              disabled={stopTimeMutation.isPending || moveStopMutation.isPending || removeOrderMutation.isPending || startMutation.isPending}
                              saving={stopTimeMutation.isPending && stopTimeMutation.variables?.detailId === stop.idDetalleRuta}
                              onSave={(time) => stopTimeMutation.mutate({ routeId: selectedRoute.idRuta, detailId: stop.idDetalleRuta, time })}
                            />
                          )}
                          {selectedRoute.estado === "PLANIFICADA" && (
                            <div className="mt-3 flex gap-2">
                              {(['UP', 'DOWN'] as const).map((direction) => (
                                <button key={direction} type="button"
                                  disabled={stopTimeMutation.isPending || moveStopMutation.isPending || removeOrderMutation.isPending ||
                                    startMutation.isPending || (direction === 'UP' ? index === 0 :
                                      index === selectedRoute.detalles.length - 1)}
                                  aria-label={`${direction === 'UP' ? 'Subir' : 'Bajar'} pedido ${stop.pedido.numeroPedido}`}
                                  onClick={() => {
                                    if (moveStopMutation.isPending) return;
                                    moveStopMutation.mutate({ routeId: selectedRoute.idRuta,
                                      detailId: stop.idDetalleRuta, direction });
                                  }}
                                  className="rounded-lg border px-3 py-1.5 hover:bg-slate-50 disabled:opacity-50">
                                  {direction === 'UP' ? 'Subir' : 'Bajar'}
                                </button>
                              ))}
                            </div>
                          )}

                          {selectedRoute.estado === "PLANIFICADA" && (
                            <button
                              type="button"
                              disabled={stopTimeMutation.isPending || removeOrderMutation.isPending || startMutation.isPending || moveStopMutation.isPending}
                              aria-label={`Retirar pedido ${stop.pedido.numeroPedido} de la ruta`}
                              onClick={() => {
                                if (removeOrderMutation.isPending) return;
                                if (window.confirm(
                                  `¿Retirar el pedido ${stop.pedido.numeroPedido} de esta ruta? El pedido seguirá registrado.`,
                                )) {
                                  removeOrderMutation.mutate({
                                    routeId: selectedRoute.idRuta,
                                    detailId: stop.idDetalleRuta,
                                  });
                                }
                              }}
                              className="mt-3 rounded-lg border border-red-200 px-3 py-1.5 text-red-700 hover:bg-red-50 disabled:opacity-50"
                            >
                              {removeOrderMutation.isPending &&
                              removeOrderMutation.variables?.detailId === stop.idDetalleRuta &&
                              removeOrderMutation.variables?.routeId === selectedRoute.idRuta
                                ? "Retirando..."
                                : "Retirar"}
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {isDriver &&
                  selectedRoute.idRepartidor === userId &&
                  selectedRoute.estado === "PLANIFICADA" &&
                  selectedRoute.detalles.length > 0 && (
                    <button
                      disabled={stopTimeMutation.isPending || startMutation.isPending || removeOrderMutation.isPending || moveStopMutation.isPending}
                      onClick={() => {
                        if (
                          window.confirm(
                            "¿Deseas iniciar esta ruta?"
                          )
                        ) {
                          startMutation.mutate(selectedRoute.idRuta);
                        }
                      }}
                      className="rounded-lg bg-slate-950 px-4 py-2 text-white disabled:opacity-50"
                    >
                      Iniciar ruta
                    </button>
                  )}

                {isDriver &&
                  selectedRoute.idRepartidor === userId &&
                  selectedRoute.estado === "EN_CURSO" &&
                  selectedRoute.detalles.length > 0 &&
                  selectedRoute.detalles.every(
                    (stop) => stop.estado === "COMPLETADO"
                  ) && (
                    <button
                      disabled={completeMutation.isPending}
                      onClick={() => {
                        if (
                          window.confirm(
                            "¿Deseas completar esta ruta?"
                          )
                        ) {
                          completeMutation.mutate(selectedRoute.idRuta);
                        }
                      }}
                      className="rounded-lg bg-green-700 px-4 py-2 text-white disabled:opacity-50"
                    >
                      Completar ruta
                    </button>
                  )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function RoutesPage() {
  return <Suspense fallback={<p>Cargando rutas...</p>}><RoutesContent /></Suspense>;
}
