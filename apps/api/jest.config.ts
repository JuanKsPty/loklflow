import type { Config } from 'jest';

const config: Config = {
  rootDir: 'src',
  moduleFileExtensions: ['js', 'json', 'ts'],
  testRegex: '.*\\.spec\\.ts$',
  transform: {
    '^.+\\.(t|j)s$': 'ts-jest',
  },
  testEnvironment: 'node',
  collectCoverageFrom: ['**/*.(t|j)s', '!**/*.entity.ts', '!**/*.dto.ts', '!main.ts'],
  // Dentro del paquete, para que coincida con `outputs: ["coverage/**"]` de turbo.json.
  coverageDirectory: '<rootDir>/../coverage',
};

export default config;
