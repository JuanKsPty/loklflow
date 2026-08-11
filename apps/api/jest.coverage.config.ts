import type { Config } from 'jest';

/**
 * Cobertura **combinada** de unitarios e integración, en un solo informe.
 *
 * El ROADMAP pedía «70 % en servicios», y medirlo solo sobre los unitarios sería medir la cosa
 * equivocada. La convención de este repo es specs unitarias de **funciones puras** más int-specs
 * para los servicios: llegar al 70 % unitario en `orders.service.ts` —486 líneas de orquestación de
 * repositorios— exige mockear `Repository`, `QueryRunner`, `RealtimeGateway` y `AuditService`, y
 * esos tests afirman que el código llama a los mocks que le dijiste que llamara. Se pondrían verdes
 * mientras lo que de verdad protege el dinero es `orders.int-spec.ts`.
 *
 * Así que la cobertura se mide sobre las dos suites juntas y el umbral se pone ahí.
 *
 * **Es una sola ejecución, no `projects`.** La versión con
 * `projects: [jest.config.ts, jest.integration.config.ts]` da números falsos: cada proyecto
 * instrumenta *todo* `collectCoverageFrom`, así que el de integración declaraba `availability.ts`,
 * `cors.ts` o `pin-policy.ts` con 0 líneas cubiertas de N —nunca las carga—, y al fundir los dos
 * mapas Istanbul **suma los denominadores**: un archivo con spec al 100 % salía al 50 %, `cors.ts`
 * al 32 % y el global al 42 % con la cobertura real por encima del 85 %. Un umbral fijado sobre
 * eso no habría medido nada.
 *
 * Por eso hereda del arnés de integración (`rootDir`, `globalSetup`, `setupFiles`, `maxWorkers: 1`)
 * y solo ensancha el `testRegex` para que entren también los `.spec.ts`. Necesita Postgres, como
 * `test:int`; `pnpm test` sigue siendo el rápido y sin base.
 *
 * **Cuidado al añadir configs**: todo `jest.*.config.ts` en la raíz del paquete tiene que estar en
 * el `exclude` de `tsconfig.build.json`, o eleva el `rootDir` que infiere tsc y la salida pasa de
 * `dist/main.js` a `dist/src/main.js`, rompiendo `start`.
 */
const config: Config = {
  rootDir: '.',
  moduleFileExtensions: ['js', 'json', 'ts'],
  // Las dos suites en la misma pasada: `.spec.ts` y `.int-spec.ts`.
  testRegex: '.*\\.(spec|int-spec)\\.ts$',
  transform: {
    '^.+\\.(t|j)s$': 'ts-jest',
  },
  testEnvironment: 'node',
  maxWorkers: 1,
  testTimeout: 30000,
  globalSetup: '<rootDir>/test/global-setup.ts',
  setupFiles: ['<rootDir>/test/setup-files.ts'],

  collectCoverage: true,
  collectCoverageFrom: [
    '<rootDir>/src/**/*.(t|j)s',
    // Los propios tests no son código que cubrir.
    '!<rootDir>/src/**/*.spec.ts',
    '!<rootDir>/src/**/*.int-spec.ts',
    '!<rootDir>/src/**/*.entity.ts',
    '!<rootDir>/src/**/*.dto.ts',
    '!<rootDir>/src/**/*.module.ts',
    '!<rootDir>/src/main.ts',
    // Las migraciones y las siembras son scripts de una sola ejecución: se verifican corriéndolas
    // (el `global-setup` levanta el esquema desde cero en cada suite), no midiendo sus líneas.
    '!<rootDir>/src/database/migrations/**',
    '!<rootDir>/src/database/seeds/**',
  ],
  coverageDirectory: '<rootDir>/coverage',
  coverageReporters: ['text-summary', 'lcov'],

  /**
   * Los números salen de **medir**, no de elegirlos.
   *
   * Un umbral por encima de lo real pone el CI en rojo el primer día, y así es como los umbrales
   * acaban borrados. Estos son los medidos con un margen abajo —dos puntos, cinco en ramas— y
   * suben cuando suba la cobertura, en un commit aparte para que el trinquete quede en el historial.
   */
  coverageThreshold: {
    // Medido: 93.69 / 76.83 / 91.14 / 94.26 sobre todo lo que no es un servicio.
    global: {
      statements: 90,
      branches: 70,
      functions: 88,
      lines: 92,
    },
    /**
     * La entrada que responde literalmente al ROADMAP —«70 % en servicios»—, separada del global
     * para que los ficheros de arranque y configuración no la diluyan.
     *
     * Dos reglas de Jest que no son evidentes y que cambian lo que significan estos números:
     *
     * 1. Un archivo que casa con una entrada por glob **sale del grupo `global`**. O sea que el
     *    `global` de arriba mide todo *menos* los servicios.
     * 2. Un umbral con glob se aplica **archivo por archivo**, no al agregado. Así que estos son
     *    suelos individuales, no una media: el agregado real es 90.63 / 72.94 / 93.05, y el
     *    archivo más flojo de cada columna marca 73.68 / 52.94 / 84.21.
     *
     * El suelo de ramas es el más bajo por un motivo concreto: `orders-merge.service.ts` está
     * lleno de guardas que solo se disparan con datos imposibles de montar desde HTTP sin
     * corromper la base a mano.
     */
    './src/**/*.service.ts': {
      statements: 70,
      branches: 50,
      lines: 80,
    },
  },
};

export default config;
