"use client";

import {
  Phone,
  MessageCircle,
  UserPlus,
  Users,
  Clock,
  CheckCircle2,
  MoreHorizontal,
  CalendarDays,
} from "lucide-react";

type ProspectStatus =
  | "nuevo"
  | "contactado"
  | "calificado"
  | "en_seguimiento"
  | "convertido"
  | "no_convertido"
  | "perdido"
  | "reactivacion";

interface Prospect {
  id: string;
  nombre: string;
  telefono: string;
  productoInteres: string;
  origen: string;
  estado: ProspectStatus;
  prioridad: "alta" | "media" | "baja";
  ultimoContacto: string;
  proximoSeguimiento: string;
  responsable: string;
}

const prospects: Prospect[] = [
  {
    id: "1",
    nombre: "Carlos Méndez",
    telefono: "5558-1204",
    productoInteres: "Garrafón",
    origen: "WhatsApp",
    estado: "nuevo",
    prioridad: "alta",
    ultimoContacto: "12/09/2026",
    proximoSeguimiento: "13/09/2026",
    responsable: "Juan Pérez",
  },
  {
    id: "2",
    nombre: "María López",
    telefono: "4185-8821",
    productoInteres: "Bolsa de agua",
    origen: "Referido",
    estado: "calificado",
    prioridad: "media",
    ultimoContacto: "11/09/2026",
    proximoSeguimiento: "14/09/2026",
    responsable: "Juan Pérez",
  },
  {
    id: "3",
    nombre: "José Ramírez",
    telefono: "5124-7732",
    productoInteres: "Garrafón",
    origen: "Llamada",
    estado: "en_seguimiento",
    prioridad: "alta",
    ultimoContacto: "12/09/2026",
    proximoSeguimiento: "15/09/2026",
    responsable: "Juan Pérez",
  },
  {
    id: "4",
    nombre: "Ana Morales",
    telefono: "4932-1885",
    productoInteres: "Garrafón",
    origen: "WhatsApp",
    estado: "convertido",
    prioridad: "baja",
    ultimoContacto: "10/09/2026",
    proximoSeguimiento: "-",
    responsable: "Juan Pérez",
  },
];

const statusStyles: Record<ProspectStatus, string> = {
  nuevo: "bg-indigo-100 text-indigo-700",
  contactado: "bg-sky-100 text-sky-700",
  calificado: "bg-amber-100 text-amber-700",
  en_seguimiento: "bg-blue-100 text-blue-700",
  convertido: "bg-green-100 text-green-700",
  no_convertido: "bg-gray-100 text-gray-700",
  perdido: "bg-red-100 text-red-700",
  reactivacion: "bg-purple-100 text-purple-700",
};

const statusLabels: Record<ProspectStatus, string> = {
  nuevo: "Nuevo",
  contactado: "Contactado",
  calificado: "Calificado",
  en_seguimiento: "En seguimiento",
  convertido: "Convertido",
  no_convertido: "No convertido",
  perdido: "Perdido",
  reactivacion: "Reactivación",
};

const priorityStyles = {
  alta: "text-red-700 bg-red-50",
  media: "text-amber-700 bg-amber-50",
  baja: "text-green-700 bg-green-50",
};

export default function CrmPage() {
  return (
    <div className="space-y-6">
      {/* Encabezado */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold tracking-tight">CRM</h1>
          <p className="mt-1 text-sm text-slate-500">
            Gestión de prospectos, interacciones y seguimientos comerciales.
          </p>
        </div>

        <button className="flex items-center gap-2 rounded-lg bg-slate-950 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800">
          <UserPlus size={17} />
          Nuevo prospecto
        </button>
      </div>

      {/* Indicadores */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          title="Prospectos nuevos"
          value="12"
          subtitle="+3 esta semana"
          icon={<Users size={20} />}
        />

        <MetricCard
          title="En seguimiento"
          value="8"
          subtitle="5 de prioridad alta"
          icon={<Clock size={20} />}
        />

        <MetricCard
          title="Convertidos"
          value="21"
          subtitle="Este mes"
          icon={<CheckCircle2 size={20} />}
        />

        <MetricCard
          title="Seguimientos pendientes"
          value="6"
          subtitle="2 para hoy"
          icon={<CalendarDays size={20} />}
        />
      </div>

      {/* Contenido */}
      <div className="grid gap-6 xl:grid-cols-[1fr_330px]">
        {/* Prospectos */}
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
            <div>
              <h2 className="text-lg font-semibold">Prospectos</h2>
              <p className="text-sm text-slate-500">
                Oportunidades comerciales registradas.
              </p>
            </div>

            <div className="flex gap-2">
              <input
                placeholder="Buscar prospecto..."
                className="h-9 rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-slate-400"
              />

              <select className="h-9 rounded-lg border border-slate-200 px-3 text-sm outline-none">
                <option>Todos</option>
                <option>Nuevos</option>
                <option>Calificados</option>
                <option>En seguimiento</option>
                <option>Convertidos</option>
              </select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="border-b border-slate-200 bg-slate-50 text-sm text-slate-600">
                <tr>
                  <th className="px-5 py-3 font-medium">Prospecto</th>
                  <th className="px-5 py-3 font-medium">Producto</th>
                  <th className="px-5 py-3 font-medium">Origen</th>
                  <th className="px-5 py-3 font-medium">Estado</th>
                  <th className="px-5 py-3 font-medium">Prioridad</th>
                  <th className="px-5 py-3 font-medium">Próximo seguimiento</th>
                  <th className="px-5 py-3"></th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {prospects.map((prospect) => (
                  <tr
                    key={prospect.id}
                    className="text-sm hover:bg-slate-50"
                  >
                    <td className="px-5 py-4">
                      <div className="font-medium text-slate-900">
                        {prospect.nombre}
                      </div>
                      <div className="text-xs text-slate-500">
                        {prospect.telefono}
                      </div>
                    </td>

                    <td className="px-5 py-4">{prospect.productoInteres}</td>

                    <td className="px-5 py-4">{prospect.origen}</td>

                    <td className="px-5 py-4">
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                          statusStyles[prospect.estado]
                        }`}
                      >
                        {statusLabels[prospect.estado]}
                      </span>
                    </td>

                    <td className="px-5 py-4">
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                          priorityStyles[prospect.prioridad]
                        }`}
                      >
                        {prospect.prioridad
                          .charAt(0)
                          .toUpperCase() + prospect.prioridad.slice(1)}
                      </span>
                    </td>

                    <td className="px-5 py-4">
                      {prospect.proximoSeguimiento}
                    </td>

                    <td className="px-5 py-4">
                      <button className="rounded-md p-2 hover:bg-slate-100">
                        <MoreHorizontal size={18} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Seguimientos */}
        <aside className="rounded-2xl border border-slate-200 bg-white">
          <div className="border-b border-slate-200 px-5 py-4">
            <h2 className="text-lg font-semibold">Próximos seguimientos</h2>
            <p className="text-sm text-slate-500">
              Actividades comerciales programadas.
            </p>
          </div>

          <div className="divide-y divide-slate-100">
            <FollowUp
              name="Carlos Méndez"
              date="Hoy, 10:30 AM"
              method="WhatsApp"
              icon={<MessageCircle size={16} />}
              priority="Alta"
            />

            <FollowUp
              name="María López"
              date="Mañana, 9:00 AM"
              method="Llamada"
              icon={<Phone size={16} />}
              priority="Media"
            />

            <FollowUp
              name="José Ramírez"
              date="15 Sep, 2:00 PM"
              method="Llamada"
              icon={<Phone size={16} />}
              priority="Alta"
            />
          </div>
        </aside>
      </div>
    </div>
  );
}

function MetricCard({
  title,
  value,
  subtitle,
  icon,
}: {
  title: string;
  value: string;
  subtitle: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">{title}</span>

        <span className="text-slate-500">{icon}</span>
      </div>

      <div className="mt-6 text-3xl font-bold">{value}</div>

      <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
    </div>
  );
}

function FollowUp({
  name,
  date,
  method,
  icon,
  priority,
}: {
  name: string;
  date: string;
  method: string;
  icon: React.ReactNode;
  priority: string;
}) {
  return (
    <div className="p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-medium text-slate-900">{name}</p>
          <p className="mt-1 text-xs text-slate-500">{date}</p>
        </div>

        <span
          className={`rounded-full px-2 py-1 text-xs font-medium ${
            priority === "Alta"
              ? "bg-red-50 text-red-700"
              : "bg-amber-50 text-amber-700"
          }`}
        >
          {priority}
        </span>
      </div>

      <div className="mt-4 flex items-center gap-2 text-sm text-slate-600">
        {icon}
        {method}
      </div>
    </div>
  );
}