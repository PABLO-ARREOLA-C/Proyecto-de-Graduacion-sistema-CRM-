"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import { toast } from "sonner";
import { productService } from "@/services/productService";
import { promotionService, type Promotion, type PromotionPayload } from "@/services/promotionService";

const button = "rounded-lg border px-4 py-2 text-sm disabled:opacity-50";
const field = "mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm";
const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Guatemala", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
const dateLabel = (value: string) => value.slice(0, 10).split("-").reverse().join("/");
type PromotionForm = { id?: string; idProducto: string; nombre: string; requerida: string; bonificada: string; inicio: string; fin: string };
function validity(promotion: Promotion, day: string) {
  if (!promotion.estado) return "Inactiva";
  if (promotion.fechaInicio.slice(0, 10) > day) return "Programada";
  if (promotion.fechaFin && promotion.fechaFin.slice(0, 10) < day) return "Vencida";
  return "Vigente";
}
function positiveInteger(value: string) {
  return /^\d+$/.test(value) && Number.isInteger(Number(value)) && Number(value) >= 1 && Number(value) <= 2147483647;
}
function errorMessage(error: unknown) {
  if (isAxiosError<{ message?: string | string[] }>(error)) {
    const message = error.response?.data?.message;
    if (Array.isArray(message)) return message.join(", ");
    if (message) return message;
  }
  return "No fue posible guardar. Actualiza antes de reintentar.";
}

export default function PromotionsPage() {
  const { data: session, status } = useSession();
  const client = useQueryClient();
  const isAdmin = session?.user?.role === "ADMIN";
  const [productId, setProductId] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("Todas");
  const [day, setDay] = useState(today);
  const [form, setForm] = useState<PromotionForm | null>(null);
  useEffect(() => { const timer = window.setInterval(() => setDay(today()), 60_000); return () => window.clearInterval(timer); }, []);
  const products = useQuery({ queryKey: ["products", "catalog"], queryFn: productService.getCatalog, enabled: isAdmin });
  const promotions = useQuery({ queryKey: ["products", "promotions", productId], queryFn: () => promotionService.getByProduct(productId), enabled: isAdmin && Boolean(productId) });
  const selected = (products.data ?? []).find((product) => product.idProducto === productId);
  const refresh = () => client.invalidateQueries({ queryKey: ["products"] });
  const fail = async (error: unknown) => { toast.error(errorMessage(error)); await refresh(); };
  const save = useMutation({
    mutationFn: ({ idProducto, id, payload }: { idProducto: string; id?: string; payload: PromotionPayload }) =>
      id ? promotionService.update(idProducto, id, payload) : promotionService.create(idProducto, payload),
    onSuccess: async (_data, variables) => { await refresh(); setForm(null); toast.success(variables.id ? "Promoción actualizada" : "Promoción creada"); },
    onError: fail,
  });
  const toggle = useMutation({
    mutationFn: (promotion: Promotion) => promotion.estado ? promotionService.deactivate(promotion.idProducto, promotion.idPromocion) : promotionService.update(promotion.idProducto, promotion.idPromocion, { estado: true }),
    onSuccess: async (_data, promotion) => { await refresh(); toast.success(promotion.estado ? "Promoción desactivada" : "Promoción activada"); }, onError: fail,
  });
  const busy = save.isPending || toggle.isPending;
  const valid = Boolean(form && form.nombre.trim().length >= 2 && form.nombre.trim().length <= 120 && positiveInteger(form.requerida) && positiveInteger(form.bonificada) && form.inicio && (!form.fin || form.fin >= form.inicio));
  const visible = (promotions.data ?? []).filter((promotion) => promotion.nombre.toLowerCase().includes(search.trim().toLowerCase()) && (filter === "Todas" || filter === validity(promotion, day)));
  if (status === "loading") return <p>Cargando sesión...</p>;
  if (!isAdmin) return <p>No tienes permisos para administrar promociones.</p>;

  return <div className="space-y-6">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h1 className="text-3xl font-bold">Promociones</h1><p className="mt-1 text-sm text-slate-500">Condiciones, bonificaciones y vigencia por producto.</p></div>
      <div className="flex gap-2"><button className={button} disabled={busy || products.isFetching || promotions.isFetching} onClick={() => refresh()}>Actualizar</button><button className={`${button} bg-slate-950 text-white`} disabled={busy || !selected || products.isError} onClick={() => setForm({ idProducto: productId, nombre: "", requerida: "", bonificada: "", inicio: today(), fin: "" })}>Nueva promoción</button></div>
    </div>
    <p className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">Las bonificaciones de estas promociones todavía no se aplican automáticamente a los pedidos.</p>
    {products.isPending ? <p>Cargando productos...</p> : products.isError ? <div role="alert"><p>{errorMessage(products.error)}</p><button className={button} onClick={() => products.refetch()}>Reintentar</button></div> : products.data?.length === 0 ? <p>No hay productos. Crea un producto para administrar sus promociones.</p> : <label className="block max-w-xl text-sm">Producto<select className={field} value={productId} disabled={busy} onChange={(event) => { setProductId(event.target.value); setSearch(""); setFilter("Todas"); }}><option value="">Selecciona un producto</option>{(products.data ?? []).map((product) => <option key={product.idProducto} value={product.idProducto}>{product.codigo} · {product.nombre}{!product.estado && " (inactivo)"}</option>)}</select></label>}
    {selected && !products.isError && <section className="overflow-hidden rounded-xl border bg-white">
      <div className="flex flex-wrap items-end gap-3 border-b p-4">
        <label className="text-sm">Buscar promoción<input className={field} value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Nombre de la promoción" /></label>
        <label className="text-sm">Vigencia<select className={field} value={filter} onChange={(e) => setFilter(e.target.value)}>{["Todas", "Vigente", "Programada", "Vencida", "Inactiva"].map((value) => <option key={value}>{value}</option>)}</select></label>
        <p className="text-sm text-slate-500">Fecha de referencia: {dateLabel(day)} · Guatemala</p>
      </div>
      {promotions.isPending ? <p className="p-5">Cargando promociones...</p> : promotions.isError ? <div role="alert" className="p-5"><p>{errorMessage(promotions.error)}</p><button className={button} onClick={() => promotions.refetch()}>Reintentar</button></div> : <div className="overflow-x-auto"><table className="w-full text-left text-sm">
        <thead className="bg-slate-50"><tr>{["Promoción", "Cantidad requerida", "Cantidad bonificada", "Inicio", "Fin", "Vigencia", "Acciones"].map((title) => <th key={title} className="p-4">{title}</th>)}</tr></thead>
        <tbody className="divide-y">{visible.map((promotion) => <tr key={promotion.idPromocion}><td className="p-4 font-medium">{promotion.nombre}</td><td className="p-4">{promotion.cantidadRequerida}</td><td className="p-4">{promotion.cantidadBonificada}</td><td className="p-4">{dateLabel(promotion.fechaInicio)}</td><td className="p-4">{promotion.fechaFin ? dateLabel(promotion.fechaFin) : "Sin fecha final"}</td><td className="p-4">{validity(promotion, day)}</td><td className="p-4"><div className="flex flex-wrap gap-2">
          <button className={button} disabled={busy || promotions.isFetching} onClick={() => setForm({ id: promotion.idPromocion, idProducto: promotion.idProducto, nombre: promotion.nombre, requerida: String(promotion.cantidadRequerida), bonificada: String(promotion.cantidadBonificada), inicio: promotion.fechaInicio.slice(0, 10), fin: promotion.fechaFin?.slice(0, 10) ?? "" })}>Editar</button>
          <button className={button} disabled={busy || promotions.isFetching} onClick={() => { if (window.confirm(`¿${promotion.estado ? "Desactivar" : "Activar"} la promoción ${promotion.nombre}?`)) toggle.mutate(promotion); }}>{toggle.isPending && toggle.variables?.idPromocion === promotion.idPromocion ? "Guardando..." : promotion.estado ? "Desactivar" : "Activar"}</button>
        </div></td></tr>)}{visible.length === 0 && <tr><td colSpan={7} className="p-8 text-center text-slate-500">No hay promociones con estos filtros.</td></tr>}</tbody>
      </table></div>}
    </section>}
    {form && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"><section role="dialog" aria-modal="true" aria-labelledby="promotion-title" className="max-h-[90vh] w-full max-w-lg space-y-4 overflow-y-auto rounded-xl bg-white p-6">
      <h2 id="promotion-title" className="text-xl font-semibold">{form.id ? "Editar promoción" : "Nueva promoción"}</h2><p className="text-sm">Producto: {selected?.nombre}</p>
      <form onSubmit={(event) => {
        event.preventDefault(); if (busy || !valid) return;
        save.mutate({ idProducto: form.idProducto, id: form.id, payload: { nombre: form.nombre.trim(), cantidadRequerida: Number(form.requerida), cantidadBonificada: Number(form.bonificada), fechaInicio: form.inicio, ...(form.fin ? { fechaFin: form.fin } : form.id ? { fechaFin: null } : {}) } });
      }}><fieldset disabled={busy} className="space-y-3">
        <label className="block text-sm">Nombre<input required minLength={2} maxLength={120} value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} className={field} /></label>
        <label className="block text-sm">Cantidad requerida<input type="number" required min={1} max={2147483647} step={1} value={form.requerida} onChange={(e) => setForm({ ...form, requerida: e.target.value })} className={field} /></label>
        <label className="block text-sm">Cantidad bonificada<input type="number" required min={1} max={2147483647} step={1} value={form.bonificada} onChange={(e) => setForm({ ...form, bonificada: e.target.value })} className={field} /></label>
        <label className="block text-sm">Fecha inicial<input type="date" required max={form.fin || undefined} value={form.inicio} onChange={(e) => setForm({ ...form, inicio: e.target.value })} className={field} /></label>
        <label className="block text-sm">Fecha final (opcional)<input type="date" min={form.inicio || undefined} value={form.fin} onChange={(e) => setForm({ ...form, fin: e.target.value })} className={field} /></label>
        <p className="text-sm text-slate-500">Deja la fecha final vacía si no tiene vencimiento. La fecha final es inclusiva.</p>
        {form.fin && form.fin < form.inicio && <p role="alert" className="text-sm text-red-700">La fecha final debe ser posterior o igual a la inicial.</p>}
        <button className={`${button} bg-slate-950 text-white`} disabled={busy || !valid}>{save.isPending ? "Guardando..." : "Guardar promoción"}</button>
      </fieldset></form><button className={button} disabled={busy} onClick={() => setForm(null)}>Cancelar</button>
    </section></div>}
  </div>;
}
