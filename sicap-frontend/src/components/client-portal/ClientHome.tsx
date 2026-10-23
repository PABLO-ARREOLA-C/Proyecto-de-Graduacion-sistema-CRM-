"use client";

import Link from "next/link";
import { useClientPortal, PortalNotice, portalButton as button, portalError, money, orderLabels } from "./shared";

export function ClientHome() {
  const portal = useClientPortal();
  const ready = portal.isClient && !portal.profile.isPending && !portal.profile.isError && Boolean(portal.profile.data);
  const orders = portal.orders.data ?? [];
  const latest = orders[0];
  return <div className="space-y-5">
    <nav className="flex flex-wrap gap-2" aria-label="Portal del cliente"><Link href="/my-profile" className={button}>Mi información</Link><Link href="/my-orders" className={button}>Mis pedidos</Link><Link href="/history" className={button}>Historial</Link></nav>
    <PortalNotice portal={portal} />
    {ready && <>
      <p className="font-medium">{portal.profile.data?.nombre}</p>
      {portal.orders.isPending ? <p>Cargando tus pedidos...</p> : portal.orders.isError ? <div role="alert"><p>{portalError(portal.orders.error)}</p><button className={button} onClick={() => portal.orders.refetch()}>Reintentar</button></div> : <div className="grid gap-4 sm:grid-cols-3">
        {[["Pedidos registrados", String(orders.length)], ["Último pedido", latest ? orderLabels[latest.estado] : "Sin pedidos"], ["Saldo de pedidos no cancelados", money(orders.filter((order) => order.estado !== "CANCELADO").reduce((sum, order) => sum + order.saldoPendiente, 0))]].map(([label, value]) => <section key={label} className="rounded-xl border bg-white p-5"><p className="text-sm text-slate-500">{label}</p><p className="mt-2 text-2xl font-bold">{value}</p>{label === "Último pedido" && latest && <p className="text-sm">{latest.numeroPedido}</p>}</section>)}
      </div>}
    </>}
  </div>;
}
