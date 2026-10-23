"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { BellRing, RefreshCw } from "lucide-react";
import { crmService } from "@/services/crmService";

const weekdays = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
const field = "rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm";
const button = "rounded-lg border px-3 py-2 text-sm disabled:opacity-50";
const date = (value: string) => value.split("-").reverse().join("/");

export function PurchaseAlerts() {
  const [days, setDays] = useState(90);
  const [page, setPage] = useState(1);
  const [day, setDay] = useState("");
  const [draft, setDraft] = useState("");
  const [search, setSearch] = useState("");
  const query = useQuery({
    queryKey: ["crm", "purchase-alerts", days, page, day, search],
    queryFn: () => crmService.getPurchaseAlerts({ dias: days, page, search, ...(day !== "" ? { diaSemana: Number(day) } : {}) }),
    refetchInterval: 60_000,
  });
  const result = query.data;
  return <section className="overflow-hidden rounded-2xl border bg-white" aria-labelledby="purchase-alerts-title">
    <div className="space-y-4 border-b p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="purchase-alerts-title" className="flex items-center gap-2 text-lg font-semibold"><BellRing size={20} className="text-amber-600" />Alertas de compra habitual</h2>
          <p className="mt-1 text-sm text-slate-600">Anticipa el contacto con tus clientes según el día en que compran más unidades de cada producto.</p>
        </div>
        <button type="button" className={`${button} flex items-center gap-2`} disabled={query.isFetching} onClick={() => query.refetch()}><RefreshCw size={15} />{query.isFetching ? "Actualizando..." : "Actualizar"}</button>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <label className="text-sm">Historial <select aria-label="Periodo de compras" value={days} className={field} onChange={e => { setDays(Number(e.target.value)); setPage(1); }}>
          {[30, 90, 180].map(value => <option key={value} value={value}>Últimos {value} días</option>)}
        </select></label>
        <select aria-label="Día habitual" className={field} value={day} onChange={e => { setDay(e.target.value); setPage(1); }}>
          <option value="">Todos los días</option>
          {weekdays.map((label, index) => <option key={index} value={index}>{label}</option>)}
        </select>
        <form className="flex gap-2" onSubmit={e => { e.preventDefault(); setSearch(draft.trim()); setPage(1); }}>
          <input aria-label="Buscar cliente o producto" maxLength={100} className={field} placeholder="Cliente o producto..." value={draft} onChange={e => setDraft(e.target.value)} />
          <button className={button}>Buscar</button>
        </form>
      </div>
      <details className="text-sm text-slate-500">
        <summary className="cursor-pointer">Cómo se detectan las alertas</summary>
        <p className="mt-2">Se usan las fechas de registro de pedidos entregados, en horario de Guatemala. Un patrón requiere al menos 3 fechas de compra, 2 en el día destacado y que ese día concentre al menos el 40% de las unidades, sin empate. Solo se muestran clientes y productos activos con una compra en los últimos 28 días. El promedio considera las fechas en que hubo compra; es una referencia histórica, no una garantía de consumo o de compra futura.</p>
      </details>
      {result && <p className="text-xs text-slate-500">Del {date(result.desde)} al {date(result.hasta)} · {result.alcance === "ENTREGAS_PROPIAS" ? "Solo pedidos entregados por ti" : "Pedidos entregados de todos los clientes"} · {result.total} patrones encontrados.</p>}
    </div>
    {query.isPending ? <p role="status" className="p-5 text-sm">Analizando historial de compras...</p> : query.isError ? <div role="alert" className="space-y-2 p-5 text-sm">
      <p>No se pudieron consultar las alertas de compra.</p><button className={button} onClick={() => query.refetch()}>Reintentar</button>
    </div> : result && <>
      {result.data.length === 0 ? <div className="space-y-2 p-5 text-sm text-slate-600">
        <p>No hay patrones suficientes para estos filtros.</p>
        <p>Se necesitan compras en varias fechas. Puedes ampliar el periodo o cambiar la búsqueda; los pedidos pendientes o cancelados no se incluyen.</p>
      </div> : <div className="overflow-x-auto"><table className="w-full text-left text-sm">
        <thead className="bg-slate-50 text-slate-600"><tr>
          <th className="px-5 py-3">Cliente y producto</th><th className="px-5 py-3">Día de mayor compra</th><th className="px-5 py-3">Historial que lo respalda</th><th className="px-5 py-3">Próxima fecha habitual</th>
        </tr></thead>
        <tbody className="divide-y">{result.data.map(alert => <tr key={`${alert.idCliente}:${alert.idProducto}`}>
          <td className="px-5 py-4"><p className="font-medium">{alert.cliente}</p><p>{alert.producto}</p><p className="text-xs text-slate-500">{alert.telefono}</p></td>
          <td className="px-5 py-4"><p className="font-medium capitalize">{weekdays[alert.diaSemana]}</p><p>{alert.promedioDia.toLocaleString("es-GT")} unidades por fecha de compra</p></td>
          <td className="px-5 py-4"><p>{alert.unidadesDia.toLocaleString("es-GT")} de {alert.totalUnidades.toLocaleString("es-GT")} unidades ({alert.porcentaje}%)</p><p className="text-xs text-slate-500">{alert.fechasDia} de {alert.fechasCompra} fechas de compra · Última: {date(alert.ultimaCompra)}</p></td>
          <td className="px-5 py-4"><span className={`rounded-full px-2 py-1 text-xs font-semibold ${alert.diasHastaCompra <= 1 ? "bg-amber-100 text-amber-900" : "bg-slate-100 text-slate-700"}`}>{alert.diasHastaCompra === 0 ? "Hoy" : alert.diasHastaCompra === 1 ? "Mañana" : `En ${alert.diasHastaCompra} días`}</span><p className="mt-2">{date(alert.proximaFecha)}</p><p className="text-xs text-slate-500">{alert.diasHastaCompra <= 1 ? "Conviene contactar al cliente hoy." : "Planifica el contacto antes de esa fecha."}</p></td>
        </tr>)}</tbody>
      </table></div>}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t px-5 py-3 text-sm">
        <span>Página {page} de {Math.max(1, Math.ceil(result.total / result.pageSize))}</span>
        <div className="flex gap-2"><button className={button} disabled={page <= 1 || query.isFetching} onClick={() => setPage(value => value - 1)}>Anterior</button><button className={button} disabled={page * result.pageSize >= result.total || query.isFetching} onClick={() => setPage(value => value + 1)}>Siguiente</button></div>
      </div>
    </>}
  </section>;
}
