"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { financeService } from "@/services/financeService";

type Period = { from: string; to: string };
const button = "rounded-lg border px-4 py-2 text-sm disabled:opacity-50";
const field = "mt-1 block rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm";
const money = (value: number) => new Intl.NumberFormat("es-GT", { style: "currency", currency: "GTQ" }).format(value);
const dayLabel = (day: string) => day.split("-").reverse().join("/");
const today = () => new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Guatemala", year: "numeric", month: "2-digit", day: "2-digit",
}).format(new Date());

export function FinancialSummary() {
  const [draft, setDraft] = useState<Period>({ from: "", to: "" });
  const [period, setPeriod] = useState<Period>({ from: "", to: "" });
  const valid = !draft.from || !draft.to || draft.from <= draft.to;
  const summary = useQuery({
    queryKey: ["finances", "summary", "period", period],
    queryFn: () => financeService.getSummary({ fechaInicio: period.from || undefined, fechaFin: period.to || undefined }),
  });
  function selectPeriod(next: Period) {
    setDraft(next);
    setPeriod(next);
  }
  const periodLabel = !period.from && !period.to ? "Todo el historial" :
    period.from === period.to ? dayLabel(period.from) :
      `${period.from ? `Desde ${dayLabel(period.from)}` : "Desde el primer registro"} · ${period.to ? `hasta ${dayLabel(period.to)}` : "sin fecha final"}`;

  return <section className="space-y-4" aria-labelledby="financial-summary-title">
    <h2 id="financial-summary-title" className="text-xl font-semibold">Resumen financiero</h2>
    <div className="space-y-3 rounded-xl border bg-white p-4">
      <form onSubmit={(event) => { event.preventDefault(); if (valid) setPeriod({ ...draft }); }} className="flex flex-wrap items-end gap-3">
        <label className="text-sm">Desde
          <input type="date" value={draft.from} max={draft.to || undefined} onChange={(event) => setDraft({ ...draft, from: event.target.value })} className={field} />
        </label>
        <label className="text-sm">Hasta
          <input type="date" value={draft.to} min={draft.from || undefined} onChange={(event) => setDraft({ ...draft, to: event.target.value })} className={field} />
        </label>
        <button type="submit" disabled={!valid} className={`${button} bg-slate-950 text-white`}>Aplicar período</button>
      </form>
      {!valid && <p role="alert" className="text-sm text-red-700">La fecha inicial debe ser anterior o igual a la final.</p>}
      <div className="flex flex-wrap gap-2">
        <button type="button" className={button} onClick={() => { const day = today(); selectPeriod({ from: day, to: day }); }}>Hoy</button>
        <button type="button" className={button} onClick={() => { const day = today(); selectPeriod({ from: `${day.slice(0, 7)}-01`, to: day }); }}>Este mes</button>
        <button type="button" className={button} onClick={() => selectPeriod({ from: "", to: "" })}>Todo el historial</button>
      </div>
      <p className="text-sm text-slate-500">El período se aplica a ingresos, egresos y balance, con fechas de Guatemala. Los filtros de movimientos se manejan en su propia sección.</p>
    </div>
    <p className="text-sm font-medium">Período aplicado: {periodLabel}</p>
    {summary.isPending ? <p role="status">Cargando resumen...</p> : summary.isError ? <div role="alert" className="space-y-2">
      <p>No fue posible consultar el resumen de este período.</p><button type="button" className={button} disabled={summary.isFetching} onClick={() => summary.refetch()}>Reintentar</button>
    </div> : summary.data && <>
      {summary.isFetching && <p role="status" className="text-sm text-slate-500">Actualizando resumen...</p>}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {([
          ["Ingresos", summary.data.ingresos, "Del período aplicado"],
          ["Egresos", summary.data.egresos, "Del período aplicado"],
          ["Balance", summary.data.balance, "Ingresos menos egresos del período"],
          ["Cuentas por cobrar", summary.data.cuentasPorCobrar, "Saldo global actual, de todas las fechas"],
        ] as const).map(([title, amount, description]) => <div key={title} className="rounded-xl border bg-white p-5">
          <p className="text-sm text-slate-500">{title}</p><p className="mt-3 text-2xl font-bold">{money(amount)}</p><p className="mt-1 text-xs text-slate-500">{description}</p>
        </div>)}
      </div>
      <p className="text-sm">Cuentas vencidas actuales: {summary.data.cantidadCuentasVencidas} · Saldo vencido global: {money(summary.data.cuentasVencidas)}</p>
    </>}
  </section>;
}
