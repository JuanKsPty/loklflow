import { describe, expect, it } from 'vitest';
import { contentSecurityPolicy, securityHeaders } from './security-headers';
import { DEFAULT_API_URL } from './api/base-url';

const PROD = { NODE_ENV: 'production', NEXT_PUBLIC_API_URL: 'https://api.ejemplo.test' };
const DEV = { NODE_ENV: 'development', NEXT_PUBLIC_API_URL: 'http://localhost:3001' };

const directive = (csp: string, name: string) =>
  csp
    .split(';')
    .map((d) => d.trim())
    .find((d) => d.startsWith(`${name} `));

describe('cabeceras de seguridad del front', () => {
  describe('CSP', () => {
    it('cierra lo que no se usa', () => {
      const csp = contentSecurityPolicy(PROD);

      expect(directive(csp, 'default-src')).toBe("default-src 'self'");
      expect(directive(csp, 'object-src')).toBe("object-src 'none'");
      expect(directive(csp, 'frame-ancestors')).toBe("frame-ancestors 'none'");
      expect(directive(csp, 'base-uri')).toBe("base-uri 'self'");
    });

    /**
     * El fallo más probable de todo el bloque: `connect-src` no deriva `wss:` de `https:`, así que
     * sin la línea del socket el tiempo real deja de funcionar **sin un solo error de red** —solo
     * una violación de CSP en una consola que nadie mira— y la pantalla simplemente deja de
     * actualizarse sola.
     */
    it('deja conectar el socket, no solo el HTTP de la API', () => {
      const prod = directive(contentSecurityPolicy(PROD), 'connect-src')!;
      expect(prod).toContain('https://api.ejemplo.test');
      expect(prod).toContain('wss://api.ejemplo.test');

      const dev = directive(contentSecurityPolicy(DEV), 'connect-src')!;
      expect(dev).toContain('http://localhost:3001');
      expect(dev).toContain('ws://localhost:3001');
    });

    /**
     * **El caso que tumbó el CI.** Sin `NEXT_PUBLIC_API_URL`, el cliente HTTP llama a
     * `http://localhost:3001`, así que un `connect-src` con solo `'self'` produce una aplicación
     * donde el navegador bloquea **todas** las llamadas por política, sin un error de red: solo
     * una línea en la consola. Con el CSP en modo informe era invisible; obligándolo, es una
     * aplicación muerta. En local no se veía porque el `.env` de la raíz define la variable.
     */
    it('sin API configurada, el CSP permite el mismo origen por defecto que usa el cliente', () => {
      const csp = contentSecurityPolicy({ NODE_ENV: 'production' });
      const connect = directive(csp, 'connect-src')!;

      expect(connect).toContain("'self'");
      expect(connect).toContain(DEFAULT_API_URL);
      expect(connect).toContain('ws://localhost:3001');
    });

    it('una URL inválida no tumba la configuración', () => {
      const csp = contentSecurityPolicy({ NEXT_PUBLIC_API_URL: 'no-es-una-url' });
      expect(directive(csp, 'connect-src')).toBe("connect-src 'self'");
    });

    /**
     * `next/font` auto-hospeda Geist en el build. Abrir `fonts.gstatic.com` sería regalar un
     * origen externo por una petición que no existe: es la línea que casi todos los ejemplos de
     * CSP para Next traen de más.
     */
    it('no abre orígenes externos para fuentes', () => {
      const csp = contentSecurityPolicy(PROD);
      expect(csp).not.toContain('fonts.gstatic.com');
      expect(csp).not.toContain('fonts.googleapis.com');
    });

    it('permite el Service Worker y el manifiesto', () => {
      const csp = contentSecurityPolicy(PROD);
      expect(directive(csp, 'worker-src')).toContain("'self'");
      expect(directive(csp, 'manifest-src')).toBe("manifest-src 'self'");
    });

    it('unsafe-eval solo en desarrollo, que es donde lo pide la recarga en caliente', () => {
      expect(directive(contentSecurityPolicy(DEV), 'script-src')).toContain("'unsafe-eval'");
      expect(directive(contentSecurityPolicy(PROD), 'script-src')).not.toContain("'unsafe-eval'");
    });

    /**
     * Riesgo residual aceptado y escrito en `docs/SECURITY.md`: un nonce rompería
     * `global-error.tsx`, cuyos estilos van en línea precisamente porque una de las causas de
     * llegar ahí es que la hoja no haya cargado.
     */
    it('mantiene unsafe-inline en estilos, que es la deuda conocida', () => {
      expect(directive(contentSecurityPolicy(PROD), 'style-src')).toContain("'unsafe-inline'");
    });
  });

  describe('el resto de cabeceras', () => {
    const value = (headers: { key: string; value: string }[], key: string) =>
      headers.find((h) => h.key === key)?.value;

    it('están todas', () => {
      const headers = securityHeaders(PROD);

      expect(value(headers, 'X-Frame-Options')).toBe('DENY');
      expect(value(headers, 'X-Content-Type-Options')).toBe('nosniff');
      expect(value(headers, 'Referrer-Policy')).toBe('strict-origin-when-cross-origin');
      expect(value(headers, 'Permissions-Policy')).toContain('camera=()');
    });

    it('HSTS solo en producción', () => {
      expect(value(securityHeaders(PROD), 'Strict-Transport-Security')).toBeDefined();
      expect(value(securityHeaders(DEV), 'Strict-Transport-Security')).toBeUndefined();
    });

    /**
     * El CSP es **obligatorio** por defecto. Estuvo en modo informe mientras se comprobaba que
     * ninguna pantalla lo violaba —lo hizo `e2e/seguridad.spec.ts`, que además destapó el
     * `new Function` de Zod—, y el interruptor se conserva para poder volver a observar desde un
     * solo sitio si hay que diagnosticar algo en producción.
     */
    it('el CSP se sirve como obligatorio', () => {
      const headers = securityHeaders(PROD);
      expect(value(headers, 'Content-Security-Policy')).toBeDefined();
      expect(value(headers, 'Content-Security-Policy-Report-Only')).toBeUndefined();
    });

    it('se puede volver a modo informe sin tocar la política', () => {
      const observando = securityHeaders(PROD, { enforceCsp: false });
      expect(value(observando, 'Content-Security-Policy-Report-Only')).toBe(
        value(securityHeaders(PROD), 'Content-Security-Policy'),
      );
      expect(value(observando, 'Content-Security-Policy')).toBeUndefined();
    });

    /** Sin `'unsafe-eval'` en producción: es lo que obligó a poner Zod en modo `jitless`. */
    it('en producción el script-src no permite evaluar cadenas', () => {
      const csp = value(securityHeaders(PROD), 'Content-Security-Policy') ?? '';
      expect(csp).not.toContain("'unsafe-eval'");
    });
  });
});
