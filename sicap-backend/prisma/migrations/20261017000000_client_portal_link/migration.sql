ALTER TABLE "clientes" ADD COLUMN "id_usuario" UUID;

CREATE UNIQUE INDEX "clientes_id_usuario_key" ON "clientes"("id_usuario");

ALTER TABLE "clientes" ADD CONSTRAINT "clientes_id_usuario_fkey"
FOREIGN KEY ("id_usuario") REFERENCES "usuarios"("id_usuario")
ON DELETE SET NULL ON UPDATE CASCADE;
