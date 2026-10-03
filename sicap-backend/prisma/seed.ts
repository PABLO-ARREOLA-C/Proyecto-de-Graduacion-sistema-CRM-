import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL no está definida en el archivo .env');
}

const adapter = new PrismaPg({
  connectionString,
});

const prisma = new PrismaClient({
  adapter,
});

async function main() {
  console.log('Iniciando seed de Rehobot CRM...');

  // =========================================================
  // ROLES
  // =========================================================

  const administrador = await prisma.rol.upsert({
    where: { nombre: 'Administrador' },
    update: {
      descripcion: 'Acceso total al sistema',
      estado: true,
    },
    create: {
      nombre: 'Administrador',
      descripcion: 'Acceso total al sistema',
      estado: true,
    },
  });

  const repartidor = await prisma.rol.upsert({
    where: { nombre: 'Repartidor' },
    update: {
      descripcion: 'Gestión de clientes, pedidos, CRM, rutas y entregas',
      estado: true,
    },
    create: {
      nombre: 'Repartidor',
      descripcion: 'Gestión de clientes, pedidos, CRM, rutas y entregas',
      estado: true,
    },
  });

  const cliente = await prisma.rol.upsert({
    where: { nombre: 'Cliente' },
    update: {
      descripcion: 'Acceso a información e historial del cliente',
      estado: true,
    },
    create: {
      nombre: 'Cliente',
      descripcion: 'Acceso a información e historial del cliente',
      estado: true,
    },
  });

  console.log('Roles creados:');
  console.log(`- ${administrador.nombre}`);
  console.log(`- ${repartidor.nombre}`);
  console.log(`- ${cliente.nombre}`);

  // =========================================================
  // PRODUCTOS INICIALES
  // =========================================================

  const garrafon = await prisma.producto.upsert({
    where: { codigo: 'PROD-001' },
    update: {
      nombre: 'Garrafón',
      estado: true,
    },
    create: {
      codigo: 'PROD-001',
      nombre: 'Garrafón',
      descripcion: 'Garrafón de agua purificada',
      precioActual: 1,
      estado: true,
    },
  });

  const bolsaAgua = await prisma.producto.upsert({
    where: { codigo: 'PROD-002' },
    update: {
      nombre: 'Bolsa de agua',
      estado: true,
    },
    create: {
      codigo: 'PROD-002',
      nombre: 'Bolsa de agua',
      descripcion: 'Bolsa de agua purificada',
      precioActual: 1,
      estado: true,
    },
  });

  console.log('Productos creados:');
  console.log(`- ${garrafon.nombre}`);
  console.log(`- ${bolsaAgua.nombre}`);

  // =========================================================
  // ADMINISTRADOR INICIAL
  // =========================================================

  const adminPassword = process.env.ADMIN_INITIAL_PASSWORD ?? 'Cambiar123!';

  const passwordHash = await bcrypt.hash(adminPassword, 12);

  const admin = await prisma.usuario.upsert({
    where: {
      correo: 'admin@rehobot.local',
    },
    update: {
      idRol: administrador.idRol,
      nombre: 'Administrador',
      estado: true,
    },
    create: {
      idRol: administrador.idRol,
      nombre: 'Administrador',
      correo: 'admin@rehobot.local',
      passwordHash,
      estado: true,
    },
  });

  console.log('Administrador inicial creado:');
  console.log(`- ${admin.correo}`);

  console.log('Seed completado correctamente.');
}

main()
  .catch((error) => {
    console.error('Error ejecutando el seed:');
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
