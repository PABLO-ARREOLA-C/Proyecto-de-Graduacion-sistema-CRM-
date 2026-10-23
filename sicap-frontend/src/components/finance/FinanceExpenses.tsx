"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import { toast } from "sonner";
import { financeService, type ExpenseCategory, type ExpensePayload } from "@/services/financeService";

const button = "rounded-lg border px-4 py-2 text-sm disabled:opacity-50";
const field = "mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm";
const money = (value: number | string) => new Intl.NumberFormat("es-GT", { style: "currency", currency: "GTQ" }).format(Number(value));
const calendarDay = (value: string) => new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Guatemala", year: "numeric", month: "2-digit", day: "2-digit",
}).format(new Date(value));

function errorMessage(error: unknown) {
  if (isAxiosError<{ message?: string | string[] }>(error)) {
    const message = error.response?.data?.message;
    if (Array.isArray(message)) return message.join(", ");
    if (message) return message;
  }
  return "No fue posible completar la operación. Actualiza antes de reintentar.";
}

export function FinanceExpenses() {
  const client = useQueryClient();
  const [view, setView] = useState<"movements" | "categories">("movements");
  const [search, setSearch] = useState("");
  const [kind, setKind] = useState("TODOS");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [categoryForm, setCategoryForm] = useState<{ id?: number; nombre: string; descripcion: string } | null>(null);
  const [expenseOpen, setExpenseOpen] = useState(false);
  const [expenseForm, setExpenseForm] = useState({ idCategoria: "", monto: "", concepto: "", descripcion: "" });
  const categories = useQuery({ queryKey: ["finances", "categories"], queryFn: financeService.getExpenseCategories });
  const movements = useQuery({ queryKey: ["finances", "movements"], queryFn: financeService.getMovements });
  const refresh = () => client.invalidateQueries({ queryKey: ["finances"] });
  const fail = async (error: unknown) => { toast.error(errorMessage(error)); await refresh(); };
  const saveCategory = useMutation({
    mutationFn: ({ id, nombre, descripcion }: { id?: number; nombre: string; descripcion: string }) =>
      id === undefined ? financeService.createExpenseCategory({ nombre, descripcion }) : financeService.updateExpenseCategory(id, { nombre, descripcion }),
    onSuccess: async () => { await refresh(); setCategoryForm(null); toast.success("Categoría guardada"); },
    onError: fail,
  });
  const toggleCategory = useMutation({
    mutationFn: (category: ExpenseCategory) => financeService.updateExpenseCategory(category.idCategoria, { estado: !category.estado }),
    onSuccess: async (_data, category) => { await refresh(); toast.success(category.estado ? "Categoría desactivada" : "Categoría activada"); },
    onError: fail,
  });
  const saveExpense = useMutation({
    mutationFn: (payload: ExpensePayload) => financeService.createExpense(payload),
    onSuccess: async () => { await refresh(); setExpenseOpen(false); setExpenseForm({ idCategoria: "", monto: "", concepto: "", descripcion: "" }); toast.success("Egreso registrado"); },
    onError: fail,
  });
  const busy = saveCategory.isPending || toggleCategory.isPending || saveExpense.isPending;
  const activeCategories = (categories.data ?? []).filter((category) => category.estado);
  const amountCents = /^\d+(\.\d{1,2})?$/.test(expenseForm.monto) ? Math.round(Number(expenseForm.monto) * 100) : 0;
  const validExpense = activeCategories.some((category) => String(category.idCategoria) === expenseForm.idCategoria) &&
    Number.isSafeInteger(amountCents) && amountCents > 0 && amountCents <= 999999999999 && expenseForm.concepto.trim().length >= 2;
  const validDates = !from || !to || from <= to;
  const visibleMovements = (movements.data ?? []).filter((item) => {
    const term = search.trim().toLowerCase();
    const day = calendarDay(item.fechaMovimiento);
    return (kind === "TODOS" || item.tipo === kind) &&
      (!categoryFilter || String(item.categoria?.idCategoria) === categoryFilter) &&
      (!from || day >= from) && (!to || day <= to) &&
      `${item.concepto} ${item.descripcion ?? ""} ${item.categoria?.nombre ?? ""} ${item.usuario.nombre}`.toLowerCase().includes(term);
  });

  return <section className="space-y-4 rounded-2xl border bg-white p-5">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h2 className="text-xl font-semibold">Gastos y movimientos</h2><p className="text-sm text-slate-500">Administración de categorías y registro de egresos.</p></div>
      <div className="flex flex-wrap gap-2">
        <button type="button" className={button} disabled={busy} onClick={() => setCategoryForm({ nombre: "", descripcion: "" })}>Nueva categoría</button>
        <button type="button" className={`${button} bg-slate-950 text-white`} disabled={busy || categories.isPending || categories.isError} onClick={() => {
          setExpenseForm({ idCategoria: "", monto: "", concepto: "", descripcion: "" }); setExpenseOpen(true);
        }}>Registrar egreso</button>
      </div>
    </div>
    <div className="flex gap-2" aria-label="Secciones de gastos">
      <button type="button" aria-pressed={view === "movements"} className={`${button} ${view === "movements" ? "bg-slate-100 font-semibold" : ""}`} onClick={() => setView("movements")}>Movimientos</button>
      <button type="button" aria-pressed={view === "categories"} className={`${button} ${view === "categories" ? "bg-slate-100 font-semibold" : ""}`} onClick={() => setView("categories")}>Categorías</button>
    </div>
    {view === "categories" ? <>
      <p className="text-sm text-slate-500">Las categorías desactivadas conservan sus movimientos y no admiten nuevos egresos.</p>
      {categories.isPending ? <p>Cargando categorías...</p> : categories.isError ? <div role="alert"><p>{errorMessage(categories.error)}</p><button className={button} onClick={() => categories.refetch()}>Reintentar</button></div> : <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50"><tr>{["Categoría", "Descripción", "Estado", "Acciones"].map((title) => <th key={title} className="p-3">{title}</th>)}</tr></thead>
          <tbody className="divide-y">{(categories.data ?? []).map((category) => <tr key={category.idCategoria}>
            <td className="p-3 font-medium">{category.nombre}</td><td className="p-3 whitespace-pre-wrap">{category.descripcion || "—"}</td><td className="p-3">{category.estado ? "Activa" : "Inactiva"}</td>
            <td className="p-3"><div className="flex flex-wrap gap-2">
              <button className={button} disabled={busy} onClick={() => setCategoryForm({ id: category.idCategoria, nombre: category.nombre, descripcion: category.descripcion ?? "" })}>Editar</button>
              <button className={button} disabled={busy} onClick={() => {
                if (window.confirm(`¿${category.estado ? "Desactivar" : "Activar"} la categoría ${category.nombre}?`)) toggleCategory.mutate(category);
              }}>{category.estado ? "Desactivar" : "Activar"}</button>
            </div></td>
          </tr>)}{categories.data?.length === 0 && <tr><td colSpan={4} className="p-5 text-center text-slate-500">No hay categorías registradas. Crea una para registrar gastos.</td></tr>}</tbody>
        </table>
      </div>}
    </> : <>
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-sm">Buscar<input className={field} value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Concepto, categoría o usuario" /></label>
        <label className="text-sm">Tipo<select className={field} value={kind} onChange={(e) => setKind(e.target.value)}><option value="TODOS">Todos</option><option value="INGRESO">Ingresos</option><option value="EGRESO">Egresos</option></select></label>
        <label className="text-sm">Categoría<select className={field} value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}><option value="">Todas</option>{(categories.data ?? []).map((category) => <option key={category.idCategoria} value={category.idCategoria}>{category.nombre}{!category.estado && " (inactiva)"}</option>)}</select></label>
        <label className="text-sm">Desde<input type="date" className={field} value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} /></label>
        <label className="text-sm">Hasta<input type="date" className={field} value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} /></label>
        <button className={button} onClick={() => { setSearch(""); setKind("TODOS"); setCategoryFilter(""); setFrom(""); setTo(""); }}>Limpiar filtros</button>
      </div>
      {categories.isError && <div role="alert" className="text-sm"><p>No se pudieron cargar los filtros de categorías.</p><button className={button} onClick={() => categories.refetch()}>Reintentar categorías</button></div>}
      {!validDates ? <p role="alert" className="text-sm text-red-700">La fecha inicial debe ser anterior o igual a la final.</p> : movements.isPending ? <p>Cargando movimientos...</p> : movements.isError ? <div role="alert"><p>{errorMessage(movements.error)}</p><button className={button} onClick={() => movements.refetch()}>Reintentar</button></div> : <>
        <p className="text-sm text-slate-500">{visibleMovements.length} movimientos con los filtros seleccionados. Las fechas corresponden a Guatemala.</p>
        <div className="overflow-x-auto"><table className="w-full text-left text-sm">
          <thead className="bg-slate-50"><tr>{["Fecha", "Tipo", "Concepto", "Categoría", "Monto", "Registrado por"].map((title) => <th key={title} className="p-3">{title}</th>)}</tr></thead>
          <tbody className="divide-y">{visibleMovements.map((item) => <tr key={item.idMovimiento}>
            <td className="p-3 whitespace-nowrap">{new Date(item.fechaMovimiento).toLocaleString("es-GT", { timeZone: "America/Guatemala" })}</td>
            <td className={`p-3 ${item.tipo === "INGRESO" ? "text-green-700" : "text-red-700"}`}>{item.tipo === "INGRESO" ? "Ingreso" : "Egreso"}</td>
            <td className="p-3"><p className="font-medium">{item.concepto}</p>{item.descripcion && <p className="whitespace-pre-wrap text-slate-500">{item.descripcion}</p>}</td>
            <td className="p-3">{item.categoria?.nombre ?? "Sin categoría"}</td><td className="p-3 whitespace-nowrap">{money(item.monto)}</td><td className="p-3">{item.usuario.nombre}</td>
          </tr>)}{visibleMovements.length === 0 && <tr><td colSpan={6} className="p-5 text-center text-slate-500">No hay movimientos con estos filtros.</td></tr>}</tbody>
        </table></div>
      </>}
    </>}
    {categoryForm && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <section role="dialog" aria-modal="true" aria-labelledby="category-title" className="max-h-[90vh] w-full max-w-lg space-y-4 overflow-y-auto rounded-2xl bg-white p-6">
        <h3 id="category-title" className="text-xl font-bold">{categoryForm.id === undefined ? "Nueva categoría" : "Editar categoría"}</h3>
        <form onSubmit={(e) => {
          e.preventDefault();
          if (!busy && categoryForm.nombre.trim().length >= 2) saveCategory.mutate({ ...categoryForm, nombre: categoryForm.nombre.trim(), descripcion: categoryForm.descripcion.trim() });
        }}>
          <fieldset disabled={busy} className="space-y-3">
            <label className="block text-sm">Nombre<input required minLength={2} maxLength={80} value={categoryForm.nombre} onChange={(e) => setCategoryForm({ ...categoryForm, nombre: e.target.value })} className={field} /></label>
            <label className="block text-sm">Descripción<textarea maxLength={200} value={categoryForm.descripcion} onChange={(e) => setCategoryForm({ ...categoryForm, descripcion: e.target.value })} className={field} /></label>
            <button className={`${button} bg-slate-950 text-white`} disabled={busy || categoryForm.nombre.trim().length < 2}>{saveCategory.isPending ? "Guardando..." : "Guardar categoría"}</button>
          </fieldset>
        </form>
        <button className={button} disabled={busy} onClick={() => setCategoryForm(null)}>Cancelar</button>
      </section>
    </div>}
    {expenseOpen && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <section role="dialog" aria-modal="true" aria-labelledby="expense-title" className="max-h-[90vh] w-full max-w-lg space-y-4 overflow-y-auto rounded-2xl bg-white p-6">
        <h3 id="expense-title" className="text-xl font-bold">Registrar egreso</h3>
        <p className="text-sm text-slate-500">El egreso se registra con la fecha y el usuario actuales.</p>
        {categories.isError && <p role="alert" className="text-sm text-red-700">No fue posible actualizar las categorías. Cierra el formulario y usa Actualizar.</p>}
        {!categories.isError && activeCategories.length === 0 && <p className="text-sm">Crea o activa una categoría para registrar egresos.</p>}
        <form onSubmit={(e) => {
          e.preventDefault();
          if (!busy && !categories.isError && !categories.isFetching && validExpense && window.confirm(`¿Registrar un egreso de ${money(amountCents / 100)} por ${expenseForm.concepto.trim()}?`)) saveExpense.mutate({
            idCategoria: Number(expenseForm.idCategoria), monto: amountCents / 100,
            concepto: expenseForm.concepto.trim(), descripcion: expenseForm.descripcion.trim(),
          });
        }}>
          <fieldset disabled={busy || categories.isError || categories.isFetching} className="space-y-3">
            <label className="block text-sm">Categoría<select required value={expenseForm.idCategoria} onChange={(e) => setExpenseForm({ ...expenseForm, idCategoria: e.target.value })} className={field}><option value="">Selecciona una categoría activa</option>{activeCategories.map((category) => <option key={category.idCategoria} value={category.idCategoria}>{category.nombre}</option>)}</select></label>
            <label className="block text-sm">Monto (Q)<input type="number" inputMode="decimal" required min="0.01" max="9999999999.99" step="0.01" value={expenseForm.monto} onChange={(e) => setExpenseForm({ ...expenseForm, monto: e.target.value })} className={field} /></label>
            <label className="block text-sm">Concepto<input required minLength={2} maxLength={150} value={expenseForm.concepto} onChange={(e) => setExpenseForm({ ...expenseForm, concepto: e.target.value })} className={field} /></label>
            <label className="block text-sm">Descripción<textarea maxLength={1000} value={expenseForm.descripcion} onChange={(e) => setExpenseForm({ ...expenseForm, descripcion: e.target.value })} className={field} /></label>
            <button className={`${button} bg-slate-950 text-white`} disabled={busy || categories.isError || categories.isFetching || !validExpense}>{saveExpense.isPending ? "Guardando..." : "Registrar egreso"}</button>
          </fieldset>
        </form>
        <button className={button} disabled={busy} onClick={() => setExpenseOpen(false)}>Cancelar</button>
      </section>
    </div>}
  </section>;
}
