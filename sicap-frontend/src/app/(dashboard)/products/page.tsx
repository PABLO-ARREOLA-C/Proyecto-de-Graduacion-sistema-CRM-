"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import { toast } from "sonner";
import { productService, type Product, type ProductPayload } from "@/services/productService";

const button = "rounded-lg border px-4 py-2 text-sm disabled:opacity-50";
const field = "mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm";
const money = (value: number | string) => new Intl.NumberFormat("es-GT", { style: "currency", currency: "GTQ" }).format(Number(value));
type ProductForm = { id?: string; codigo: string; nombre: string; descripcion: string; precio: string };

function errorMessage(error: unknown) {
  if (isAxiosError<{ message?: string | string[] }>(error)) {
    const message = error.response?.data?.message;
    if (Array.isArray(message)) return message.join(", ");
    if (message) return message;
  }
  return "No fue posible guardar. Actualiza el catálogo antes de reintentar.";
}

export default function ProductsPage() {
  const { data: session, status } = useSession();
  const client = useQueryClient();
  const isAdmin = session?.user?.role === "ADMIN";
  const [search, setSearch] = useState("");
  const [stateFilter, setStateFilter] = useState("TODOS");
  const [form, setForm] = useState<ProductForm | null>(null);
  const query = useQuery({ queryKey: ["products", "catalog"], queryFn: productService.getCatalog, enabled: isAdmin });
  const refresh = () => client.invalidateQueries({ queryKey: ["products"] });
  const fail = async (error: unknown) => { toast.error(errorMessage(error)); await refresh(); };
  const save = useMutation({
    mutationFn: ({ id, payload }: { id?: string; payload: ProductPayload }) =>
      id ? productService.update(id, payload) : productService.create(payload),
    onSuccess: async (_data, variables) => {
      await refresh(); setForm(null);
      toast.success(variables.id ? "Producto actualizado" : "Producto creado");
    },
    onError: fail,
  });
  const toggle = useMutation({
    mutationFn: (product: Product) => product.estado ? productService.deactivate(product.idProducto) : productService.update(product.idProducto, { estado: true }),
    onSuccess: async (_data, product) => {
      await refresh(); toast.success(product.estado ? "Producto desactivado" : "Producto activado");
    },
    onError: fail,
  });
  const busy = save.isPending || toggle.isPending;
  const products = query.data ?? [];
  const visible = products.filter((product) => {
    const term = search.trim().toLowerCase();
    return `${product.codigo} ${product.nombre} ${product.descripcion ?? ""}`.toLowerCase().includes(term) &&
      (stateFilter === "TODOS" || product.estado === (stateFilter === "ACTIVOS"));
  });
  const cents = form && /^\d+(\.\d{1,2})?$/.test(form.precio) ? Math.round(Number(form.precio) * 100) : -1;
  const normalizedCode = form?.codigo.trim().toUpperCase() ?? "";
  const valid = Boolean(form && normalizedCode.length >= 1 && normalizedCode.length <= 20 && form.nombre.trim().length >= 2 && form.nombre.trim().length <= 100 &&
    Number.isSafeInteger(cents) && cents >= 0 && cents <= 9999999999);

  function edit(product: Product) {
    setForm({ id: product.idProducto, codigo: product.codigo, nombre: product.nombre, descripcion: product.descripcion ?? "", precio: Number(product.precioActual).toFixed(2) });
  }

  if (status === "loading") return <p>Cargando sesión...</p>;
  if (!isAdmin) return <p>No tienes permisos para administrar productos.</p>;
  return <div className="space-y-6">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h1 className="text-3xl font-bold">Productos</h1><p className="mt-1 text-sm text-slate-500">Catálogo, precios y disponibilidad para nuevos pedidos.</p></div>
      <div className="flex gap-2">
        <button className={button} disabled={busy || query.isFetching} onClick={() => query.refetch()}>{query.isFetching ? "Actualizando..." : "Actualizar"}</button>
        <button className={`${button} bg-slate-950 text-white`} disabled={busy} onClick={() => setForm({ codigo: "", nombre: "", descripcion: "", precio: "" })}>Nuevo producto</button>
      </div>
    </div>
    <section className="overflow-hidden rounded-2xl border bg-white">
      <div className="flex flex-wrap items-end gap-3 border-b p-4">
        <label className="text-sm">Buscar producto<input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Código, nombre o descripción" className={field} /></label>
        <label className="text-sm">Estado<select value={stateFilter} onChange={(e) => setStateFilter(e.target.value)} className={field}><option value="TODOS">Todos</option><option value="ACTIVOS">Activos</option><option value="INACTIVOS">Inactivos</option></select></label>
      </div>
      {query.isPending ? <p className="p-5">Cargando productos...</p> : query.isError ? <div role="alert" className="space-y-2 p-5"><p>{errorMessage(query.error)}</p><button className={button} onClick={() => query.refetch()}>Reintentar consulta</button></div> : <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50"><tr>{["Código", "Producto", "Precio actual", "Estado", "Acciones"].map((title) => <th key={title} className="p-4">{title}</th>)}</tr></thead>
          <tbody className="divide-y">{visible.map((product) => <tr key={product.idProducto}>
            <td className="p-4 font-medium">{product.codigo}</td><td className="p-4"><p className="font-medium">{product.nombre}</p>{product.descripcion && <p className="whitespace-pre-wrap text-slate-500">{product.descripcion}</p>}</td>
            <td className="p-4 whitespace-nowrap">{money(product.precioActual)}</td><td className="p-4">{product.estado ? "Activo" : "Inactivo"}</td>
            <td className="p-4"><div className="flex flex-wrap gap-2">
              <button className={button} disabled={busy || query.isFetching} onClick={() => edit(product)}>Editar</button>
              <button className={button} disabled={busy || query.isFetching} onClick={() => {
                const text = product.estado ? `¿Desactivar ${product.nombre}? Dejará de estar disponible para nuevos pedidos; los pedidos existentes se conservarán.` : `¿Activar ${product.nombre} para nuevos pedidos?`;
                if (window.confirm(text)) toggle.mutate(product);
              }}>{toggle.isPending && toggle.variables?.idProducto === product.idProducto ? "Guardando..." : product.estado ? "Desactivar" : "Activar"}</button>
            </div></td>
          </tr>)}{visible.length === 0 && <tr><td colSpan={5} className="p-8 text-center text-slate-500">No hay productos con estos filtros.</td></tr>}</tbody>
        </table>
      </div>}
    </section>
    {form && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <section role="dialog" aria-modal="true" aria-labelledby="product-title" className="max-h-[90vh] w-full max-w-lg space-y-4 overflow-y-auto rounded-2xl bg-white p-6">
        <h2 id="product-title" className="text-xl font-bold">{form.id ? "Editar producto" : "Nuevo producto"}</h2>
        <form onSubmit={(event) => {
          event.preventDefault();
          if (busy || !valid) return;
          save.mutate({ id: form.id, payload: { codigo: form.codigo.trim().toUpperCase(), nombre: form.nombre.trim(), descripcion: form.descripcion.trim(), precioActual: cents / 100 } });
        }}>
          <fieldset disabled={busy} className="space-y-3">
            <label className="block text-sm">Código<input required maxLength={20} value={form.codigo} onChange={(e) => setForm({ ...form, codigo: e.target.value })} className={field} /></label>
            <label className="block text-sm">Nombre<input required minLength={2} maxLength={100} value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} className={field} /></label>
            <label className="block text-sm">Descripción<textarea rows={3} value={form.descripcion} onChange={(e) => setForm({ ...form, descripcion: e.target.value })} className={field} /></label>
            <label className="block text-sm">Precio actual (Q)<input type="number" inputMode="decimal" required min="0" max="99999999.99" step="0.01" value={form.precio} onChange={(e) => setForm({ ...form, precio: e.target.value })} className={field} /></label>
            <p className="text-sm text-slate-500">El código se guarda en mayúsculas. El precio se usará en nuevos pedidos; los importes de pedidos existentes se conservan.</p>
            <button className={`${button} bg-slate-950 text-white`} disabled={busy || !valid}>{save.isPending ? "Guardando..." : "Guardar producto"}</button>
          </fieldset>
        </form>
        <button type="button" className={button} disabled={busy} onClick={() => setForm(null)}>Cancelar</button>
      </section>
    </div>}
  </div>;
}
