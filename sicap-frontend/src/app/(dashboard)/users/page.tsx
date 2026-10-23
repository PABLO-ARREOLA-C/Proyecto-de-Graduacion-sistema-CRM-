"use client";

import { useState } from "react";
import { signOut, useSession } from "next-auth/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import { toast } from "sonner";
import { userService, type ManagedUser, type UserPayload } from "@/services/userService";
import { clientService } from "@/services/clientService";

const button = "rounded-lg border px-4 py-2 text-sm disabled:opacity-50";
const field = "mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm";
type UserForm = { id?: string; originalRole?: number; nombre: string; correo: string; idRol: string; password: string };
function errorMessage(error: unknown) {
  if (isAxiosError<{ message?: string | string[] }>(error)) {
    const message = error.response?.data?.message;
    if (Array.isArray(message)) return message.join(", ");
    if (message) return message;
  }
  return "No fue posible guardar. Actualiza los usuarios antes de reintentar.";
}

export default function UsersPage() {
  const { data: session, status } = useSession();
  const client = useQueryClient();
  const isAdmin = session?.user?.role === "ADMIN";
  const [search, setSearch] = useState("");
  const [stateFilter, setStateFilter] = useState("TODOS");
  const [roleFilter, setRoleFilter] = useState("");
  const [form, setForm] = useState<UserForm | null>(null);
  const [linkForm, setLinkForm] = useState<{ user: ManagedUser; idCliente: string } | null>(null);
  const profiles = useQuery({ queryKey: ["clients"], queryFn: clientService.getAll, enabled: isAdmin && Boolean(linkForm) });
  const users = useQuery({ queryKey: ["users"], queryFn: userService.getAll, enabled: isAdmin });
  const roles = useQuery({ queryKey: ["users", "roles"], queryFn: userService.getRoles, enabled: isAdmin });
  const refresh = () => Promise.all([
    client.invalidateQueries({ queryKey: ["users"] }),
    client.invalidateQueries({ queryKey: ["logistics"] }),
  ]);
  const fail = async (error: unknown) => { toast.error(errorMessage(error)); await refresh(); };
  const link = useMutation({
    mutationFn: ({ id, idCliente }: { id: string; idCliente: string | null }) => userService.linkClient(id, idCliente),
    onSuccess: async () => {
      await Promise.all([refresh(), client.invalidateQueries({ queryKey: ["clients"] }), client.invalidateQueries({ queryKey: ["client-portal"] })]);
      setLinkForm(null); toast.success("Ficha de cliente vinculada");
    },
    onError: async (error) => { await fail(error); await profiles.refetch(); },
  });
  const save = useMutation({
    mutationFn: ({ id, originalRole, payload }: { id?: string; originalRole?: number; payload: UserPayload }) => {
      if (id) {
        const { idRol, ...data } = payload;
        return userService.update(id, { ...data, ...(idRol !== originalRole ? { idRol } : {}) });
      }
      if (!payload.password) throw new Error("Ingresa una contraseña.");
      return userService.create({ ...payload, password: payload.password });
    },
    onSuccess: async (_data, variables) => {
      setForm(null);
      toast.success(variables.id ? "Usuario actualizado" : "Usuario creado");
      if (variables.id === session?.user?.id) {
        await signOut({ callbackUrl: "/login" });
        return;
      }
      await refresh();
    },
    onError: fail,
  });
  const toggle = useMutation({
    mutationFn: (user: ManagedUser) => user.estado ? userService.deactivate(user.idUsuario) : userService.update(user.idUsuario, { estado: true }),
    onSuccess: async (_data, user) => {
      toast.success(user.estado ? "Usuario desactivado" : "Usuario activado");
      if (user.idUsuario === session?.user?.id && user.estado) {
        await signOut({ callbackUrl: "/login" });
        return;
      }
      await refresh();
    },
    onError: fail,
  });
  const busy = save.isPending || toggle.isPending || link.isPending;
  const availableRoles = roles.data ?? [];
  const passwordValid = Boolean(form && ((form.id && form.password === "") ||
    (form.password.length >= 8 && form.password.length <= 100 && new TextEncoder().encode(form.password).length <= 72)));
  const chosenRoleValid = Boolean(form && (availableRoles.some((role) => String(role.idRol) === form.idRol) ||
    (form.id && String(form.originalRole) === form.idRol)));
  const valid = Boolean(form && form.nombre.trim().length >= 3 && form.nombre.trim().length <= 100 &&
    form.correo.trim().length <= 100 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.correo.trim()) && chosenRoleValid && passwordValid);
  const visible = (users.data ?? []).filter((user) => {
    const term = search.trim().toLowerCase();
    return `${user.nombre} ${user.correo} ${user.rol.nombre}`.toLowerCase().includes(term) &&
      (!roleFilter || String(user.rol.idRol) === roleFilter) &&
      (stateFilter === "TODOS" || user.estado === (stateFilter === "ACTIVOS"));
  });
  const filterRoles = new Map((users.data ?? []).map((user) => [user.rol.idRol, user.rol]));
  availableRoles.forEach((role) => filterRoles.set(role.idRol, role));

  function edit(user: ManagedUser) {
    setForm({ id: user.idUsuario, originalRole: user.rol.idRol, nombre: user.nombre, correo: user.correo, idRol: String(user.rol.idRol), password: "" });
  }
  if (status === "loading") return <p>Cargando sesión...</p>;
  if (!isAdmin) return <p>No tienes permisos para administrar usuarios.</p>;
  return <div className="space-y-6">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h1 className="text-3xl font-bold">Usuarios</h1><p className="mt-1 text-sm text-slate-500">Cuentas de acceso, roles y estado de los usuarios.</p></div>
      <div className="flex gap-2">
        <button className={button} disabled={busy || users.isFetching || roles.isFetching} onClick={() => refresh()}>Actualizar</button>
        <button className={`${button} bg-slate-950 text-white`} disabled={busy || roles.isPending || roles.isError} onClick={() => setForm({ nombre: "", correo: "", idRol: "", password: "" })}>Nuevo usuario</button>
      </div>
    </div>
    {roles.isError && <div role="alert" className="text-sm"><p>No fue posible cargar los roles disponibles.</p><button className={button} onClick={() => roles.refetch()}>Reintentar roles</button></div>}
    <section className="overflow-hidden rounded-2xl border bg-white">
      <div className="flex flex-wrap items-end gap-3 border-b p-4">
        <label className="text-sm">Buscar usuario<input className={field} placeholder="Nombre, correo o rol" value={search} onChange={(e) => setSearch(e.target.value)} /></label>
        <label className="text-sm">Rol<select className={field} value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}><option value="">Todos</option>{[...filterRoles.values()].map((role) => <option key={role.idRol} value={role.idRol}>{role.nombre}</option>)}</select></label>
        <label className="text-sm">Estado<select className={field} value={stateFilter} onChange={(e) => setStateFilter(e.target.value)}><option value="TODOS">Todos</option><option value="ACTIVOS">Activos</option><option value="INACTIVOS">Inactivos</option></select></label>
      </div>
      {users.isPending ? <p className="p-5">Cargando usuarios...</p> : users.isError ? <div role="alert" className="space-y-2 p-5"><p>{errorMessage(users.error)}</p><button className={button} onClick={() => users.refetch()}>Reintentar consulta</button></div> : <div className="overflow-x-auto"><table className="w-full text-left text-sm">
        <thead className="bg-slate-50"><tr>{["Nombre", "Correo", "Rol", "Estado", "Último acceso", "Acciones"].map((title) => <th key={title} className="p-4">{title}</th>)}</tr></thead>
        <tbody className="divide-y">{visible.map((user) => <tr key={user.idUsuario}>
          <td className="p-4 font-medium">{user.nombre}{user.idUsuario === session?.user?.id && " (tu cuenta)"}</td><td className="p-4">{user.correo}</td><td className="p-4">{user.rol.nombre}</td><td className="p-4">{user.estado ? "Activo" : "Inactivo"}</td>
          <td className="p-4">{user.fechaUltimaConexion ? new Date(user.fechaUltimaConexion).toLocaleString("es-GT", { timeZone: "America/Guatemala" }) : "Sin accesos registrados"}</td>
          <td className="p-4"><div className="flex flex-wrap gap-2">
            {user.rol.nombre === "Cliente" && <button className={button} disabled={busy} onClick={() => setLinkForm({ user, idCliente: user.cliente?.idCliente ?? "" })}>Vincular ficha</button>}
            <button className={button} disabled={busy || roles.isPending || roles.isError || users.isFetching} onClick={() => edit(user)}>Editar</button>
            <button className={button} disabled={busy || users.isFetching} onClick={() => {
              const own = user.idUsuario === session?.user?.id;
              if (window.confirm(`¿${user.estado ? "Desactivar" : "Activar"} a ${user.nombre}?${own && user.estado ? " Se cerrará tu sesión y no podrás ingresar con esta cuenta hasta que otro administrador la active." : ""}`)) toggle.mutate(user);
            }}>{toggle.isPending && toggle.variables?.idUsuario === user.idUsuario ? "Guardando..." : user.estado ? "Desactivar" : "Activar"}</button>
          </div></td>
        </tr>)}{visible.length === 0 && <tr><td colSpan={6} className="p-8 text-center text-slate-500">No hay usuarios con estos filtros.</td></tr>}</tbody>
      </table></div>}
    </section>
    {linkForm && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"><section role="dialog" aria-modal="true" aria-labelledby="link-title" className="w-full max-w-lg space-y-4 rounded-xl bg-white p-6">
      <h2 id="link-title" className="text-xl font-semibold">Ficha de {linkForm.user.nombre}</h2>
      <p className="text-sm">Esta cuenta podrá consultar los pedidos y datos de la ficha vinculada.</p>
      {linkForm.user.cliente && <p className="text-sm">Ficha actual: {linkForm.user.cliente.nombre}</p>}
      {profiles.isPending ? <p>Cargando clientes...</p> : profiles.isError ? <p role="alert">No fue posible cargar clientes. Cierra y vuelve a intentar.</p> : <form onSubmit={(event) => {
        event.preventDefault();
        if (!busy && window.confirm("¿Guardar esta vinculación de cliente?")) link.mutate({ id: linkForm.user.idUsuario, idCliente: linkForm.idCliente || null });
      }}><fieldset disabled={busy || profiles.isFetching} className="space-y-3"><label className="block text-sm">Ficha de cliente<select className={field} value={linkForm.idCliente} onChange={(e) => setLinkForm({ ...linkForm, idCliente: e.target.value })}><option value="">Sin vinculación</option>{(profiles.data ?? []).filter((profile) => !profile.userId || profile.userId === linkForm.user.idUsuario).map((profile) => <option key={profile.id} value={profile.id}>{profile.name} · {profile.phone}</option>)}</select></label><button className={button} disabled={busy || profiles.isFetching}>{link.isPending ? "Guardando..." : "Guardar vinculación"}</button></fieldset></form>}
      <button className={button} disabled={busy} onClick={() => setLinkForm(null)}>Cancelar</button>
    </section></div>}
    {form && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <section role="dialog" aria-modal="true" aria-labelledby="user-title" className="max-h-[90vh] w-full max-w-lg space-y-4 overflow-y-auto rounded-2xl bg-white p-6">
        <h2 id="user-title" className="text-xl font-bold">{form.id ? "Editar usuario" : "Nuevo usuario"}</h2>
        {roles.isError && <p role="alert" className="text-sm text-red-700">No fue posible actualizar los roles. Cierra y usa Actualizar antes de guardar.</p>}
        <form onSubmit={(event) => {
          event.preventDefault();
          if (busy || roles.isFetching || roles.isError || !valid) return;
          if (form.id === session?.user?.id && !window.confirm("¿Guardar los cambios de tu cuenta? Se cerrará tu sesión para que ingreses con los datos actualizados.")) return;
          save.mutate({ id: form.id, originalRole: form.originalRole, payload: {
            nombre: form.nombre.trim(), correo: form.correo.trim().toLowerCase(), idRol: Number(form.idRol),
            ...(form.password !== "" ? { password: form.password } : {}),
          } });
        }}>
          <fieldset disabled={busy || roles.isFetching || roles.isError} className="space-y-3">
            <label className="block text-sm">Nombre<input required minLength={3} maxLength={100} value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} className={field} /></label>
            <label className="block text-sm">Correo<input type="email" required maxLength={100} autoComplete="off" value={form.correo} onChange={(e) => setForm({ ...form, correo: e.target.value })} className={field} /></label>
            <label className="block text-sm">Rol<select required value={form.idRol} onChange={(e) => setForm({ ...form, idRol: e.target.value })} className={field}><option value="">Selecciona un rol</option>{form.id && !availableRoles.some((role) => role.idRol === form.originalRole) && <option value={form.originalRole}>Rol actual no disponible</option>}{availableRoles.map((role) => <option key={role.idRol} value={role.idRol}>{role.nombre}</option>)}</select></label>
            <label className="block text-sm">{form.id ? "Nueva contraseña (opcional)" : "Contraseña"}<input type="password" autoComplete="new-password" required={!form.id} minLength={8} maxLength={72} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className={field} /></label>
            <p className="text-sm text-slate-500">Mínimo 8 caracteres. {form.id && "Deja la contraseña vacía para conservar la actual."}</p>
            {form.password.length > 0 && new TextEncoder().encode(form.password).length > 72 && <p role="alert" className="text-sm text-red-700">La contraseña es demasiado larga; acórtala para guardarla completa.</p>}
            <button className={`${button} bg-slate-950 text-white`} disabled={busy || roles.isFetching || roles.isError || !valid}>{save.isPending ? "Guardando..." : "Guardar usuario"}</button>
          </fieldset>
        </form>
        <button className={button} disabled={busy} onClick={() => setForm(null)}>Cancelar</button>
      </section>
    </div>}
  </div>;
}
