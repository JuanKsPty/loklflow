import type { Config } from 'jest';

/**
 * Tests de integración: la app real, contra un Postgres real.
 *
 * Configuración aparte de `jest.config.ts` porque los unitarios corren con `rootDir: src`
 * y sin base de datos, y aquí hace falta la carpeta `test/` del arnés además de `src/`.
 */
const config: Config = {
  rootDir: '.',
  moduleFileExtensions: ['js', 'json', 'ts'],
  // Los `.int-spec.ts` viven junto al código que prueban, como el resto de las specs del
  // proyecto. El `jest.config.ts` de los unitarios los excluye por nombre.
  testRegex: '.*\\.int-spec\\.ts$',
  transform: {
    '^.+\\.(t|j)s$': 'ts-jest',
  },
  testEnvironment: 'node',
  // Una sola base compartida: en paralelo, la suite que trunca dejaría a las demás sin
  // datos a media ejecución.
  maxWorkers: 1,
  // Arrancar el módulo entero de Nest y conectar a Postgres no cabe en los 5 s por defecto.
  testTimeout: 30000,
  globalSetup: '<rootDir>/test/global-setup.ts',
  setupFiles: ['<rootDir>/test/setup-files.ts'],
};

export default config;
