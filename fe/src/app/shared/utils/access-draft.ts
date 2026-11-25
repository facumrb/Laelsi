import { DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormGroup } from '@angular/forms';

// Pantallas de acceso que conservan lo que la persona escribió.
export type AccessScreen = 'login' | 'register' | 'recover-password';

export interface AccessDraft {
  // Descarta el borrador. Se llama cuando la pantalla se envió correctamente.
  clear(): void;
}

const STORAGE_PREFIX = 'laelsi:borrador-acceso:';

// Los campos de contraseña nunca se guardan, se llamen como se llamen
const PASSWORD_FIELD = /password|contrase/i;

/*
sessionStorage puede no estar disponible (modo privado estricto, almacenamiento
bloqueado). El borrador es una comodidad: si falla, la pantalla funciona igual.
*/
function getStorage(): Storage | null {
  try {
    return globalThis.sessionStorage ?? null;
  } catch {
    return null;
  }
}

// Lee el borrador guardado de una pantalla ({} si no hay).
export function readAccessDraft(screen: AccessScreen): Record<string, string> {
  try {
    const raw = getStorage()?.getItem(STORAGE_PREFIX + screen);
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    if (parsed === null || typeof parsed !== 'object') return {};

    // Solo se devuelven textos: lo guardado pudo haber sido alterado a mano
    return Object.fromEntries(
      Object.entries(parsed).filter(
        (entry): entry is [string, string] => typeof entry[1] === 'string',
      ),
    );
  } catch {
    return {};
  }
}

/*
Conserva el identificador que la persona escribió en una pantalla de acceso
(nombre de usuario, email...) para que no tenga que volver a tipearlo si sale
de la pantalla y vuelve.

- Se guarda en sessionStorage: dura lo que dura la sesión de navegación de esa
  pestaña y se borra sola al cerrarla.
- Solo se guardan los campos indicados en `fields`. La contraseña NUNCA se
  guarda: de recordarla se ocupa el navegador o el gestor de contraseñas,
  mediante los atributos `autocomplete` de cada input.
- Cuando la pantalla se envía bien hay que llamar a `clear()`.

Debe llamarse en un contexto de inyección (inicializador de campo o constructor).
*/
export function injectAccessDraft(
  screen: AccessScreen,
  form: FormGroup,
  fields: readonly string[],
): AccessDraft {
  const destroyRef = inject(DestroyRef);
  const key = STORAGE_PREFIX + screen;

  for (const field of fields) {
    if (PASSWORD_FIELD.test(field)) {
      throw new Error(
        `El campo "${field}" no se puede guardar como borrador: las contraseñas no se almacenan.`,
      );
    }
  }

  // 1. Restaurar lo que había quedado escrito
  const saved = readAccessDraft(screen);
  for (const field of fields) {
    const control = form.get(field);
    const value = saved[field];

    if (control && value) {
      /*
      Se marca como modificado ANTES de asignar el valor: las validaciones
      asíncronas (ej: "usuario disponible") ignoran los campos sin tocar.
      */
      control.markAsDirty();
      control.setValue(value);
    }
  }

  // 2. Guardar cada cambio mientras la pantalla esté abierta
  let cleared = false;

  form.valueChanges.pipe(takeUntilDestroyed(destroyRef)).subscribe(() => {
    if (cleared) return;

    const values = form.getRawValue() as Record<string, unknown>;
    const draft = new Map<string, string>();
    for (const field of fields) {
      const value = values[field];
      if (typeof value === 'string' && value !== '') draft.set(field, value);
    }

    try {
      const storage = getStorage();
      if (draft.size === 0) {
        storage?.removeItem(key);
      } else {
        storage?.setItem(key, JSON.stringify(Object.fromEntries(draft)));
      }
    } catch {
      // Sin almacenamiento disponible no hay borrador: no es un error para la persona
    }
  });

  return {
    clear() {
      cleared = true;
      try {
        getStorage()?.removeItem(key);
      } catch {
        // Nada que hacer: no había almacenamiento disponible
      }
    },
  };
}
