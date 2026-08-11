const base = require('@loklflow/config/eslint');
const globals = require('globals');
const nextPlugin = require('@next/eslint-plugin-next');
const reactHooks = require('eslint-plugin-react-hooks');
const jsxA11y = require('eslint-plugin-jsx-a11y');

module.exports = [
  ...base,
  {
    files: ['**/*.{ts,tsx}'],
    plugins: {
      '@next/next': nextPlugin,
      'react-hooks': reactHooks,
      'jsx-a11y': jsxA11y,
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

      /**
       * Accesibilidad estática. Es la mitad que se puede comprobar sin renderizar; la otra
       * —contraste, nombres accesibles calculados, orden de foco— la cubre `e2e/a11y.spec.ts`
       * con axe sobre las cinco pantallas.
       *
       * En `error` desde el principio y no en `warn`: el árbol está limpio hoy, y un `warn` que
       * nadie mira es exactamente cómo llegaron aquí las tres reglas de abajo.
       */
      ...jsxA11y.flatConfigs.recommended.rules,

      /**
       * Envolver el campo dentro de la etiqueta **es** una asociación válida, y es el patrón que
       * usa el filtro de fechas de la bitácora —un formulario GET nativo, sin JavaScript—. Con
       * el ajuste por defecto (`htmlFor`) la regla lo marcaba como error; `either` acepta las dos
       * formas, y `controlComponents` le enseña que `Input` es un campo y no un `div` cualquiera.
       */
      'jsx-a11y/label-has-associated-control': [
        'error',
        { assert: 'either', controlComponents: ['Input', 'Textarea', 'SelectTrigger'], depth: 3 },
      ],

      // Falso positivo en Server Components: la regla asume el render perezoso del
      // cliente, pero en un componente async el await ya resolvió antes de construir
      // el JSX, así que `try { await fetch(); return <X/> } catch { notFound() }`
      // —el patrón idiomático del App Router— sí captura el error del fetch.
      'react-hooks/error-boundaries': 'off',

      /**
       * `set-state-in-effect` y `refs` **ya están limpias** y suben a `error`: lo que quedaba
       * eran cuatro escrituras de estado en efectos de montaje y un ref escrito durante el
       * render, y todas tenían un síntoma visible —el plano del salón daba un salto al cargar,
       * `useIsMobile` devolvía `false` en la primera pintura aunque el aparato fuera un móvil—.
       *
       * `incompatible-library` se queda en `warn`, y no es deuda: es el compilador de React
       * diciendo que no puede optimizar dos componentes porque usan `react-hook-form`. No hay
       * nada que arreglar salvo cambiar de librería de formularios, así que ponerlo en `error`
       * sería bloquear el pipeline por una decisión que ya está tomada.
       */
      'react-hooks/set-state-in-effect': 'error',
      'react-hooks/refs': 'error',
      'react-hooks/incompatible-library': 'warn',
    },
  },
  {
    /**
     * Las primitivas del sistema de diseño quedan fuera de `label-has-associated-control`.
     *
     * `ui/label.tsx` **es** un `<label>` genérico: la asociación la pone quien lo usa, y ahí sí
     * se comprueba. Exigírsela a la definición obligaría a inventar un `htmlFor` que no existe
     * todavía. Que las pantallas de verdad estén bien lo vigila `e2e/a11y.spec.ts` con axe, que
     * mira el árbol renderizado y no el archivo.
     */
    files: ['src/components/ui/**/*.tsx'],
    rules: {
      'jsx-a11y/label-has-associated-control': 'off',
    },
  },
];
