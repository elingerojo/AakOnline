import { drizzle } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';
import { config } from 'dotenv';
import * as schema from '../schema/index.js';

// Los imports ESM se evalúan antes que el cuerpo de src/index.ts (donde se
// llama config()), así que aquí se carga el .env otra vez (dotenv es idempotente).
config();

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  // No se aborta el arranque: las rutas que consultan Neon responderán 503
  // y el resto de la API (productos desde JSON, imágenes, IA) sigue viva.
  console.warn('[db] DATABASE_URL no está definida; las consultas a Neon fallarán.');
}

const sql = neon(
  connectionString ?? 'postgres://missing:missing@localhost:5432/missing'
);

export const db = drizzle(sql, { schema });
