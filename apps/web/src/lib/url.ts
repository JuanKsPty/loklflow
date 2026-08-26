/**
 * El constructor de URLs con filtros, en un solo sitio.
 *
 * Los filtros del panel viven en la query string y no en estado de cliente, que es la regla que
 * el propio panel se puso con el chip de bajo mínimo: así la vista filtrada es una URL que se
 * puede guardar, mandar por mensaje y abrir cada mañana.
 *
 * Eso solo funciona si **cada enlace conserva los demás parámetros**. Hasta ahora cada pantalla
 * lo resolvía a su manera —o no lo resolvía: los tres componentes de pestañas construían
 * `?tab=x` a pelo y borraban todo lo demás—, así que la parte genérica vive aquí y `pageHref`
 * de la paginación la reutiliza.
 */

/** Un valor ausente, vacío o `false` no se escribe: la URL canónica no lleva ruido. */
export type UrlParams = Record<string, string | number | boolean | undefined | null>;

/**
 * Construye `basePath?a=1&b=2` a partir de un objeto, omitiendo lo que no aporta.
 *
 * `URLSearchParams` y no una plantilla: un nombre de categoría en español lleva acentos y puede
 * llevar `&` («Bebidas & Café»), y concatenarlo a mano parte la URL en dos parámetros.
 */
export function buildHref(basePath: string, params: UrlParams = {}): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '' || value === false) continue;
    search.set(key, String(value));
  }
  const qs = search.toString();
  return qs ? `${basePath}?${qs}` : basePath;
}

/**
 * Los mismos parámetros con unos cuantos cambiados. Pasar `undefined` en `changes` **quita** el
 * parámetro, que es como se escribe un «Todos» o un «Quitar filtros».
 */
export function hrefWith(basePath: string, params: UrlParams, changes: UrlParams): string {
  return buildHref(basePath, { ...params, ...changes });
}

/** ¿Hay algún filtro puesto? Es lo que decide si una tabla vacía dice «no hay» o «no coincide». */
export function hasAnyFilter(params: UrlParams): boolean {
  return Object.entries(params).some(
    ([, v]) => v !== undefined && v !== null && v !== '' && v !== false,
  );
}
