"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { useQuery } from "@tanstack/react-query";
import { auditService, type AuditEvent, type AuditFilters } from "@/services/auditService";
import { guatemalaDay } from "@/lib/reportUtils";

const button = "rounded-lg border px-4 py-2 text-sm disabled:opacity-50";
const field = "mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm";
const initial = { from: "", to: "", action: "", table: "", userId: "", search: "" };
const actionLabels: Record<string, string> = { CREAR: "Crear", ACTUALIZAR: "Actualizar", ACTIVAR: "Activar", DESACTIVAR: "Desactivar", RETIRAR: "Retirar", INICIO_SESION: "Inicio de sesión", VINCULAR_FICHA: "Vincular ficha", INICIAR_RUTA: "Iniciar ruta", COMPLETAR_RUTA: "Completar ruta", MOVER_PARADA: "Mover parada", REGISTRAR_PAGO: "Registrar pago", CAMBIAR_ESTADO: "Cambiar estado" };
const tableLabels: Record<string, string> = { usuarios: "Usuarios", clientes: "Clientes", productos: "Productos", promociones: "Promociones", pedidos: "Pedidos", direcciones_cliente: "Direcciones", rutas: "Rutas", detalle_ruta: "Paradas de ruta", entregas: "Entregas", incidencias: "Incidencias", cuentas_por_cobrar: "Cuentas por cobrar", pagos: "Pagos", categorias_egreso: "Categorías de gastos", movimientos_financieros: "Movimientos financieros", prospectos: "Prospectos", prospecto_producto: "Productos de interés", interacciones_crm: "Interacciones CRM", seguimientos_crm: "Seguimientos CRM" };
const displayTime = (value: string) => new Date(value).toLocaleString("es-GT", { timeZone: "America/Guatemala" });

export default function AuditPage() {
  const { data: session, status } = useSession();
  const isAdmin = session?.user?.role === "ADMIN";
  const [draft, setDraft] = useState(initial);
  const [applied, setApplied] = useState(initial);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [selected, setSelected] = useState<AuditEvent | null>(null);
  const params: AuditFilters = { page, pageSize, ...Object.fromEntries(Object.entries(applied).filter(([, value]) => value !== "")) };
  const events = useQuery({ queryKey: ["audit", "events", params], queryFn: () => auditService.getEvents(params), enabled: isAdmin });
  const options = useQuery({ queryKey: ["audit", "options"], queryFn: auditService.getOptions, enabled: isAdmin });
  const valid = !draft.from || !draft.to || draft.from <= draft.to;
  function apply(next = draft) { setApplied({ ...next, search: next.search.trim() }); setDraft(next); setPage(1); }
  if (status === "loading") return <p>Cargando sesión...</p>;
  if (!isAdmin) return <p>No tienes permisos para consultar la auditoría.</p>;
  return <div className="space-y-6">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h1 className="text-3xl font-bold">Auditoría</h1><p className="mt-1 text-sm text-slate-500">Operaciones exitosas registradas y su usuario responsable.</p></div><button className={button} disabled={events.isFetching || options.isFetching} onClick={() => Promise.all([events.refetch(), options.refetch()])}>{events.isFetching ? "Actualizando..." : "Actualizar"}</button></div>
    <p className="rounded-xl border bg-white p-4 text-sm text-slate-600">El registro comienza con esta actualización. Las operaciones anteriores que no fueron registradas no aparecerán. Las fechas se muestran en horario de Guatemala.</p>
    <section className="space-y-3 rounded-xl border bg-white p-4"><form className="space-y-3" onSubmit={(event) => { event.preventDefault(); if (valid) apply(); }}>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <label className="text-sm">Desde<input className={field} type="date" value={draft.from} max={draft.to || undefined} onChange={(e) => setDraft({ ...draft, from: e.target.value })} /></label><label className="text-sm">Hasta<input className={field} type="date" value={draft.to} min={draft.from || undefined} onChange={(e) => setDraft({ ...draft, to: e.target.value })} /></label>
        <label className="text-sm">Acción<select className={field} value={draft.action} onChange={(e) => setDraft({ ...draft, action: e.target.value })}><option value="">Todas</option>{(options.data?.actions ?? []).map((value) => <option key={value} value={value}>{actionLabels[value] ?? value}</option>)}</select></label>
        <label className="text-sm">Entidad<select className={field} value={draft.table} onChange={(e) => setDraft({ ...draft, table: e.target.value })}><option value="">Todas</option>{(options.data?.tables ?? []).map((value) => <option key={value} value={value}>{tableLabels[value] ?? value}</option>)}</select></label>
        <label className="text-sm">Usuario<select className={field} value={draft.userId} onChange={(e) => setDraft({ ...draft, userId: e.target.value })}><option value="">Todos</option>{(options.data?.users ?? []).map((user) => <option key={user.idUsuario} value={user.idUsuario}>{user.nombre} · {user.correo}</option>)}</select></label>
        <label className="text-sm">Buscar<input className={field} maxLength={100} value={draft.search} onChange={(e) => setDraft({ ...draft, search: e.target.value })} placeholder="Usuario, acción, entidad o identificador" /></label>
      </div>
      {!valid && <p role="alert" className="text-sm text-red-700">La fecha inicial debe ser anterior o igual a la final.</p>}
      <div className="flex flex-wrap gap-2"><button className={`${button} bg-slate-950 text-white`} disabled={!valid}>Aplicar filtros</button><button type="button" className={button} onClick={() => { const day = guatemalaDay(new Date()); apply({ ...draft, from: day, to: day }); }}>Hoy</button><button type="button" className={button} onClick={() => apply(initial)}>Limpiar filtros</button></div>
    </form>
      {options.isError && <p role="alert" className="text-sm text-red-700">No fue posible cargar las opciones de filtros. Usa Actualizar para reintentar.</p>}
      <p className="text-sm text-slate-500">Período aplicado: {applied.from || "desde el primer registro"} — {applied.to || "sin fecha final"}. Los cambios de filtros se aplican al pulsar Aplicar filtros.</p>
    </section>
    {events.isPending ? <p>Cargando auditoría...</p> : events.isError ? <div role="alert"><p>No fue posible cargar los eventos de auditoría.</p><button className={button} onClick={() => events.refetch()}>Reintentar</button></div> : events.data && <section className="overflow-hidden rounded-xl border bg-white">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b p-4"><p className="text-sm">{events.data.total} eventos · Página {events.data.page} de {events.data.pages}</p><label className="text-sm">Filas por página<select className={field} value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}>{[25, 50, 100].map((value) => <option key={value}>{value}</option>)}</select></label></div>
      <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-slate-50"><tr>{["Fecha", "Usuario", "Acción", "Entidad", "Registro", "Detalle"].map((title) => <th key={title} className="p-4">{title}</th>)}</tr></thead><tbody className="divide-y">{events.data.data.map((item) => <tr key={item.idAuditoria}><td className="p-4 whitespace-nowrap">{displayTime(item.fechaHora)}</td><td className="p-4">{item.usuario?.nombre ?? "Usuario sin referencia"}{item.usuario && <p className="text-xs text-slate-500">{item.usuario.correo}</p>}</td><td className="p-4">{actionLabels[item.accion] ?? item.accion}</td><td className="p-4">{tableLabels[item.tablaAfectada] ?? item.tablaAfectada}</td><td className="max-w-64 break-all p-4">{item.registroId ?? "Sin identificador"}</td><td className="p-4"><button className={button} onClick={() => setSelected(item)}>Ver detalle</button></td></tr>)}{events.data.data.length === 0 && <tr><td colSpan={6} className="p-8 text-center text-slate-500">No hay eventos con estos filtros. Las nuevas operaciones registradas aparecerán aquí.</td></tr>}</tbody></table></div>
      <div className="flex justify-end gap-2 border-t p-4"><button className={button} disabled={events.isFetching || page <= 1} onClick={() => setPage((value) => value - 1)}>Anterior</button><button className={button} disabled={events.isFetching || page >= events.data.pages} onClick={() => setPage((value) => value + 1)}>Siguiente</button></div>
    </section>}
    {selected && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"><section role="dialog" aria-modal="true" aria-labelledby="audit-title" className="max-h-[90vh] w-full max-w-3xl space-y-4 overflow-y-auto rounded-xl bg-white p-6"><div className="flex justify-between gap-3"><h2 id="audit-title" className="text-xl font-semibold">Evento {selected.idAuditoria}</h2><button className={button} onClick={() => setSelected(null)}>Cerrar</button></div><p className="text-sm">{displayTime(selected.fechaHora)} · {actionLabels[selected.accion] ?? selected.accion} · {tableLabels[selected.tablaAfectada] ?? selected.tablaAfectada}</p><p className="text-sm">Usuario: {selected.usuario?.nombre ?? "Sin referencia"}</p><p className="break-all text-sm">Registro: {selected.registroId ?? "Sin identificador"}</p><h3 className="font-semibold">Valores anteriores</h3>{selected.datosAnteriores === null ? <p className="text-sm text-slate-500">No se capturaron valores anteriores para este evento.</p> : <pre className="overflow-auto whitespace-pre-wrap break-all rounded-lg bg-slate-50 p-3 text-xs">{JSON.stringify(selected.datosAnteriores, null, 2)}</pre>}<h3 className="font-semibold">Datos registrados</h3><pre className="overflow-auto whitespace-pre-wrap break-all rounded-lg bg-slate-50 p-3 text-xs">{JSON.stringify(selected.datosNuevos, null, 2)}</pre></section></div>}
  </div>;
}
