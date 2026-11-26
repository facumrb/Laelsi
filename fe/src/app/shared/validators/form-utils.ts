import { HttpClient } from '@angular/common/http';
import {
  AbstractControl,
  AsyncValidatorFn,
  ValidationErrors,
} from '@angular/forms';
import { Observable, of, timer } from 'rxjs';
import { catchError, map, switchMap } from 'rxjs/operators';
import { environment } from '@environments/environment';
import {
  MENSAJE_FORMATO_TELEFONO,
  PATRON_TELEFONO,
} from '@shared/utils/telefono';

export class FormUtils {
  // Expresiones regulares
  static namePattern = "^[a-zA-ZáéíóúÁÉÍÓÚñÑ0-9'\\-\\s\\.&]+$";
  static emailPattern = '^[a-z0-9._%+-]+@[a-z0-9.-]+\\.[a-z]{2,}$';
  static numberPattern = '^[0-9]*$';
  static cuitPattern = '^[0-9]{11}$';
  // Sale de telefono.ts, la única fuente de las reglas del teléfono
  static phonePattern = PATRON_TELEFONO.source;
  static usernamePattern = '^[a-zA-Z0-9._-]+$';
  /*
  Solo para el login: el campo acepta un nombre de usuario O un email, así que
  admite además @, % y +. Solo filtra caracteres: quien resuelve la cuenta es el backend.
  */
  static loginIdentifierPattern = '^[a-zA-Z0-9._%+@-]+$';
  // Mínimo 8 caracteres y debe tener al menos 1 letra, y 1 número.
  static passwordPattern = '^(?=.*[A-Za-z])(?=.*\\d).{8,}$';
  // Texto de la regla: lo usan el mensaje de error y la ayuda fija debajo de los campos de contraseña
  static passwordRule = 'Mínimo 8 caracteres, al menos una letra y un número.';

  // Controles cuya última verificación de unicidad no pudo hacerse (sin red, límite de consultas)
  private static verificacionesFallidas = new WeakSet<AbstractControl>();

  // Validadores para strings reemplazando los nativos para eliminar espacios vacios con trim
  static minLength(minLength: number) {
    return (control: AbstractControl): ValidationErrors | null => {
      if (!control.value || typeof control.value !== 'string') return null;
      const length = control.value.trim().replace(/\s{2,}/g, ' ').length;
      return length < minLength && length > 0
        ? { minlength: { requiredLength: minLength, actualLength: length } }
        : null;
    };
  }

  static maxLength(maxLength: number) {
    return (control: AbstractControl): ValidationErrors | null => {
      if (!control.value || typeof control.value !== 'string') return null;
      const length = control.value.trim().replace(/\s{2,}/g, ' ').length;
      return length > maxLength
        ? { maxlength: { requiredLength: maxLength, actualLength: length } }
        : null;
    };
  }

  // Texto del primer error de un control. Lo usa app-field-error
  static getTextError(
    errors: ValidationErrors,
    fieldName: string = 'campo',
  ): string | null {
    for (const key of Object.keys(errors)) {
      switch (key) {
        case 'required':
          return `El ${fieldName} es requerido.`;

        case 'minlength':
          return `Mínimo de ${errors['minlength'].requiredLength} caracteres.`;

        case 'maxlength':
          return `Límite alcanzado.`;

        case 'min':
          return `El valor mínimo es ${errors['min'].min}.`;

        case 'max':
          return `El valor máximo es ${errors['max'].max}.`;

        case 'onlyWhitespace':
          return `El campo no puede contener solo espacios en blanco.`;

        case 'emailTaken':
          return `El correo electrónico ya está registrado.`;

        case 'usernameTaken':
          return `El nombre de usuario ya está en uso.`;

        case 'dniTaken':
          return `El DNI ya está registrado.`;

        case 'cuitTaken':
          return `El CUIT ya está registrado.`;

        case 'nameTaken':
          return `Este nombre ya está en uso.`;

        case 'passwordsNotEqual':
          return `Las contraseñas no coinciden.`;

        case 'pattern':
          // Email
          if (errors['pattern'].requiredPattern === this.emailPattern) {
            return 'Formato de correo no válido (ej: usuario@dominio.com).';
          }

          // Nombre (Name)
          if (errors['pattern'].requiredPattern === this.namePattern) {
            return 'El nombre contiene caracteres no permitidos.';
          }

          // Contraseña (Password)
          if (errors['pattern'].requiredPattern === this.passwordPattern) {
            return this.passwordRule;
          }

          // Nombre de Usuario (Username)
          if (errors['pattern'].requiredPattern === this.usernamePattern) {
            return 'Solo letras, números, puntos (.), guiones (-) y guiones bajos (_).';
          }

          // Usuario o email (login)
          if (
            errors['pattern'].requiredPattern === this.loginIdentifierPattern
          ) {
            return 'Ingresá un email o un nombre de usuario válido, sin espacios.';
          }

          // CUIT
          if (errors['pattern'].requiredPattern === this.cuitPattern) {
            return 'El CUIT debe contener exactamente 11 números (sin guiones).';
          }

          // Teléfono (Phone)
          if (errors['pattern'].requiredPattern === this.phonePattern) {
            return MENSAJE_FORMATO_TELEFONO;
          }

          // Solo Números (Number)
          if (errors['pattern'].requiredPattern === this.numberPattern) {
            return 'Este campo solo acepta números.';
          }
          return `El formato del ${fieldName} no es válido.`;
        default:
          return `Error: ${key}`;
      }
    }
    return null;
  }

  // Validador de grupo: marca el segundo campo con passwordsNotEqual si no coincide con el primero
  static isFieldOneEqualFieldTwo(field1: string, field2: string) {
    return (formGroup: AbstractControl) => {
      const field1Value = formGroup.get(field1)?.value;
      const field2Control = formGroup.get(field2);
      if (!field2Control) return null;

      const field2Value = field2Control.value;

      if (field1Value !== field2Value) {
        if (!field2Control.hasError('passwordsNotEqual')) {
          field2Control.setErrors({
            ...field2Control.errors,
            passwordsNotEqual: true,
          });
        }
        return { passwordsNotEqual: true };
      } else {
        if (field2Control.hasError('passwordsNotEqual')) {
          const errors = { ...field2Control.errors };
          delete errors['passwordsNotEqual'];
          field2Control.setErrors(
            Object.keys(errors).length > 0 ? errors : null,
          );
        }
        return null;
      }
    };
  }

  // Rechaza un valor que tiene solo espacios
  static notOnlyWhiteSpace(control: AbstractControl): ValidationErrors | null {
    // Si no hay valor, dejamos que el validador 'required' se encargue
    if (!control.value) {
      return null;
    }
    const isWhitespace = (control.value || '').toString().trim().length === 0;
    // Si después de quitar espacios el largo es 0, es inválido
    const isValid = !isWhitespace;
    return isValid ? null : { onlyWhitespace: true };
  }

  /*
  Validador asíncrono para verificar la unicidad de campos en el backend.

  Parámetros:
  - entity: nombre de la entidad (ej: 'Admin', 'Client', 'Product', 'Category')
  - field: nombre del campo a validar (ej: 'email', 'username', 'dni', 'cuit', 'name')
  - http: instancia de HttpClient (inyectada con inject(HttpClient))
  - excludeId: ID opcional a excluir de la validación (útil en ediciones)

  Devuelve un AsyncValidatorFn que da { [field + 'Taken']: true } si el valor ya existe.

  Si la consulta falla (sin red, o el límite de consultas por minuto de check_field_unique), el control
  queda válido para no impedir el envío: los índices únicos de la base rechazan el duplicado al guardar.
  Ese control queda registrado como sin verificar (ver verificacionPendiente) hasta que una consulta responda.
  */
  static uniqueFieldValidator(
    entity: string,
    field: string,
    http: HttpClient,
    excludeId?: number,
  ): AsyncValidatorFn {
    return (control: AbstractControl): Observable<ValidationErrors | null> => {
      FormUtils.verificacionesFallidas.delete(control);

      if (!control.value || control.pristine) {
        return of(null);
      }

      return timer(400).pipe(
        switchMap(() => {
          const value = control.value;
          /*
          La validación la resuelve la función SQL check_field_unique, que se
          invoca por la API REST de Supabase
          */
          const url = `${environment.supabaseUrl}/rest/v1/rpc/check_field_unique`;
          const body = {
            p_entity: entity,
            p_field: field,
            p_value: value,
            p_exclude_id: excludeId ?? null,
          };

          return http.post<{ available: boolean }>(url, body).pipe(
            map((res) => (res.available ? null : { [`${field}Taken`]: true })),
            catchError(() => {
              FormUtils.verificacionesFallidas.add(control);
              return of(null);
            }),
          );
        }),
      );
    };
  }

  // Indica si la última verificación de unicidad del control no pudo hacerse
  static verificacionPendiente(control: AbstractControl): boolean {
    return FormUtils.verificacionesFallidas.has(control);
  }
}
