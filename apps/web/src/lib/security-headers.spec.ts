import { describe, expect, it } from 'vitest';
import { contentSecurityPolicy, securityHeaders } from './security-headers';

const PROD = { NODE_ENV: 'production', NEXT_PUBLIC_API_URL: 'https://loklflow.juank.tech' };
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
      expect(prod).toContain('https://loklflow.juank.tech');
      expect(prod).toContain('wss://loklflow.juank.tech');

      const dev = directive(contentSecurityPolicy(DEV), 'connect-src')!;
      expect(dev).toContain('http://localhost:3001');
      expect(dev).toContain('ws://localhost:3001');
    });

    it('sin API configurada no rompe: queda self', () => {
      const csp = contentSecurityPolicy({ NODE_ENV: 'production' });
      expect(directive(csp, 'connect-src')).toBe("connect-src 'self'");
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
     * El CSP entra en modo informe. Una directiva de menos rompe el tiempo real o el Service
     * Worker sin error de red, así que primero se observa y luego se obliga.
     */
    it('el CSP empieza en modo informe y se puede forzar', () => {
      const observando = securityHeaders(PROD);
      expect(value(observando, 'Content-Security-Policy-Report-Only')).toBeDefined();
      expect(value(observando, 'Content-Security-Policy')).toBeUndefined();

      const obligatorio = securityHeaders(PROD, { enforceCsp: true });
      expect(value(obligatorio, 'Content-Security-Policy')).toBeDefined();
      expect(value(obligatorio, 'Content-Security-Policy-Report-Only')).toBeUndefined();
    });
  });
});
