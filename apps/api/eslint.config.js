const base = require('@loklflow/config/eslint');

module.exports = [
  ...base,
  {
    files: ['**/*.ts'],
    rules: {
      // Nest usa decoradores y metadatos: los constructores con solo parámetros
      // inyectados y las clases DTO vacías son idiomáticos, no errores.
      '@typescript-eslint/no-extraneous-class': 'off',
    },
  },
  {
    files: ['**/*.spec.ts'],
    languageOptions: {
      globals: {
        describe: 'readonly',
        it: 'readonly',
        expect: 'readonly',
        beforeEach: 'readonly',
        afterEach: 'readonly',
        beforeAll: 'readonly',
        afterAll: 'readonly',
        jest: 'readonly',
      },
    },
  },
];
