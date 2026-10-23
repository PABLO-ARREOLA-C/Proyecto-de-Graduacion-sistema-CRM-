import type { PaymentPayload } from "@/services/financeService";

export interface PendingPayment extends PaymentPayload {
  idCuenta?: string;
}

const eventName = "sicap-pending-payment";

export function subscribePendingPayment(listener: () => void) {
  window.addEventListener(eventName, listener);
  window.addEventListener("storage", listener);
  return () => {
    window.removeEventListener(eventName, listener);
    window.removeEventListener("storage", listener);
  };
}

export function paymentSnapshot(key: string): string | null {
  try { return window.sessionStorage.getItem(key); }
  catch { return null; }
}

export function savePendingPayment(key: string, payment: PendingPayment | null) {
  if (payment) window.sessionStorage.setItem(key, JSON.stringify(payment));
  else window.sessionStorage.removeItem(key);
  window.dispatchEvent(new Event(eventName));
}

export function parsePendingPayment(snapshot: string | null): PendingPayment | null {
  if (!snapshot) return null;
  try {
    const value = JSON.parse(snapshot) as PendingPayment;
    return typeof value.idOperacion === "string" && typeof value.monto === "number"
      && Number.isFinite(value.monto) && value.monto > 0
      && (value.observaciones === undefined || typeof value.observaciones === "string")
      && (value.idCuenta === undefined || typeof value.idCuenta === "string") ? value : null;
  } catch { return null; }
}
