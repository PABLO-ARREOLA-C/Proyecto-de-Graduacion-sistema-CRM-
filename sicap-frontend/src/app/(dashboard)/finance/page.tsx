"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DollarSign, TrendingUp, TrendingDown, Calendar } from "lucide-react";

export default function FinancePage() {
  // Datos mock (más adelante se conectarán con la API)
  const summary = {
    totalIncome: 12500,
    totalExpenses: 3200,
    netProfit: 9300,
    pendingInvoices: 1450,
  };

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Finanzas</h1>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Ingresos Totales</CardTitle>
            <DollarSign className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">Q {summary.totalIncome.toLocaleString()}</div>
            <p className="text-xs text-gray-500">+20% respecto al mes pasado</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Egresos</CardTitle>
            <TrendingDown className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">Q {summary.totalExpenses.toLocaleString()}</div>
            <p className="text-xs text-gray-500">+5% respecto al mes pasado</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Utilidad Neta</CardTitle>
            <TrendingUp className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">Q {summary.netProfit.toLocaleString()}</div>
            <p className="text-xs text-gray-500">Margen: {(summary.netProfit / summary.totalIncome * 100).toFixed(1)}%</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Cuentas por Cobrar</CardTitle>
            <Calendar className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">Q {summary.pendingInvoices.toLocaleString()}</div>
            <p className="text-xs text-gray-500">Próximos vencimientos: 5</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Ingresos por mes</CardTitle>
          </CardHeader>
          <CardContent>
            {/* Aquí podrías agregar una gráfica (por ejemplo con recharts) */}
            <div className="h-48 flex items-center justify-center text-gray-500">
              Gráfica de ingresos (próximamente)
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Gastos por categoría</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-48 flex items-center justify-center text-gray-500">
              Gráfica de gastos (próximamente)
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}