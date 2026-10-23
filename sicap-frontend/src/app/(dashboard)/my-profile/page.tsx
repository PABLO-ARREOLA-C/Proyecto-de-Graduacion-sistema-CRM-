"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { clientPortalService, type OwnProfile, type OwnProfilePayload, type OwnAddressPayload } from "@/services/clientPortalService";
import { useClientPortal, PortalNotice, portalButton as button, portalField as field, portalError } from "@/components/client-portal/shared";

function ProfileForm({ profile, name, onSave, busy }: { profile: OwnProfile | null; name: string; onSave: (data: OwnProfilePayload) => void; busy: boolean }) {
  const [form, setForm] = useState({ nombre: profile?.nombre ?? name, telefono: profile?.telefono ?? "", nit: profile?.nit ?? "" });
  return <form onSubmit={(event) => { event.preventDefault(); if (!busy && form.nombre.trim().length >= 2 && form.telefono.trim().length >= 8) onSave({ nombre: form.nombre.trim(), telefono: form.telefono.trim(), nit: form.nit.trim() }); }}>
    <fieldset disabled={busy} className="space-y-3">
      <label className="block text-sm">Nombre<input required minLength={2} maxLength={100} className={field} value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} /></label>
      <label className="block text-sm">Teléfono<input type="tel" required minLength={8} maxLength={20} className={field} value={form.telefono} onChange={(e) => setForm({ ...form, telefono: e.target.value })} /></label>
      <label className="block text-sm">NIT<input maxLength={20} className={field} value={form.nit} onChange={(e) => setForm({ ...form, nit: e.target.value })} /></label>
      <button className={`${button} bg-slate-950 text-white`} disabled={busy || form.nombre.trim().length < 2 || form.telefono.trim().length < 8}>{busy ? "Guardando..." : "Guardar información"}</button>
    </fieldset>
  </form>;
}

export default function MyProfilePage() {
  const portal = useClientPortal();
  const client = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [address, setAddress] = useState<(OwnAddressPayload & { id?: string }) | null>(null);
  const refresh = () => Promise.all([client.invalidateQueries({ queryKey: ["client-portal"] }), client.invalidateQueries({ queryKey: ["clients"] })]);
  const fail = async (error: unknown) => { toast.error(portalError(error)); await refresh(); };
  const save = useMutation({ mutationFn: clientPortalService.saveProfile, onSuccess: async () => { await refresh(); setEditing(false); toast.success("Información guardada"); }, onError: fail });
  const saveAddress = useMutation({
    mutationFn: ({ id, ...payload }: OwnAddressPayload & { id?: string }) => id ? clientPortalService.updateAddress(id, payload) : clientPortalService.addAddress(payload),
    onSuccess: async () => { await refresh(); setAddress(null); toast.success("Dirección guardada"); }, onError: fail,
  });
  const remove = useMutation({ mutationFn: clientPortalService.removeAddress, onSuccess: async () => { await refresh(); toast.success("Dirección retirada"); }, onError: fail });
  const busy = save.isPending || saveAddress.isPending || remove.isPending;
  const profile = portal.profile.data;
  if (portal.status === "loading" || !portal.isClient || portal.profile.isPending || portal.profile.isError) return <PortalNotice portal={portal} />;
  return <div className="space-y-6">
    <div className="flex flex-wrap items-center justify-between gap-3"><h1 className="text-3xl font-bold">Mi información</h1><button className={button} disabled={busy || portal.profile.isFetching} onClick={() => portal.profile.refetch()}>Actualizar</button></div>
    {!profile && <div className="rounded-xl border bg-white p-5 text-sm"><p>Completa tu ficha para usar el portal.</p><p>Si ya tienes pedidos anteriores, pide al administrador que vincule tu ficha existente desde Usuarios antes de crear una nueva.</p></div>}
    <section className="max-w-2xl space-y-4 rounded-xl border bg-white p-5">
      <h2 className="text-xl font-semibold">Datos personales</h2>
      <p className="text-sm">Correo de acceso: {portal.session?.user?.email}</p>
      {!profile || editing ? <>
        <ProfileForm key={profile?.idCliente ?? "new"} profile={profile ?? null} name={portal.session?.user?.name ?? ""} busy={busy} onSave={(data) => save.mutate(data)} />
        {profile && <button className={button} disabled={busy} onClick={() => setEditing(false)}>Cancelar</button>}
      </> : <>
        <dl className="space-y-2 text-sm"><div><dt className="font-medium">Nombre</dt><dd>{profile.nombre}</dd></div><div><dt className="font-medium">Teléfono</dt><dd>{profile.telefono}</dd></div><div><dt className="font-medium">NIT</dt><dd>{profile.nit || "Sin registrar"}</dd></div>{profile.correo && <div><dt className="font-medium">Correo de contacto</dt><dd>{profile.correo}</dd></div>}</dl>
        <button className={button} disabled={busy} onClick={() => setEditing(true)}>Editar información</button>
      </>}
    </section>
    {profile && <section className="max-w-2xl space-y-4 rounded-xl border bg-white p-5">
      <div className="flex flex-wrap justify-between gap-2"><h2 className="text-xl font-semibold">Mis direcciones</h2><button className={button} disabled={busy} onClick={() => setAddress({ direccion: "", referencia: "", zona: "" })}>Agregar dirección</button></div>
      {profile.direcciones.length === 0 && <p className="text-sm text-slate-500">No tienes direcciones registradas.</p>}
      {profile.direcciones.map((item) => <article key={item.idDireccion} className="space-y-2 rounded-lg border p-4 text-sm"><p>{item.direccion}</p>{item.referencia && <p>Referencia: {item.referencia}</p>}{item.zona && <p>Zona: {item.zona}</p>}
        <div className="flex gap-2"><button className={button} disabled={busy} onClick={() => setAddress({ id: item.idDireccion, direccion: item.direccion, referencia: item.referencia ?? "", zona: item.zona ?? "" })}>Editar</button><button className={button} disabled={busy} onClick={() => { if (window.confirm("¿Retirar esta dirección? Los pedidos existentes se conservan.")) remove.mutate(item.idDireccion); }}>Retirar</button></div>
      </article>)}
    </section>}
    {address && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"><section role="dialog" aria-modal="true" aria-labelledby="address-title" className="w-full max-w-lg space-y-4 rounded-xl bg-white p-6"><h2 id="address-title" className="text-xl font-semibold">{address.id ? "Editar dirección" : "Agregar dirección"}</h2>
      <form onSubmit={(event) => { event.preventDefault(); if (!busy && address.direccion.trim()) saveAddress.mutate({ ...address, direccion: address.direccion.trim(), referencia: address.referencia.trim(), zona: address.zona.trim() }); }}><fieldset disabled={busy} className="space-y-3">
        <label className="block text-sm">Dirección<input required maxLength={255} className={field} value={address.direccion} onChange={(e) => setAddress({ ...address, direccion: e.target.value })} /></label>
        <label className="block text-sm">Referencia<input maxLength={255} className={field} value={address.referencia} onChange={(e) => setAddress({ ...address, referencia: e.target.value })} /></label>
        <label className="block text-sm">Zona<input maxLength={50} className={field} value={address.zona} onChange={(e) => setAddress({ ...address, zona: e.target.value })} /></label>
        <button className={button} disabled={busy || !address.direccion.trim()}>{busy ? "Guardando..." : "Guardar dirección"}</button>
      </fieldset></form><button className={button} disabled={busy} onClick={() => setAddress(null)}>Cancelar</button>
    </section></div>}
  </div>;
}
