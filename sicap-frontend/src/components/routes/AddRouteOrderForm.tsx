"use client";

import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import { toast } from "sonner";
import { orderService } from "@/services/orderService";
import { routeService, type DeliveryRoute } from "@/services/routeService";

function errorMessage(error: unknown): string {
  if (isAxiosError<{ message?: string | string[] }>(error)) {
    const message = error.response?.data?.message;
    if (Array.isArray(message)) return message.join(", ");
    if (typeof message === "string") return message;
  }
  return "No fue posible agregar el pedido. Intenta nuevamente.";
}

export function AddRouteOrderForm({
  route,
  routes,
  routesReady,
}: {
  route: DeliveryRoute;
  routes: DeliveryRoute[];
  routesReady: boolean;
}) {
  const queryClient = useQueryClient();
  const [orderId, setOrderId] = useState("");
  const ordersQuery = useQuery({
    queryKey: ["orders"],
    queryFn: orderService.getAll,
  });

  const assignedIds = new Set(
    [...routes, route]
      .filter((item) => item.estado === "PLANIFICADA" || item.estado === "EN_CURSO")
      .flatMap((item) => item.detalles.map((stop) => stop.idPedido)),
  );
  const availableOrders = (ordersQuery.data ?? []).filter(
    (order) => order.estado !== "ENTREGADO" &&
      order.estado !== "CANCELADO" && !assignedIds.has(order.idPedido),
  );
  const nextStop = Math.max(0, ...route.detalles.map((stop) => stop.ordenParada)) + 1;
  const selectedAvailable = availableOrders.some((order) => order.idPedido === orderId);
  const canSubmit = routesReady && !ordersQuery.isPending &&
    !ordersQuery.isError && selectedAvailable && route.estado === "PLANIFICADA";

  const addMutation = useMutation({
    mutationFn: (idPedido: string) => routeService.addOrder(route.idRuta, {
      idPedido,
      ordenParada: nextStop,
    }),
    onSuccess: async () => {
      setOrderId("");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["logistics"] }),
        queryClient.invalidateQueries({ queryKey: ["orders"] }),
      ]);
      toast.success("Pedido agregado a la ruta");
    },
    onError: async (error) => {
      toast.error(errorMessage(error));
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["logistics"] }),
        queryClient.invalidateQueries({ queryKey: ["orders"] }),
      ]);
    },
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (canSubmit && !addMutation.isPending) addMutation.mutate(orderId);
  }

  return (
    <form onSubmit={submit} className="space-y-3 rounded-xl border p-4">
      <h3 className="font-semibold">Agregar pedido</h3>
      <p className="text-sm text-slate-500">
        Se agregará al final como parada {nextStop}. Se excluyen pedidos entregados,
        cancelados o asignados a una ruta activa.
      </p>
      {ordersQuery.isError ? (
        <div role="alert" className="text-sm text-red-600">
          No fue posible cargar los pedidos.
          <button type="button" onClick={() => ordersQuery.refetch()}
            className="ml-2 underline">Reintentar</button>
        </div>
      ) : !routesReady ? (
        <p role="alert" className="text-sm text-red-600">
          No fue posible verificar las asignaciones. Actualiza la lista de rutas.
        </p>
      ) : ordersQuery.isPending ? (
        <p role="status" className="text-sm text-slate-500">Cargando pedidos...</p>
      ) : availableOrders.length === 0 ? (
        <p role="status" className="text-sm text-slate-500">
          No hay pedidos disponibles para asignar.
        </p>
      ) : (
        <label className="block text-sm">
          Pedido
          <select required value={selectedAvailable ? orderId : ""}
            onChange={(event) => setOrderId(event.target.value)}
            disabled={addMutation.isPending}
            className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm">
            <option value="">Selecciona un pedido</option>
            {availableOrders.map((order) => (
              <option key={order.idPedido} value={order.idPedido}>
                {order.numeroPedido} | {order.cliente.nombre} | {order.direccion.direccion}
              </option>
            ))}
          </select>
        </label>
      )}
      <button type="submit" disabled={!canSubmit || addMutation.isPending}
        className="rounded-lg bg-slate-950 px-4 py-2 text-sm text-white disabled:opacity-50">
        {addMutation.isPending ? "Agregando..." : "Agregar a la ruta"}
      </button>
    </form>
  );
}
