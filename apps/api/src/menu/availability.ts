/**
 * ¿Está este producto disponible en este instante?
 *
 * La regla existía en la base y en el formulario desde Fase 2 —`product_availabilities` se
 * guarda y se edita— pero **nadie la evaluaba**: `products.service.ts` la carga como relación y
 * la devuelve tal cual. El ROADMAP daba «Disponibilidad de productos por horario» por hecha, y
 * lo único hecho era poder escribirla.
 *
 * Función pura, sin TypeORM y sin `Date` implícito, siguiendo la convención del repo
 * (`order-totals.ts`, `csv.ts`, `utc-timestamp.ts`): la lógica que decide qué ve un cliente se
 * prueba sin base de datos.
 */

export interface AvailabilityWindow {
  /** 0 = domingo … 6 = sábado. */
  dayOfWeek: number;
  /** `HH:mm`, `HH:mm:ss` o `H:mm`. Postgres devuelve `HH:mm:ss` para una columna `time`. */
  startTime: string;
  endTime: string;
  /** `false` convierte la ventana en una **exclusión**: «los lunes no hay pescado». */
  isAvailable: boolean;
}

/**
 * Minutos desde medianoche.
 *
 * **Comparar cadenas no vale.** Postgres devuelve `'07:00:00'` para una columna `time`, pero un
 * seed escrito a mano o un formulario pueden producir `'7:00'`, y ahí el orden lexicográfico se
 * invierte en silencio: `'7:00' > '19:00'` es cierto para JavaScript. Normalizar a un número
 * hace que el error no exista en vez de esperar que nadie lo escriba mal.
 */
export function toMinutes(time: string): number {
  const [h = '0', m = '0'] = time.split(':');
  return Number(h) * 60 + Number(m);
}

/**
 * Día de la semana y minutos del día **en la zona horaria del negocio**.
 *
 * No en la del servidor. Este repo ya pagó esa lección una vez: el arnés de tests fuerza
 * `TZ=America/Mexico_City` porque en un runner de CI en UTC el desfase es invisible, y así llegó
 * a producción el fallo de rangos de fechas de los reportes. Un producto de desayuno tiene que
 * dejar de ofrecerse a las 11:00 de la hora del local, no de la del contenedor.
 */
export function localDayAndMinutes(
  at: Date,
  timeZone: string,
): { dayOfWeek: number; minutes: number } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(at);

  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  const days: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  // `hour12: false` puede dar «24» a medianoche en algunos entornos.
  const hour = Number(get('hour')) % 24;

  return { dayOfWeek: days[get('weekday')] ?? 0, minutes: hour * 60 + Number(get('minute')) };
}

/**
 * Las reglas, en orden de precedencia:
 *
 * 1. **Sin ventanas → disponible.** Casi ningún producto tiene horario configurado, y tratar
 *    «sin configurar» como «oculto» vaciaría el menú el primer día.
 * 2. **Una exclusión que encaja gana sobre cualquier ventana permisiva.** Es lo que hace útil el
 *    `isAvailable: false`: «todos los días de 12 a 23, menos los lunes».
 * 3. Si existe alguna ventana permisiva (para cualquier día), el producto solo está disponible
 *    dentro de una que encaje. Sin esto, «desayuno de 7 a 11» seguiría ofreciéndose en la cena.
 * 4. **Una ventana con `start > end` cruza la medianoche** (`22:00–02:00`, el caso de la barra).
 *    Un `start <= t && t < end` ingenuo la deja siempre en falso, y ese es el fallo que estará
 *    ahí si nadie escribe el test.
 * 5. **Inicio inclusivo, fin exclusivo**, así que las 11:00 son almuerzo y no desayuno, y dos
 *    ventanas seguidas no se solapan en el minuto de la frontera.
 */
export function isAvailableAt(
  windows: AvailabilityWindow[] | undefined | null,
  dayOfWeek: number,
  minutes: number,
): boolean {
  if (!windows || windows.length === 0) return true;

  const matches = (w: AvailabilityWindow): boolean => {
    const start = toMinutes(w.startTime);
    const end = toMinutes(w.endTime);

    if (start === end) return false;

    if (start < end) return w.dayOfWeek === dayOfWeek && minutes >= start && minutes < end;

    // Cruza medianoche: o es después del inicio en su propio día, o antes del fin en el
    // siguiente —que desde aquí se mira como «el día de ayer era el de la ventana».
    const yesterday = (dayOfWeek + 6) % 7;
    return (
      (w.dayOfWeek === dayOfWeek && minutes >= start) ||
      (w.dayOfWeek === yesterday && minutes < end)
    );
  };

  if (windows.some((w) => !w.isAvailable && matches(w))) return false;

  const permissive = windows.filter((w) => w.isAvailable);
  if (permissive.length === 0) return true;

  return permissive.some(matches);
}

/** Envoltorio para el caso normal: un instante y la zona del negocio. */
export function isAvailableNow(
  windows: AvailabilityWindow[] | undefined | null,
  at: Date,
  timeZone: string,
): boolean {
  const { dayOfWeek, minutes } = localDayAndMinutes(at, timeZone);
  return isAvailableAt(windows, dayOfWeek, minutes);
}
