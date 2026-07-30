import { config as loadEnv } from 'dotenv';
import path from 'node:path';
import type { NextConfig } from 'next';

// Next solo lee los .env de su propio directorio (apps/web), pero en este monorepo el
// .env vive en la raíz y lo comparte con la API: si el frontend no lo carga, JWT_SECRET
// queda undefined y la verificación de sesión rechaza a todo el mundo.
loadEnv({ path: path.resolve(__dirname, '../../.env') });

const nextConfig: NextConfig = {
  transpilePackages: ['@loklflow/types'],
  // Salida autocontenida para la imagen de Docker: `.next/standalone` trae un server.js
  // con solo las dependencias que el trazado encuentra usadas. Sin esto la imagen tendría
  // que arrastrar el node_modules del monorepo entero.
  //
  // En este monorepo la salida conserva la estructura de carpetas, así que el server.js
  // acaba en `.next/standalone/apps/web/server.js`, no en la raíz de standalone.
  output: 'standalone',
  // Con la salida standalone Next solo copia lo que el trazado detecta; los ficheros de
  // los workspaces vecinos quedan fuera si no se le dice dónde está la raíz.
  outputFileTracingRoot: path.resolve(__dirname, '../..'),
};

export default nextConfig;
