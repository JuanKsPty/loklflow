import { config as loadEnv } from 'dotenv';
import path from 'node:path';
import type { NextConfig } from 'next';

// Next solo lee los .env de su propio directorio (apps/web), pero en este monorepo el
// .env vive en la raíz y lo comparte con la API: si el frontend no lo carga, JWT_SECRET
// queda undefined y la verificación de sesión rechaza a todo el mundo.
loadEnv({ path: path.resolve(__dirname, '../../.env') });

const nextConfig: NextConfig = {
  transpilePackages: ['@loklflow/types'],
};

export default nextConfig;
