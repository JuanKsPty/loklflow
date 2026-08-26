import { Raw } from 'typeorm';

/**
 * La búsqueda por texto de los catálogos, en un solo sitio.
 *
 * Antes de esto no había **ni un solo `ILIKE` en toda la API**: ningún listado del panel se podía
 * filtrar por nombre. Está aquí y no repartido por los servicios porque son ocho módulos los que
 * lo necesitan y las tres decisiones difíciles —acentos, comodines y longitud— hay que tomarlas
 * una vez.
 */

/**
 * Tope de longitud del término.
 *
 * No es cosmético. Un `LIKE '%…%'` no puede usar un índice: es un recorrido completo de la tabla
 * comparando carácter a carácter, y el coste crece con el largo del patrón. Sin tope, cualquiera
 * con una sesión válida manda 10 KB de basura por parámetro y pone a la base a masticar. 80 es de
 * sobra para el nombre más largo del catálogo (`ingredients.name` es `varchar(150)`).
 */
export const SEARCH_MAX_LENGTH = 80;

/**
 * Normaliza el término que llega por la URL: recorta los extremos y colapsa los espacios de en
 * medio, para que «  ron   abuelo » y «ron abuelo» busquen lo mismo.
 *
 * Lo importante es el final: **la cadena vacía vale `undefined`, no `''`**. Un `?q=` —que es lo
 * que manda un formulario cuando el usuario borra la caja y pulsa Enter— tiene que significar «sin
 * filtro». Devolver `''` lo convertiría en `LIKE '%%'`, que casualmente devuelve todo, pero por el
 * camino equivocado: seguiría sin usar índice, seguiría contando como filtro activo en la interfaz
 * y el estado vacío diría «nada que coincide» cuando no hay ninguna búsqueda puesta.
 */
export const toSearchTerm = ({ value }: { value: unknown }): string | undefined => {
  if (typeof value !== 'string') return undefined;
  const term = value.trim().replace(/\s+/g, ' ');
  return term === '' ? undefined : term;
};

/**
 * Envuelve una expresión SQL de texto en comodines de «contiene», **escapando antes los que
 * pudiera contener el propio valor**.
 *
 * El orden es lo único que importa aquí, y se paga caro si se invierte. Escapar en TypeScript,
 * antes de mandar el parámetro, **no funciona**: `unaccent` corre después y *fabrica* comodines
 * nuevos a partir de caracteres que no lo eran. Comprobado contra la base real — `unaccent('％')`
 * (el porcentaje ancho, el que sale de un teclado japonés o de copiar y pegar) devuelve `%`, y lo
 * mismo `＿` con el guion bajo. Buscar «％» devolvía **el catálogo entero** en vez de nada.
 *
 * Por eso se normaliza primero y se escapa después, ya en SQL, sobre el texto que de verdad va a
 * comparar Postgres. La barra invertida se dobla primero, o escaparía a los escapes de después.
 */
const contiene = (expr: string) =>
  `'%' || replace(replace(replace(${expr}, '\\', '\\\\'), '%', '\\%'), '_', '\\_') || '%'`;

/**
 * El fragmento SQL que compara sin acentos ni mayúsculas.
 *
 * `unaccent(lower(...))` en los **dos lados**: en la columna para que «Café» se vuelva «cafe», y
 * en el parámetro para que quien escriba «Café» con acento también encuentre un producto guardado
 * sin él. Con los dos lados ya normalizados basta `LIKE`; `ILIKE` sería redundante.
 *
 * El término va **siempre como parámetro enlazado y en crudo**. Solo el nombre de la columna y el
 * del parámetro se interpolan, y los dos los pone el código de la API, nunca la petición.
 */
export const unaccentedLike = (column: string, param = 'q') =>
  `unaccent(lower(${column})) LIKE ${contiene(`unaccent(lower(:${param}))`)} ESCAPE '\\'`;

/**
 * Lo mismo para las columnas que son un número: la mesa 12, la orden 105.
 *
 * Se compara el número **como texto** y con un «contiene», que es como lo busca una persona:
 * teclear «1» tiene que ofrecer la 1, la 10 y la 12 mientras se decide, no obligar a escribir el
 * número entero para ver una sola fila. Sin `unaccent`, que sobre dígitos no hace nada, pero con
 * el mismo escape: el término lo escribe quien sea y puede traer un `%`.
 */
export const numberLike = (column: string, param = 'q') =>
  `CAST(${column} AS TEXT) LIKE ${contiene(`:${param}`)} ESCAPE '\\'`;

/**
 * Para los servicios que usan `repo.find()` en vez de un QueryBuilder, que son la mayoría del
 * catálogo. Con esto el filtro de un listado es **una línea**, en vez de reescribir el servicio
 * entero a QueryBuilder solo para poder poner un `andWhere`.
 *
 * `param` casi nunca hay que pasarlo, pero existe por una razón concreta: TypeORM mete los
 * parámetros de todos los `Raw` de una misma consulta en el mismo saco, así que dos con la misma
 * clave y **distinto valor** se pisan y el segundo gana en silencio. Filtrar productos por nombre
 * y por categoría a la vez es justo ese caso; buscar el mismo término en dos columnas —nombre y
 * correo del empleado— no lo es, porque el valor coincide.
 */
export function matchesText(term: string, param = 'q') {
  return Raw((alias) => unaccentedLike(alias, param), { [param]: term });
}

/** La versión numérica de `matchesText`. Ver `numberLike`. */
export function matchesNumberText(term: string, param = 'q') {
  return Raw((alias) => numberLike(alias, param), { [param]: term });
}

/**
 * Igualdad tolerante a acentos y mayúsculas, para lo que se elige de un desplegable.
 *
 * La categoría **no** se compara con un «contiene»: el valor no lo teclea nadie, sale de una lista
 * cerrada, y con «contiene» elegir «Bebidas» arrastraría también «Bebidas calientes» sin que nada
 * en la pantalla explicara por qué. Aquí no hacen falta escapes: no hay comodines de por medio.
 */
export const unaccentedEquals = (column: string, param = 'q') =>
  `unaccent(lower(${column})) = unaccent(lower(:${param}))`;

/** Ver `unaccentedEquals`. */
export function equalsText(term: string, param = 'q') {
  return Raw((alias) => unaccentedEquals(alias, param), { [param]: term });
}
