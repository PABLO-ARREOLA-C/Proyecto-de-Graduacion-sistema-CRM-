"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { orderService, type OrderStatus } from "@/services/orderService";
import { routeService, type RouteStatus } from "@/services/routeService";
import { financeService } from "@/services/financeService";
import { csvContent, guatemalaDay, inReportPeriod, sumMoney, type ReportPeriod } from "@/lib/reportUtils";

type ReportKind = "orders" | "movements" | "routes" | "receivables";
type ReportRow = Array<string | number>;
const button = "rounded-lg border px-4 py-2 text-sm disabled:opacity-50";
const field = "mt-1 block rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm";
const money = (value: number | string) => new Intl.NumberFormat("es-GT", { style: "currency", currency: "GTQ" }).format(Number(value));
const dayLabel = (value: string) => value.slice(0, 10).split("-").reverse().join("/");
const timeLabel = (value: string) => new Date(value).toLocaleString("es-GT", { timeZone: "America/Guatemala" });
const orderLabels: Record<OrderStatus, string> = { PENDIENTE: "Pendiente", CONFIRMADO: "Confirmado", EN_RUTA: "En ruta", ENTREGADO: "Entregado", CANCELADO: "Cancelado" };
const routeLabels: Record<RouteStatus, string> = { PLANIFICADA: "Planificada", EN_CURSO: "En curso", COMPLETADA: "Completada", CANCELADA: "Cancelada" };
const titles: Record<ReportKind, string> = { orders: "Pedidos", movements: "Movimientos financieros", routes: "Rutas", receivables: "Cuentas por cobrar" };
const dateBasis: Record<ReportKind, string> = {
  orders: "Fecha de creación del pedido. Los estados son los actuales; el importe de pedidos no representa cobros recibidos.",
  movements: "Fecha del movimiento registrado. Ingresos y egresos corresponden a cobros y gastos registrados en el período.",
  routes: "Fecha programada de la ruta. El estado y el progreso corresponden a la situación actual.",
  receivables: "Fecha de vencimiento de la cuenta. Los pagos y saldos son los actuales; no representan un cierre histórico al final del período.",
};

export default function ReportsPage() {
  const { data: session, status } = useSession();
  const client = useQueryClient();
  const isAdmin = session?.user?.role === "ADMIN";
  const [kind, setKind] = useState<ReportKind>("orders");
  const [draft, setDraft] = useState<ReportPeriod>(() => { const day = guatemalaDay(new Date()); return { from: `${day.slice(0, 7)}-01`, to: day }; });
  const [period, setPeriod] = useState(draft);
  const [search, setSearch] = useState("");
  const [stateFilter, setStateFilter] = useState("TODOS");
  const [saleType, setSaleType] = useState("TODOS");
  const orders = useQuery({ queryKey: ["orders"], queryFn: orderService.getAll, enabled: isAdmin });
  const movements = useQuery({ queryKey: ["finances", "movements"], queryFn: financeService.getMovements, enabled: isAdmin });
  const routes = useQuery({ queryKey: ["logistics", "routes"], queryFn: routeService.getAll, enabled: isAdmin });
  const accounts = useQuery({ queryKey: ["finances", "receivables"], queryFn: financeService.getReceivables, enabled: isAdmin });
  const term = search.trim().toLowerCase();
  const filteredOrders = (orders.data ?? []).filter((order) => inReportPeriod(order.fechaPedido, period) &&
    (stateFilter === "TODOS" || order.estado === stateFilter) && (saleType === "TODOS" || order.tipoVenta === saleType) &&
    `${order.numeroPedido} ${order.cliente.nombre}`.toLowerCase().includes(term));
  const filteredMovements = (movements.data ?? []).filter((item) => inReportPeriod(item.fechaMovimiento, period) &&
    (stateFilter === "TODOS" || item.tipo === stateFilter) && `${item.concepto} ${item.categoria?.nombre ?? ""} ${item.usuario.nombre}`.toLowerCase().includes(term));
  const filteredRoutes = (routes.data ?? []).filter((route) => inReportPeriod(route.fecha, period, true) &&
    (stateFilter === "TODOS" || route.estado === stateFilter) && `${route.codigoRuta} ${route.nombre} ${route.repartidor.nombre}`.toLowerCase().includes(term));
  const filteredAccounts = (accounts.data ?? []).filter((account) => inReportPeriod(account.fechaVencimiento, period, true) &&
    (stateFilter === "TODOS" || account.estadoCalculado === stateFilter) && `${account.pedido.numeroPedido} ${account.pedido.cliente.nombre}`.toLowerCase().includes(term));
  const query = { orders, movements, routes, receivables: accounts }[kind];
  const validDates = !draft.from || !draft.to || draft.from <= draft.to;
  const options = kind === "orders" ? Object.entries(orderLabels) : kind === "routes" ? Object.entries(routeLabels) : kind === "movements" ? [["INGRESO", "Ingresos"], ["EGRESO", "Egresos"]] : [["PENDIENTE", "Pendientes"], ["VENCIDA", "Vencidas"], ["PAGADA", "Pagadas"]];
  let headers: string[];
  let rows: ReportRow[];
  let amounts: number[];
  let metrics: Array<[string, string]>;
  if (kind === "orders") {
    headers = ["Pedido", "Cliente", "Creado (Guatemala)", "Entrega solicitada", "Venta", "Estado actual", "Total (Q)"];
    rows = filteredOrders.map((order) => [order.numeroPedido, order.cliente.nombre, timeLabel(order.fechaPedido), dayLabel(order.fechaEntregaSolicitada), order.tipoVenta === "CREDITO" ? "Crédito" : "Contado", orderLabels[order.estado], Number(order.total)]);
    amounts = [6];
    metrics = [["Pedidos", String(rows.length)], ["Importe no cancelado", money(sumMoney(filteredOrders.filter((order) => order.estado !== "CANCELADO").map((order) => order.total)))], ["Entregados actualmente", String(filteredOrders.filter((order) => order.estado === "ENTREGADO").length)], ["Cancelados", String(filteredOrders.filter((order) => order.estado === "CANCELADO").length)]];
  } else if (kind === "movements") {
    headers = ["Fecha (Guatemala)", "Tipo", "Concepto", "Categoría", "Registrado por", "Monto (Q)"];
    rows = filteredMovements.map((item) => [timeLabel(item.fechaMovimiento), item.tipo === "INGRESO" ? "Ingreso" : "Egreso", item.concepto, item.categoria?.nombre ?? "Sin categoría", item.usuario.nombre, Number(item.monto)]);
    amounts = [5];
    const income = sumMoney(filteredMovements.filter((item) => item.tipo === "INGRESO").map((item) => item.monto));
    const expenses = sumMoney(filteredMovements.filter((item) => item.tipo === "EGRESO").map((item) => item.monto));
    metrics = [["Movimientos", String(rows.length)], ["Ingresos filtrados", money(income)], ["Egresos filtrados", money(expenses)], ["Balance filtrado", money(sumMoney([income, -expenses]))]];
  } else if (kind === "routes") {
    headers = ["Código", "Ruta", "Fecha programada", "Repartidor", "Estado actual", "Paradas", "Completadas", "Progreso (%)"];
    rows = filteredRoutes.map((route) => {
      const done = route.detalles.filter((stop) => stop.estado === "COMPLETADO").length;
      return [route.codigoRuta, route.nombre, dayLabel(route.fecha), route.repartidor.nombre, routeLabels[route.estado], route.detalles.length, done, route.detalles.length ? Math.round(done / route.detalles.length * 100) : 0];
    });
    amounts = [];
    metrics = [["Rutas", String(rows.length)], ["En curso", String(filteredRoutes.filter((route) => route.estado === "EN_CURSO").length)], ["Completadas", String(filteredRoutes.filter((route) => route.estado === "COMPLETADA").length)], ["Paradas completadas", String(filteredRoutes.reduce((sum, route) => sum + route.detalles.filter((stop) => stop.estado === "COMPLETADO").length, 0))]];
  } else {
    headers = ["Pedido", "Cliente", "Estado del pedido", "Vencimiento", "Estado actual de cuenta", "Original (Q)", "Pagado actual (Q)", "Saldo actual (Q)"];
    rows = filteredAccounts.map((account) => [account.pedido.numeroPedido, account.pedido.cliente.nombre, orderLabels[account.pedido.estado], dayLabel(account.fechaVencimiento), account.estadoCalculado === "PAGADA" ? "Pagada" : account.estadoCalculado === "VENCIDA" ? "Vencida" : "Pendiente", account.montoOriginal, account.totalPagado, account.saldoPendiente]);
    amounts = [5, 6, 7];
    metrics = [["Cuentas", String(rows.length)], ["Saldo actual filtrado", money(sumMoney(filteredAccounts.map((account) => account.saldoPendiente)))], ["Saldo vencido actual", money(sumMoney(filteredAccounts.filter((account) => account.estadoCalculado === "VENCIDA").map((account) => account.saldoPendiente)))], ["Cuentas pagadas", String(filteredAccounts.filter((account) => account.estadoCalculado === "PAGADA").length)]];
  }
  function selectPeriod(next: ReportPeriod) { setDraft(next); setPeriod(next); }
  function exportCsv() {
    if (query.isPending || query.isError || query.isFetching || rows.length === 0) return;
    const blob = new Blob([csvContent(headers, rows)], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url; anchor.download = `sicap-${kind}-${period.from || "inicio"}-${period.to || "actual"}.csv`;
    document.body.appendChild(anchor); anchor.click(); anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  if (status === "loading") return <p>Cargando sesión...</p>;
  if (!isAdmin) return <p>No tienes permisos para consultar reportes.</p>;
  return <div className="space-y-6">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h1 className="text-3xl font-bold">Reportes</h1><p className="mt-1 text-sm text-slate-500">Consulta y exporta datos reales de la operación.</p></div><div className="flex gap-2">
      <button className={button} disabled={query.isFetching} onClick={() => Promise.all([client.invalidateQueries({ queryKey: ["orders"] }), client.invalidateQueries({ queryKey: ["logistics"] }), client.invalidateQueries({ queryKey: ["finances"] })])}>{query.isFetching ? "Actualizando..." : "Actualizar"}</button>
      <button className={`${button} bg-slate-950 text-white`} disabled={query.isPending || query.isError || query.isFetching || rows.length === 0} onClick={exportCsv}>Exportar CSV</button>
    </div></div>
    <div className="flex flex-wrap gap-2" aria-label="Tipos de reporte">{(Object.entries(titles) as Array<[ReportKind, string]>).map(([value, label]) => <button key={value} className={`${button} ${value === kind ? "bg-slate-100 font-semibold" : ""}`} aria-pressed={value === kind} onClick={() => { setKind(value); setSearch(""); setStateFilter("TODOS"); setSaleType("TODOS"); }}>{label}</button>)}</div>
    <section className="space-y-3 rounded-xl border bg-white p-4">
      <form className="flex flex-wrap items-end gap-3" onSubmit={(event) => { event.preventDefault(); if (validDates) setPeriod({ ...draft }); }}>
        <label className="text-sm">Desde<input className={field} type="date" value={draft.from} max={draft.to || undefined} onChange={(e) => setDraft({ ...draft, from: e.target.value })} /></label><label className="text-sm">Hasta<input className={field} type="date" value={draft.to} min={draft.from || undefined} onChange={(e) => setDraft({ ...draft, to: e.target.value })} /></label><button className={button} disabled={!validDates}>Aplicar período</button>
      </form>
      {!validDates && <p role="alert" className="text-sm text-red-700">La fecha inicial debe ser anterior o igual a la final.</p>}
      <div className="flex flex-wrap gap-2"><button className={button} onClick={() => { const day = guatemalaDay(new Date()); selectPeriod({ from: day, to: day }); }}>Hoy</button><button className={button} onClick={() => { const day = guatemalaDay(new Date()); selectPeriod({ from: `${day.slice(0, 7)}-01`, to: day }); }}>Este mes</button><button className={button} onClick={() => selectPeriod({ from: "", to: "" })}>Todo el historial</button></div>
      <p className="text-sm font-medium">Período aplicado: {period.from ? dayLabel(period.from) : "Desde el primer registro"} — {period.to ? dayLabel(period.to) : "sin fecha final"}</p><p className="text-sm text-slate-500">{dateBasis[kind]}</p>
      <div className="flex flex-wrap items-end gap-3"><label className="text-sm">Buscar<input className={field} value={search} onChange={(e) => setSearch(e.target.value)} placeholder={kind === "orders" || kind === "receivables" ? "Pedido o cliente" : kind === "routes" ? "Ruta o repartidor" : "Concepto, categoría o usuario"} /></label><label className="text-sm">{kind === "movements" ? "Tipo" : "Estado"}<select className={field} value={stateFilter} onChange={(e) => setStateFilter(e.target.value)}><option value="TODOS">Todos</option>{options.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>{kind === "orders" && <label className="text-sm">Venta<select className={field} value={saleType} onChange={(e) => setSaleType(e.target.value)}><option value="TODOS">Todas</option><option value="CONTADO">Contado</option><option value="CREDITO">Crédito</option></select></label>}</div>
    </section>
    {query.isPending ? <p>Cargando reporte...</p> : query.isError ? <div role="alert"><p>No fue posible consultar los datos de este reporte.</p><button className={button} onClick={() => query.refetch()}>Reintentar</button></div> : <>
      {query.isFetching && <p role="status" className="text-sm text-slate-500">Actualizando los datos...</p>}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{metrics.map(([label, value]) => <section key={label} className="rounded-xl border bg-white p-5"><p className="text-sm text-slate-500">{label}</p><p className="mt-2 text-2xl font-bold">{value}</p></section>)}</div>
      <section className="overflow-hidden rounded-xl border bg-white"><div className="border-b p-4"><h2 className="font-semibold">{titles[kind]}</h2><p className="text-sm text-slate-500">{rows.length} registros · La exportación incluye únicamente estos resultados filtrados.</p></div><div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-slate-50"><tr>{headers.map((header) => <th key={header} className="p-4">{header}</th>)}</tr></thead><tbody className="divide-y">{rows.map((row, index) => <tr key={index}>{row.map((value, column) => <td key={column} className="p-4">{amounts.includes(column) ? money(value) : value}</td>)}</tr>)}{rows.length === 0 && <tr><td colSpan={headers.length} className="p-8 text-center text-slate-500">No hay datos con estos filtros.</td></tr>}</tbody></table></div></section>
    </>}
  </div>;
}
