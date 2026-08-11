import {
  isAvailableAt,
  isAvailableNow,
  localDayAndMinutes,
  toMinutes,
  type AvailabilityWindow,
} from './availability';

const w = (over: Partial<AvailabilityWindow> = {}): AvailabilityWindow => ({
  dayOfWeek: 1,
  startTime: '12:00:00',
  endTime: '23:00:00',
  isAvailable: true,
  ...over,
});

const LUN = 1;
const MAR = 2;
const DOM = 0;
const at = (h: number, m = 0) => h * 60 + m;

describe('disponibilidad por horario', () => {
  describe('toMinutes', () => {
    it('acepta los formatos que llegan de verdad', () => {
      // Postgres devuelve HH:mm:ss para una columna `time`; un formulario puede dar H:mm.
      expect(toMinutes('07:00:00')).toBe(420);
      expect(toMinutes('07:00')).toBe(420);
      expect(toMinutes('7:00')).toBe(420);
      expect(toMinutes('23:59')).toBe(1439);
    });

    /**
     * El motivo de que exista esta función. Comparando cadenas, `'7:00' > '19:00'` es cierto
     * para JavaScript, así que un horario escrito sin cero a la izquierda invertiría la regla
     * sin que nada fallara.
     */
    it('ordena por hora y no por texto', () => {
      expect(toMinutes('7:00')).toBeLessThan(toMinutes('19:00'));
    });
  });

  describe('reglas', () => {
    it('sin ventanas está disponible: «sin configurar» no es «oculto»', () => {
      expect(isAvailableAt(undefined, LUN, at(3))).toBe(true);
      expect(isAvailableAt(null, LUN, at(3))).toBe(true);
      expect(isAvailableAt([], LUN, at(3))).toBe(true);
    });

    it('dentro de la ventana sí, fuera no', () => {
      const windows = [w({ dayOfWeek: LUN, startTime: '12:00', endTime: '23:00' })];

      expect(isAvailableAt(windows, LUN, at(15))).toBe(true);
      expect(isAvailableAt(windows, LUN, at(9))).toBe(false);
    });

    it('otro día de la semana no encaja', () => {
      const windows = [w({ dayOfWeek: LUN })];

      expect(isAvailableAt(windows, MAR, at(15))).toBe(false);
    });

    /**
     * Lo que hace útil el `isAvailable: false`: «todos los días de 12 a 23, menos los lunes».
     * Si la exclusión no ganara, la ventana permisiva del resto de días la anularía.
     */
    it('una exclusión que encaja gana sobre una ventana permisiva', () => {
      const windows = [
        w({ dayOfWeek: LUN, startTime: '12:00', endTime: '23:00', isAvailable: true }),
        w({ dayOfWeek: LUN, startTime: '15:00', endTime: '17:00', isAvailable: false }),
      ];

      expect(isAvailableAt(windows, LUN, at(13))).toBe(true);
      expect(isAvailableAt(windows, LUN, at(16))).toBe(false);
    });

    it('solo con exclusiones, lo no excluido está disponible', () => {
      const windows = [w({ dayOfWeek: LUN, startTime: '15:00', endTime: '17:00', isAvailable: false })];

      expect(isAvailableAt(windows, LUN, at(16))).toBe(false);
      expect(isAvailableAt(windows, LUN, at(19))).toBe(true);
      expect(isAvailableAt(windows, MAR, at(16))).toBe(true);
    });

    it('con una ventana permisiva, los días sin ventana quedan fuera', () => {
      // Si no, «desayuno de 7 a 11 los lunes» se seguiría ofreciendo el martes a cualquier hora.
      const windows = [w({ dayOfWeek: LUN, startTime: '07:00', endTime: '11:00' })];

      expect(isAvailableAt(windows, MAR, at(8))).toBe(false);
    });

    /**
     * **El caso que estará mal si nadie lo escribe.** La barra abre de 22:00 a 02:00, y un
     * `start <= t && t < end` ingenuo deja esa ventana siempre en falso.
     */
    describe('una ventana que cruza medianoche', () => {
      const windows = [w({ dayOfWeek: LUN, startTime: '22:00', endTime: '02:00' })];

      it('vale después del inicio, en su propio día', () => {
        expect(isAvailableAt(windows, LUN, at(23))).toBe(true);
        expect(isAvailableAt(windows, LUN, at(22))).toBe(true);
      });

      it('vale antes del fin, ya en el día siguiente', () => {
        expect(isAvailableAt(windows, MAR, at(1))).toBe(true);
        expect(isAvailableAt(windows, MAR, at(0, 30))).toBe(true);
      });

      it('no vale en la tarde de su día ni después del fin del siguiente', () => {
        expect(isAvailableAt(windows, LUN, at(18))).toBe(false);
        expect(isAvailableAt(windows, MAR, at(3))).toBe(false);
      });

      it('cruza correctamente del domingo al lunes', () => {
        const sabado = [w({ dayOfWeek: DOM, startTime: '22:00', endTime: '02:00' })];
        expect(isAvailableAt(sabado, DOM, at(23))).toBe(true);
        expect(isAvailableAt(sabado, LUN, at(1))).toBe(true);
      });
    });

    it('el inicio es inclusivo y el fin exclusivo', () => {
      const windows = [
        w({ dayOfWeek: LUN, startTime: '07:00', endTime: '11:00' }),
        w({ dayOfWeek: LUN, startTime: '11:00', endTime: '16:00' }),
      ];

      // Las 11:00 pertenecen al almuerzo y solo al almuerzo: dos ventanas seguidas no se
      // solapan en el minuto de la frontera.
      expect(isAvailableAt([windows[0]], LUN, at(11))).toBe(false);
      expect(isAvailableAt([windows[1]], LUN, at(11))).toBe(true);
      expect(isAvailableAt(windows, LUN, at(11))).toBe(true);
    });

    it('una ventana de duración cero no habilita nada', () => {
      const windows = [w({ dayOfWeek: LUN, startTime: '12:00', endTime: '12:00' })];

      expect(isAvailableAt(windows, LUN, at(12))).toBe(false);
    });
  });

  /**
   * La zona horaria es la del negocio y no la del servidor. Este repo ya pagó esa lección: el
   * arnés fuerza `TZ=America/Mexico_City` porque en un runner en UTC el desfase es invisible, y
   * así llegó a producción el fallo de rangos de fechas de los reportes.
   */
  describe('zona horaria del negocio', () => {
    it('el mismo instante cae en horas distintas según la zona', () => {
      // 2026-08-10 fue lunes. 03:00 UTC son las 21:00 del domingo en Ciudad de México.
      const instante = new Date('2026-08-10T03:00:00.000Z');

      expect(localDayAndMinutes(instante, 'UTC')).toEqual({ dayOfWeek: LUN, minutes: at(3) });
      expect(localDayAndMinutes(instante, 'America/Mexico_City')).toEqual({
        dayOfWeek: DOM,
        minutes: at(21),
      });
    });

    it('un producto de noche del domingo se ofrece en la zona del local, no en UTC', () => {
      const windows = [w({ dayOfWeek: DOM, startTime: '20:00', endTime: '23:00' })];
      const instante = new Date('2026-08-10T03:00:00.000Z');

      expect(isAvailableNow(windows, instante, 'America/Mexico_City')).toBe(true);
      expect(isAvailableNow(windows, instante, 'UTC')).toBe(false);
    });
  });
});
