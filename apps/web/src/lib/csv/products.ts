import type { PreparationStation } from '@loklflow/types';
import type { CsvTable } from './parse';
import { fold, isBlank, parseBoolean, parseDecimal, parsePrice, parseStation, productKey } from './coerce';

export const PRODUCT_IMPORT_COLUMNS = [
  'nombre',
  'descripcion',
  'precio',
  'categoria',
  'estacion',
  'stock',
  'stock_minimo',
  'activo',
] as const;
export type ProductColumn = (typeof PRODUCT_IMPORT_COLUMNS)[number];

/** El nombre de la fila de ejemplo de la plantilla, para poder avisar si se olvidó borrar. */
export const FILA_DE_EJEMPLO = 'BORRA ESTA FILA (ejemplo)';

/** Cabecera → clave comparable. `Precio (MXN)` → `precio`, `Stock mínimo` → `stockminimo`. */
export function headerKey(raw: string): string {
  return raw
    .replace(/\(.*?\)/g, '') // el paréntesis de una cabecera es una nota, no parte del nombre
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

const ALIAS: Record<ProductColumn, string[]> = {
  nombre: ['nombre', 'producto', 'nombreproducto', 'nombredelproducto', 'name', 'articulo'],
  descripcion: ['descripcion', 'detalle', 'description', 'notas'],
  precio: ['precio', 'precioventa', 'preciodeventa', 'price', 'pvp', 'importe'],
  categoria: ['categoria', 'grupo', 'familia', 'category'],
  estacion: ['estacion', 'area', 'destino', 'station'],
  stock: ['stock', 'existencias', 'existencia', 'cantidad', 'inventario'],
  stock_minimo: ['stockminimo', 'minimo', 'stockmin', 'existenciaminima'],
  activo: ['activo', 'disponible', 'active', 'enventa', 'sevende'],
};

/** Lo que se manda al servidor por cada fila. Se construye campo a campo; ver `toPayload`. */
export interface ImportProductRow {
  line: number;
  name: string;
  description?: string;
  price: number;
  categoryName?: string;
  station?: PreparationStation;
  isActive?: boolean;
  stock?: number;
  minimumStock?: number;
}

export interface PreviewRow {
  line: number;
  name: string;
  /** Qué va a pasar con esta fila. */
  action: 'create' | 'update' | 'error';
  /** Solo si `action === 'error'`. */
  reason?: string;
  /** Avisos que no impiden importar (redondeos, parecidos). */
  warnings: string[];
  /** El texto tal cual venía, para poder enseñarlo junto a lo interpretado. */
  raw: Partial<Record<ProductColumn, string>>;
  payload?: ImportProductRow;
}

export interface PreviewResult {
  /** Errores del archivo entero: sin ellos no hay nada que previsualizar. */
  fileErrors: string[];
  /** Avisos del archivo entero (columnas ignoradas, cabecera repetida, comilla sin cerrar). */
  fileWarnings: string[];
  /** Columnas que traía el archivo y que no se usan. */
  ignoredColumns: string[];
  rows: PreviewRow[];
  /** Categorías que el archivo menciona y que no existen todavía. */
  missingCategories: string[];
}

export interface Catalogo {
  productos: { id: string; name: string }[];
  categorias: { id: string; name: string }[];
}

/**
 * Del archivo a lo que se va a hacer, fila por fila, **antes** de tocar nada.
 *
 * La previsualización es la mitad del valor de esta funcionalidad: «152 nuevos, 31 se actualizan,
 * 4 con error en la línea 16» es la diferencia entre una importación y una sorpresa.
 */
export function buildPreview(table: CsvTable, catalogo: Catalogo): PreviewResult {
  const fileErrors: string[] = [];
  const fileWarnings = [...table.warnings];
  const ignoredColumns: string[] = [];

  // ── Cabeceras ─────────────────────────────────────────────────────────────
  const indice = new Map<ProductColumn, number>();
  table.header.forEach((bruta, i) => {
    const clave = headerKey(bruta);
    const columna = (Object.keys(ALIAS) as ProductColumn[]).find((c) => ALIAS[c].includes(clave));
    if (!columna) {
      if (bruta.trim() !== '') ignoredColumns.push(bruta.trim());
      return;
    }
    if (indice.has(columna)) {
      // Gana la primera, que es como se lee. Adivinar cuál de las dos vale sería peor.
      fileWarnings.push(`La columna «${bruta.trim()}» aparece dos veces; se usa la primera.`);
      return;
    }
    indice.set(columna, i);
  });

  for (const obligatoria of ['nombre', 'precio'] as const) {
    if (!indice.has(obligatoria)) {
      fileErrors.push(`Falta la columna «${obligatoria}». Descarga la plantilla para ver el formato.`);
    }
  }
  if (ignoredColumns.length > 0) {
    // Es el espejo de `forbidNonWhitelisted`: si esa columna llegara a la API sería un 400 para
    // las 200 filas de la tanda. Por eso el parseo está aquí y no en el servidor.
    fileWarnings.push(`Se ignoran las columnas: ${ignoredColumns.join(', ')}.`);
  }
  if (fileErrors.length > 0) {
    return { fileErrors, fileWarnings, ignoredColumns, rows: [], missingCategories: [] };
  }

  const celda = (cells: string[], columna: ProductColumn): string => {
    const i = indice.get(columna);
    // Una fila corta rellena con vacío: en Excel es una coma final, no un error.
    return i === undefined ? '' : (cells[i] ?? '');
  };

  // ── Índices del catálogo ──────────────────────────────────────────────────
  const porProducto = new Map<string, { id: string; name: string }>();
  const ambiguos = new Set<string>();
  for (const p of catalogo.productos) {
    const k = productKey(p.name);
    if (porProducto.has(k)) ambiguos.add(k);
    else porProducto.set(k, p);
  }
  const porParecido = new Map<string, string>();
  for (const p of catalogo.productos) {
    if (!porParecido.has(fold(p.name))) porParecido.set(fold(p.name), p.name);
  }
  const categoriasExistentes = new Set(catalogo.categorias.map((c) => fold(c.name)));

  // ── Filas ─────────────────────────────────────────────────────────────────
  const vistas = new Map<string, number[]>();
  for (const registro of table.records) {
    const nombre = celda(registro.cells, 'nombre').trim();
    if (nombre === '') continue;
    const k = productKey(nombre);
    vistas.set(k, [...(vistas.get(k) ?? []), registro.line]);
  }

  const missingCategories = new Set<string>();
  const rows: PreviewRow[] = table.records.map((registro) => {
    const raw: Partial<Record<ProductColumn, string>> = {};
    for (const c of PRODUCT_IMPORT_COLUMNS) {
      if (indice.has(c)) raw[c] = celda(registro.cells, c);
    }
    const warnings: string[] = [];
    const error = (reason: string): PreviewRow => ({
      line: registro.line,
      name: raw.nombre?.trim() ?? '',
      action: 'error',
      reason,
      warnings,
      raw,
    });

    // Una fila **larga con contenido de más** es el síntoma exacto de un nombre con coma sin
    // entrecomillar: el precio ya cayó en la columna equivocada, así que no se puede importar.
    if (registro.cells.length > table.header.length) {
      const sobrantes = registro.cells.slice(table.header.length).filter((c) => c.trim() !== '');
      if (sobrantes.length > 0) {
        return error('Tiene más columnas de las esperadas. ¿Hay una coma dentro del nombre?');
      }
    }

    if (Object.values(raw).some((v) => v?.includes('�'))) {
      return error('Tiene caracteres ilegibles. Vuelve a guardar el archivo como CSV UTF-8.');
    }

    const nombre = (raw.nombre ?? '').trim();
    if (nombre === '') return error('Falta el nombre.');
    if (nombre.length < 2) return error('El nombre es demasiado corto.');
    // 150 es lo que cabe en `ingredients.name`, y el espejo de un producto se llama igual.
    if (nombre.length > 150) return error('El nombre pasa de 150 caracteres.');
    if (nombre.includes(FILA_DE_EJEMPLO)) {
      return error('Es la fila de ejemplo de la plantilla. Bórrala antes de importar.');
    }

    const k = productKey(nombre);
    const repetidas = vistas.get(k) ?? [];
    if (repetidas.length > 1) {
      return error(`«${nombre}» aparece en las líneas ${repetidas.join(' y ')} de este archivo.`);
    }
    if (ambiguos.has(k)) {
      return error(`Ya hay más de un producto llamado «${nombre}». Renómbralos antes de importar.`);
    }

    const precio = parsePrice(raw.precio ?? '');
    if ('error' in precio) return error(precio.error);
    if (precio.warning) warnings.push(precio.warning);

    const payload: ImportProductRow = { line: registro.line, name: nombre, price: precio.value };

    // `undefined` = «no toques este campo». El CSV no sabe expresar «quítale la categoría»: una
    // celda vacía en un archivo que solo trae nombres y precios no puede desclasificar el menú.
    if (!isBlank(raw.descripcion ?? '')) payload.description = raw.descripcion!.trim();

    const categoria = (raw.categoria ?? '').trim();
    if (categoria !== '') {
      payload.categoryName = categoria;
      if (!categoriasExistentes.has(fold(categoria))) missingCategories.add(categoria);
    }

    if (!isBlank(raw.estacion ?? '')) {
      const estacion = parseStation(raw.estacion!);
      if (!estacion) return error('Estación desconocida. Usa cocina, barra o inmediato.');
      payload.station = estacion;
    }

    if (!isBlank(raw.activo ?? '')) {
      const activo = parseBoolean(raw.activo!);
      // No cae a `false`: eso escondería medio menú sin decir nada.
      if (activo === null) return error('No se entiende si está activo. Usa sí o no.');
      payload.isActive = activo;
    }

    for (const [columna, campo] of [
      ['stock', 'stock'],
      ['stock_minimo', 'minimumStock'],
    ] as const) {
      if (isBlank(raw[columna] ?? '')) continue;
      const n = parseDecimal(raw[columna]!);
      if (n === null) return error(`No se entiende «${raw[columna]!.trim()}» como cantidad.`);
      if (n < 0) return error('Las existencias no pueden ser negativas en una importación.');
      payload[campo] = Number(n.toFixed(3));
    }

    const existente = porProducto.get(k);
    if (!existente) {
      // Un parecido no se adivina: se pregunta, en la única pantalla donde preguntar es barato.
      const parecido = porParecido.get(fold(nombre));
      if (parecido) warnings.push(`Se parece a «${parecido}», que ya existe. ¿Es el mismo?`);
    }

    return {
      line: registro.line,
      name: nombre,
      action: existente ? 'update' : 'create',
      warnings,
      raw,
      payload,
    };
  });

  return {
    fileErrors,
    fileWarnings,
    ignoredColumns,
    rows,
    missingCategories: [...missingCategories],
  };
}

/**
 * El cuerpo de una fila, **campo a campo**.
 *
 * Nunca un spread de `PreviewRow`: el `ValidationPipe` corre con `forbidNonWhitelisted`, así que
 * una sola clave de sobra —`raw`, `warnings`, `action`— responde 400 y **se pierde la tanda
 * entera**, doscientas filas. Su spec afirma el conjunto exacto de claves, y ese test es lo único
 * que separa esto de un fallo que solo aparece con datos reales.
 */
export function toPayload(row: PreviewRow): ImportProductRow {
  if (!row.payload) throw new Error('Una fila con error no tiene cuerpo que enviar');
  const p = row.payload;
  const cuerpo: ImportProductRow = { line: p.line, name: p.name, price: p.price };
  if (p.description !== undefined) cuerpo.description = p.description;
  if (p.categoryName !== undefined) cuerpo.categoryName = p.categoryName;
  if (p.station !== undefined) cuerpo.station = p.station;
  if (p.isActive !== undefined) cuerpo.isActive = p.isActive;
  if (p.stock !== undefined) cuerpo.stock = p.stock;
  if (p.minimumStock !== undefined) cuerpo.minimumStock = p.minimumStock;
  return cuerpo;
}
