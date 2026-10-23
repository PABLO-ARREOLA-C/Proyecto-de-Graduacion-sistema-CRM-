export type ReportPeriod = { from: string; to: string };

export function guatemalaDay(value: string | Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Guatemala", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date(value));
}

export function inReportPeriod(value: string, period: ReportPeriod, dateOnly = false): boolean {
  const day = dateOnly ? value.slice(0, 10) : guatemalaDay(value);
  return (!period.from || day >= period.from) && (!period.to || day <= period.to);
}

export function sumMoney(values: Array<string | number>): number {
  return values.reduce<number>((total, value) => total + Math.round(Number(value) * 100), 0) / 100;
}

export function csvContent(headers: string[], rows: Array<Array<string | number>>): string {
  const escape = (value: string | number) => {
    let text = String(value);
    // Mantener los textos ingresados por usuarios como texto en hojas de calculo.
    if (typeof value === "string" && /^[\s]*[=+@-]/.test(text)) text = `'${text}`;
    return `"${text.replaceAll('"', '""')}"`;
  };
  return '\uFEFF' + [headers, ...rows].map((row) => row.map(escape).join(";")).join("\r\n");
}
