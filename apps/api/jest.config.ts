import type { Config } from 'jest';

const config: Config = {
  rootDir: 'src',
  moduleFileExtensions: ['js', 'json', 'ts'],
  testRegex: '.*\\.spec\\.ts$',
  // `orders.int-spec.ts` también termina en `spec.ts`, así que el testRegex de arriba lo
  // capturaría. Los de integración necesitan Postgres y su propio arranque: van por
  // `pnpm test:int` con jest.integration.config.ts.
  testPathIgnorePatterns: ['\\.int-spec\\.ts$'],
  transform: {
    '^.+\\.(t|j)s$': 'ts-jest',
  },
  testEnvironment: 'node',
  collectCoverageFrom: ['**/*.(t|j)s', '!**/*.entity.ts', '!**/*.dto.ts', '!main.ts'],
  // Dentro del paquete, para que coincida con `outputs: ["coverage/**"]` de turbo.json.
  coverageDirectory: '<rootDir>/../coverage',
};

export default config;
