import { describe, expect, it } from 'vitest';
import { parseCsv } from './parse';
import { buildPreview, headerKey, toPayload, type Catalogo } from './products';

const CATALOGO: Catalogo = {
  productos: [{ id: 'p1', name: 'Taco al pastor' }],
  categorias: [{ id: 'c1', name: 'Bebidas' }],
};

const previsualizar = (csv: string, catalogo: Catalogo = CATALOGO) =>
  buildPreview(parseCsv(csv), catalogo);

describe('headerKey', () => {
  it('normaliza acentos, mayúsculas y separadores', () => {
    expect(headerKey('Descripción')).toBe('descripcion');
    expect(headerKey('Stock mínimo')).toBe('stockminimo');
  });

  it('ignora la nota entre paréntesis', () => {
    expect(headerKey('Precio (MXN)')).toBe('precio');
  });
});

describe('buildPreview — cabeceras', () => {
  it('acepta cabeceras con acentos y mayúsculas', () => {
    const r = previsualizar(
      'Nombre;Descripción;Precio;Categoría;Estación;Stock;Stock mínimo;Activo\r\nAgua;;10;Bebidas;barra;5;1;sí',
    );
    expect(r.fileErrors).toEqual([]);
    expect(r.rows[0]).toMatchObject({ action: 'create' });
    expect(r.rows[0].payload).toMatchObject({ station: 'bar', stock: 5, isActive: true });
  });

  it('acepta alias', () => {
    const r = previsualizar('producto,precio de venta,grupo\r\nAgua,10,Bebidas');
    expect(r.fileErrors).toEqual([]);
    expect(r.rows[0].payload).toMatchObject({ name: 'Agua', price: 10, categoryName: 'Bebidas' });
  });

  it('las columnas de más se ignoran y se listan', () => {
    const r = previsualizar('nombre,precio,costo,proveedor\r\nAgua,10,3,ACME');
    expect(r.ignoredColumns).toEqual(['costo', 'proveedor']);
    expect(r.rows[0].action).toBe('create');
  });

  it('sin la columna nombre es un error de archivo, no de fila', () => {
    const r = previsualizar('precio,categoria\r\n10,Bebidas');
    expect(r.fileErrors.join(' ')).toMatch(/nombre/);
    expect(r.rows).toEqual([]);
  });

  it('sin la columna precio también', () => {
    const r = previsualizar('nombre,categoria\r\nAgua,Bebidas');
    expect(r.fileErrors.join(' ')).toMatch(/precio/);
  });

  it('una cabecera duplicada gana la primera y deja aviso', () => {
    const r = previsualizar('precio,nombre,precio\r\n10,Agua,20');
    expect(r.rows[0].payload?.price).toBe(10);
    expect(r.fileWarnings.join(' ')).toMatch(/dos veces/i);
  });
});

describe('buildPreview — filas', () => {
  it('clasifica como actualización contra el catálogo, sin importar mayúsculas', () => {
    const r = previsualizar('nombre,precio\r\nTACO AL PASTOR,99');
    expect(r.rows[0].action).toBe('update');
  });

  it('una columna opcional ausente no borra el dato existente', () => {
    const r = previsualizar('nombre,precio\r\nAgua,10');
    expect(toPayload(r.rows[0])).not.toHaveProperty('description');
  });

  it('y una celda vacía tampoco', () => {
    const r = previsualizar('nombre,precio,descripcion\r\nAgua,10,');
    expect(toPayload(r.rows[0])).not.toHaveProperty('description');
  });

  it('una fila corta se rellena con vacío', () => {
    const r = previsualizar('nombre,precio,categoria\r\nAgua,10');
    expect(r.rows[0].action).toBe('create');
    expect(r.rows[0].payload).not.toHaveProperty('categoryName');
  });

  it('una fila larga con celdas vacías de más se acepta', () => {
    expect(previsualizar('nombre,precio\r\nAgua,10,').rows[0].action).toBe('create');
  });

  it('una fila larga con contenido de más es error y sugiere la coma sin comillas', () => {
    // Es el síntoma exacto de `Taco, doble,95`: el precio ya cayó en la columna equivocada.
    const r = previsualizar('nombre,precio\r\nTaco, doble,95');
    expect(r.rows[0]).toMatchObject({ action: 'error' });
    expect(r.rows[0].reason).toMatch(/coma/i);
  });

  it('dos filas con el mismo nombre quedan las dos en error, citando ambas líneas', () => {
    const r = previsualizar('nombre,precio\r\nAgua,10\r\nAGUA,20');
    expect(r.rows.map((x) => x.action)).toEqual(['error', 'error']);
    for (const fila of r.rows) expect(fila.reason).toMatch(/líneas 2 y 3/);
  });

  it('dos filas que solo difieren en el acento no son duplicado, pero avisan', () => {
    const r = previsualizar('nombre,precio\r\nCafe,10\r\nCafé,20', {
      productos: [{ id: 'p9', name: 'Café' }],
      categorias: [],
    });
    expect(r.rows[0].action).toBe('create');
    expect(r.rows[0].warnings.join(' ')).toMatch(/se parece a «Café»/i);
    expect(r.rows[1].action).toBe('update');
  });

  it('un producto ya duplicado en la base falla en vez de adivinar cuál actualizar', () => {
    const r = previsualizar('nombre,precio\r\nAgua,10', {
      productos: [
        { id: 'a', name: 'Agua' },
        { id: 'b', name: 'agua' },
      ],
      categorias: [],
    });
    expect(r.rows[0]).toMatchObject({ action: 'error' });
    expect(r.rows[0].reason).toMatch(/más de un producto/i);
  });

  it('una celda con caracteres ilegibles es error de fila', () => {
    const r = previsualizar('nombre,precio\r\nPi�a,10');
    expect(r.rows[0]).toMatchObject({ action: 'error' });
    expect(r.rows[0].reason).toMatch(/ilegibles/i);
  });

  it('una estación desconocida enumera las tres aceptadas', () => {
    const r = previsualizar('nombre,precio,estacion\r\nAgua,10,freidora');
    expect(r.rows[0].reason).toMatch(/cocina.*barra.*inmediato/i);
  });

  it('un «activo» que no se entiende no cae a falso', () => {
    const r = previsualizar('nombre,precio,activo\r\nAgua,10,tal vez');
    expect(r.rows[0]).toMatchObject({ action: 'error' });
  });

  it('detecta la fila de ejemplo que la plantilla trae', () => {
    const r = previsualizar('nombre,precio\r\nBORRA ESTA FILA (ejemplo),10');
    expect(r.rows[0].reason).toMatch(/ejemplo/i);
  });

  it('un nombre de más de 150 caracteres se rechaza aquí, no en la base', () => {
    // `ingredients.name` es varchar(150) y el espejo de un producto se llama igual.
    const r = previsualizar(`nombre,precio\r\n${'x'.repeat(151)},10`);
    expect(r.rows[0].reason).toMatch(/150/);
  });

  it('las categorías que faltan se listan para poder ofrecer crearlas', () => {
    const r = previsualizar('nombre,precio,categoria\r\nAgua,10,Postres\r\nJugo,12,Bebidas');
    expect(r.missingCategories).toEqual(['Postres']);
  });

  it('la fila arrastra el texto crudo para poder enseñarlo junto a lo interpretado', () => {
    const r = previsualizar('nombre,precio\r\nAgua,"$ 12,50"');
    expect(r.rows[0].raw.precio).toBe('$ 12,50');
    expect(r.rows[0].payload?.price).toBe(12.5);
  });
});

describe('toPayload', () => {
  it('no lleva ni una clave de más', () => {
    // `forbidNonWhitelisted`: una sola clave de sobra responde 400 y se pierde la tanda entera.
    const r = previsualizar(
      'nombre,descripcion,precio,categoria,estacion,stock,stock_minimo,activo\r\nAgua,fría,10,Bebidas,barra,5,1,sí',
    );
    expect(Object.keys(toPayload(r.rows[0])).sort()).toEqual(
      [
        'categoryName',
        'description',
        'isActive',
        'line',
        'minimumStock',
        'name',
        'price',
        'station',
        'stock',
      ].sort(),
    );
  });

  it('con lo mínimo, solo lo mínimo', () => {
    const r = previsualizar('nombre,precio\r\nAgua,10');
    expect(Object.keys(toPayload(r.rows[0])).sort()).toEqual(['line', 'name', 'price']);
  });

  it('conserva el número de línea del archivo, no el índice de la tanda', () => {
    // La fila en blanco de en medio no renumera: la segunda sigue siendo la línea 4 del archivo.
    const r = previsualizar('nombre,precio\r\nAgua,1\r\n\r\nJugo,2');
    expect(toPayload(r.rows[1]).line).toBe(4);
  });
});
