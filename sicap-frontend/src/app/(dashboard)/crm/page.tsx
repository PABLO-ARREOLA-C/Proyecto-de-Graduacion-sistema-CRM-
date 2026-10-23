
"use client";

import { useState } from "react";
import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  UserPlus,
  Search,
  Users,
  Clock,
  CheckCircle2,
  CalendarDays,
  Pencil,
  Eye,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { PurchaseAlerts } from "@/components/crm/PurchaseAlerts";
import {
  crmService,
  type Prospect,
  type ProspectPayload,
  type ProspectStatus,
  type InteractionType,
} from "@/services/crmService";

const statuses: ProspectStatus[] = [
  "NUEVO",
  "CONTACTADO",
  "INTERESADO",
  "CONVERTIDO",
  "DESCARTADO",
];

const statusLabels: Record<ProspectStatus, string> = {
  NUEVO: "Nuevo",
  CONTACTADO: "Contactado",
  INTERESADO: "Interesado",
  CONVERTIDO: "Convertido",
  DESCARTADO: "Descartado",
};

const statusStyles: Record<ProspectStatus, string> = {
  NUEVO: "bg-indigo-100 text-indigo-700",
  CONTACTADO: "bg-sky-100 text-sky-700",
  INTERESADO: "bg-amber-100 text-amber-700",
  CONVERTIDO: "bg-green-100 text-green-700",
  DESCARTADO: "bg-slate-100 text-slate-700",
};

const inputClass =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900";

const initialForm = {
  nombre: "",
  telefono: "",
  correo: "",
  direccion: "",
  interes: "",
  estado: "NUEVO" as ProspectStatus,
};

function errorMessage(error: unknown): string {
  if (
    typeof error === "object" &&
    error !== null &&
    "response" in error
  ) {
    const response = (
      error as {
        response?: {
          data?: { message?: string | string[] };
        };
      }
    ).response;

    const message = response?.data?.message;

    if (Array.isArray(message)) return message.join(", ");
    if (typeof message === "string") return message;
  }

  return error instanceof Error
    ? error.message
    : "Ocurrió un error inesperado.";
}

function formatDate(value: string): string {
  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? "—"
    : date.toLocaleString("es-GT");
}

function Metric({
  title,
  value,
  icon,
}: {
  title: string;
  value: number;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border bg-white p-5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium text-slate-600">
          {title}
        </span>
        <span className="text-slate-500">{icon}</span>
      </div>
      <div className="mt-5 text-3xl font-bold text-slate-900">
        {value}
      </div>
    </div>
  );
}

export default function CrmPage() {
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("TODOS");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Prospect | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(
    null
  );
  const [form, setForm] = useState(initialForm);
  const [interactionType, setInteractionType] =
    useState<InteractionType>("LLAMADA");
  const [interactionDescription, setInteractionDescription] =
    useState("");
  const [followUpDate, setFollowUpDate] = useState("");
  const [followUpDescription, setFollowUpDescription] =
    useState("");

  const {
    data: prospects = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ["crm", "prospects"],
    queryFn: crmService.getProspects,
  });

  const {
    data: detail,
    isLoading: detailLoading,
  } = useQuery({
    queryKey: ["crm", "prospect", selectedId],
    queryFn: () => crmService.getProspect(selectedId!),
    enabled: Boolean(selectedId),
  });

  const saveMutation = useMutation({
    mutationFn: async (payload: ProspectPayload) => {
      if (editing) {
        return crmService.updateProspect(
          editing.idProspecto,
          payload
        );
      }
      return crmService.createProspect(payload);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["crm"],
      });
      toast.success("Prospecto guardado correctamente");
      setFormOpen(false);
      setEditing(null);
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  const interactionMutation = useMutation({
    mutationFn: () =>
      crmService.createInteraction(selectedId!, {
        tipo: interactionType,
        descripcion: interactionDescription.trim(),
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["crm", "prospect", selectedId],
      });
      setInteractionDescription("");
      toast.success("Interacción registrada");
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  const followUpMutation = useMutation({
    mutationFn: () =>
      crmService.createFollowUp(selectedId!, {
        fechaProgramada: new Date(
          `${followUpDate}T12:00:00`
        ).toISOString(),
        descripcion: followUpDescription.trim() || undefined,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["crm", "prospect", selectedId],
      });
      setFollowUpDate("");
      setFollowUpDescription("");
      toast.success("Seguimiento programado");
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  const statusMutation = useMutation({
    mutationFn: ({
      followUpId,
      estado,
    }: {
      followUpId: string;
      estado: "COMPLETADO" | "CANCELADO";
    }) =>
      crmService.updateFollowUp(
        selectedId!,
        followUpId,
        { estado }
      ),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["crm", "prospect", selectedId],
      });
      toast.success("Seguimiento actualizado");
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  function openCreate() {
    setEditing(null);
    setForm({ ...initialForm });
    setFormOpen(true);
  }

  function openEdit(prospect: Prospect) {
    setEditing(prospect);
    setForm({
      nombre: prospect.nombre,
      telefono: prospect.telefono,
      correo: prospect.correo ?? "",
      direccion: prospect.direccion ?? "",
      interes: prospect.interes ?? "",
      estado: prospect.estado,
    });
    setFormOpen(true);
  }

  function saveProspect(event: React.FormEvent) {
    event.preventDefault();

    const payload: ProspectPayload = {
      nombre: form.nombre.trim(),
      telefono: form.telefono.trim(),
      estado: form.estado,
      ...(form.correo.trim()
        ? { correo: form.correo.trim() }
        : {}),
      ...(form.direccion.trim()
        ? { direccion: form.direccion.trim() }
        : {}),
      ...(form.interes.trim()
        ? { interes: form.interes.trim() }
        : {}),
    };

    saveMutation.mutate(payload);
  }

  const filtered = prospects.filter((prospect) => {
    const term = search.toLowerCase().trim();

    const matchesSearch =
      prospect.nombre.toLowerCase().includes(term) ||
      prospect.telefono.includes(term) ||
      (prospect.correo ?? "").toLowerCase().includes(term);

    const matchesStatus =
      filter === "TODOS" || prospect.estado === filter;

    return matchesSearch && matchesStatus;
  });

  const newCount = prospects.filter(
    (p) => p.estado === "NUEVO"
  ).length;

  const activeCount = prospects.filter(
    (p) =>
      p.estado === "CONTACTADO" ||
      p.estado === "INTERESADO"
  ).length;

  const convertedCount = prospects.filter(
    (p) => p.estado === "CONVERTIDO"
  ).length;

  const discardedCount = prospects.filter(
    (p) => p.estado === "DESCARTADO"
  ).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">CRM</h1>
          <p className="mt-1 text-sm text-slate-500">
            Gestión de prospectos y actividades comerciales.
          </p>
        </div>

        <button
          onClick={openCreate}
          className="flex items-center gap-2 rounded-lg bg-slate-950 px-4 py-2 text-sm font-medium text-white"
        >
          <UserPlus size={17} />
          Nuevo prospecto
        </button>
      </div>

      <PurchaseAlerts />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric
          title="Prospectos nuevos"
          value={newCount}
          icon={<Users size={20} />}
        />
        <Metric
          title="En gestión comercial"
          value={activeCount}
          icon={<Clock size={20} />}
        />
        <Metric
          title="Convertidos"
          value={convertedCount}
          icon={<CheckCircle2 size={20} />}
        />
        <Metric
          title="Descartados"
          value={discardedCount}
          icon={<CalendarDays size={20} />}
        />
      </div>

      <section className="overflow-hidden rounded-2xl border bg-white">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b p-5">
          <div>
            <h2 className="text-lg font-semibold">Prospectos</h2>
            <p className="text-sm text-slate-500">
              {prospects.length} registros en el sistema
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <div className="relative">
              <Search
                size={16}
                className="absolute left-3 top-3 text-slate-400"
              />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar prospecto..."
                className={`${inputClass} pl-9`}
              />
            </div>

            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className={inputClass}
            >
              <option value="TODOS">Todos los estados</option>
              {statuses.map((status) => (
                <option key={status} value={status}>
                  {statusLabels[status]}
                </option>
              ))}
            </select>
          </div>
        </div>

        {isLoading ? (
          <p className="p-6">Cargando prospectos...</p>
        ) : error ? (
          <p className="p-6 text-red-600">
            {errorMessage(error)}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="px-5 py-3">Prospecto</th>
                  <th className="px-5 py-3">Productos de interés</th>
                  <th className="px-5 py-3">Estado</th>
                  <th className="px-5 py-3">Responsable</th>
                  <th className="px-5 py-3">Fecha de registro</th>
                  <th className="px-5 py-3">Acciones</th>
                </tr>
              </thead>

              <tbody className="divide-y">
                {filtered.map((prospect) => (
                  <tr
                    key={prospect.idProspecto}
                    className="hover:bg-slate-50"
                  >
                    <td className="px-5 py-4">
                      <p className="font-medium">
                        {prospect.nombre}
                      </p>
                      <p className="text-xs text-slate-500">
                        {prospect.telefono}
                      </p>
                    </td>

                    <td className="px-5 py-4">
                      {prospect.productos
                        .map((p) => p.producto.nombre)
                        .join(", ") || "Sin productos"}
                    </td>

                    <td className="px-5 py-4">
                      <span
                        className={`rounded-full px-2 py-1 text-xs ${statusStyles[prospect.estado]}`}
                      >
                        {statusLabels[prospect.estado]}
                      </span>
                    </td>

                    <td className="px-5 py-4">
                      {prospect.responsable?.nombre ?? "—"}
                    </td>

                    <td className="px-5 py-4">
                      {formatDate(prospect.fechaCreacion)}
                    </td>

                    <td className="px-5 py-4">
                      <div className="flex gap-2">
                        <button
                          title="Ver detalle"
                          aria-label="Ver detalle"
                          onClick={() =>
                            setSelectedId(prospect.idProspecto)
                          }
                          className="rounded-md p-2 hover:bg-slate-100"
                        >
                          <Eye size={17} />
                        </button>
                        <button
                          title="Editar prospecto"
                          aria-label="Editar prospecto"
                          onClick={() => openEdit(prospect)}
                          className="rounded-md p-2 hover:bg-slate-100"
                        >
                          <Pencil size={17} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}

                {filtered.length === 0 && (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-5 py-10 text-center text-slate-500"
                    >
                      No se encontraron prospectos.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {formOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-xl font-bold">
                {editing ? "Editar prospecto" : "Nuevo prospecto"}
              </h2>
              <button
                onClick={() => setFormOpen(false)}
                aria-label="Cerrar formulario"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={saveProspect} className="space-y-4">
              <label className="block text-sm">
                Nombre *
                <input
                  required
                  minLength={2}
                  maxLength={100}
                  value={form.nombre}
                  onChange={(e) =>
                    setForm({ ...form, nombre: e.target.value })
                  }
                  className={`${inputClass} mt-1`}
                />
              </label>

              <label className="block text-sm">
                Teléfono *
                <input
                  required
                  minLength={8}
                  maxLength={20}
                  value={form.telefono}
                  onChange={(e) =>
                    setForm({ ...form, telefono: e.target.value })
                  }
                  className={`${inputClass} mt-1`}
                />
              </label>

              <label className="block text-sm">
                Correo
                <input
                  type="email"
                  maxLength={100}
                  value={form.correo}
                  onChange={(e) =>
                    setForm({ ...form, correo: e.target.value })
                  }
                  className={`${inputClass} mt-1`}
                />
              </label>

              <label className="block text-sm">
                Dirección
                <input
                  maxLength={255}
                  value={form.direccion}
                  onChange={(e) =>
                    setForm({ ...form, direccion: e.target.value })
                  }
                  className={`${inputClass} mt-1`}
                />
              </label>

              <label className="block text-sm">
                Interés comercial
                <textarea
                  maxLength={1000}
                  value={form.interes}
                  onChange={(e) =>
                    setForm({ ...form, interes: e.target.value })
                  }
                  rows={3}
                  className={`${inputClass} mt-1`}
                />
              </label>

              <label className="block text-sm">
                Estado
                <select
                  value={form.estado}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      estado: e.target.value as ProspectStatus,
                    })
                  }
                  className={`${inputClass} mt-1`}
                >
                  {statuses.map((status) => (
                    <option key={status} value={status}>
                      {statusLabels[status]}
                    </option>
                  ))}
                </select>
              </label>

              <div className="flex justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setFormOpen(false)}
                  className="rounded-lg border px-4 py-2"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saveMutation.isPending}
                  className="rounded-lg bg-slate-950 px-4 py-2 text-white disabled:opacity-50"
                >
                  {saveMutation.isPending
                    ? "Guardando..."
                    : "Guardar prospecto"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {selectedId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-xl font-bold">
                Detalle comercial
              </h2>
              <button
                onClick={() => setSelectedId(null)}
                aria-label="Cerrar detalle"
              >
                <X size={20} />
              </button>
            </div>

            {detailLoading || !detail ? (
              <p>Cargando detalle...</p>
            ) : (
              <div className="space-y-6">
                <div className="rounded-lg bg-slate-50 p-4">
                  <h3 className="font-semibold">{detail.nombre}</h3>
                  <p className="text-sm">{detail.telefono}</p>
                  <p className="text-sm">
                    {detail.correo || "Sin correo"}
                  </p>
                  <p className="mt-2 text-sm">
                    {detail.interes || "Sin interés registrado"}
                  </p>
                </div>

                <section className="space-y-3">
                  <h3 className="font-semibold">Interacciones</h3>

                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      interactionMutation.mutate();
                    }}
                    className="space-y-2"
                  >
                    <select
                      value={interactionType}
                      onChange={(e) =>
                        setInteractionType(
                          e.target.value as InteractionType
                        )
                      }
                      className={inputClass}
                    >
                      <option value="LLAMADA">Llamada</option>
                      <option value="WHATSAPP">WhatsApp</option>
                      <option value="VISITA">Visita</option>
                      <option value="OTRO">Otro</option>
                    </select>

                    <textarea
                      required
                      minLength={2}
                      maxLength={2000}
                      placeholder="Descripción de la interacción"
                      value={interactionDescription}
                      onChange={(e) =>
                        setInteractionDescription(e.target.value)
                      }
                      className={inputClass}
                    />

                    <button
                      disabled={interactionMutation.isPending}
                      className="rounded-lg bg-slate-950 px-4 py-2 text-sm text-white disabled:opacity-50"
                    >
                      Registrar interacción
                    </button>
                  </form>

                  {(detail.interacciones ?? []).map((item) => (
                    <div
                      key={item.idInteraccion}
                      className="rounded-lg border p-3 text-sm"
                    >
                      <p className="font-medium">{item.tipo}</p>
                      <p>{item.descripcion}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        {formatDate(item.fechaHora)}
                        {" · "}
                        {item.usuario?.nombre}
                      </p>
                    </div>
                  ))}
                </section>

                <section className="space-y-3">
                  <h3 className="font-semibold">Seguimientos</h3>

                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (!followUpDate) return;
                      followUpMutation.mutate();
                    }}
                    className="space-y-2"
                  >
                    <input
                      type="date"
                      required
                      value={followUpDate}
                      onChange={(e) =>
                        setFollowUpDate(e.target.value)
                      }
                      className={inputClass}
                    />

                    <textarea
                      placeholder="Descripción del seguimiento"
                      minLength={2}
                      maxLength={1000}
                      value={followUpDescription}
                      onChange={(e) =>
                        setFollowUpDescription(e.target.value)
                      }
                      className={inputClass}
                    />

                    <button
                      disabled={followUpMutation.isPending}
                      className="rounded-lg bg-slate-950 px-4 py-2 text-sm text-white disabled:opacity-50"
                    >
                      Programar seguimiento
                    </button>
                  </form>

                  {(detail.seguimientos ?? []).map((item) => (
                    <div
                      key={item.idSeguimiento}
                      className="rounded-lg border p-3 text-sm"
                    >
                      <div className="flex flex-wrap justify-between gap-2">
                        <span className="font-medium">
                          {formatDate(item.fechaProgramada)}
                        </span>
                        <span>{item.estado}</span>
                      </div>

                      <p className="mt-1">
                        {item.descripcion || "Sin descripción"}
                      </p>

                      {item.estado === "PENDIENTE" && (
                        <div className="mt-3 flex gap-2">
                          <button
                            disabled={statusMutation.isPending}
                            onClick={() =>
                              statusMutation.mutate({
                                followUpId: item.idSeguimiento,
                                estado: "COMPLETADO",
                              })
                            }
                            className="rounded border px-3 py-1"
                          >
                            Completar
                          </button>

                          <button
                            disabled={statusMutation.isPending}
                            onClick={() =>
                              statusMutation.mutate({
                                followUpId: item.idSeguimiento,
                                estado: "CANCELADO",
                              })
                            }
                            className="rounded border px-3 py-1"
                          >
                            Cancelar
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </section>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
