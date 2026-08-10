import { Injectable, NotFoundException, PipeTransform } from '@nestjs/common';

/**
 * Valida el token del QR de la ruta pública.
 *
 * **No se reutiliza `ParseUuidPipe`** por dos motivos, y el segundo es el que importa:
 *
 * 1. Lanza `BadRequestException` con el mensaje `"<valor>" is not a valid UUID`, que **devuelve el
 *    valor recibido** en el cuerpo de la respuesta. En una ruta autenticada da igual; en una
 *    pública es un reflejo gratuito de lo que le manden.
 * 2. Distinguir «mal formado» (400) de «no existe» (404) le dice a quien está probando que su
 *    formato era correcto y que solo falló el valor. Aquí las dos cosas responden **404**, así que
 *    un sondeo no aprende nada de la diferencia.
 *
 * El formato es el de `randomUUID()`, que es lo que genera `TablesService`.
 */
@Injectable()
export class ParseQrCodePipe implements PipeTransform<string> {
  private readonly QR_REGEX =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  transform(value: string): string {
    if (typeof value !== 'string' || !this.QR_REGEX.test(value)) {
      throw new NotFoundException('Este código no corresponde a ninguna mesa');
    }
    return value;
  }
}
