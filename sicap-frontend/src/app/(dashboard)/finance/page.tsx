"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import { toast } from "sonner";
import { financeService } from "@/services/financeService";
import { FinanceExpenses } from "@/components/finance/FinanceExpenses";
import { FinancialSummary } from "@/components/finance/FinancialSummary";
import { PaymentDetail } from "@/components/finance/PaymentDetail";

const button = "rounded-lg border px-4 py-2 text-sm disabled:opacity-50";
const field = "mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm";
const money = (value: number | string) => new Intl.NumberFormat("es-GT", { style: "currency", currency: "GTQ" }).format(Number(value));
const dateOnly = (value: string) => value.slice(0, 10).split("-").reverse().join("/");
const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Guatemala", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
const paymentLabels = { PENDIENTE: "Pendiente", PARCIAL: "Parcial", PAGADO: "Pagado" };

function errorMessage(error: unknown) {
  if (isAxiosError<{ message?: string | string[] }>(error)) {
    const value = error.response?.data?.message;
    if (Array.isArray(value)) return value.join(", ");
    if (value) return value;
  }
  return "No fue posible completar la operación. Actualiza para consultar el estado actual.";
}

export default function FinancePage() {
  const { data: session, status } = useSession();
  const client = useQueryClient();
  const isAdmin = session?.user?.role === "ADMIN";
  const allowed = isAdmin || session?.user?.role === "DRIVER";
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("TODOS");
  const [saleType, setSaleType] = useState("TODOS");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [orderId, setOrderId] = useState("");
  const [due, setDue] = useState(today);
  const orders = useQuery({ queryKey: ["finances", "orders"], queryFn: financeService.getOrders, enabled: allowed });
  const accounts = useQuery({ queryKey: ["finances", "receivables"], queryFn: financeService.getReceivables, enabled: allowed });
  const create = useMutation({
    mutationFn: () => financeService.createReceivable({ idPedido: orderId, fechaVencimiento: `${due}T00:00:00-06:00` }),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ["finances"] });
      setCreateOpen(false); setOrderId(""); toast.success("Cuenta por cobrar creada");
    },
    onError: async (error) => { toast.error(errorMessage(error)); await client.invalidateQueries({ queryKey: ["finances"] }); },
  });
  const allOrders = orders.data?.pedidos ?? [];
  const available = allOrders.filter((order) => order.tipoVenta === "CREDITO" && order.estadoPedido !== "CANCELADO" && !order.cuentaPorCobrar && order.saldoPendiente > 0);
  const accountByOrder = new Map((accounts.data ?? []).map((account) => [account.idPedido, account]));
  const visible = allOrders.filter((order) => {
    const account = accountByOrder.get(order.idPedido);
    const term = search.trim().toLowerCase();
    return (order.numeroPedido.toLowerCase().includes(term) || account?.pedido.cliente.nombre.toLowerCase().includes(term)) &&
      (saleType === "TODOS" || order.tipoVenta === saleType) &&
      (filter === "TODOS" || filter === order.estadoPago || (filter === "VENCIDAS" && order.cuentaPorCobrar?.estadoCalculado === "VENCIDA") || (filter === "CUENTAS" && Boolean(order.cuentaPorCobrar)));
  });
  const loading = orders.isPending || accounts.isPending;
  const failed = orders.isError || accounts.isError;
  const refreshing = orders.isFetching || accounts.isFetching;
  const reload = () => client.invalidateQueries({ queryKey: ["finances"] });
  if (status === "loading") return <p>Cargando sesión...</p>;
  if (!allowed) return <p>No tienes permisos para acceder a Finanzas.</p>;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h1 className="text-3xl font-bold">Finanzas</h1><p className="mt-1 text-sm text-slate-500">Cuentas por cobrar, abonos y pagos de pedidos.</p></div>
        <div className="flex gap-2">
          <button className={button} disabled={refreshing || create.isPending} onClick={() => reload()}>Actualizar</button>
          <button className={`${button} bg-slate-950 text-white`} disabled={loading || failed || create.isPending} onClick={() => { setOrderId(""); setDue(today()); setCreateOpen(true); }}>Nueva cuenta por cobrar</button>
        </div>
      </div>
      {isAdmin && <FinancialSummary />}
      <section className="overflow-hidden rounded-2xl border bg-white">
        <div className="flex flex-wrap items-end gap-3 border-b p-4">
          <label className="text-sm">Buscar pedido o cliente de cuenta
            <input value={search} onChange={(e) => setSearch(e.target.value)} className={field} placeholder="Número de pedido o cliente" />
          </label>
          <label className="text-sm">Cobros
            <select value={filter} onChange={(e) => setFilter(e.target.value)} className={field}>
              <option value="TODOS">Todos los pedidos</option><option value="PENDIENTE">Sin pagos</option><option value="PARCIAL">Pago parcial</option><option value="PAGADO">Pagados</option><option value="CUENTAS">Cuentas por cobrar</option><option value="VENCIDAS">Cuentas vencidas</option>
            </select>
          </label>
          <label className="text-sm">Tipo de venta
            <select value={saleType} onChange={(e) => setSaleType(e.target.value)} className={field}><option value="TODOS">Todos</option><option value="CONTADO">Contado</option><option value="CREDITO">Crédito</option></select>
          </label>
        </div>
        {loading ? <p className="p-5">Cargando cobros...</p> : failed ? <p role="alert" className="p-5 text-red-700">{errorMessage(orders.error ?? accounts.error)}</p> : <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50"><tr>{["Pedido", "Cliente de cuenta", "Venta", "Total", "Pagado", "Saldo", "Estado", "Vencimiento", "Acciones"].map((title) => <th key={title} className="p-3">{title}</th>)}</tr></thead>
            <tbody className="divide-y">{visible.map((order) => <tr key={order.idPedido}>
              <td className="p-3"><p className="font-medium">{order.numeroPedido}</p><p className="text-xs text-slate-500">{order.estadoPedido}</p></td>
              <td className="p-3">{accountByOrder.get(order.idPedido)?.pedido.cliente.nombre ?? "—"}</td>
              <td className="p-3">{order.tipoVenta === "CREDITO" ? "Crédito" : "Contado"}</td>
              <td className="p-3 whitespace-nowrap">{money(order.total)}</td><td className="p-3 whitespace-nowrap">{money(order.totalPagado)}</td><td className="p-3 whitespace-nowrap">{money(order.saldoPendiente)}</td>
              <td className="p-3">{paymentLabels[order.estadoPago]}{order.cuentaPorCobrar?.estadoCalculado === "VENCIDA" && <p className="text-red-700">Cuenta vencida</p>}</td>
              <td className="p-3">{order.cuentaPorCobrar ? dateOnly(order.cuentaPorCobrar.fechaVencimiento) : "—"}</td>
              <td className="p-3"><button className={button} onClick={() => setSelectedId(order.idPedido)}>Ver pagos / Cobrar</button></td>
            </tr>)}{visible.length === 0 && <tr><td colSpan={9} className="p-8 text-center text-slate-500">No hay pedidos con estos filtros.</td></tr>}</tbody>
          </table>
        </div>}
      </section>
      {isAdmin && <FinanceExpenses />}
      {selectedId && <PaymentDetail key={selectedId} id={selectedId} onClose={() => setSelectedId(null)} />}
      {createOpen && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
        <section role="dialog" aria-modal="true" aria-labelledby="receivable-title" className="max-h-[90vh] w-full max-w-lg space-y-4 overflow-y-auto rounded-2xl bg-white p-6">
          <h2 id="receivable-title" className="text-xl font-bold">Nueva cuenta por cobrar</h2>
          <form onSubmit={(event) => {
            event.preventDefault();
            if (!create.isPending && !failed && !refreshing && available.some((order) => order.idPedido === orderId) && due >= today()) create.mutate();
          }}>
            <fieldset disabled={create.isPending || failed || refreshing} className="space-y-4">
              <p className="text-sm text-slate-500">Selecciona un pedido a crédito sin cuenta. El importe se toma del total del pedido.</p>
              {available.length === 0 && <p>No hay pedidos a crédito disponibles.</p>}
              <label className="block text-sm">Pedido
                <select required className={field} value={orderId} onChange={(e) => setOrderId(e.target.value)}><option value="">Selecciona un pedido</option>{available.map((order) => <option key={order.idPedido} value={order.idPedido}>{order.numeroPedido} · {money(order.total)}</option>)}</select>
              </label>
              <label className="block text-sm">Fecha de vencimiento
                <input type="date" required min={today()} value={due} onChange={(e) => setDue(e.target.value)} className={field} />
              </label>
              <button className={`${button} bg-slate-950 text-white`} disabled={create.isPending || failed || refreshing || !available.some((order) => order.idPedido === orderId) || !due || due < today()}>{create.isPending ? "Guardando..." : "Crear cuenta"}</button>
            </fieldset>
          </form>
          {failed && <p role="alert" className="text-sm text-red-700">No fue posible actualizar los pedidos. Cierra y usa Actualizar antes de reintentar.</p>}
          <button className={button} disabled={create.isPending} onClick={() => setCreateOpen(false)}>Cancelar</button>
        </section>
      </div>}
    </div>
  );
}
