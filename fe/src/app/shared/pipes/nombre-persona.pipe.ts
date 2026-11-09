import { Pipe, PipeTransform } from '@angular/core';

/**
 * Nombre para mostrar de una persona. Nombre y apellido de un cliente son opcionales (ID 71 de
 * docs/requerimientos/discusiones.md): un cliente sin nombre no puede aparecer como "null null" ni en
 * blanco, así que se muestra el respaldo (en los pedidos, su correo).
 */
@Pipe({
  name: 'nombrePersona',
})
export class NombrePersonaPipe implements PipeTransform {
  transform(
    persona: { name?: string | null; lastName?: string | null } | null | undefined,
    respaldo: string,
  ): string {
    const completo = [persona?.name, persona?.lastName]
      .map((texto) => (texto ?? '').trim())
      .filter((texto) => texto.length > 0)
      .join(' ');
    return completo || respaldo;
  }
}
