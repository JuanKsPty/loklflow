import 'fake-indexeddb/auto';

/**
 * IndexedDB de mentira para los specs de la cola.
 *
 * `fake-indexeddb/auto` la instala en el ámbito global, así que `db.ts` funciona sin enterarse
 * de que está en un test — que es justo lo que interesa probar: el envoltorio de verdad, no un
 * doble que se comporta como a uno le conviene.
 */
