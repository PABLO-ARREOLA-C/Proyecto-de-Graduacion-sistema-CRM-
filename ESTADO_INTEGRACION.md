# Estado de integracion backend y frontend de SICAP

Fecha de actualizacion: 22 de octubre de 2026.

## Punto actual: alertas de compra habitual dentro del CRM

El usuario solicito alertas dentro del CRM para identificar el dia de la semana en que cada cliente suele comprar mas unidades de cada producto, y confirmo ese alcance. Se implemento el panel; pendiente de validacion en pantalla.

- Nuevo panel Alertas de compra habitual en /crm, separado del listado de prospectos. Analiza clientes existentes con pedidos; no asocia prospectos con clientes por nombre, telefono o correo.
- Muestra cliente, telefono, producto, dia de mayor compra, promedio de unidades por fecha con compra, cantidades y porcentaje que respaldan el patron, ultima compra y proxima fecha habitual. Destaca Hoy/Manana y sugiere anticipar el contacto.
- Analiza solo pedidos ENTREGADOS de clientes y productos activos. El dia corresponde a fechaPedido (registro de compra) en America/Guatemala, no a fecha solicitada de entrega ni a medicion de consumo real. Excluye fechas futuras, pedidos cancelados y pendientes.
- Historial seleccionable de 30/90/180 dias, por defecto 90. Para mostrar un patron exige al menos 3 fechas distintas de compra del mismo cliente/producto, al menos 2 en el dia destacado, 40% de las unidades o mas y un unico dia ganador. Requiere compra del producto en los ultimos 28 dias. Las compras de la misma fecha suman unidades pero cuentan como una sola fecha.
- Nuevo GET /crm/purchase-alerts con JWT y RolesGuard. Administrador consulta el historial general; Repartidor solo pedidos con entrega ENTREGADO realizada por el usuario autenticado. No acepta identificador de propietario enviado por el cliente.
- Agrupacion por cliente/producto/dia en PostgreSQL con SQL parametrizado. Deteccion, filtros por dia y paginacion de 25 alertas en backend; busqueda literal por cliente/producto. El navegador recibe patrones y sus fundamentos, no colecciones completas de pedidos.
- Actualizacion automatica cada minuto mientras el CRM esta abierto, al volver a la ventana y mediante Actualizar. Estados de carga, fallo con reintento y sin historial suficiente. No envia correos, WhatsApp ni notificaciones con el sistema cerrado; no registra seguimientos o contactos automaticamente.
- Sin migraciones ni cambios en datos comerciales. Son reglas descriptivas sobre compras historicas; no garantizan pedidos futuros ni estiman inventario o consumo fisico.
- Verificacion: build backend y TypeScript backend/frontend correctos; ESLint de archivos modificados correcto. 155 pruebas correctas en 11 suites; 26 nuevas de patrones, horario de Guatemala, datos insuficientes/empates, vigencia, permisos HTTP con identidades simuladas, filtros, busqueda parametrizada y paginacion.
- PostgreSQL real: test/crm-alerts.database-check.ts crea fixtures dentro de una transaccion, verifica cantidades/dia, exclusion de cancelados/pendientes, acceso del repartidor propio/ajeno y clientes/productos inactivos; revierte todos los fixtures al terminar. No deja alertas ni clientes ficticios. Ejecutar desde sicap-backend: npx.cmd ts-node --transpile-only test/crm-alerts.database-check.ts.
- Prueba manual pendiente: cargar el backend actualizado, recargar CRM y consultar el panel. Probar periodos, dia, busqueda, Actualizar y perfiles Administrador/Repartidor. Una lista vacia es esperable si los pedidos reales aun no cumplen los minimos; no se agregaron ventas de demostracion. No se realizo prueba de este panel en navegador.
- Siguen pendientes los productos de interes en pantalla de prospectos y las mejoras previas de numeracion concurrente y sesiones vencidas. La validacion manual del cambio de tipo de venta anterior tampoco fue confirmada individualmente.

## Revision anterior: consistencia del tipo de venta de pedidos

El usuario confirmo que la proteccion de pagos funciona excelente y autorizo avanzar. Se implemento el bloqueo de cambios de tipo de venta con actividad financiera; pendiente de validacion de la pantalla actualizada.

- Cambiar CONTADO/CREDITO se permite unicamente si el pedido no tiene pagos ni cuenta por cobrar. Mantener el mismo tipo o editar otros datos conserva las reglas anteriores (no se editan pedidos ENTREGADOS/CANCELADOS y la direccion debe pertenecer al cliente).
- Backend consulta el pedido, sus pagos y cuenta y guarda la edicion dentro de una transaccion Serializable. Reintenta conflictos hasta tres veces, releyendo los datos; si persisten devuelve 409.
- Crear cuenta por cobrar tambien realiza sus consultas y escritura dentro de una transaccion Serializable para coordinarse con cambios concurrentes del pedido. Rechaza pedidos sin saldo pendiente y convierte duplicados concurrentes de cuenta en 409. No se crean o eliminan pagos ni cuentas automaticamente al cambiar el tipo de venta.
- El formulario de edicion consulta el estado financiero y bloquea Tipo de venta si existen pagos/cuenta, mientras carga la consulta o si falla. Explica el motivo y permite reintentar la consulta. Los demas campos siguen disponibles segun las reglas existentes.
- La edicion omite tipoVenta cuando no cambia o esta bloqueado. Guardar actualiza las consultas de Pedidos y Finanzas; errores de edicion refrescan el estado financiero.
- Sin cambios de esquema ni migraciones. No se corrigieron retroactivamente posibles inconsistencias antiguas ni se ampliaron reglas de cancelacion o devoluciones.
- Verificacion: build backend correcto, TypeScript backend/frontend correcto y ESLint de archivos modificados correcto. Suite: 129 pruebas correctas en 10 suites; 17 nuevas cubren cambios permitidos/bloqueados, otras ediciones, restricciones anteriores, relectura ante conflicto y cuentas sin saldo/duplicadas.
- Se amplio test/payments.database-check.ts: cambios antes/despues de pagos/cuenta, edicion de observaciones, creacion de cuenta sin saldo y carreras entre cambio de tipo y pago/creacion de cuenta. HTTP con JWT real de prueba verifica rechazo 400 de conversiones incompatibles y aceptacion 200 de otras ediciones. Esquema de prueba aislado eliminado al finalizar; sin cambios en datos comerciales de public.
- Prueba manual pendiente: en Pedidos, editar uno sin pagos/cuenta y comprobar que permite cambiar el tipo; editar otro con abono o cuenta y verificar el selector bloqueado y la explicacion. Confirmar que se guardan observaciones/direccion/fecha cuando corresponde. No se realizo prueba de este formulario en navegador.
- Siguiente mejora propuesta: numeracion concurrente de pedidos y rutas; despues, manejo de sesiones vencidas.

## Revision anterior: pagos concurrentes y reintentos protegidos

El usuario autorizo continuar despues de permisos de rutas e indico que levanto el sistema para pruebas. Se implemento la proteccion de pagos de contado y abonos de credito. Despues confirmo que funciona excelente y autorizo continuar.

- Saldo, estado del pedido, cuenta y usuario se consultan dentro de la misma transaccion Serializable que crea pago, ingreso y actualiza cuenta. Se usa Decimal para calcular los importes.
- Conflictos de serializacion y colisiones de clave reintentan hasta tres transacciones; si persisten, respuesta 409 sin dejar un pago parcial. Se contempla P2034, P2002 y TransactionWriteConflict del adaptador pg al confirmar.
- Ambos POST de pagos requieren idOperacion UUID. Se guarda como idPago en la tabla existente: no hay nueva migracion. Reutilizarlo con mismo pedido, actor, monto y observaciones devuelve el pago existente; con otros datos devuelve 409.
- La respuesta incluye reutilizado. En reintentos confirmados movimiento es null, los saldos corresponden a la consulta actual y no se crea otro ingreso ni otro evento de Auditoria. Un pago nuevo conserva pago y movimiento en la respuesta.
- PaymentDetail, compartido por Finanzas y Pedidos, genera el identificador y guarda la operacion en sessionStorage por usuario/pedido antes de enviarla. Si no se confirma el resultado, muestra Confirmar pago pendiente y bloquea nuevos cobros en ese dialogo hasta resolverlo. Recargar o cerrar/reabrir el dialogo en la misma pestana conserva la operacion; cerrar la pestana o borrar su almacenamiento no garantiza esa recuperacion.
- Errores definitivos 400/403/404/422 liberan el formulario. Fallos de red, 401, 409 y errores de servidor conservan la operacion para repetir la misma solicitud.
- API y frontend deben actualizarse juntos; consumidores externos deben incluir idOperacion y conservarlo al reintentar. No sustituirlo por uno nuevo si se desconoce el resultado anterior.
- Verificacion: build backend correcto; TypeScript completo de backend/frontend correcto; ESLint de archivos modificados correcto; 112 pruebas correctas en 9 suites (14 nuevas de pagos/auditoria).
- PostgreSQL real: test/payments.database-check.ts crea un esquema aislado con copias de estructura y lo elimina al terminar. Prueba sobrepagos simultaneos, duplicados simultaneos/secuenciales, pagos parciales concurrentes, colisiones entre actores/pedidos/montos y rollback ante fallo del ingreso. No modifica datos comerciales de public.
- El mismo script prueba endpoints HTTP con JWT real firmado con clave temporal, estrategia JWT y consultas a PostgreSQL: 401 sin token, 400 sin idOperacion, alta correcta, repeticion sin duplicado y 409 ante cambio de monto, tanto para contado como credito. No utiliza credenciales reales ni prueba el formulario en navegador.
- Para repetir la prueba aislada: desde sicap-backend, npx.cmd ts-node --transpile-only test/payments.database-check.ts. No ejecutar seed ni migraciones.
- Prueba manual pendiente: recargar frontend actualizado, registrar un abono desde Finanzas o Pedidos y verificar saldo, historial e ingreso. Ante respuesta perdida, confirmar la operacion pendiente y comprobar que no aparezca un segundo cobro.
- Siguiente mejora propuesta: impedir cambios de tipo de venta incompatibles con pagos/cuentas existentes; siguen pendientes numeracion concurrente y sesiones vencidas. El aislamiento de cobros por repartidor no se modifico.

## Revision posterior a la auditoria: permisos de rutas

El usuario autorizo avanzar con las mejoras de la auditoria. Se implemento primero el aislamiento de rutas en backend. Despues respondio ok y autorizo continuar con pagos; no detallo pruebas individuales de rutas.

- GET /logistics/routes devuelve solo rutas propias para Repartidor; Administrador conserva el listado general.
- Nuevo RouteAccessGuard, ejecutado despues de JWT y RolesGuard, verifica propietario en todos los endpoints de rutas con parametro :id: detalle, edicion, agregar/retirar pedidos, mover/editar paradas, iniciar/completar y registrar entrega.
- Repartidor solo puede crear rutas para si mismo y conservar su asignacion al editar. Asignar otro repartidor requiere Administrador.
- Entregas e incidencias conservan ademas sus verificaciones existentes de propietario en el servicio. No se ampliaron permisos administrativos para iniciar rutas o registrar entregas.
- Sin cambios de esquema ni migraciones. El control HTTP no sustituye bloqueo transaccional ante una reasignacion concurrente; ese caso no se verifico contra PostgreSQL.
- Verificacion: backend compila; 98 pruebas correctas en 8 suites, incluyendo 27 nuevas HTTP con identidades simuladas. Las pruebas HTTP comprueban la conexion del guard, rechazo de rutas ajenas, listado por propietario, asignacion, acceso administrativo y roles. No reemplazan JWT real ni prueba de navegador.
- Probar con dos repartidores: cada uno debe ver solo sus rutas; consultar o modificar por API una ruta ajena debe devolver 403. Administrador debe poder consultar y reasignar rutas.
- Siguiente mejora propuesta: proteger pagos simultaneos y reintentos duplicados; despues, validar cambios de tipo de venta con pagos/cuentas existentes, numeracion concurrente y vencimiento de sesion. No estan implementadas en este paso.

Las secciones siguientes conservan el historial de integracion anterior. Las referencias historicas al alcance general de rutas quedan sustituidas por esta revision; el aislamiento de otros modulos, como cobros, sigue pendiente de definir.

## Historial: punto de integracion antes de la auditoria del proyecto

El usuario confirmo que Reportes funciona y solicito continuar con Auditoria. La ultima funcionalidad implementada es Auditoria (paso 19), pendiente de validacion en pantalla. Su ultima solicitud fue actualizar este documento; no ha confirmado todavia la prueba de Auditoria.

| Area | Estado al cierre |
| --- | --- |
| Planificacion de rutas | Agregar/retirar pedidos, ordenar paradas, editar ruta y horas estimadas validados |
| Entregas | Usuario confirmo entrega y finalizacion de ruta; incidencias/reintentos sin confirmacion individual |
| Ruta del dia | Implementada; acceso a Crear ruta validado; falta confirmacion individual del resto de controles de esa vista |
| Finanzas | Cobros, cuentas, abonos, pagos, gastos, categorias, movimientos, filtros del resumen y cobros desde Pedidos validados |
| Productos | Creacion, edicion y baja logica aceptadas por el usuario |
| Usuarios | Pantalla implementada; usuario confirmo crear una cuenta Cliente; otras operaciones sin confirmacion individual |
| Inicio/Dashboard | Vistas administrativas y de repartidor aceptadas; inicio del cliente conectado al portal validado |
| Portal del cliente | El usuario confirmo funcionamiento correcto del portal |
| Promociones | Administracion por producto validada por el usuario; bonificaciones automaticas no implementadas |
| Reportes | El usuario confirmo su funcionamiento |
| Auditoria | Pantalla administrativa y registro de nuevas operaciones exitosas implementados; pendiente de prueba |

### Proxima accion concreta

1. Reiniciar el backend si no cargo los nuevos modulo e interceptor de Auditoria.
2. Realizar una operacion de prueba desde el sistema (por ejemplo editar un producto) y consultar Administrador -> Auditoria -> Actualizar.
3. Verificar usuario, fecha, accion, entidad y detalle; probar filtros, busqueda y paginacion. No esperar eventos de operaciones anteriores a la activacion del registro.
4. Esperar validacion antes de avanzar a otro modulo. Las bonificaciones de Promociones no se aplican automaticamente a ventas; ese alcance requiere acuerdo separado.

### Arranque y comprobaciones al retomar

- Backend, desde sicap-backend: npm run start:dev. Puerto predeterminado 3000.
- Frontend, desde sicap-frontend: npm run dev. Se ha utilizado http://localhost:3001; confirmar el puerto que anuncie Next.js al arrancar.
- En PowerShell con restriccion de scripts, usar npm.cmd o npx.cmd para los mismos comandos.
- Backend, compilacion: npm.cmd run build.
- Backend, suite completa: npm.cmd run test -- --runInBand. Ultimo resultado: 71 pruebas correctas, 7 suites.
- Frontend, tipos: npx.cmd tsc --noEmit --incremental false.
- Frontend, pruebas de reportes: node --experimental-strip-types --test test/report-utils.test.mjs. Ultimo resultado: 7 correctas.
- Verificacion opcional de auditoria en PostgreSQL: npx.cmd ts-node --transpile-only test/audit.database-check.ts desde sicap-backend. Crea fixtures dentro de una transaccion y los revierte al terminar; no reemplaza la prueba manual de la pantalla.
- No volver a ejecutar el seed, recrear migraciones ni reiniciar la base de datos para probar Auditoria. La tabla ya existia y no hubo migracion nueva en ese paso.

### Ultimas verificaciones y base de datos

- Backend: compilacion correcta y ultima suite completa con 71 pruebas correctas en 7 suites, incluyendo 17 nuevas de Auditoria.
- Frontend: TypeScript sin errores; ESLint de archivos modificados correcto. Reportes agrega 7 pruebas correctas de fechas, sumas y CSV, ejecutadas con node --experimental-strip-types --test test/report-utils.test.mjs. No se ejecuto build de produccion del frontend ni prueba manual de descarga CSV en navegador.
- Migracion 20261017000000_client_portal_link aplicada en la base PostgreSQL local rehobot_crm; agrega Cliente.idUsuario opcional y unico con clave foranea. No hay que volver a crear esta migracion ni reiniciar la base de datos.
- Prisma Client regenerado. Para otro entorno, aplicar las migraciones existentes y generar su cliente antes de arrancar.
- Prueba adicional real de PostgreSQL: consulta de datos propios y rechazo de pedido ajeno, con fixtures revertidos al finalizar. La migracion permanece aplicada; no se dejaron cuentas, pedidos ni pagos temporales de esa prueba.
- Las 14 pruebas nuevas de portal/vinculacion incluyen pruebas HTTP con identidades simuladas; no sustituyen una prueba de inicio de sesion con JWT real.
- Auditoria: verificacion adicional real contra PostgreSQL con producto/usuario/evento temporales, todos revertidos al finalizar. Sin nueva migracion: se reutiliza la tabla auditoria existente.
- El registro de Auditoria empieza al cargar el backend actualizado: no hay reconstruccion de operaciones anteriores. Las pruebas dejaron la tabla sin eventos ficticios; una lista inicialmente vacia no confirma un error.
- Los cambios de esta sesion permanecen en el espacio de trabajo. No se realizo commit, push ni despliegue.

## Forma de trabajo acordada

- Trabajar paso a paso.
- Antes de modificar codigo, explicar al usuario los cambios y esperar su aprobacion.
- Despues de implementar, verificar y permitir que el usuario pruebe antes de avanzar.
- No asumir aprobacion de funcionalidades futuras.

## Avances realizados

### 1. Agregar pedidos a una ruta: validado por el usuario

- Selector de pedidos en el detalle de rutas PLANIFICADAS.
- Excluye pedidos ENTREGADOS, CANCELADOS o asignados a rutas PLANIFICADAS / EN_CURSO.
- Agrega al final con orden calculado automaticamente.
- Actualiza consultas logisticas y de pedidos; muestra confirmaciones y errores.
- Usa orderService.getAll y routeService.addOrder existentes.
- Archivos: sicap-frontend/src/components/routes/AddRouteOrderForm.tsx y sicap-frontend/src/app/(dashboard)/routes/page.tsx.
- TypeScript y ESLint pasaron. El usuario probo la asignacion y confirmo que funciona.

### 2. Retirar pedidos de una ruta: validado por el usuario

- Boton Retirar en las paradas de rutas PLANIFICADAS.
- Solicita confirmacion; retira la asignacion sin eliminar el pedido.
- Actualiza las consultas logisticas, que tambien actualizan los pedidos disponibles del selector.
- Bloquea retiros repetidos e inicio de ruta mientras procesa.
- Usa routeService.removeOrder existente.
- El backend rechaza retirar paradas que tengan intentos de entrega.
- Archivo: sicap-frontend/src/app/(dashboard)/routes/page.tsx.
- TypeScript y ESLint pasaron. El usuario confirmo que funciona.

### 3. Subir y bajar paradas: validado por el usuario

El usuario confirmo que el problema de acceso se resolvio y que Subir/Bajar funciona. No se aplicaron los cambios propuestos a allowedDevOrigins ni al formulario de acceso.

El usuario aprobo cambios en frontend y backend.

- Botones Subir y Bajar en rutas PLANIFICADAS.
- Intercambia con la parada vecina segun ordenParada, incluso si hay saltos de numeracion.
- Desactiva controles durante el guardado y en los extremos de la lista.
- Nuevo endpoint: POST /logistics/routes/:id/details/:detailId/move.
- Cuerpo: { "direction": "UP" } o { "direction": "DOWN" }.
- DTO valida la direccion; parametros de ruta validados como UUID.
- Backend exige ruta planificada y que la parada pertenezca a ella.
- Intercambio dentro de una transaccion Prisma con aislamiento Serializable.
- Usa una posicion positiva temporal libre para respetar la unicidad de (idRuta, ordenParada).
- Ante conflictos Prisma P2034 o P2002 devuelve un error de conflicto para actualizar y reintentar.
- No se modifico el esquema de la base de datos.

Archivos agregados:

- sicap-backend/src/modules/logistics/dto/move-route-stop.dto.ts
- sicap-backend/src/modules/logistics/logistics.service.spec.ts

Archivos modificados:

- sicap-backend/src/modules/logistics/logistics.controller.ts
- sicap-backend/src/modules/logistics/logistics.service.ts
- sicap-frontend/src/services/routeService.ts
- sicap-frontend/src/app/(dashboard)/routes/page.tsx

Verificaciones realizadas:

- Backend: npm run build correcto.
- Backend: 10 pruebas unitarias de logistics.service.spec.ts correctas.
- Pruebas cubren movimientos en ambas direcciones, saltos de numeracion, limites, estados no permitidos, parada ajena y fallos simulados en escrituras.
- Las pruebas usan una transaccion simulada; NO prueban rollback ni concurrencia contra PostgreSQL real.
- Frontend: npx tsc --noEmit --incremental false correcto.
- ESLint de archivos modificados del frontend y backend correcto.

### 4. Editar rutas planificadas: validado por el usuario

El usuario aprobo implementar la edicion de nombre, fecha, repartidor y observaciones. Las horas estimadas quedan para un paso posterior.

- Boton Editar ruta en el detalle de rutas PLANIFICADAS.
- Administrador puede cambiar el repartidor; el repartidor puede editar su propia ruta conservando su asignacion.
- Reutiliza el formulario de creacion con los datos actuales y routeService.update (PATCH existente).
- Permite vaciar observaciones y las muestra en el detalle.
- Bloquea formulario y cierre durante el guardado; actualiza listado y detalle, con mensajes de exito y error.
- No se modifico el backend en este paso. La restriccion a PLANIFICADAS corresponde a esta pantalla; el endpoint existente tambien permite editar rutas EN_CURSO.
- Archivo: sicap-frontend/src/app/(dashboard)/routes/page.tsx.
- Verificacion: TypeScript y ESLint correctos.
- El usuario confirmo este paso como listo y solicito continuar. Siguiente propuesta: horas estimadas por parada.

### 5. Horas estimadas por parada: validado por el usuario

El usuario aprobo asignar, editar y quitar la hora estimada.

- Cada parada muestra la hora guardada o Sin asignar; rutas PLANIFICADAS incluyen campo de hora, Guardar hora y Quitar hora.
- Actualiza listado y detalle, informa exito o error y bloquea movimientos, retiros e inicio mientras guarda la hora.
- Mantiene el formato HH:mm sin aplicar conversion de zona horaria a la hora almacenada.
- PATCH de detalle admite horaEstimada: null para borrar la hora; omitir el campo conserva el valor. No cambia el esquema de base de datos.
- Archivos: routes/page.tsx, routeService.ts, update-route-detail.dto.ts, logistics.service.ts y logistics.service.spec.ts.
- Verificacion: TypeScript frontend, compilacion backend y ESLint de archivos modificados correctos. Las 23 pruebas unitarias pasan, incluyendo formato de hora, limites y eliminacion con null; no se realizo prueba contra PostgreSQL real.
- El usuario confirmo este paso como listo. Planificacion de rutas prevista completada; siguiente paso propuesto: registrar entregas e incidencias, con aprobacion de alcance antes de modificar codigo.

### 6. Entregas e incidencias: flujo de entrega validado por el usuario

El usuario aprobo conectar la pantalla de entregas y las operaciones existentes del backend.

- Nueva pagina /deliveries, accesible desde el enlace Entregas existente para Administrador y Repartidor.
- Selector de rutas, paradas ordenadas, cliente, direccion, productos, cantidades y hora estimada.
- Administrador consulta; repartidor asignado registra en rutas EN_CURSO. Las restricciones de escritura por usuario ya existen en backend.
- Registrar intento guarda cantidades por producto (enteros entre cero y lo solicitado) y observaciones; despues se finaliza como ENTREGADO o NO_ENTREGADO con confirmacion.
- ENTREGADO exige todos los productos completos en ese intento, segun la regla actual del backend. No se implemento acumulacion de entregas parciales entre intentos.
- NO_ENTREGADO deja la parada pendiente y permite reintentar. Una parada pendiente impide completar la ruta, segun la regla existente.
- Historial de intentos y cantidades, recuperacion de intentos pendientes al recargar y registro/consulta de incidencias por intento.
- La consulta de rutas ahora incluye entregas con detalles e incidencias. No se modifico el esquema ni las reglas de finalizacion.
- Archivos: sicap-frontend/src/app/(dashboard)/deliveries/page.tsx, sicap-frontend/src/services/routeService.ts y sicap-backend/src/modules/logistics/logistics.service.ts.
- Verificacion: TypeScript frontend, ESLint de archivos modificados y compilacion backend correctos. Las 23 pruebas existentes pasan; no constituyen pruebas del nuevo flujo de entregas en navegador ni contra PostgreSQL real.
- El usuario confirmo que funciono el flujo para entregar y completar la ruta. No detallo validacion separada de incidencias y reintentos.
- En este paso aun se filtraba al repartidor en frontend. El paso 7 agrego /my-route y la consulta propia de rutas utilizada tambien por Entregas.

### 7. Ruta del dia: implementado, pendiente de validacion del usuario

- Nueva pagina /my-route para repartidores, usando el enlace Ruta del dia existente.
- Fecha inicial de Guatemala, selector de fecha y boton Actualizar. Muestra rutas de esa fecha y todas las rutas EN_CURSO, aunque sean de otro dia.
- Paradas ordenadas, productos, cliente, telefono, direccion, referencia, hora estimada y progreso.
- Inicio con pedidos CONFIRMADOS; indica pedidos que bloquean el inicio y enlaza a Pedidos.
- Acceso a Entregas con la ruta preseleccionada y regreso a Ruta del dia. Completar ruta se habilita cuando todas sus paradas estan completadas.
- Nuevo GET /logistics/my-routes restringido a Repartidor; filtra por idUsuario de la sesion JWT en backend, sin recibir un identificador de repartidor desde el cliente.
- Entregas tambien usa esa consulta para sesiones de repartidor. El endpoint general /logistics/routes conserva su alcance anterior; no se implemento aislamiento global en otros endpoints.
- Archivos: my-route/page.tsx, deliveries/page.tsx, routeService.ts, logistics.controller.ts, logistics.service.ts y logistics.service.spec.ts.
- Verificacion: TypeScript, ESLint, compilacion backend y 24 pruebas correctos. Nueva prueba verifica la consulta por el usuario autenticado. Falta validacion del flujo en navegador por el usuario.

### 8. Crear ruta desde el perfil de repartidor: validado por el usuario

- El usuario aprobo agregar el acceso que faltaba en Ruta del dia.
- Boton Crear ruta en /my-route enlaza a /routes?create=1, que abre automaticamente el formulario existente.
- Conserva la asignacion automatica al usuario repartidor y las operaciones existentes de creacion y planificacion.
- Archivos: my-route/page.tsx y routes/page.tsx. TypeScript y ESLint correctos.
- El usuario confirmo este paso como listo.

### 9. Finanzas: cobros, cuentas por cobrar y pagos validados por el usuario

El usuario aprobo continuar con Finanzas. Se conecto la primera etapa de cuentas por cobrar, abonos y pagos.

- Se reemplazaron datos de ejemplo de /finance por consultas reales.
- Servicio financeService con estado de pago por pedido, cuentas por cobrar, resumen, creacion de cuenta, pagos al contado, abonos a credito e historial.
- Acceso desde el menu para Administrador y Repartidor, conforme a los permisos existentes del backend. Resumen de ingresos, egresos y balance exclusivo del Administrador, de todo el historial.
- Listado con total, pagado, saldo, estado de pago y vencimiento; filtros por venta, estado, cuentas y cuentas vencidas; busqueda por numero de pedido y cliente de cuenta.
- Nueva cuenta solo para pedidos a credito, no cancelados, sin cuenta previa y con saldo pendiente. Fecha minima de hoy en Guatemala.
- Ver pagos / Cobrar muestra saldo actualizado, historial con usuario y fecha, y formulario de pago o abono. Pagos al contado usan endpoint de pedido; credito usa endpoint de cuenta.
- Valida monto positivo, maximo dos decimales y limite del saldo; pide confirmacion, bloquea formulario y cierre mientras guarda y actualiza consultas financieras y de pedidos.
- No permite pagar pedidos cancelados ni saldos agotados. Para credito exige crear primero una cuenta por cobrar.
- Correccion backend necesaria: vencimientos DATE comparados sin desplazarlos al dia anterior por zona horaria. Hoy se determina en America/Guatemala; se aceptan vencimientos de hoy y se rechazan fechas invalidas o pasadas.
- Archivos: finance/page.tsx, services/financeService.ts, components/layout/sidebar.tsx, finances.service.ts y finances.service.spec.ts.
- Verificacion: TypeScript frontend, ESLint de archivos modificados y compilacion backend correctos. Siete pruebas nuevas de fechas pasan, incluyendo cambio de dia en Guatemala y vencimientos de ayer/hoy/manana.
- No se registraron operaciones financieras reales durante las verificaciones. No se realizo prueba en navegador ni con PostgreSQL real.
- El usuario confirmo que Finanzas funciono y solicito conectar Inicio y Dashboard con datos reales. No detallo pruebas individuales de cada caso.
- Las consultas de cobros conservan el alcance general por rol del backend; no se agrego aislamiento de cobros por repartidor. No se modificaron reglas de pago ni transacciones existentes.
- Esta etapa se completo posteriormente con categorias/egresos/movimientos (paso 11), filtro de fechas (paso 12) y acceso a pagos desde Pedidos (paso 13).

### 10. Inicio y Dashboard con datos reales: aceptado por el usuario

El usuario solicito trabajar Inicio y Dashboard con datos reales. Ambos enlaces llevan a /dashboard, que muestra contenido segun el perfil; la raiz / conserva su redireccion autenticada a esa pagina.

- Administrador: clientes activos reales, pedidos no cancelados programados para hoy segun fecha solicitada, ingresos de hoy y saldo global de cuentas por cobrar.
- Fecha de referencia en America/Guatemala. El resumen financiero recibe fechaInicio y fechaFin para los ingresos diarios; las cuentas por cobrar siguen siendo el saldo global segun contrato del backend.
- Pedidos recientes: los cinco mas recientes con cliente, total y estado. Rutas de hoy y todas las EN_CURSO, con repartidor, paradas completadas y porcentaje real.
- Repartidor: consulta /logistics/my-routes para obtener solo sus rutas. Cuenta pedidos unicos asignados/entregados/pendientes de rutas de hoy y EN_CURSO, excluyendo rutas y paradas canceladas. Accesos a Ruta del dia y registro de entregas.
- Datos sincronizados mediante las claves de consultas de clientes, pedidos, logistica y finanzas existentes; actualizacion cada minuto, al volver a la ventana y con boton Actualizar. Cambio automatico de fecha al llegar la medianoche de Guatemala.
- Estados de carga, error con reintento y listas vacias; los fallos no se presentan como contadores de cero.
- Se retiraron cifras y etiquetas de demostracion de todos los perfiles. En este paso Cliente mostraba solo datos de sesion; el paso 16 agrego vinculo autorizado con su ficha y datos reales de pedidos. No se infirio pertenencia por correo ni se ampliaron permisos de acceso a pedidos globales.
- Archivos: dashboard/page.tsx, components/dashboard/LiveDashboard.tsx, services/financeService.ts y finance/page.tsx (ajuste de llamada del resumen).
- Verificacion: TypeScript frontend, ESLint de los archivos modificados y diff --check correctos. No se realizo prueba autenticada en navegador ni se modifico informacion de la base de datos.
- El usuario respondio ok y solicito continuar; no detallo pruebas individuales. Siguiente propuesta: categorias de gastos, egresos y movimientos de Finanzas.

### 11. Categorias de gastos, egresos y movimientos: validado por el usuario

El usuario aprobo conectar las operaciones existentes para Administrador.

- Nueva seccion Gastos y movimientos dentro de Finanzas, exclusiva del administrador.
- Crear y editar nombre/descripcion de categorias; activar y desactivar con confirmacion. No elimina categorias ni registros historicos.
- Registrar egreso con categoria activa, monto, concepto y descripcion. Valida monto positivo, maximo dos decimales y limite de DECIMAL(12,2); nombre/concepto no pueden consistir solo en espacios.
- Confirmacion antes de registrar el egreso; bloqueo de formularios y cierre durante el guardado. Manejo de errores y actualizacion de consultas financieras, incluyendo resumen y dashboard.
- Consulta de movimientos reales con tipo, concepto, descripcion, categoria, monto, fecha y usuario. Filtros por ingreso/egreso, categoria (incluye inactivas), rango de fechas y busqueda; fechas interpretadas en Guatemala.
- Reutiliza endpoints existentes de categorias, expenses y movements; no se modifico backend ni esquema de base de datos.
- Archivos: components/finance/FinanceExpenses.tsx, services/financeService.ts y finance/page.tsx.
- Verificacion: TypeScript, ESLint de archivos modificados y diff --check correctos. No se realizaron operaciones financieras reales ni prueba autenticada en navegador.
- El usuario confirmo que funciona y solicito continuar. Repartidor conserva unicamente la vista de cobros.
- Selector de fechas del resumen y acceso a pagos desde Pedidos completados en pasos 12 y 13.

### 12. Filtro de fechas del resumen financiero: validado por el usuario

- El usuario solicito continuar despues de validar gastos y movimientos; se abordo el siguiente pendiente registrado.
- Administrador puede indicar Desde/Hasta y Aplicar periodo; accesos Hoy, Este mes (hasta hoy) y Todo el historial.
- Permite rangos abiertos y valida que el inicio no sea posterior al final. El periodo aplicado se muestra separado de los campos para evitar confundir fechas editadas con resultados ya consultados.
- Consulta el endpoint de resumen existente con fechaInicio/fechaFin, que usa limites de dia de Guatemala.
- Ingresos, egresos y balance corresponden al periodo; cuentas por cobrar y vencidas conservan el saldo global actual. La pantalla lo indica expresamente.
- Incluye carga y errores con reintento; usa claves financieras existentes para actualizar tras pagos y egresos. Los filtros del listado de movimientos son independientes.
- Archivos: components/finance/FinancialSummary.tsx y finance/page.tsx. Sin cambios de backend ni esquema.
- Verificacion: TypeScript y ESLint de los archivos modificados correctos.
- El usuario confirmo este paso como listo. Se continuo con el siguiente pendiente registrado: acceso a pagos desde Pedidos.

### 13. Pagos desde Pedidos: validado por el usuario

- Nueva opcion Ver pagos / Cobrar en el menu de acciones de cada pedido, incluido entregados y cancelados para consultar historial.
- Se extrajo PaymentDetail como componente compartido entre Finanzas y Pedidos, manteniendo las reglas de cobro y el historial existentes.
- Permite pagos al contado y abonos a cuentas de credito sin salir de Pedidos. Pedidos cancelados o pagados solo muestran consulta; credito sin cuenta solicita crearla en Finanzas.
- Conserva validacion de monto, confirmacion y bloqueo al guardar, y actualiza las consultas de pedidos y finanzas.
- Archivos: components/finance/PaymentDetail.tsx, components/orders/columns.tsx, orders/page.tsx y finance/page.tsx. Sin cambios de backend.
- Verificacion: TypeScript y ESLint de archivos modificados correctos.
- El usuario confirmo este paso como listo. La etapa prevista de Finanzas queda validada; siguiente propuesta del orden acordado: administracion de Productos, con aprobacion de alcance antes de implementar.

### 14. Administracion de Productos: validado por el usuario

El usuario aprobo continuar con listado, creacion, edicion y baja segun las reglas del backend.

- Nueva pantalla /products para Administrador, enlazada al menu Productos existente.
- Catalogo con codigo, nombre, descripcion, precio y estado; busqueda y filtro de activos/inactivos.
- Formulario de creacion/edicion con codigo normalizado a mayusculas, nombre, descripcion y precio no negativo con hasta dos decimales dentro de DECIMAL(10,2).
- Permite vaciar descripcion. El backend informa codigos duplicados y los errores se muestran en pantalla.
- Desactivar usa la baja logica existente; Activar usa PATCH estado:true, ambas con confirmacion. Conserva pedidos historicos y sus precios.
- getCatalog devuelve activos e inactivos para administracion; getAll conserva su filtrado de activos para el formulario de pedidos. Guardar o cambiar estado invalida las consultas de productos.
- Bloquea acciones y cierre del formulario durante el guardado; incluye carga, errores con reintento y listados vacios.
- Archivos: products/page.tsx y services/productService.ts. No se modifico backend ni esquema.
- Verificacion: TypeScript, ESLint de archivos modificados y diff --check correctos. No se realizaron escrituras en la base de datos ni prueba autenticada en navegador.
- El usuario confirmo este paso como listo. Siguiente propuesta: administracion de Usuarios, con aprobacion de alcance antes de implementar.

### 15. Administracion de Usuarios: creacion validada; otras operaciones pendientes de confirmacion individual

El usuario aprobo continuar con Usuarios.

- Nueva pantalla /users para Administrador, usando el enlace Usuarios existente.
- Listado con nombre, correo, rol, estado y ultimo acceso en Guatemala; busqueda y filtros de rol/estado.
- Crear usuario con nombre, correo, rol y contrasena; editar datos y rol, con cambio opcional de contrasena. Dejarla vacia conserva la actual.
- Correos normalizados, nombre sin espacios vacios y contrasena de al menos 8 caracteres; limita a 72 bytes para evitar truncamiento de bcrypt. No se recuperan ni muestran contrasenas guardadas.
- Activacion/desactivacion con confirmacion usando operaciones existentes y baja logica.
- Guardar o desactivar la cuenta propia requiere confirmacion informando cierre de sesion; se cierra la sesion tras exito para actualizar los datos de acceso. Conserva las reglas actuales del backend, que no impiden desactivar el ultimo administrador.
- Nuevo GET /users/roles restringido por los guards de Administrador existentes, declarado antes de /users/:id; devuelve identificadores y nombres de roles activos de la base de datos, sin asumir IDs fijos.
- Mantiene el rol al editar si no cambia (omite idRol), incluso si ese rol ya no esta disponible para nuevas asignaciones.
- Cambios invalidan Usuarios y Logistica para actualizar el selector de repartidores en Rutas. Crear cuenta Cliente no crea ni vincula automaticamente una ficha comercial de Cliente.
- Archivos: users/page.tsx, services/userService.ts, users.controller.ts y users.service.ts. Sin cambios de esquema.
- Verificacion: TypeScript frontend, ESLint de archivos modificados y compilacion backend correctos. No se crearon cuentas reales durante verificaciones ni se realizo prueba autenticada en navegador.
- El usuario confirmo crear una cuenta Cliente. Edicion, cambio de contrasena/rol y activacion/desactivacion siguen sin confirmacion individual. Se priorizo completar el portal que el usuario encontro incompleto, antes de avanzar a Promociones.

### 16. Portal del cliente: validado por el usuario

El usuario confirmo que creo una cuenta Cliente y solicito completar Mi informacion, Mis pedidos e Historial.

- Nuevas paginas /my-profile, /my-orders y /history, enlazadas al menu existente y al inicio del cliente.
- Nueva relacion opcional y unica Cliente.idUsuario -> Usuario. Una ficha comercial por cuenta, sin asociar automaticamente por correo.
- Migracion 20261017000000_client_portal_link aplicada con prisma migrate deploy sobre PostgreSQL local; Prisma Client regenerado. No se borraron registros existentes.
- Usuarios incorpora Vincular ficha para cuentas Cliente: un administrador puede asociar una ficha activa existente o retirar el vinculo. No puede apropiarse de una ficha vinculada a otra cuenta. Validacion y escritura en transaccion Serializable con control de conflictos.
- Una cuenta nueva sin ficha puede completar nombre, telefono y NIT desde Mi informacion; se crea su ficha vinculada al usuario autenticado. Si ya tiene pedidos anteriores debe vincularse la ficha existente desde Usuarios antes de crear otra.
- Mi informacion muestra datos reales, permite editar nombre/telefono/NIT y agregar/editar/retirar direcciones con referencia/zona. El correo de acceso se consulta desde la sesion; no se cambia desde el portal.
- Mis pedidos lista solo los pedidos de la ficha vinculada, con filtros, productos/cantidades/precios, direccion, estado, total, pagado, saldo y vencimiento. No se incluyo creacion o cambio de estado de pedidos por el cliente.
- Historial muestra cambios de estado y pagos propios, sin datos de usuarios internos ni observaciones internas del personal.
- Inicio del cliente incorpora accesos a las tres paginas y contadores reales de pedidos, ultimo estado y saldo de pedidos no cancelados.
- Nuevos endpoints /client-portal guardados con JWT y rol Cliente, basados en idUsuario autenticado. Consulta individual de pedido filtra idPedido e idCliente juntos; direcciones se validan contra la ficha propia. DTO de perfil no acepta idUsuario, estado ni otro identificador de propietario.
- El portal rechaza fichas inactivas y presenta estados sin ficha, vacios, carga y error. No se ampliaron permisos de los endpoints globales de clientes, pedidos ni finanzas.
- Archivos: schema.prisma y migracion; modulo client-portal y sus pruebas; app.module.ts; users controller/service/DTO de vinculo y pruebas; servicios frontend de portal/usuarios/clientes; paginas my-profile, my-orders, history, users; componentes client-portal e inicio del cliente.
- Verificacion: compilacion backend, TypeScript frontend y ESLint correctos; 46 pruebas del backend pasan (14 nuevas para portal/vinculacion). Las pruebas HTTP simulan la identidad autenticada y usan RolesGuard real; no prueban emision de JWT.
- Verificacion adicional contra PostgreSQL real con test/client-portal.database-check.ts: dos usuarios/fichas/pedidos temporales, consulta propia, saldo e historial, rechazo de pedido ajeno. Se revirtieron todos los datos de prueba al terminar; la migracion permanece aplicada.
- El usuario confirmo que el portal de clientes funciona correctamente y solicito continuar. Para futuras cuentas: vincular ficha existente desde Usuarios o completar Mi informacion si es cliente nuevo; no asociar por correo ni crear duplicados para recuperar pedidos anteriores.

### 17. Promociones por producto: validado por el usuario

- Nueva pantalla /promotions para Administrador, usando el enlace existente.
- Selector de producto (incluye inactivos identificados), listado, busqueda y filtros de vigencia: Vigente, Programada, Vencida e Inactiva, con fecha de Guatemala.
- Crear/editar nombre, cantidad requerida, cantidad bonificada y fechas. Valida cantidades enteras positivas y rango de fechas; inicio y fin pueden coincidir.
- Permite promociones sin fecha final y quitar una fecha final existente mediante fechaFin:null. DTO y servicio backend actualizados para ese caso, sin modificar esquema.
- Activar/desactivar con confirmacion, bloqueo durante guardado y actualizacion de consultas de productos. Reactivar una promocion vencida no modifica sus fechas ni la vuelve vigente por si solo.
- Backend valida fechas de calendario reales y pertenencia de la promocion al producto solicitado.
- La pantalla informa que las bonificaciones todavia no se aplican automaticamente a pedidos. No se cambiaron calculos de ventas, precios ni cantidades de pedidos.
- Archivos: promotions/page.tsx, services/promotionService.ts, products.service.ts, dto/update-promotion.dto.ts y products.service.spec.ts.
- Verificacion: TypeScript frontend, ESLint frontend/backend y compilacion backend correctos; 8 pruebas nuevas correctas de fechas, fecha final nula/omitida y promocion ajena al producto. No se realizaron escrituras reales ni prueba autenticada de esta pantalla.
- El usuario confirmo que Promociones funciona como se indico y solicito avanzar con Reportes.

### 18. Reportes: validado por el usuario

- Nueva pantalla /reports para Administrador, usando el enlace existente del menu.
- Cuatro reportes: Pedidos, Movimientos financieros, Rutas y Cuentas por cobrar. Reutiliza consultas existentes autorizadas; no se agregaron endpoints ni se modifico el esquema.
- Periodo inicial desde el primer dia del mes hasta hoy en Guatemala; rango personalizado abierto/cerrado y accesos Hoy/Este mes/Todo el historial. Valida rango y muestra por separado el periodo aplicado.
- Pedidos se filtra por fecha de creacion del pedido, estado actual, tipo de venta y busqueda por numero/cliente. Totaliza el importe no cancelado y cuenta entregados/cancelados; no lo presenta como ingresos cobrados.
- Movimientos se filtra por fecha real del movimiento en Guatemala, tipo y busqueda de concepto/categoria/usuario. Totaliza ingresos, egresos y balance de los registros filtrados.
- Rutas se filtra por fecha programada (DATE), estado y ruta/repartidor. Muestra paradas, completadas y porcentaje de progreso actual.
- Cuentas se filtra por fecha de vencimiento (DATE), estado calculado y numero/cliente. Muestra original, pagado y saldo actuales; indica expresamente que no es un cierre historico del saldo.
- Indicadores y tablas usan los mismos filtros. Incluye carga, consulta fallida con reintento, listas vacias y Actualizar.
- Exportar CSV descarga unicamente la tabla filtrada del reporte activo, con encabezados, fechas e importes en Q. Deshabilitado si no hay filas, hay error o se esta actualizando.
- CSV con BOM UTF-8, separador punto y coma y escape de comillas/saltos de linea; textos que podrian interpretarse como formulas se exportan como texto, conservando los numeros como valores numericos.
- Filtrado y exportacion se realizan en frontend con las colecciones completas de los endpoints existentes; no se agrego paginacion ni un motor de reportes del servidor.
- Archivos: reports/page.tsx, lib/reportUtils.ts y test/report-utils.test.mjs.
- Verificacion: TypeScript y ESLint correctos; 7 pruebas correctas para limites de dia de Guatemala, campos DATE, rangos abiertos, dinero en centavos y escape CSV/formulas. No se realizaron escrituras de datos ni prueba de descarga en navegador.
- El usuario confirmo que funciona y solicito continuar con Auditoria. No detallo pruebas individuales de cada filtro/descarga.

### 19. Auditoria: implementado, pendiente de validacion

- La inspeccion inicial confirmo tabla auditoria vacia, sin disparadores en PostgreSQL ni escrituras de auditoria en el codigo. No existia historial previo que mostrar.
- Nueva pantalla /audit exclusiva de Administrador y endpoints GET /audit y /audit/options con JWT y RolesGuard.
- Filtros del servidor por fechas inclusivas de Guatemala, accion, entidad y usuario; busqueda por nombre/correo, accion, entidad o identificador; paginacion de 25/50/100 eventos, ordenados del mas reciente al mas antiguo.
- Listado con fecha, usuario, accion, entidad e identificador. Detalle muestra datos permitidos de la solicitud y resumen del resultado. Indica cuando no hay valores anteriores capturados.
- Interceptor global registra solicitudes de escritura exitosas de Usuarios, Clientes, Productos, Promociones, Pedidos, Logistica, Finanzas, CRM y Portal del cliente; tambien inicios de sesion exitosos, tomando la identidad desde el resultado de autenticacion.
- Acciones especificas para pagos, inicio/finalizacion de ruta, movimientos de paradas, cambios de estado y vinculacion de ficha. No registra lecturas ni operaciones fallidas como exitosas.
- Campos de entrada/resultados seleccionados explicitamente; contrasenas, hashes, tokens y cabeceras no se almacenan. Cambios de contrasena de usuarios guardan solo una bandera. Redaccion adicional de credenciales en datos historicos al consultar.
- Importante: es una bitacora de operaciones HTTP exitosas, no una captura de todos los cambios de fila en PostgreSQL. No reconstruye eventos antiguos, no registra cambios hechos por procesos externos y no captura automaticamente valores anteriores.
- La escritura del evento ocurre despues de la operacion de negocio. Si falla, se registra el error en la terminal sin convertir una operacion ya guardada en un fallo HTTP, para evitar reintentos duplicados de pagos. No garantiza auditoria transaccional ante ese fallo; endurecerla requiere un alcance adicional.
- Reutiliza tabla auditoria existente; no hubo cambio de esquema ni migracion.
- Archivos: modulo backend audit (controlador, servicio, interceptor, DTO, saneamiento y pruebas), app.module.ts; frontend audit/page.tsx y services/auditService.ts; test/audit.database-check.ts.
- Verificacion: compilacion backend, TypeScript frontend y ESLint correctos. Suite completa: 71 pruebas en 7 suites. Las 17 nuevas cubren exclusion de credenciales, actor/entidad, pagos, inicio de sesion, errores, fechas, paginacion y acceso exclusivo de Administrador (HTTP con identidades simuladas).
- Verificacion PostgreSQL real: actualizacion temporal de producto, registro con actor y consulta por filtros; datos temporales y evento revertidos al terminar. La prueba no dejo eventos ficticios en la tabla.
- Pendiente: cargar el backend actualizado, realizar una operacion y verificar su evento desde Auditoria; filtros, detalle y paginacion quedan pendientes de validacion del usuario.

## Incidencia anterior: resuelta segun confirmacion del usuario

El usuario logro iniciar sesion y confirmo que Subir/Bajar esta solucionado. El diagnostico siguiente se conserva como antecedente; ya no es un bloqueo activo.

El usuario reporto un error despues de implementar Subir/Bajar. No proporciono el mensaje exacto y NO se ha confirmado la causa.

En aquella inspeccion de puertos (antecedente historico, no estado actual de los servicios):

- Habia un proceso escuchando en 3001 (puerto habitual del frontend).
- No habia proceso escuchando en 3000 (puerto predeterminado del backend).
- Esto sugiere un problema de conexion SOLO si el frontend apunta al puerto 3000. No confirma la causa del error ni descarta un fallo al arrancar el backend o una configuracion de puerto diferente.
- No se revisaron valores secretos de .env ni se obtuvo el registro del error.
- No se modifico codigo durante ese diagnostico.

El error de acceso y la prueba Subir/Bajar fueron confirmados como resueltos por el usuario. Los pasos actuales para retomar estan al principio del documento y corresponden al portal del cliente.

## Funcionalidades pendientes de integracion

La siguiente lista resume el estado actualizado de la integracion. Revalidar el codigo al abordar cada pendiente. Los modulos futuros no estan aprobados automaticamente.

| Modulo | Disponible actualmente | Pendiente |
| --- | --- | --- |
| Rutas | Listar, detalle, crear, iniciar, completar, agregar y retirar pedidos; Subir/Bajar, edicion y horas estimadas validados | Sin pendientes en la planificacion prevista |
| Entregas | Flujo de entrega y finalizacion de ruta validado; historial e incidencias implementados | Validar enlace desde Ruta del dia; incidencias y reintentos si aun no se probaron |
| Finanzas | Cobros, categorias, egresos, movimientos, filtro del resumen y acceso a pagos desde Pedidos validados | Sin pendientes en la etapa prevista |
| Productos | Catalogo, creacion, edicion y baja logica validados por el usuario | Sin pendientes en la etapa prevista |
| Promociones | Administracion por producto validada por el usuario | Aplicacion de bonificaciones a ventas requiere alcance separado |
| Usuarios | Creacion probada por el usuario; administracion y roles disponibles; vinculo de ficha Cliente implementado | Validar vinculo de ficha y demas operaciones si aun no se probaron |
| CRM | Prospectos, interacciones y seguimientos conectados; alertas de compra habitual por cliente/producto implementadas el 22 de octubre | Validar panel de alertas; asociar y retirar productos de interes en prospectos |
| Clientes | Gestion comercial existente y portal propio validado con NIT, direcciones y vinculo a usuario | Ampliar gestion administrativa de direcciones, coordenadas, NIT y estado |
| Pedidos | Gestion y cobros validados; portal muestra estados/pagos propios | Historial de estados en la pantalla administrativa; crear cuenta de credito directamente desde Pedidos |
| Dashboard | Inicio/Dashboard administrativo y de repartidor validados; inicio conectado al portal del cliente validado | Sin pendientes en la etapa prevista |
| Reportes | Cuatro reportes con datos reales, filtros, indicadores y CSV aceptados por el usuario | Sin pendientes en la etapa prevista |
| Auditoria | Bitacora de nuevas operaciones exitosas y pantalla administrativa implementadas | Validar registro, consulta y filtros; valores anteriores y auditoria transaccional no incluidos |

## Pendientes que tambien necesitan definir o ampliar el backend

- Portal del cliente: implementado y validado en paso 16 con vinculo explicito Usuario/Cliente y endpoints propios autorizados. No se implemento creacion de pedidos por el cliente.
- Ruta del repartidor: /my-route implementada en paso 7, con consulta propia filtrada por usuario en backend. La consulta general de rutas conserva su alcance previo; el aislamiento global de otros endpoints sigue pendiente si se requiere.
- Reportes: pantalla validada en paso 18 con endpoints existentes. Auditoria implementada en paso 19, pendiente de prueba; no incluye snapshots anteriores ni registro transaccional garantizado.
- Aplicacion de promociones a ventas: crear pedidos calcula con precioActual; no se encontro aplicacion de promociones en ese calculo. Administrar promociones no implementa automaticamente descuentos en ventas.
- Sesion vencida: falta manejo centralizado de respuestas 401 del backend. El frontend conserva JWT y no implementa renovacion automatica.

## Enlaces del menu que aun no tienen pagina

Todos los enlaces del menu revisados tienen pagina implementada. /audit fue agregada en el paso 19; esto no significa que todas las funcionalidades futuras de cada modulo esten completas.

## Orden sugerido despues de validar Auditoria

1. Resolver cualquier incidencia que reporte el usuario al probar Auditoria y el registro de nuevas operaciones.
2. Acordar por separado si se requiere aplicar bonificaciones a pedidos; administrar promociones no las aplica automaticamente.
3. Completar gestion administrativa de clientes y productos de interes en CRM.
4. Completar historial de estados administrativo y creacion de cuentas de credito desde Pedidos, si el usuario lo requiere.
5. Acordar mejoras adicionales de Reportes/Auditoria, si se requieren (por ejemplo snapshots anteriores o garantia transaccional), y resolver pendientes de sesiones y aislamiento por propietario fuera del portal.

El siguiente paso concreto debe acordarse con el usuario.
