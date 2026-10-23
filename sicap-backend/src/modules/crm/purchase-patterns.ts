export interface PurchaseWeekday {
  idCliente: string;
  cliente: string;
  telefono: string;
  idProducto: string;
  producto: string;
  diaSemana: number;
  unidades: number;
  fechas: number;
  ultimaCompra: string;
}

export function guatemalaDay(now: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Guatemala',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

export function purchasePatterns(rows: PurchaseWeekday[], today: string) {
  const groups = new Map<string, PurchaseWeekday[]>();
  for (const row of rows) {
    const key = `${row.idCliente}:${row.idProducto}`;
    const group = groups.get(key) ?? [];
    group.push(row);
    groups.set(key, group);
  }
  const todayDate = new Date(`${today}T00:00:00Z`);
  const recentLimit = new Date(todayDate);
  recentLimit.setUTCDate(recentLimit.getUTCDate() - 28);
  const alerts = [...groups.values()].flatMap((group) => {
    const totalUnidades = group.reduce((sum, row) => sum + row.unidades, 0);
    const fechasCompra = group.reduce((sum, row) => sum + row.fechas, 0);
    const sorted = [...group].sort((a, b) => b.unidades - a.unidades);
    const peak = sorted[0];
    const ultimaCompra = group.reduce(
      (latest, row) => (row.ultimaCompra > latest ? row.ultimaCompra : latest),
      '',
    );
    if (
      !peak ||
      fechasCompra < 3 ||
      peak.fechas < 2 ||
      totalUnidades <= 0 ||
      peak.unidades / totalUnidades < 0.4 ||
      sorted[1]?.unidades === peak.unidades ||
      ultimaCompra < recentLimit.toISOString().slice(0, 10)
    )
      return [];
    const diasHastaCompra = (peak.diaSemana - todayDate.getUTCDay() + 7) % 7;
    const next = new Date(todayDate);
    next.setUTCDate(next.getUTCDate() + diasHastaCompra);
    return [
      {
        idCliente: peak.idCliente,
        cliente: peak.cliente,
        telefono: peak.telefono,
        idProducto: peak.idProducto,
        producto: peak.producto,
        diaSemana: peak.diaSemana,
        unidadesDia: peak.unidades,
        totalUnidades,
        fechasDia: peak.fechas,
        fechasCompra,
        promedioDia: Math.round((peak.unidades / peak.fechas) * 100) / 100,
        porcentaje: Math.round((peak.unidades / totalUnidades) * 100),
        ultimaCompra,
        proximaFecha: next.toISOString().slice(0, 10),
        diasHastaCompra,
      },
    ];
  });
  return alerts.sort(
    (a, b) =>
      a.diasHastaCompra - b.diasHastaCompra ||
      b.porcentaje - a.porcentaje ||
      a.cliente.localeCompare(b.cliente) ||
      a.idCliente.localeCompare(b.idCliente) ||
      a.idProducto.localeCompare(b.idProducto),
  );
}
