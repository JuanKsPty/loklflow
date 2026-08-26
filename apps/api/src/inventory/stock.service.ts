import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, In, QueryFailedError, Repository } from 'typeorm';
import { MOVEMENTS_DEFAULT_TAKE, MOVEMENTS_MAX_TAKE } from './dto/query-movements.dto';
import { Ingredient } from './entities/ingredient.entity';
import { RecipeIngredient } from './entities/recipe-ingredient.entity';
import { StockMovement } from './entities/stock-movement.entity';
import { CreateMovementDto } from './dto/create-movement.dto';
import { stockSetReason, type StockMovementType, type StockSetReason } from './inventory.constants';
import { aggregateConsumptions, type Consumption } from './consumptions';
import { NotificationsService } from '../notifications/notifications.service';

/**
 * Roles que reciben el aviso de stock bajo. Mismo criterio que `APPROVER_ROLES` en descuentos.
 *
 * **`Administrador` no es opcional.** `notifyRole` escribe una fila por usuario activo del rol,
 * así que avisar solo a `Gerente` no notifica a nadie mientras no exista ningún usuario con ese
 * rol — y no existe: ni el seed de desarrollo ni `seed:deploy`, que crea un único
 * administrador, dan de alta un gerente. La alerta se habría perdido en silencio, que es el
 * peor fallo posible en algo cuyo trabajo es avisar.
 */
const STOCK_ALERT_ROLES = ['Gerente', 'Administrador'];

@Injectable()
export class StockService {
  private readonly logger = new Logger(StockService.name);

  constructor(
    @InjectRepository(Ingredient) private readonly ingredientsRepo: Repository<Ingredient>,
    @InjectRepository(StockMovement) private readonly movementsRepo: Repository<StockMovement>,
    @InjectRepository(RecipeIngredient) private readonly recipesRepo: Repository<RecipeIngredient>,
    private readonly dataSource: DataSource,
    private readonly notifications: NotificationsService,
  ) {}

  /** Historial del libro mayor, del más reciente al más antiguo. */
  findMovements(filters: { ingredientId?: string; take?: number } = {}) {
    return this.movementsRepo.find({
      where: filters.ingredientId ? { ingredientId: filters.ingredientId } : {},
      relations: { ingredient: true, supplier: true },
      order: { createdAt: 'DESC' },
      take: Math.min(filters.take ?? MOVEMENTS_DEFAULT_TAKE, MOVEMENTS_MAX_TAKE),
    });
  }

  /**
   * Registra un movimiento hecho por una persona: entrada de mercancía, merma o ajuste.
   *
   * `consumption` no se puede pedir por aquí —el DTO no lo acepta—: ese lo escribe solo el
   * cierre de cuenta, con su orden detrás.
   */
  async record(dto: CreateMovementDto, userId: string): Promise<StockMovement> {
    if ((dto.type === 'waste' || dto.type === 'adjustment') && !dto.reason?.trim()) {
      // Una merma o un ajuste sin motivo es un descuadre que nadie podrá explicar dentro de
      // seis meses, que es justo cuando se mira el historial.
      throw new BadRequestException('Una merma o un ajuste necesitan un motivo');
    }
    if (dto.type !== 'entry' && (dto.supplierId || dto.costPerUnit !== undefined)) {
      throw new BadRequestException('El proveedor y el costo solo aplican a una entrada');
    }

    const signed =
      dto.type === 'entry'
        ? dto.quantity
        : dto.type === 'waste'
          ? -dto.quantity
          : dto.direction === 'decrease'
            ? -dto.quantity
            : dto.quantity;

    const { movement, ingredient } = await this.dataSource.transaction((manager) =>
      this.apply(manager, {
        ingredientId: dto.ingredientId,
        type: dto.type,
        amount: { signed },
        userId,
        reason: dto.reason ?? null,
        supplierId: dto.supplierId ?? null,
        costPerUnit: dto.costPerUnit,
      }),
    );

    // Después de confirmar, nunca dentro: una transacción que acabe deshaciéndose habría
    // dejado igualmente el aviso enviado, y sería un aviso sobre algo que no ocurrió.
    await this.maybeAlert(ingredient, movement.previousStock, movement.newStock);
    return movement;
  }

  /**
   * Fija el stock **absoluto** de un ingrediente: la operación de quien cuenta cajas, no la de
   * quien lleva un inventario.
   *
   * Se escribe como un `adjustment` normal, con su motivo: no aparece un camino nuevo por el que
   * el stock cambie sin dejar movimiento, y el libro mayor sigue siendo la única explicación del
   * número que hay hoy. El delta lo calcula `apply` con la fila ya bloqueada; ver allí.
   *
   * **Un delta de cero también se escribe.** «Conté y sigue habiendo 12» es un hecho, y el día que
   * el número no cuadre, saber que alguien lo confirmó a las siete de la tarde vale más que la
   * fila que se ahorra.
   */
  async setLevel(
    input: { ingredientId: string; toStock: number; reasonCode: StockSetReason; note?: string },
    userId: string,
  ): Promise<StockMovement> {
    const { movement, ingredient } = await this.dataSource.transaction((manager) =>
      this.apply(manager, {
        ingredientId: input.ingredientId,
        type: 'adjustment',
        amount: { toStock: round3(input.toStock) },
        userId,
        reason: stockSetReason(input.reasonCode, input.note),
        supplierId: null,
      }),
    );

    // Fuera de la transacción, igual que en `record`: un aviso sobre algo que luego se deshizo
    // sería un aviso sobre algo que no ocurrió.
    await this.maybeAlert(ingredient, movement.previousStock, movement.newStock);
    return movement;
  }

  /**
   * Descuenta del inventario lo que consumió una orden que se acaba de cerrar.
   *
   * **Nunca lanza.** Lo llama el cierre de cuenta, y un fallo de inventario no puede impedir
   * que una cuenta cobrada se cierre: el dinero ya cambió de manos. Si algo va mal queda la
   * traza —que desde el bloque 2 va a un log de verdad— y el stock se corrige con un ajuste.
   *
   * Es idempotente por partida doble: comprueba antes si la orden ya tiene consumos, y aun
   * así el índice único parcial de la base es el que decide, porque entre la comprobación y
   * la escritura cabe otro cierre.
   */
  async consumeForOrder(
    orderId: string,
    items: { productId: string; quantity: number }[],
    userId: string,
  ): Promise<void> {
    try {
      // Atajo para el caso normal de un reenvío: lo que esta orden ya consumió no se vuelve a
      // escribir. El índice único sigue siendo quien decide —entre esta consulta y la escritura
      // cabe otro cierre—, pero así el camino habitual no son N transacciones que fallan.
      //
      // Se comprueba **por ingrediente**, que es la unidad que el índice protege. Antes bastaba
      // con que la orden tuviera *algún* consumo para salirse: un cierre que descontó dos de tres
      // ingredientes y murió en medio dejaba el tercero sin descontar **para siempre**, porque el
      // reenvío veía «ya hay consumos» y se iba. Un descuadre permanente y sin una sola señal.
      const done = new Set(
        (
          await this.movementsRepo.find({
            where: { orderId, type: 'consumption' },
            select: { ingredientId: true },
          })
        ).map((m) => m.ingredientId),
      );

      const consumptions = await this.resolveConsumptions(items);
      if (consumptions.length === 0) return;

      for (const line of consumptions) {
        if (done.has(line.ingredientId)) continue;
        const applied = await this.dataSource
          .transaction((manager) =>
            this.apply(manager, {
              ingredientId: line.ingredientId,
              type: 'consumption',
              amount: { signed: -line.quantity },
              userId,
              reason: null,
              supplierId: null,
              orderId,
            }),
          )
          .catch((err: unknown) => {
            // El índice único parcial rebota el segundo intento sobre el mismo par
            // (orden, ingrediente). Eso no es un fallo: es la orden cerrándose dos veces,
            // que es exactamente lo que el índice existe para absorber.
            if (isDuplicateConsumption(err)) return null;
            throw err;
          });

        if (applied) {
          await this.maybeAlert(
            applied.ingredient,
            applied.movement.previousStock,
            applied.movement.newStock,
          );
        }
      }
    } catch (err) {
      this.logger.error({
        event: 'inventory:consume-failed',
        orderId,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  /**
   * Qué sale del inventario por lo que se vendió. Carga los dos caminos y deja que
   * `aggregateConsumptions` decida; la aritmética y el desempate viven allí, sin base de datos.
   */
  private async resolveConsumptions(
    items: { productId: string; quantity: number }[],
  ): Promise<Consumption[]> {
    const productIds = [...new Set(items.map((i) => i.productId))];
    if (productIds.length === 0) return [];

    const [mirrors, recipes] = await Promise.all([
      // Solo los espejos **activos**: dejar de llevar las existencias de un producto tiene que
      // dejar de moverle el stock de verdad, no seguir hundiéndolo en negativo donde ya nadie
      // mira. (Las recetas no filtran `is_active`, y esa asimetría es anterior a esto.)
      this.ingredientsRepo.find({
        where: { productId: In(productIds), isActive: true },
        select: { id: true, productId: true },
      }),
      this.recipesRepo.find({ where: productIds.map((productId) => ({ productId })) }),
    ]);
    if (mirrors.length === 0 && recipes.length === 0) return [];

    const plan = aggregateConsumptions(
      items,
      mirrors.map((m) => ({ ingredientId: m.id, productId: m.productId as string })),
      recipes.map((r) => ({
        productId: r.productId,
        ingredientId: r.ingredientId,
        quantity: r.quantity,
      })),
    );

    for (const productId of plan.conflicts) {
      // No se lanza: `consumeForOrder` no puede impedir que una cuenta cobrada se cierre. Pero
      // esto es una invariante rota del inventario y no puede pasar sin dejar rastro.
      this.logger.error({ event: 'inventory:mirror-and-recipe', productId });
    }

    return plan.consumptions;
  }

  /**
   * El único sitio donde cambia el stock de un ingrediente.
   *
   * Va en transacción y con **bloqueo pesimista sobre la fila del ingrediente**: sin él, dos
   * movimientos simultáneos leen el mismo stock inicial y el segundo pisa al primero, así que
   * una entrada se pierde y los `previous_stock`/`new_stock` del historial pasan a mentir. Es
   * el mismo tipo de carrera que el `MAX(order_number) + 1` que ya costó una migración.
   */
  private async apply(
    manager: EntityManager,
    input: {
      ingredientId: string;
      type: StockMovementType;
      /**
       * O el delta con signo, o el stock al que hay que llegar. **Exactamente uno de los dos**, y
       * la unión lo hace inexpresable en lugar de comprobarlo en tiempo de ejecución.
       */
      amount: { signed: number } | { toStock: number };
      userId: string;
      reason: string | null;
      supplierId: string | null;
      orderId?: string;
      costPerUnit?: number;
    },
  ): Promise<{ movement: StockMovement; ingredient: Ingredient }> {
    const ingredient = await manager.findOne(Ingredient, {
      where: { id: input.ingredientId },
      lock: { mode: 'pessimistic_write' },
    });
    if (!ingredient) throw new NotFoundException(`Ingrediente ${input.ingredientId} no encontrado`);

    const previousStock = Number(ingredient.currentStock);

    /**
     * El delta de un «ahora tengo 12» **solo se puede calcular aquí**, con la fila ya bloqueada.
     *
     * Calcularlo en el servicio —leer el stock, restar, mandar el delta— es leer un número,
     * esperar y escribir un movimiento cuyo `previous_stock` ya no es el de nadie. Con una venta
     * cerrándose en medio, el ajuste **se traga la venta**: el operario ve 12, el libro mayor dice
     * que se llegó a 12 desde un número que nunca existió, y el consumo queda contabilizado contra
     * un stock que solo bajó una vez. Es la misma carrera que el `MAX(order_number) + 1`.
     */
    const signed =
      'signed' in input.amount
        ? input.amount.signed
        : round3(input.amount.toStock - previousStock);
    const newStock = round3(previousStock + signed);

    const movement = manager.create(StockMovement, {
      ingredientId: ingredient.id,
      type: input.type,
      quantity: round3(signed),
      previousStock,
      newStock,
      reason: input.reason,
      supplierId: input.supplierId,
      orderId: input.orderId ?? null,
      createdBy: input.userId,
    });
    const saved = await manager.save(movement);

    ingredient.currentStock = newStock;
    if (input.type === 'entry' && input.costPerUnit !== undefined) {
      ingredient.costPerUnit = weightedCost(
        previousStock,
        Number(ingredient.costPerUnit),
        signed,
        input.costPerUnit,
      );
    }
    await manager.save(ingredient);

    // El aviso lo dispara quien llama, ya fuera de la transacción. Ver `record`.
    return { movement: saved, ingredient };
  }

  /**
   * Avisa **solo al cruzar** el mínimo, no en cada venta posterior.
   *
   * Con una condición de «stock por debajo del mínimo» a secas, un ingrediente agotado
   * generaría una notificación por cada plato vendido durante el resto del servicio, y el
   * aviso que importa se perdería entre sus propias repeticiones. Los snapshots del
   * movimiento dan la transición gratis.
   */
  private async maybeAlert(
    ingredient: Ingredient,
    previousStock: number,
    newStock: number,
  ): Promise<void> {
    const minimum = Number(ingredient.minimumStock);
    // Un mínimo en cero significa «no me avises de este», no «avísame siempre».
    if (minimum <= 0) return;
    if (!(previousStock > minimum && newStock <= minimum)) return;

    // Se espera en lugar de lanzarlo al aire: `notifyRole` ya captura sus propios errores, así
    // que esperar no puede romper el cobro, y a cambio el aviso queda escrito antes de que la
    // respuesta salga. Con `void`, quien recargue la pantalla al instante no vería la alerta.
    for (const roleName of STOCK_ALERT_ROLES) {
      await this.notifications.notifyRole(roleName, {
        type: 'stock_alert',
        title: `Stock bajo: ${ingredient.name}`,
        body: `Quedan ${newStock} ${ingredient.unit} (mínimo ${minimum}).`,
        resourceType: 'ingredient',
        resourceId: ingredient.id,
      });
    }
  }
}

function round3(value: number): number {
  return Number(value.toFixed(3));
}

/**
 * Costo promedio ponderado tras una entrada.
 *
 * Con stock previo negativo o cero el promedio no significa nada, así que la compra nueva
 * pasa a ser el costo. Es lo que evita que un ingrediente que quedó en negativo arrastre para
 * siempre un costo distorsionado.
 */
function weightedCost(
  previousStock: number,
  previousCost: number,
  addedQuantity: number,
  addedCost: number,
): number {
  if (previousStock <= 0) return Number(addedCost.toFixed(4));
  const total = previousStock + addedQuantity;
  if (total <= 0) return Number(addedCost.toFixed(4));
  const weighted = (previousStock * previousCost + addedQuantity * addedCost) / total;
  return Number(weighted.toFixed(4));
}

/**
 * ¿Es este error el índice único parcial rebotando un consumo que ya estaba escrito?
 *
 * Se compara el **código del driver**, no el texto del mensaje. Comparar el texto es lo que
 * `common/write-conflict.ts` documenta como roto: Postgres traduce sus mensajes según
 * `lc_messages`, así que con la base hablando español ni «unique» ni «duplicate» aparecen, el
 * reenvío dejaba de reconocerse como tal, subía al `catch` de `consumeForOrder` y **se
 * descartaba el consumo entero de la orden** dejando solo una línea de log.
 *
 * No se reutiliza `isConcurrentWriteConflict`: ese trata también un interbloqueo como «ya está
 * hecho», y aquí un interbloqueo significa justo lo contrario — que este consumo **no** se
 * escribió y hay que dejar que el error suba.
 */
function isDuplicateConsumption(err: unknown): boolean {
  if (!(err instanceof QueryFailedError)) return false;
  return (err as QueryFailedError & { code?: string }).code === '23505';
}
