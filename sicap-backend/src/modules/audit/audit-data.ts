import { Prisma } from '@prisma/client';

const allowed = new Set([
  'nombre',
  'codigo',
  'correo',
  'telefono',
  'nit',
  'estado',
  'precioActual',
  'descripcion',
  'observaciones',
  'direccion',
  'referencia',
  'zona',
  'latitud',
  'longitud',
  'idRol',
  'idCliente',
  'idUsuario',
  'idProducto',
  'idPedido',
  'idRepartidor',
  'idDireccion',
  'idDetalleRuta',
  'idDetallePedido',
  'cantidad',
  'cantidadEntregada',
  'cantidadRequerida',
  'cantidadBonificada',
  'fecha',
  'fechaInicio',
  'fechaFin',
  'fechaVencimiento',
  'horaEstimada',
  'direction',
  'ordenParada',
  'tipo',
  'tipoVenta',
  'monto',
  'concepto',
  'interes',
  'prioridad',
]);
const ids = [
  'idUsuario',
  'idCliente',
  'idProducto',
  'idPromocion',
  'idPedido',
  'idRuta',
  'idDetalleRuta',
  'idEntrega',
  'idPago',
  'idCuenta',
  'idMovimiento',
  'idCategoria',
  'idProspecto',
  'idProspectoProducto',
  'idInteraccion',
  'idSeguimiento',
  'idIncidencia',
  'idDireccion',
];
export function objectValue(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function scalar(value: unknown): Prisma.InputJsonValue | null | undefined {
  if (value === null) return null;
  if (typeof value === 'string') return value.slice(0, 1000);
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  return undefined;
}

export function auditInput(
  value: unknown,
  userChange = false,
): Prisma.InputJsonObject {
  const input = objectValue(value);
  const result: Record<string, Prisma.InputJsonValue | null> = {};
  for (const [key, value] of Object.entries(input)) {
    const parsed = scalar(value);
    if (allowed.has(key) && parsed !== undefined) result[key] = parsed;
  }
  if (Array.isArray(input.detalles)) {
    result.detalles = input.detalles
      .slice(0, 100)
      .map((detail: unknown) => auditInput(detail));
    if (input.detalles.length > 100)
      result.detallesOmitidos = input.detalles.length - 100;
  }
  if (
    userChange &&
    typeof input.password === 'string' &&
    input.password.length > 0
  )
    result.contrasenaModificada = true;
  return result;
}

export function auditResult(value: unknown): Prisma.InputJsonObject {
  const input = objectValue(value);
  const result: Record<string, Prisma.InputJsonValue | null> = {};
  for (const key of [
    ...ids,
    'estado',
    'numeroPedido',
    'codigoRuta',
    'numeroIntento',
    'saldoPendiente',
    'totalPagado',
  ]) {
    const parsed = scalar(input[key]);
    if (parsed !== undefined) result[key] = parsed;
  }
  for (const key of [
    'pago',
    'cuenta',
    'pedido',
    'usuario',
    'cliente',
    'movimiento',
  ]) {
    if (input[key] && typeof input[key] === 'object')
      result[key] = auditResult(input[key]);
  }
  return result;
}

// Proteccion adicional para datos historicos escritos por otros procesos.
export function redactAuditData(value: Prisma.JsonValue): Prisma.JsonValue {
  if (Array.isArray(value)) return value.map(redactAuditData);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        /password|hash|token|authorization|secret|cookie|credential|contrase[ñn]a/i.test(
          key,
        ) && key !== 'contrasenaModificada'
          ? '[OCULTO]'
          : redactAuditData(item ?? null),
      ]),
    );
  }
  return value;
}
