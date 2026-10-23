"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { useQuery } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import { clientPortalService } from "@/services/clientPortalService";
import type { OrderStatus } from "@/services/orderService";

export const portalButton = "inline-block rounded-lg border px-4 py-2 text-sm disabled:opacity-50";
export const portalField = "mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm";
export const money = (value: number | string) => new Intl.NumberFormat("es-GT", { style: "currency", currency: "GTQ" }).format(Number(value));
export const dayLabel = (value: string) => value.slice(0, 10).split("-").reverse().join("/");
export const timeLabel = (value: string) => new Date(value).toLocaleString("es-GT", { timeZone: "America/Guatemala" });
export const orderLabels: Record<OrderStatus, string> = {
  PENDIENTE: "Pendiente", CONFIRMADO: "Confirmado", EN_RUTA: "En ruta", ENTREGADO: "Entregado", CANCELADO: "Cancelado",
};
export function portalError(error: unknown) {
  if (isAxiosError<{ message?: string | string[] }>(error)) {
    const message = error.response?.data?.message;
    if (Array.isArray(message)) return message.join(", ");
    if (message) return message;
  }
  return "No fue posible consultar tus datos. Intenta nuevamente.";
}

export function useClientPortal() {
  const { data: session, status } = useSession();
  const isClient = session?.user?.role === "CLIENT";
  const profile = useQuery({ queryKey: ["client-portal", session?.user?.id, "profile"], queryFn: clientPortalService.getProfile, enabled: isClient });
  const orders = useQuery({ queryKey: ["client-portal", session?.user?.id, "orders"], queryFn: clientPortalService.getOrders, enabled: isClient && Boolean(profile.data) && !profile.isError });
  return { session, status, isClient, profile, orders };
}

export function PortalNotice({ portal }: { portal: ReturnType<typeof useClientPortal> }) {
  if (portal.status === "loading" || (portal.isClient && portal.profile.isPending)) return <p>Cargando tu información...</p>;
  if (!portal.isClient) return <p>Esta vista está disponible para clientes.</p>;
  if (portal.profile.isError) return <div role="alert" className="space-y-2"><p>{portalError(portal.profile.error)}</p><button className={portalButton} onClick={() => portal.profile.refetch()}>Reintentar</button></div>;
  if (!portal.profile.data) return <div className="space-y-3 rounded-xl border bg-white p-5"><p>Tu cuenta todavía no tiene una ficha de cliente.</p><p className="text-sm text-slate-500">Si ya tienes pedidos, solicita al administrador que vincule tu ficha existente para consultarlos.</p><Link href="/my-profile" className={portalButton}>Completar Mi información</Link></div>;
  return null;
}
