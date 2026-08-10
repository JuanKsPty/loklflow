import { registerDecorator, type ValidationArguments, type ValidationOptions } from 'class-validator';
import { checkPin } from './pin-policy';

/**
 * Aplica `checkPin` como validador de `class-validator`.
 *
 * Un decorador y no una comprobación dentro del servicio para que el rechazo salga por el mismo
 * camino que el resto de las validaciones —un 400 con el mensaje en el cuerpo, que el formulario ya
 * sabe pintar— y para que el motivo concreto llegue al usuario: «ese PIN es de los más usados» es
 * accionable, «PIN inválido» no.
 */
export function IsAcceptablePin(options?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isAcceptablePin',
      target: object.constructor,
      propertyName,
      options,
      validator: {
        validate: (value: unknown) => typeof value === 'string' && checkPin(value).ok,
        defaultMessage: (args: ValidationArguments) => {
          const verdict = checkPin(String(args.value));
          return verdict.ok ? '' : verdict.reason;
        },
      },
    });
  };
}
