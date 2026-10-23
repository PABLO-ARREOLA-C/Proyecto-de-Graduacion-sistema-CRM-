"use client";

import { useState } from "react";
import { useClientPortal, PortalNotice, portalButton as button, portalField as field, portalError, money, dayLabel, timeLabel, orderLabels } from "./shared";

export function MyOrders({ history = false }: { history?: boolean }) {
  const portal = useClientPortal();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("TODOS");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  if (portal.status === "loading" || !portal.isClient || portal.profile.isPending || portal.profile.isError || !portal.profile.data) return <PortalNotice portal={portal} />;
  const orders = portal.orders.data ?? [];
  const visible = orders.filter((order) => order.numeroPedido.toLowerCase().includes(search.trim().toLowerCase()) && (filter === "TODOS" || order.estado === filter));
  const selected = orders.find((order) => order.idPedido === selectedId);
  return <div className="space-y-6">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h1 className="text-3xl font-bold">{history ? "Historial" : "Mis pedidos"}</h1><p className="mt-1 text-sm text-slate-500">{history ? "Cambios de estado y pagos de tus pedidos." : "Consulta tus pedidos, productos, entrega y saldo."}</p></div><button className={button} disabled={portal.orders.isFetching} onClick={() => portal.orders.refetch()}>Actualizar</button></div>
    <div className="flex flex-wrap items-end gap-3">
      <label className="text-sm">Buscar pedido<input className={field} placeholder="Número de pedido" value={search} onChange={(e) => setSearch(e.target.value)} /></label>
      <label className="text-sm">Estado<select className={field} value={filter} onChange={(e) => setFilter(e.target.value)}><option value="TODOS">Todos</option>{Object.entries(orderLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
    </div>
    {portal.orders.isPending ? <p>Cargando tus pedidos...</p> : portal.orders.isError ? <div role="alert"><p>{portalError(portal.orders.error)}</p><button className={button} onClick={() => portal.orders.refetch()}>Reintentar</button></div> : visible.length === 0 ? <p className="rounded-xl border bg-white p-5 text-sm text-slate-500">No hay pedidos con estos filtros.</p> : history ? <div className="space-y-4">{visible.map((order) => <section key={order.idPedido} className="space-y-3 rounded-xl border bg-white p-5">
      <div className="flex flex-wrap justify-between gap-2"><h2 className="font-semibold">{order.numeroPedido} · {orderLabels[order.estado]}</h2><button className={button} onClick={() => setSelectedId(order.idPedido)}>Ver pedido</button></div>
      <h3 className="text-sm font-semibold">Estados</h3>
      {order.historialEstados.length === 0 ? <p className="text-sm text-slate-500">Sin cambios de estado registrados.</p> : <ol className="space-y-2 border-l-2 pl-4 text-sm">{order.historialEstados.map((event) => <li key={event.idHistorial}><p>{orderLabels[event.estadoNuevo as keyof typeof orderLabels] ?? event.estadoNuevo}</p><p className="text-xs text-slate-500">{timeLabel(event.fechaHora)}</p></li>)}</ol>}
      <h3 className="text-sm font-semibold">Pagos</h3>
      {order.pagos.length === 0 ? <p className="text-sm text-slate-500">Sin pagos registrados.</p> : <ul className="space-y-1 text-sm">{order.pagos.map((payment) => <li key={payment.idPago}>{money(payment.monto)} · {timeLabel(payment.fechaPago)}</li>)}</ul>}
      <p className="text-sm">Pagado: {money(order.totalPagado)} · Saldo: {money(order.saldoPendiente)}</p>
    </section>)}</div> : <div className="overflow-x-auto rounded-xl border bg-white"><table className="w-full text-left text-sm">
      <thead className="bg-slate-50"><tr>{["Pedido", "Creado", "Entrega solicitada", "Estado", "Total", "Pagado", "Saldo", "Acciones"].map((title) => <th key={title} className="p-4">{title}</th>)}</tr></thead>
      <tbody className="divide-y">{visible.map((order) => <tr key={order.idPedido}><td className="p-4 font-medium">{order.numeroPedido}</td><td className="p-4">{timeLabel(order.fechaPedido)}</td><td className="p-4">{dayLabel(order.fechaEntregaSolicitada)}</td><td className="p-4">{orderLabels[order.estado]}</td><td className="p-4 whitespace-nowrap">{money(order.total)}</td><td className="p-4 whitespace-nowrap">{money(order.totalPagado)}</td><td className="p-4 whitespace-nowrap">{money(order.saldoPendiente)}</td><td className="p-4"><button className={button} onClick={() => setSelectedId(order.idPedido)}>Ver detalle</button></td></tr>)}</tbody>
    </table></div>}
    {selected && !portal.orders.isError && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"><section role="dialog" aria-modal="true" aria-labelledby="own-order-title" className="max-h-[90vh] w-full max-w-2xl space-y-4 overflow-y-auto rounded-xl bg-white p-6">
      <div className="flex items-center justify-between"><h2 id="own-order-title" className="text-xl font-bold">{selected.numeroPedido}</h2><button className={button} onClick={() => setSelectedId(null)}>Cerrar</button></div>
      <p>{orderLabels[selected.estado]} · {selected.tipoVenta === "CREDITO" ? "Crédito" : "Contado"}</p>
      <p className="text-sm">Entrega solicitada: {dayLabel(selected.fechaEntregaSolicitada)}</p><p className="text-sm">Dirección: {selected.direccion.direccion}</p>{selected.direccion.referencia && <p className="text-sm">Referencia: {selected.direccion.referencia}</p>}
      <table className="w-full text-left text-sm"><thead><tr><th className="py-2">Producto</th><th className="py-2">Cantidad</th><th className="py-2">Precio unitario</th><th className="py-2">Subtotal</th></tr></thead><tbody>{selected.detalles.map((detail) => <tr key={detail.idDetalle}><td className="py-2">{detail.producto.nombre}</td><td>{detail.cantidad}</td><td>{money(detail.precioUnitario)}</td><td>{money(Number(detail.precioUnitario) * detail.cantidad)}</td></tr>)}</tbody></table>
      <div className="rounded-lg bg-slate-50 p-4 text-sm"><p>Total: {money(selected.total)}</p><p>Pagado: {money(selected.totalPagado)}</p><p>Saldo pendiente: {money(selected.saldoPendiente)}</p>{selected.cuentaPorCobrar && <p>Vencimiento: {dayLabel(selected.cuentaPorCobrar.fechaVencimiento)}</p>}</div>
      <p className="text-sm text-slate-500">El estado del pedido y los pagos se actualizan cuando el equipo registra las operaciones.</p>
    </section></div>}
  </div>;
}
