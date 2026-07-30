import type { Config } from 'jest';

/**
 * El paquete es casi todo tipos, pero contiene helpers puros de dinero
 * (`taxBreakdown`) que sí necesitan pruebas.
 */
const config: Config = {
  rootDir: 'src',
  moduleFileExtensions: ['js', 'json', 'ts'],
  testRegex: '.*\\.spec\\.ts$',
  transform: { '^.+\\.ts$': 'ts-jest' },
  testEnvironment: 'node',
};

export default config;
