import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, concatMap } from 'rxjs';
import { AuditService } from './audit.service';
import { auditInput, auditResult, objectValue } from './audit-data';

type AuditRequest = {
  method: string;
  path: string;
  body?: unknown;
  params: Record<string, string>;
  user?: { idUsuario: string };
};
const identifiers: Record<string, string> = {
  usuarios: 'idUsuario',
  clientes: 'idCliente',
  productos: 'idProducto',
  promociones: 'idPromocion',
  pedidos: 'idPedido',
  direcciones_cliente: 'idDireccion',
  rutas: 'idRuta',
  detalle_ruta: 'idDetalleRuta',
  entregas: 'idEntrega',
  incidencias: 'idIncidencia',
  cuentas_por_cobrar: 'idCuenta',
  pagos: 'idPago',
  categorias_egreso: 'idCategoria',
  movimientos_financieros: 'idMovimiento',
  prospectos: 'idProspecto',
  prospecto_producto: 'idProspectoProducto',
  interacciones_crm: 'idInteraccion',
  seguimientos_crm: 'idSeguimiento',
};

function entity(path: string) {
  const parts = path.split('/').filter(Boolean);
  if (parts[0] === 'auth' && parts[1] === 'login') return 'usuarios';
  if (parts[0] === 'users') return 'usuarios';
  if (parts[0] === 'clients')
    return parts.includes('addresses') ? 'direcciones_cliente' : 'clientes';
  if (parts[0] === 'client-portal')
    return parts[1] === 'addresses' ? 'direcciones_cliente' : 'clientes';
  if (parts[0] === 'products')
    return parts.includes('promotions') ? 'promociones' : 'productos';
  if (parts[0] === 'orders') return 'pedidos';
  if (parts[0] === 'logistics') {
    if (parts.includes('incidents')) return 'incidencias';
    if (parts.includes('deliveries')) return 'entregas';
    if (parts.includes('details') || parts.includes('orders'))
      return 'detalle_ruta';
    return 'rutas';
  }
  if (parts[0] === 'finances') {
    if (parts.includes('payments')) return 'pagos';
    if (parts.includes('receivables')) return 'cuentas_por_cobrar';
    if (parts.includes('expense-categories')) return 'categorias_egreso';
    if (parts.includes('expenses')) return 'movimientos_financieros';
  }
  if (parts[0] === 'crm') {
    if (parts.includes('products')) return 'prospecto_producto';
    if (parts.includes('interactions')) return 'interacciones_crm';
    if (parts.includes('follow-ups')) return 'seguimientos_crm';
    return 'prospectos';
  }
  return null;
}

function action(req: AuditRequest) {
  if (req.path === '/auth/login') return 'INICIO_SESION';
  if (req.path.endsWith('/client-profile')) return 'VINCULAR_FICHA';
  if (req.path.endsWith('/start')) return 'INICIAR_RUTA';
  if (req.path.endsWith('/complete')) return 'COMPLETAR_RUTA';
  if (req.path.endsWith('/move')) return 'MOVER_PARADA';
  if (req.path.endsWith('/payments')) return 'REGISTRAR_PAGO';
  if (req.path.endsWith('/status')) return 'CAMBIAR_ESTADO';
  if (req.method === 'DELETE')
    return req.path.includes('/logistics/') || req.path.includes('/crm/')
      ? 'RETIRAR'
      : 'DESACTIVAR';
  if (req.method === 'POST') return 'CREAR';
  const body = objectValue(req.body);
  if (typeof body.estado === 'boolean')
    return body.estado ? 'ACTIVAR' : 'DESACTIVAR';
  return 'ACTUALIZAR';
}

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AuditInterceptor.name);
  constructor(private readonly audit: AuditService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') return next.handle();
    const request = context.switchToHttp().getRequest<AuditRequest>();
    const req: AuditRequest = {
      method: request.method,
      path: request.path.replace(/\/+$/, ''),
      params: request.params ?? {},
      body: request.body,
      user: request.user,
    };
    if (!['POST', 'PATCH', 'PUT', 'DELETE'].includes(req.method))
      return next.handle();
    const table = entity(req.path);
    if (!table) return next.handle();
    return next.handle().pipe(
      concatMap(async (data: unknown) => {
        const result = objectValue(data);
        // Un reintento confirmado no representa otro ingreso ni otro pago.
        if (req.path.endsWith('/payments') && result.reutilizado === true)
          return data;
        const account = objectValue(result.usuario);
        const actor =
          req.user?.idUsuario ??
          (req.path === '/auth/login' && typeof account.idUsuario === 'string'
            ? account.idUsuario
            : undefined);
        if (!actor) return data;
        const idKey = identifiers[table];
        let recordId: unknown = result[idKey];
        if (recordId === undefined) {
          for (const nested of [
            'pago',
            'cuenta',
            'pedido',
            'usuario',
            'cliente',
            'movimiento',
          ]) {
            recordId = objectValue(result[nested])[idKey];
            if (recordId !== undefined) break;
          }
        }
        if (recordId === undefined)
          recordId =
            req.params.promotionId ??
            req.params.addressId ??
            req.params.detailId ??
            req.params.deliveryId ??
            req.params.followUpId ??
            req.params.relationId ??
            req.params.id;
        try {
          await this.audit.record({
            idUsuario: actor,
            accion: action(req),
            tablaAfectada: table,
            registroId:
              typeof recordId === 'string' || typeof recordId === 'number'
                ? String(recordId).slice(0, 100)
                : null,
            datosNuevos: {
              solicitud: auditInput(
                req.body,
                table === 'usuarios' && req.path !== '/auth/login',
              ),
              resultado: auditResult(data),
            },
          });
        } catch {
          // La operacion ya fue guardada: no devolver un fallo que provoque repetir pagos u otras escrituras.
          this.logger.error(
            `No se pudo guardar el evento ${req.method} de ${table}`,
          );
        }
        return data;
      }),
    );
  }
}
