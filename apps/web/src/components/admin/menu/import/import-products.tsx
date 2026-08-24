'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { DownloadIcon, FileUpIcon, UploadIcon } from 'lucide-react';
import type { Category, ImportProductsResult, Product } from '@loklflow/types';
import { downloadFile } from '@/lib/api/client';
import { productsApi } from '@/lib/api/menu.api';
import { decodeSpreadsheet } from '@/lib/csv/decode';
import { parseCsv } from '@/lib/csv/parse';
import { buildPreview, toPayload, type PreviewResult } from '@/lib/csv/products';
import { chunkByBytes } from '@/lib/csv/chunk';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { ImportPreview } from './import-preview';
import { ImportSummary } from './import-summary';

interface Props {
  products: Product[];
  categories: Category[];
}

/** Máximo de filas por archivo. Una carta son decenas, no un histórico. */
const MAX_FILAS = 2000;

type Estado =
  | { fase: 'elegir' }
  | { fase: 'previsualizando'; nombre: string; encoding: string; preview: PreviewResult }
  | { fase: 'subiendo'; nombre: string; preview: PreviewResult; hechas: number; total: number }
  | { fase: 'hecho'; resultado: ImportProductsResult };

/**
 * Importar el catálogo desde un archivo.
 *
 * El archivo se lee y se interpreta **aquí**, y solo después de que la persona vea qué va a pasar
 * se manda nada. La previsualización no es un adorno: «152 nuevos, 31 se actualizan, 4 con error en
 * la línea 16» es la diferencia entre una importación y una sorpresa.
 */
export function ImportProducts({ products, categories }: Props) {
  const router = useRouter();
  const [estado, setEstado] = useState<Estado>({ fase: 'elegir' });
  const [crearCategorias, setCrearCategorias] = useState(true);
  const inputRef = useRef<HTMLInputElement>(null);

  async function elegir(archivo: File) {
    // `arrayBuffer` y no `text()`: `Blob.text()` decodifica siempre como UTF-8 y **sustituye** los
    // bytes inválidos sin lanzar nada, así que un CSV del Excel en español entraría con los acentos
    // rotos y sin un solo error.
    const { text, encoding } = decodeSpreadsheet(new Uint8Array(await archivo.arrayBuffer()));
    const tabla = parseCsv(text);

    if (tabla.records.length > MAX_FILAS) {
      toast.error(`El archivo trae ${tabla.records.length} filas; el máximo es ${MAX_FILAS}.`);
      return;
    }

    setEstado({
      fase: 'previsualizando',
      nombre: archivo.name,
      encoding,
      preview: buildPreview(tabla, {
        productos: products.map((p) => ({ id: p.id, name: p.name })),
        categorias: categories.map((c) => ({ id: c.id, name: c.name })),
      }),
    });
  }

  async function importar(preview: PreviewResult, nombre: string) {
    const validas = preview.rows.filter((r) => r.action !== 'error');
    const tandas = chunkByBytes(validas.map(toPayload));
    const acumulado: ImportProductsResult = {
      created: 0,
      updated: 0,
      failed: 0,
      categoriesCreated: [],
      rows: [],
    };

    // `beforeunload` mientras haya tandas en vuelo. No es la defensa real —en Safari y Chrome
    // móviles no dispara de forma fiable al deslizar la pestaña—, pero cuesta ocho líneas.
    // La defensa real es que repetir el mismo archivo es seguro, y eso se dice en pantalla.
    const avisar = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', avisar);

    try {
      for (const [i, tanda] of tandas.entries()) {
        setEstado({ fase: 'subiendo', nombre, preview, hechas: i, total: tandas.length });
        const parcial = await productsApi.import({
          rows: tanda,
          createMissingCategories: crearCategorias,
        });
        acumulado.created += parcial.created;
        acumulado.updated += parcial.updated;
        acumulado.failed += parcial.failed;
        acumulado.categoriesCreated.push(...parcial.categoriesCreated);
        acumulado.rows.push(...parcial.rows);
      }
      setEstado({ fase: 'hecho', resultado: acumulado });
      router.refresh();
    } catch (err) {
      /**
       * **Se para en seco.** Seguir disparando veinte peticiones más contra un servidor que está
       * fallando es cómo un despliegue malo se convierte en cuatro mil escrituras a medias.
       *
       * Lo ya enviado queda aplicado, y eso no es un problema: repetir el mismo archivo actualiza
       * lo que entró en vez de duplicarlo.
       */
      toast.error(err instanceof Error ? err.message : 'Se cortó la importación', {
        description: `Se guardaron ${acumulado.created + acumulado.updated} productos. Vuelve a importar el mismo archivo para terminar.`,
      });
      setEstado({ fase: 'hecho', resultado: acumulado });
    } finally {
      window.removeEventListener('beforeunload', avisar);
    }
  }

  if (estado.fase === 'hecho') {
    return (
      <ImportSummary
        resultado={estado.resultado}
        onOtra={() => {
          setEstado({ fase: 'elegir' });
          if (inputRef.current) inputRef.current.value = '';
        }}
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 rounded-xl border p-4">
        <label className="flex flex-col gap-2">
          <span className="text-sm font-medium">Archivo CSV</span>
          <Input
            ref={inputRef}
            type="file"
            accept=".csv,text/csv"
            onChange={(e) => {
              const archivo = e.target.files?.[0];
              if (archivo) void elegir(archivo);
            }}
          />
        </label>

        <div className="flex flex-col gap-2 sm:flex-row">
          <Button
            variant="outline"
            className="w-full sm:w-auto"
            onClick={() =>
              void downloadFile(productsApi.importTemplatePath(), 'plantilla-productos.csv')
            }
          >
            <DownloadIcon />
            Descargar plantilla
          </Button>
          <Button
            variant="outline"
            className="w-full sm:w-auto"
            onClick={() => void downloadFile(productsApi.exportPath(), 'productos.csv')}
          >
            <FileUpIcon />
            Exportar lo que ya hay
          </Button>
        </div>

        <p className="text-xs text-muted-foreground">
          Excel guarda a CSV desde «Archivo → Guardar como». Si la importación se corta a la mitad,
          vuelve a subir <strong>el mismo archivo</strong>: lo que ya se cargó se actualiza en vez de
          duplicarse.
        </p>
      </div>

      {estado.fase !== 'elegir' && (
        <>
          <p className="text-sm text-muted-foreground">
            {estado.nombre} · {estado.preview.rows.length} filas
            {'encoding' in estado ? ` · ${estado.encoding}` : ''}
          </p>

          {estado.preview.fileErrors.length > 0 && (
            <Alert variant="destructive">
              <AlertTitle>No se puede leer este archivo</AlertTitle>
              <AlertDescription>
                <ul className="list-inside list-disc">
                  {estado.preview.fileErrors.map((e) => (
                    <li key={e}>{e}</li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}

          {estado.preview.fileWarnings.map((w) => (
            <Alert key={w}>
              <AlertDescription>{w}</AlertDescription>
            </Alert>
          ))}

          {estado.preview.rows.length > 0 && (
            <>
              <ImportPreview preview={estado.preview} />

              {estado.preview.missingCategories.length > 0 && (
                <label className="flex items-start gap-2 text-sm">
                  <Checkbox
                    checked={crearCategorias}
                    onCheckedChange={(v) => setCrearCategorias(v === true)}
                  />
                  <span>
                    {estado.preview.missingCategories.length === 1
                      ? 'Crear la categoría que falta: '
                      : `Crear las ${estado.preview.missingCategories.length} categorías que faltan: `}
                    <strong>{estado.preview.missingCategories.join(', ')}</strong>
                  </span>
                </label>
              )}

              <div className="sticky bottom-0 -mx-4 border-t bg-background/95 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] backdrop-blur sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:p-0 sm:backdrop-blur-none">
                <Button
                  size="touch"
                  className="w-full sm:w-auto"
                  disabled={
                    estado.fase === 'subiendo' ||
                    estado.preview.rows.every((r) => r.action === 'error')
                  }
                  onClick={() => void importar(estado.preview, estado.nombre)}
                >
                  {estado.fase === 'subiendo' ? <Spinner /> : <UploadIcon />}
                  Importar {estado.preview.rows.filter((r) => r.action !== 'error').length}{' '}
                  {estado.preview.rows.filter((r) => r.action !== 'error').length === 1
                    ? 'producto'
                    : 'productos'}
                </Button>

                {estado.fase === 'subiendo' && (
                  <div
                    role="progressbar"
                    aria-valuenow={estado.hechas}
                    aria-valuemin={0}
                    aria-valuemax={estado.total}
                    className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted"
                  >
                    <div
                      className="h-full bg-primary transition-all"
                      style={{ width: `${Math.round((estado.hechas / estado.total) * 100)}%` }}
                    />
                  </div>
                )}
                {estado.fase === 'subiendo' && (
                  // El texto es lo que se lee; la barra solo tranquiliza.
                  <p aria-live="polite" className="mt-1 text-xs text-muted-foreground">
                    Tanda {estado.hechas + 1} de {estado.total}
                  </p>
                )}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
