import api from "@/lib/axios";
import type { OrderStatus, SaleType } from "@/services/orderService";

export type PaymentStatus = "PENDIENTE" | "PARCIAL" | "PAGADO";
export interface ReceivableStatus {
  idCuenta: string;
  fechaVencimiento: string;
  estado: string;
  estadoCalculado: "PENDIENTE" | "VENCIDA" | "PAGADA";
}
export interface OrderBalance {
  idPedido: string;
  numeroPedido: string;
  fechaPedido: string;
  tipoVenta: SaleType;
  estadoPedido: OrderStatus;
  total: number;
  totalPagado: number;
  saldoPendiente: number;
  estadoPago: PaymentStatus;
  cuentaPorCobrar: ReceivableStatus | null;
}
export interface Payment {
  idPago: string;
  monto: string | number;
  fechaPago: string;
  observaciones: string | null;
  usuario: { idUsuario: string; nombre: string; correo: string };
}
export interface Receivable {
  idCuenta: string;
  idPedido: string;
  fechaVencimiento: string;
  montoOriginal: number;
  totalPagado: number;
  saldoPendiente: number;
  estadoCalculado: "PENDIENTE" | "VENCIDA" | "PAGADA";
  pedido: { numeroPedido: string; estado: OrderStatus; cliente: { nombre: string }; pagos: Payment[] };
}
export interface PaymentPayload { idOperacion: string; monto: number; observaciones?: string }

export interface ExpenseCategory {
  idCategoria: number;
  nombre: string;
  descripcion: string | null;
  estado: boolean;
}
export interface FinancialMovement {
  idMovimiento: string;
  tipo: "INGRESO" | "EGRESO";
  monto: number | string;
  concepto: string;
  descripcion: string | null;
  fechaMovimiento: string;
  categoria: ExpenseCategory | null;
  usuario: { idUsuario: string; nombre: string; correo: string };
}
export interface ExpensePayload {
  idCategoria: number;
  monto: number;
  concepto: string;
  descripcion?: string;
}

export const financeService = {
  getExpenseCategories: async () => {
    const { data } = await api.get<ExpenseCategory[]>("/finances/expense-categories");
    return data;
  },
  createExpenseCategory: async (payload: { nombre: string; descripcion?: string }) => {
    const { data } = await api.post<ExpenseCategory>("/finances/expense-categories", payload);
    return data;
  },
  updateExpenseCategory: async (id: number, payload: { nombre?: string; descripcion?: string; estado?: boolean }) => {
    const { data } = await api.patch<ExpenseCategory>(`/finances/expense-categories/${id}`, payload);
    return data;
  },
  getMovements: async () => {
    const { data } = await api.get<FinancialMovement[]>("/finances/movements");
    return data;
  },
  createExpense: async (payload: ExpensePayload) => {
    const { data } = await api.post<FinancialMovement>("/finances/expenses", payload);
    return data;
  },
  getOrders: async () => {
    const { data } = await api.get<{ pedidos: OrderBalance[] }>("/finances/orders/payment-status");
    return data;
  },
  getReceivables: async () => {
    const { data } = await api.get<Receivable[]>("/finances/receivables");
    return data;
  },
  getSummary: async (params?: { fechaInicio?: string; fechaFin?: string }) => {
    const { data } = await api.get<{
      ingresos: number; egresos: number; balance: number; cuentasPorCobrar: number;
      cuentasVencidas: number; cantidadCuentasVencidas: number;
    }>("/finances/summary", { params });
    return data;
  },
  getOrderStatus: async (id: string) => {
    const { data } = await api.get<{
      pedido: { idPedido: string; numeroPedido: string; tipoVenta: SaleType; estado: OrderStatus; total: number };
      totalPagado: number; saldoPendiente: number; estadoPago: PaymentStatus; cuentaPorCobrar: ReceivableStatus | null;
    }>(`/finances/orders/${id}/payment-status`);
    return data;
  },
  getPayments: async (id: string) => {
    const { data } = await api.get<{ pagos: Payment[] }>(`/finances/orders/${id}/payments`);
    return data;
  },
  createReceivable: async (payload: { idPedido: string; fechaVencimiento: string }) => {
    const { data } = await api.post<Receivable>("/finances/receivables", payload);
    return data;
  },
  payReceivable: async (id: string, payload: PaymentPayload) => {
    await api.post(`/finances/receivables/${id}/payments`, payload);
  },
  payCashOrder: async (id: string, payload: PaymentPayload) => {
    await api.post(`/finances/orders/${id}/payments`, payload);
  },
};
