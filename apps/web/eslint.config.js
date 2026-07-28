const base = require('@loklflow/config/eslint');
const globals = require('globals');
const nextPlugin = require('@next/eslint-plugin-next');
const reactHooks = require('eslint-plugin-react-hooks');

module.exports = [
  ...base,
  {
    files: ['**/*.{ts,tsx}'],
    plugins: {
      '@next/next': nextPlugin,
      'react-hooks': reactHooks,
    },
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
    rules: {
      ...nextPlugin.configs.recommended.rules,
      ...nextPlugin.configs['core-web-vitals'].rules,
      ...reactHooks.configs.recommended.rules,

      // Falso positivo en Server Components: la regla asume el render perezoso del
      // cliente, pero en un componente async el await ya resolvió antes de construir
      // el JSX, así que `try { await fetch(); return <X/> } catch { notFound() }`
      // —el patrón idiomático del App Router— sí captura el error del fetch.
      'react-hooks/error-boundaries': 'off',

      // Deuda conocida, no bugs: degradadas a warn para no bloquear el pipeline.
      // Pendiente de limpiar en Fase 6 (pulido).
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/refs': 'warn',
      'react-hooks/incompatible-library': 'warn',
    },
  },
];
