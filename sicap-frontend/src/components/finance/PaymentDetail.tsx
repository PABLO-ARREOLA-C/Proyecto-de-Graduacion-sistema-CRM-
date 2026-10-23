"use client";

import { useState, useSyncExternalStore } from "react";
import { useSession } from "next-auth/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import { toast } from "sonner";
import { financeService } from "@/services/financeService";
import { parsePendingPayment, paymentSnapshot, savePendingPayment, subscribePendingPayment, type PendingPayment } from "@/lib/pendingPayment";

const button = "rounded-lg border px-4 py-2 text-sm disabled:opacity-50";
const field = "mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm";
const money = (value: number | string) => new Intl.NumberFormat("es-GT", { style: "currency", currency: "GTQ" }).format(Number(value));
const dateOnly = (value: string) => value.slice(0, 10).split("-").reverse().join("/");
const paymentLabels = { PENDIENTE: "Pendiente", PARCIAL: "Parcial", PAGADO: "Pagado" };

function errorMessage(error: unknown) {
  if (isAxiosError<{ message?: string | string[] }>(error)) {
    const value = error.response?.data?.message;
    if (Array.isArray(value)) return value.join(", ");
    if (value) return value;
  }
  return "No fue posible completar la operación. Actualiza para consultar el estado actual.";
}

export function PaymentDetail({ id, onClose }: { id: string; onClose: () => void }) {
  const client = useQueryClient();
  const { data: session } = useSession();
  const storageKey = `sicap-payment:${session?.user.id ?? ""}:${id}`;
  const snapshot = useSyncExternalStore(subscribePendingPayment, () => paymentSnapshot(storageKey), () => null);
  const pending = parsePendingPayment(snapshot);
  const [amount, setAmount] = useState("");
  const [notes, setNotes] = useState("");
  const status = useQuery({ queryKey: ["finances", "status", id], queryFn: () => financeService.getOrderStatus(id) });
  const history = useQuery({ queryKey: ["finances", "payments", id], queryFn: () => financeService.getPayments(id) });
  const detail = status.data;
  const cents = /^\d+(\.\d{1,2})?$/.test(amount) ? Math.round(Number(amount) * 100) : 0;
  const canPay = Boolean(detail && detail.pedido.estado !== "CANCELADO" && detail.saldoPendiente > 0 &&
    (detail.pedido.tipoVenta === "CONTADO" || detail.cuentaPorCobrar));
  const valid = Number.isSafeInteger(cents) && cents > 0 && cents <= Math.round((detail?.saldoPendiente ?? 0) * 100);
  const payment = useMutation({
    mutationFn: async (operation: PendingPayment) => {
      if (!session?.user.id) throw new Error("La sesión no está disponible.");
      // Persistir antes de enviar permite recuperar una respuesta perdida.
      savePendingPayment(storageKey, operation);
      const { idCuenta, ...payload } = operation;
      if (idCuenta) {
        await financeService.payReceivable(idCuenta, payload);
      } else {
        await financeService.payCashOrder(id, payload);
      }
    },
    onSuccess: async () => {
      savePendingPayment(storageKey, null);
      setAmount(""); setNotes("");
      await Promise.all([
        client.invalidateQueries({ queryKey: ["finances"] }),
        client.invalidateQueries({ queryKey: ["orders"] }),
      ]);
      toast.success("Pago registrado correctamente");
    },
    onError: async (error) => {
      if (isAxiosError(error) && [400, 403, 404, 422].includes(error.response?.status ?? 0)) {
        savePendingPayment(storageKey, null);
      }
      toast.error(errorMessage(error));
      await client.invalidateQueries({ queryKey: ["finances"] });
    },
  });
  const unavailable = status.isPending || history.isPending || status.isError || history.isError || status.isFetching || history.isFetching;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <section role="dialog" aria-modal="true" aria-labelledby="payment-title" className="max-h-[90vh] w-full max-w-2xl space-y-5 overflow-y-auto rounded-2xl bg-white p-6">
        <div className="flex items-center justify-between gap-3">
          <h2 id="payment-title" className="text-xl font-bold">Pagos de {detail?.pedido.numeroPedido ?? "pedido"}</h2>
          <button type="button" className={button} disabled={payment.isPending} onClick={onClose}>Cerrar</button>
        </div>
        {status.isPending || history.isPending ? <p>Cargando saldo e historial...</p> : status.isError || history.isError ? (
          <div role="alert" className="space-y-2"><p>{errorMessage(status.error ?? history.error)}</p>
            <button className={button} onClick={() => { status.refetch(); history.refetch(); }}>Reintentar consulta</button>
          </div>
        ) : detail && <>
          <div className="rounded-xl bg-slate-50 p-4 text-sm">
            <p>{detail.pedido.tipoVenta === "CREDITO" ? "Crédito" : "Contado"} · {detail.pedido.estado} · {paymentLabels[detail.estadoPago]}</p>
            <p>Total: {money(detail.pedido.total)} · Pagado: {money(detail.totalPagado)} · Saldo: <strong>{money(detail.saldoPendiente)}</strong></p>
            {detail.cuentaPorCobrar && <p>Vencimiento: {dateOnly(detail.cuentaPorCobrar.fechaVencimiento)} · {detail.cuentaPorCobrar.estadoCalculado}</p>}
          </div>
          {pending ? <div role="status" className="space-y-3 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm">
            <p>Hay un pago de {money(pending.monto)} pendiente de confirmación. Reintenta para confirmar su resultado antes de registrar otro pago.</p>
            <button type="button" className={button} disabled={payment.isPending || !session?.user.id} onClick={() => payment.mutate(pending)}>
              {payment.isPending ? "Confirmando..." : "Confirmar pago pendiente"}
            </button>
          </div> : canPay ? <form onSubmit={(event) => {
            event.preventDefault();
            if (!payment.isPending && !unavailable && valid && session?.user.id && window.confirm(`¿Registrar un pago de ${money(cents / 100)} para ${detail.pedido.numeroPedido}?`)) {
              payment.mutate({ idOperacion: crypto.randomUUID(), monto: cents / 100, observaciones: notes.trim(),
                ...(detail.pedido.tipoVenta === "CREDITO" && detail.cuentaPorCobrar ? { idCuenta: detail.cuentaPorCobrar.idCuenta } : {}) });
            }
          }}>
            <fieldset disabled={payment.isPending || unavailable} className="space-y-3">
              <legend className="font-semibold">Registrar pago o abono</legend>
              <label className="block text-sm">Monto (Q)
                <input type="number" inputMode="decimal" required min="0.01" step="0.01" max={detail.saldoPendiente} value={amount} onChange={(event) => setAmount(event.target.value)} className={field} />
              </label>
              <button type="button" className={button} onClick={() => setAmount(detail.saldoPendiente.toFixed(2))}>Usar saldo completo</button>
              <label className="block text-sm">Observaciones
                <textarea rows={2} maxLength={1000} value={notes} onChange={(event) => setNotes(event.target.value)} className={field} />
              </label>
              <p className="text-sm text-slate-500">El pago se registrará como ingreso en efectivo.</p>
              <button className={`${button} bg-slate-950 text-white`} disabled={payment.isPending || unavailable || !valid}>
                {payment.isPending ? "Guardando..." : "Registrar pago"}
              </button>
            </fieldset>
          </form> : <p className="text-sm text-slate-600">{detail.pedido.estado === "CANCELADO" ? "Este pedido está cancelado y no admite pagos." : detail.saldoPendiente <= 0 ? "Este pedido no tiene saldo pendiente." : "Crea una cuenta por cobrar para registrar abonos de este pedido a crédito."}</p>}
          <div className="space-y-3">
            <h3 className="font-semibold">Historial de pagos</h3>
            {history.data?.pagos.length === 0 && <p className="text-sm text-slate-500">Sin pagos registrados.</p>}
            {history.data?.pagos.map((item) => <article key={item.idPago} className="rounded-lg border p-3 text-sm">
              <p className="font-medium">{money(item.monto)} · {new Date(item.fechaPago).toLocaleString("es-GT", { timeZone: "America/Guatemala" })}</p>
              <p>Registrado por: {item.usuario.nombre}</p>
              {item.observaciones && <p className="whitespace-pre-wrap">{item.observaciones}</p>}
            </article>)}
          </div>
        </>}
      </section>
    </div>
  );
}

