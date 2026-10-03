$pedido2Actual = Invoke-RestMethod -Uri "http://localhost:3000/orders/$($pedido2.idPedido)" -Method GET -Headers $headersRepartidor-- CreateTable
CREATE TABLE "roles" (
    "id_rol" SMALLSERIAL NOT NULL,
    "nombre" VARCHAR(50) NOT NULL,
    "descripcion" VARCHAR(200),
    "estado" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id_rol")
);

-- CreateTable
CREATE TABLE "usuarios" (
    "id_usuario" UUID NOT NULL,
    "id_rol" SMALLINT NOT NULL,
    "nombre" VARCHAR(100) NOT NULL,
    "correo" VARCHAR(100) NOT NULL,
    "password_hash" VARCHAR(255) NOT NULL,
    "estado" BOOLEAN NOT NULL DEFAULT true,
    "fecha_creacion" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_ultima_conexion" TIMESTAMPTZ(6),

    CONSTRAINT "usuarios_pkey" PRIMARY KEY ("id_usuario")
);

-- CreateTable
CREATE TABLE "auditoria" (
    "id_auditoria" BIGSERIAL NOT NULL,
    "id_usuario" UUID,
    "accion" VARCHAR(50) NOT NULL,
    "tabla_afectada" VARCHAR(50) NOT NULL,
    "registro_id" VARCHAR(100),
    "datos_anteriores" JSONB,
    "datos_nuevos" JSONB,
    "fecha_hora" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auditoria_pkey" PRIMARY KEY ("id_auditoria")
);

-- CreateTable
CREATE TABLE "clientes" (
    "id_cliente" UUID NOT NULL,
    "nombre" VARCHAR(100) NOT NULL,
    "telefono" VARCHAR(20) NOT NULL,
    "correo" VARCHAR(100),
    "nit" VARCHAR(20),
    "estado" BOOLEAN NOT NULL DEFAULT true,
    "fecha_creacion" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_actualizacion" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "clientes_pkey" PRIMARY KEY ("id_cliente")
);

-- CreateTable
CREATE TABLE "direcciones_cliente" (
    "id_direccion" UUID NOT NULL,
    "id_cliente" UUID NOT NULL,
    "direccion" VARCHAR(255) NOT NULL,
    "referencia" VARCHAR(255),
    "zona" VARCHAR(50),
    "latitud" DECIMAL(10,7),
    "longitud" DECIMAL(10,7),
    "estado" BOOLEAN NOT NULL DEFAULT true,
    "fecha_creacion" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "direcciones_cliente_pkey" PRIMARY KEY ("id_direccion")
);

-- CreateTable
CREATE TABLE "prospectos" (
    "id_prospecto" UUID NOT NULL,
    "nombre" VARCHAR(100) NOT NULL,
    "telefono" VARCHAR(20) NOT NULL,
    "correo" VARCHAR(100),
    "direccion" VARCHAR(255),
    "interes" TEXT,
    "estado" VARCHAR(20) NOT NULL,
    "id_responsable" UUID,
    "fecha_creacion" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_actualizacion" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "prospectos_pkey" PRIMARY KEY ("id_prospecto")
);

-- CreateTable
CREATE TABLE "prospecto_producto" (
    "id_prospecto_producto" UUID NOT NULL,
    "id_prospecto" UUID NOT NULL,
    "id_producto" UUID NOT NULL,
    "cantidad_estimada" INTEGER,

    CONSTRAINT "prospecto_producto_pkey" PRIMARY KEY ("id_prospecto_producto")
);

-- CreateTable
CREATE TABLE "interacciones_crm" (
    "id_interaccion" UUID NOT NULL,
    "id_prospecto" UUID NOT NULL,
    "id_usuario" UUID NOT NULL,
    "tipo" VARCHAR(30) NOT NULL,
    "descripcion" TEXT NOT NULL,
    "fecha_hora" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "interacciones_crm_pkey" PRIMARY KEY ("id_interaccion")
);

-- CreateTable
CREATE TABLE "seguimientos_crm" (
    "id_seguimiento" UUID NOT NULL,
    "id_prospecto" UUID NOT NULL,
    "id_usuario" UUID NOT NULL,
    "fecha_programada" TIMESTAMPTZ(6) NOT NULL,
    "descripcion" TEXT,
    "estado" VARCHAR(20) NOT NULL,
    "fecha_completado" TIMESTAMPTZ(6),

    CONSTRAINT "seguimientos_crm_pkey" PRIMARY KEY ("id_seguimiento")
);

-- CreateTable
CREATE TABLE "productos" (
    "id_producto" UUID NOT NULL,
    "codigo" VARCHAR(20) NOT NULL,
    "nombre" VARCHAR(100) NOT NULL,
    "descripcion" TEXT,
    "precio_actual" DECIMAL(10,2) NOT NULL,
    "estado" BOOLEAN NOT NULL DEFAULT true,
    "fecha_creacion" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_actualizacion" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "productos_pkey" PRIMARY KEY ("id_producto")
);

-- CreateTable
CREATE TABLE "promociones" (
    "id_promocion" UUID NOT NULL,
    "id_producto" UUID NOT NULL,
    "nombre" VARCHAR(120) NOT NULL,
    "cantidad_requerida" INTEGER NOT NULL,
    "cantidad_bonificada" INTEGER NOT NULL,
    "fecha_inicio" DATE NOT NULL,
    "fecha_fin" DATE,
    "estado" BOOLEAN NOT NULL DEFAULT true,
    "fecha_creacion" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "promociones_pkey" PRIMARY KEY ("id_promocion")
);

-- CreateTable
CREATE TABLE "pedidos" (
    "id_pedido" UUID NOT NULL,
    "numero_pedido" VARCHAR(25) NOT NULL,
    "id_cliente" UUID NOT NULL,
    "id_direccion" UUID NOT NULL,
    "registrado_por" UUID,
    "fecha_pedido" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_entrega_solicitada" DATE NOT NULL,
    "tipo_venta" VARCHAR(10) NOT NULL,
    "estado" VARCHAR(25) NOT NULL,
    "total" DECIMAL(12,2) NOT NULL,
    "observaciones" TEXT,
    "fecha_actualizacion" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "pedidos_pkey" PRIMARY KEY ("id_pedido")
);

-- CreateTable
CREATE TABLE "detalle_pedido" (
    "id_detalle" UUID NOT NULL,
    "id_pedido" UUID NOT NULL,
    "id_producto" UUID NOT NULL,
    "cantidad" INTEGER NOT NULL,
    "precio_unitario" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "detalle_pedido_pkey" PRIMARY KEY ("id_detalle")
);

-- CreateTable
CREATE TABLE "historial_estados_pedido" (
    "id_historial" BIGSERIAL NOT NULL,
    "id_pedido" UUID NOT NULL,
    "cambiado_por" UUID,
    "estado_anterior" VARCHAR(25),
    "estado_nuevo" VARCHAR(25) NOT NULL,
    "fecha_hora" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "observaciones" TEXT,

    CONSTRAINT "historial_estados_pedido_pkey" PRIMARY KEY ("id_historial")
);

-- CreateTable
CREATE TABLE "rutas" (
    "id_ruta" UUID NOT NULL,
    "codigo_ruta" VARCHAR(25) NOT NULL,
    "nombre" VARCHAR(100) NOT NULL,
    "fecha" DATE NOT NULL,
    "id_repartidor" UUID NOT NULL,
    "estado" VARCHAR(20) NOT NULL,
    "observaciones" TEXT,
    "fecha_creacion" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_actualizacion" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "rutas_pkey" PRIMARY KEY ("id_ruta")
);

-- CreateTable
CREATE TABLE "detalle_ruta" (
    "id_detalle_ruta" UUID NOT NULL,
    "id_ruta" UUID NOT NULL,
    "id_pedido" UUID NOT NULL,
    "orden_parada" INTEGER NOT NULL,
    "estado" VARCHAR(20) NOT NULL,
    "hora_estimada" TIME(6),
    "fecha_asignacion" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "detalle_ruta_pkey" PRIMARY KEY ("id_detalle_ruta")
);

-- CreateTable
CREATE TABLE "entregas" (
    "id_entrega" UUID NOT NULL,
    "id_pedido" UUID NOT NULL,
    "id_detalle_ruta" UUID NOT NULL,
    "id_repartidor" UUID NOT NULL,
    "numero_intento" SMALLINT NOT NULL,
    "fecha_hora" TIMESTAMPTZ(6) NOT NULL,
    "estado" VARCHAR(20) NOT NULL,
    "observaciones" TEXT,
    "fecha_registro" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "entregas_pkey" PRIMARY KEY ("id_entrega")
);

-- CreateTable
CREATE TABLE "detalle_entrega" (
    "id_detalle_entrega" UUID NOT NULL,
    "id_entrega" UUID NOT NULL,
    "id_detalle_pedido" UUID NOT NULL,
    "cantidad_entregada" INTEGER NOT NULL,

    CONSTRAINT "detalle_entrega_pkey" PRIMARY KEY ("id_detalle_entrega")
);

-- CreateTable
CREATE TABLE "incidencias" (
    "id_incidencia" UUID NOT NULL,
    "id_entrega" UUID NOT NULL,
    "tipo" VARCHAR(50) NOT NULL,
    "descripcion" TEXT NOT NULL,
    "registrado_por" UUID NOT NULL,
    "fecha_hora" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "incidencias_pkey" PRIMARY KEY ("id_incidencia")
);

-- CreateTable
CREATE TABLE "cuentas_por_cobrar" (
    "id_cuenta" UUID NOT NULL,
    "id_pedido" UUID NOT NULL,
    "monto_original" DECIMAL(12,2) NOT NULL,
    "fecha_vencimiento" DATE NOT NULL,
    "estado" VARCHAR(20) NOT NULL,
    "fecha_creacion" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_actualizacion" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "cuentas_por_cobrar_pkey" PRIMARY KEY ("id_cuenta")
);

-- CreateTable
CREATE TABLE "pagos" (
    "id_pago" UUID NOT NULL,
    "id_pedido" UUID NOT NULL,
    "registrado_por" UUID NOT NULL,
    "monto" DECIMAL(12,2) NOT NULL,
    "fecha_pago" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "observaciones" TEXT,

    CONSTRAINT "pagos_pkey" PRIMARY KEY ("id_pago")
);

-- CreateTable
CREATE TABLE "categorias_egreso" (
    "id_categoria" SMALLSERIAL NOT NULL,
    "nombre" VARCHAR(80) NOT NULL,
    "descripcion" VARCHAR(200),
    "estado" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "categorias_egreso_pkey" PRIMARY KEY ("id_categoria")
);

-- CreateTable
CREATE TABLE "movimientos_financieros" (
    "id_movimiento" UUID NOT NULL,
    "tipo" VARCHAR(15) NOT NULL,
    "id_categoria" SMALLINT,
    "monto" DECIMAL(12,2) NOT NULL,
    "concepto" VARCHAR(150) NOT NULL,
    "descripcion" TEXT,
    "registrado_por" UUID NOT NULL,
    "fecha_movimiento" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "movimientos_financieros_pkey" PRIMARY KEY ("id_movimiento")
);

-- CreateIndex
CREATE UNIQUE INDEX "roles_nombre_key" ON "roles"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_correo_key" ON "usuarios"("correo");

-- CreateIndex
CREATE INDEX "usuarios_id_rol_idx" ON "usuarios"("id_rol");

-- CreateIndex
CREATE INDEX "auditoria_id_usuario_idx" ON "auditoria"("id_usuario");

-- CreateIndex
CREATE INDEX "auditoria_fecha_hora_idx" ON "auditoria"("fecha_hora");

-- CreateIndex
CREATE INDEX "clientes_nombre_idx" ON "clientes"("nombre");

-- CreateIndex
CREATE INDEX "clientes_telefono_idx" ON "clientes"("telefono");

-- CreateIndex
CREATE INDEX "direcciones_cliente_id_cliente_idx" ON "direcciones_cliente"("id_cliente");

-- CreateIndex
CREATE INDEX "prospectos_id_responsable_idx" ON "prospectos"("id_responsable");

-- CreateIndex
CREATE INDEX "prospectos_estado_idx" ON "prospectos"("estado");

-- CreateIndex
CREATE INDEX "prospecto_producto_id_producto_idx" ON "prospecto_producto"("id_producto");

-- CreateIndex
CREATE UNIQUE INDEX "prospecto_producto_id_prospecto_id_producto_key" ON "prospecto_producto"("id_prospecto", "id_producto");

-- CreateIndex
CREATE INDEX "interacciones_crm_id_prospecto_idx" ON "interacciones_crm"("id_prospecto");

-- CreateIndex
CREATE INDEX "interacciones_crm_id_usuario_idx" ON "interacciones_crm"("id_usuario");

-- CreateIndex
CREATE INDEX "interacciones_crm_fecha_hora_idx" ON "interacciones_crm"("fecha_hora");

-- CreateIndex
CREATE INDEX "seguimientos_crm_id_prospecto_idx" ON "seguimientos_crm"("id_prospecto");

-- CreateIndex
CREATE INDEX "seguimientos_crm_id_usuario_idx" ON "seguimientos_crm"("id_usuario");

-- CreateIndex
CREATE INDEX "seguimientos_crm_fecha_programada_idx" ON "seguimientos_crm"("fecha_programada");

-- CreateIndex
CREATE INDEX "seguimientos_crm_estado_idx" ON "seguimientos_crm"("estado");

-- CreateIndex
CREATE UNIQUE INDEX "productos_codigo_key" ON "productos"("codigo");

-- CreateIndex
CREATE INDEX "productos_nombre_idx" ON "productos"("nombre");

-- CreateIndex
CREATE INDEX "promociones_id_producto_idx" ON "promociones"("id_producto");

-- CreateIndex
CREATE INDEX "promociones_fecha_inicio_fecha_fin_idx" ON "promociones"("fecha_inicio", "fecha_fin");

-- CreateIndex
CREATE UNIQUE INDEX "pedidos_numero_pedido_key" ON "pedidos"("numero_pedido");

-- CreateIndex
CREATE INDEX "pedidos_id_cliente_idx" ON "pedidos"("id_cliente");

-- CreateIndex
CREATE INDEX "pedidos_id_direccion_idx" ON "pedidos"("id_direccion");

-- CreateIndex
CREATE INDEX "pedidos_registrado_por_idx" ON "pedidos"("registrado_por");

-- CreateIndex
CREATE INDEX "pedidos_fecha_entrega_solicitada_idx" ON "pedidos"("fecha_entrega_solicitada");

-- CreateIndex
CREATE INDEX "pedidos_estado_idx" ON "pedidos"("estado");

-- CreateIndex
CREATE INDEX "detalle_pedido_id_producto_idx" ON "detalle_pedido"("id_producto");

-- CreateIndex
CREATE UNIQUE INDEX "detalle_pedido_id_pedido_id_producto_key" ON "detalle_pedido"("id_pedido", "id_producto");

-- CreateIndex
CREATE INDEX "historial_estados_pedido_id_pedido_idx" ON "historial_estados_pedido"("id_pedido");

-- CreateIndex
CREATE INDEX "historial_estados_pedido_cambiado_por_idx" ON "historial_estados_pedido"("cambiado_por");

-- CreateIndex
CREATE INDEX "historial_estados_pedido_fecha_hora_idx" ON "historial_estados_pedido"("fecha_hora");

-- CreateIndex
CREATE UNIQUE INDEX "rutas_codigo_ruta_key" ON "rutas"("codigo_ruta");

-- CreateIndex
CREATE INDEX "rutas_id_repartidor_idx" ON "rutas"("id_repartidor");

-- CreateIndex
CREATE INDEX "rutas_fecha_idx" ON "rutas"("fecha");

-- CreateIndex
CREATE INDEX "rutas_estado_idx" ON "rutas"("estado");

-- CreateIndex
CREATE INDEX "detalle_ruta_id_pedido_idx" ON "detalle_ruta"("id_pedido");

-- CreateIndex
CREATE UNIQUE INDEX "detalle_ruta_id_ruta_id_pedido_key" ON "detalle_ruta"("id_ruta", "id_pedido");

-- CreateIndex
CREATE UNIQUE INDEX "detalle_ruta_id_ruta_orden_parada_key" ON "detalle_ruta"("id_ruta", "orden_parada");

-- CreateIndex
CREATE INDEX "entregas_id_detalle_ruta_idx" ON "entregas"("id_detalle_ruta");

-- CreateIndex
CREATE INDEX "entregas_id_repartidor_idx" ON "entregas"("id_repartidor");

-- CreateIndex
CREATE INDEX "entregas_fecha_hora_idx" ON "entregas"("fecha_hora");

-- CreateIndex
CREATE UNIQUE INDEX "entregas_id_pedido_numero_intento_key" ON "entregas"("id_pedido", "numero_intento");

-- CreateIndex
CREATE INDEX "detalle_entrega_id_detalle_pedido_idx" ON "detalle_entrega"("id_detalle_pedido");

-- CreateIndex
CREATE UNIQUE INDEX "detalle_entrega_id_entrega_id_detalle_pedido_key" ON "detalle_entrega"("id_entrega", "id_detalle_pedido");

-- CreateIndex
CREATE INDEX "incidencias_id_entrega_idx" ON "incidencias"("id_entrega");

-- CreateIndex
CREATE INDEX "incidencias_registrado_por_idx" ON "incidencias"("registrado_por");

-- CreateIndex
CREATE INDEX "incidencias_fecha_hora_idx" ON "incidencias"("fecha_hora");

-- CreateIndex
CREATE UNIQUE INDEX "cuentas_por_cobrar_id_pedido_key" ON "cuentas_por_cobrar"("id_pedido");

-- CreateIndex
CREATE INDEX "cuentas_por_cobrar_estado_idx" ON "cuentas_por_cobrar"("estado");

-- CreateIndex
CREATE INDEX "cuentas_por_cobrar_fecha_vencimiento_idx" ON "cuentas_por_cobrar"("fecha_vencimiento");

-- CreateIndex
CREATE INDEX "pagos_id_pedido_idx" ON "pagos"("id_pedido");

-- CreateIndex
CREATE INDEX "pagos_registrado_por_idx" ON "pagos"("registrado_por");

-- CreateIndex
CREATE INDEX "pagos_fecha_pago_idx" ON "pagos"("fecha_pago");

-- CreateIndex
CREATE UNIQUE INDEX "categorias_egreso_nombre_key" ON "categorias_egreso"("nombre");

-- CreateIndex
CREATE INDEX "movimientos_financieros_id_categoria_idx" ON "movimientos_financieros"("id_categoria");

-- CreateIndex
CREATE INDEX "movimientos_financieros_registrado_por_idx" ON "movimientos_financieros"("registrado_por");

-- CreateIndex
CREATE INDEX "movimientos_financieros_fecha_movimiento_idx" ON "movimientos_financieros"("fecha_movimiento");

-- CreateIndex
CREATE INDEX "movimientos_financieros_tipo_idx" ON "movimientos_financieros"("tipo");

-- AddForeignKey
ALTER TABLE "usuarios" ADD CONSTRAINT "usuarios_id_rol_fkey" FOREIGN KEY ("id_rol") REFERENCES "roles"("id_rol") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auditoria" ADD CONSTRAINT "auditoria_id_usuario_fkey" FOREIGN KEY ("id_usuario") REFERENCES "usuarios"("id_usuario") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "direcciones_cliente" ADD CONSTRAINT "direcciones_cliente_id_cliente_fkey" FOREIGN KEY ("id_cliente") REFERENCES "clientes"("id_cliente") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prospectos" ADD CONSTRAINT "prospectos_id_responsable_fkey" FOREIGN KEY ("id_responsable") REFERENCES "usuarios"("id_usuario") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prospecto_producto" ADD CONSTRAINT "prospecto_producto_id_prospecto_fkey" FOREIGN KEY ("id_prospecto") REFERENCES "prospectos"("id_prospecto") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prospecto_producto" ADD CONSTRAINT "prospecto_producto_id_producto_fkey" FOREIGN KEY ("id_producto") REFERENCES "productos"("id_producto") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interacciones_crm" ADD CONSTRAINT "interacciones_crm_id_prospecto_fkey" FOREIGN KEY ("id_prospecto") REFERENCES "prospectos"("id_prospecto") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interacciones_crm" ADD CONSTRAINT "interacciones_crm_id_usuario_fkey" FOREIGN KEY ("id_usuario") REFERENCES "usuarios"("id_usuario") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seguimientos_crm" ADD CONSTRAINT "seguimientos_crm_id_prospecto_fkey" FOREIGN KEY ("id_prospecto") REFERENCES "prospectos"("id_prospecto") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seguimientos_crm" ADD CONSTRAINT "seguimientos_crm_id_usuario_fkey" FOREIGN KEY ("id_usuario") REFERENCES "usuarios"("id_usuario") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "promociones" ADD CONSTRAINT "promociones_id_producto_fkey" FOREIGN KEY ("id_producto") REFERENCES "productos"("id_producto") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pedidos" ADD CONSTRAINT "pedidos_id_cliente_fkey" FOREIGN KEY ("id_cliente") REFERENCES "clientes"("id_cliente") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pedidos" ADD CONSTRAINT "pedidos_id_direccion_fkey" FOREIGN KEY ("id_direccion") REFERENCES "direcciones_cliente"("id_direccion") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pedidos" ADD CONSTRAINT "pedidos_registrado_por_fkey" FOREIGN KEY ("registrado_por") REFERENCES "usuarios"("id_usuario") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "detalle_pedido" ADD CONSTRAINT "detalle_pedido_id_pedido_fkey" FOREIGN KEY ("id_pedido") REFERENCES "pedidos"("id_pedido") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "detalle_pedido" ADD CONSTRAINT "detalle_pedido_id_producto_fkey" FOREIGN KEY ("id_producto") REFERENCES "productos"("id_producto") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "historial_estados_pedido" ADD CONSTRAINT "historial_estados_pedido_id_pedido_fkey" FOREIGN KEY ("id_pedido") REFERENCES "pedidos"("id_pedido") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "historial_estados_pedido" ADD CONSTRAINT "historial_estados_pedido_cambiado_por_fkey" FOREIGN KEY ("cambiado_por") REFERENCES "usuarios"("id_usuario") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rutas" ADD CONSTRAINT "rutas_id_repartidor_fkey" FOREIGN KEY ("id_repartidor") REFERENCES "usuarios"("id_usuario") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "detalle_ruta" ADD CONSTRAINT "detalle_ruta_id_ruta_fkey" FOREIGN KEY ("id_ruta") REFERENCES "rutas"("id_ruta") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "detalle_ruta" ADD CONSTRAINT "detalle_ruta_id_pedido_fkey" FOREIGN KEY ("id_pedido") REFERENCES "pedidos"("id_pedido") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entregas" ADD CONSTRAINT "entregas_id_pedido_fkey" FOREIGN KEY ("id_pedido") REFERENCES "pedidos"("id_pedido") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entregas" ADD CONSTRAINT "entregas_id_detalle_ruta_fkey" FOREIGN KEY ("id_detalle_ruta") REFERENCES "detalle_ruta"("id_detalle_ruta") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entregas" ADD CONSTRAINT "entregas_id_repartidor_fkey" FOREIGN KEY ("id_repartidor") REFERENCES "usuarios"("id_usuario") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "detalle_entrega" ADD CONSTRAINT "detalle_entrega_id_entrega_fkey" FOREIGN KEY ("id_entrega") REFERENCES "entregas"("id_entrega") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "detalle_entrega" ADD CONSTRAINT "detalle_entrega_id_detalle_pedido_fkey" FOREIGN KEY ("id_detalle_pedido") REFERENCES "detalle_pedido"("id_detalle") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incidencias" ADD CONSTRAINT "incidencias_id_entrega_fkey" FOREIGN KEY ("id_entrega") REFERENCES "entregas"("id_entrega") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incidencias" ADD CONSTRAINT "incidencias_registrado_por_fkey" FOREIGN KEY ("registrado_por") REFERENCES "usuarios"("id_usuario") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cuentas_por_cobrar" ADD CONSTRAINT "cuentas_por_cobrar_id_pedido_fkey" FOREIGN KEY ("id_pedido") REFERENCES "pedidos"("id_pedido") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pagos" ADD CONSTRAINT "pagos_id_pedido_fkey" FOREIGN KEY ("id_pedido") REFERENCES "pedidos"("id_pedido") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pagos" ADD CONSTRAINT "pagos_registrado_por_fkey" FOREIGN KEY ("registrado_por") REFERENCES "usuarios"("id_usuario") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimientos_financieros" ADD CONSTRAINT "movimientos_financieros_id_categoria_fkey" FOREIGN KEY ("id_categoria") REFERENCES "categorias_egreso"("id_categoria") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimientos_financieros" ADD CONSTRAINT "movimientos_financieros_registrado_por_fkey" FOREIGN KEY ("registrado_por") REFERENCES "usuarios"("id_usuario") ON DELETE RESTRICT ON UPDATE CASCADE;
