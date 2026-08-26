import {
  numberLike,
  toSearchTerm,
  unaccentedEquals,
  unaccentedLike,
  SEARCH_MAX_LENGTH,
} from './search';

describe('toSearchTerm', () => {
  it('recorta los extremos', () => {
    expect(toSearchTerm({ value: '  cerveza  ' })).toBe('cerveza');
  });

  it('colapsa los espacios de en medio', () => {
    expect(toSearchTerm({ value: 'ron   abuelo' })).toBe('ron abuelo');
  });

  // Es lo que manda un formulario cuando se borra la caja y se pulsa Enter, y tiene que
  // significar «sin filtro»: con `''` la interfaz creería que hay una búsqueda puesta y el
  // estado vacío diría «nada que coincide» sin que nadie haya buscado nada.
  it('la cadena vacía no es un término, es la ausencia de término', () => {
    expect(toSearchTerm({ value: '' })).toBeUndefined();
    expect(toSearchTerm({ value: '   ' })).toBeUndefined();
  });

  it('ignora lo que no sea texto', () => {
    expect(toSearchTerm({ value: undefined })).toBeUndefined();
    expect(toSearchTerm({ value: 42 })).toBeUndefined();
    expect(toSearchTerm({ value: ['a', 'b'] })).toBeUndefined();
  });

  it('respeta los acentos: normalizar es cosa de Postgres, no de aquí', () => {
    expect(toSearchTerm({ value: ' Café ' })).toBe('Café');
  });
});

describe('unaccentedLike', () => {
  it('normaliza los dos lados de la comparación', () => {
    const sql = unaccentedLike('p.name');
    expect(sql.startsWith('unaccent(lower(p.name)) LIKE')).toBe(true);
    expect(sql).toContain('unaccent(lower(:q))');
  });

  /**
   * El orden importa y costó encontrarlo. Escapar en TypeScript, antes de mandar el parámetro,
   * no sirve: `unaccent` corre después y **fabrica** comodines a partir de caracteres que no lo
   * eran —`unaccent('％')` es `%`—, así que buscar «％» devolvía el catálogo entero. Se normaliza
   * primero y se escapa después, ya dentro del SQL.
   */
  it('escapa los comodines DESPUÉS de quitar los acentos, no antes', () => {
    const sql = unaccentedLike('p.name');
    const escape = sql.indexOf('replace(');
    const normaliza = sql.indexOf('unaccent(lower(:q))');
    expect(escape).toBeGreaterThan(-1);
    expect(normaliza).toBeGreaterThan(escape); // el replace envuelve al unaccent del parámetro
    expect(sql).toContain("ESCAPE '\\'");
  });

  it('los comodines los pone el SQL, no el parámetro', () => {
    expect(unaccentedLike('p.name')).toContain("'%' ||");
  });

  // Dos filtros en la misma consulta necesitan parámetros distintos o se pisan.
  it('acepta otro nombre de parámetro', () => {
    expect(unaccentedLike('c.name', 'cat')).toContain(':cat');
  });
});

describe('unaccentedEquals', () => {
  /**
   * La categoría sale de un desplegable, no de un teclado: con un «contiene», elegir «Bebidas»
   * arrastraría «Bebidas calientes» sin que nada explicara por qué.
   */
  it('compara por igualdad, sin comodines', () => {
    const sql = unaccentedEquals('c.name', 'cat');
    expect(sql).toBe('unaccent(lower(c.name)) = unaccent(lower(:cat))');
    expect(sql).not.toContain('%');
  });
});

describe('numberLike', () => {
  it('compara el número como texto, con un «contiene»', () => {
    const sql = numberLike('t.number');
    expect(sql).toContain('CAST(t.number AS TEXT) LIKE');
    expect(sql).toContain("'%' ||");
  });

  // Sin unaccent no se fabrican comodines, pero el término lo escribe cualquiera igual.
  it('también escapa lo que teclee el usuario', () => {
    expect(numberLike('o.order_number')).toContain('replace(');
  });
});

describe('SEARCH_MAX_LENGTH', () => {
  // `ingredients.name` es varchar(150), pero un LIKE '%…%' no usa índice y su coste crece con el
  // largo del patrón: el tope es para que nadie mande 10 KB por la URL.
  it('deja sitio de sobra para un nombre del catálogo', () => {
    expect(SEARCH_MAX_LENGTH).toBeGreaterThanOrEqual(60);
    expect(SEARCH_MAX_LENGTH).toBeLessThanOrEqual(150);
  });
});
