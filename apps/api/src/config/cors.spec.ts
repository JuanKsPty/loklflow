import { CorsConfigError, corsOrigins, parseCorsOrigins } from './cors';

describe('orígenes permitidos', () => {
  it('sin configurar, cae al localhost de desarrollo', () => {
    expect(parseCorsOrigins(undefined)).toEqual(['http://localhost:3000']);
    expect(parseCorsOrigins('')).toEqual(['http://localhost:3000']);
    expect(parseCorsOrigins('   ')).toEqual(['http://localhost:3000']);
  });

  it('acepta uno y varios, con espacios de sobra', () => {
    expect(parseCorsOrigins('https://app.ejemplo.test')).toEqual([
      'https://app.ejemplo.test',
    ]);
    expect(parseCorsOrigins(' http://localhost:3000 , https://x.com ')).toEqual([
      'http://localhost:3000',
      'https://x.com',
    ]);
  });

  it('una coma de sobra no rompe la lista', () => {
    expect(parseCorsOrigins('https://x.com,,https://y.com,')).toEqual([
      'https://x.com',
      'https://y.com',
    ]);
  });

  it('no repite orígenes', () => {
    expect(parseCorsOrigins('https://x.com,https://x.com')).toEqual(['https://x.com']);
  });

  /**
   * El error más común y el más difícil de ver: `new URL('https://x.com/')` es válida, pero el
   * navegador compara la cabecera **como cadena** y manda `Origin: https://x.com` sin barra. Una
   * lista con barra final no coincide con nada y la aplicación deja de cargar datos con un error
   * de CORS en una consola que nadie mira.
   */
  it('rechaza una barra final o cualquier ruta', () => {
    expect(() => parseCorsOrigins('https://x.com/')).not.toThrow();
    expect(parseCorsOrigins('https://x.com/')).toEqual(['https://x.com']);
    expect(() => parseCorsOrigins('https://x.com/app')).toThrow(CorsConfigError);
    expect(() => parseCorsOrigins('https://x.com?a=1')).toThrow(CorsConfigError);
  });

  it('rechaza lo que no es un origen, nombrando el valor culpable', () => {
    // El mensaje tiene que decir **cuál** falla: una lista de seis con una mal es imposible de
    // depurar con un «CORS_ORIGINS inválida».
    expect(() => parseCorsOrigins('midominio.com')).toThrow(/midominio\.com/);
    expect(() => parseCorsOrigins('https //x.com')).toThrow(CorsConfigError);
    expect(() => parseCorsOrigins('https://x.com, no-vale')).toThrow(/no-vale/);
  });

  it('normaliza el puerto por defecto igual que el navegador', () => {
    // `https://x.com:443` y `https://x.com` son el mismo origen; el navegador manda el segundo.
    expect(parseCorsOrigins('https://x.com:443')).toEqual(['https://x.com']);
  });

  describe('aviso de producción', () => {
    it('avisa si en producción se cae al default', () => {
      const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);

      corsOrigins({ NODE_ENV: 'production' } as NodeJS.ProcessEnv);

      expect(warn).toHaveBeenCalledWith(expect.stringContaining('CORS_ORIGINS'));
      warn.mockRestore();
    });

    it('no avisa si está configurada', () => {
      const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);

      corsOrigins({
        NODE_ENV: 'production',
        CORS_ORIGINS: 'https://app.ejemplo.test',
      } as NodeJS.ProcessEnv);

      expect(warn).not.toHaveBeenCalled();
      warn.mockRestore();
    });
  });
});
