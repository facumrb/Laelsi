import { HttpClient } from '@angular/common/http';
import {
  AbstractControl,
  AsyncValidatorFn,
  FormArray,
  FormGroup,
  ValidationErrors,
} from '@angular/forms';
import { Observable, of, timer } from 'rxjs';
import { catchError, map, switchMap } from 'rxjs/operators';
import { environment } from 'src/environments/environment';

export class FormUtils {
  //EXPRESIONES REGULARES
  static namePattern = "^[a-zA-ZáéíóúÁÉÍÓÚñÑ0-9'\\-\\s\\.&]+$";
  static emailPattern = '^[a-z0-9._%+-]+@[a-z0-9.-]+\\.[a-z]{2,}$';
  static numberPattern = '^[0-9]*$';
  static cuitPattern = '^[0-9]{11}$';
  static phonePattern = '^[+]?[0-9\\-\\s]*$';
  static usernamePattern = '^[a-zA-Z0-9._-]+$';
  // Solo para el login: el campo acepta un nombre de usuario O un email, así que
  // admite además @, % y +. Solo filtra caracteres: quien resuelve la cuenta es el backend.
  static loginIdentifierPattern = '^[a-zA-Z0-9._%+@-]+$';
  // Mínimo 8 caracteres y debe tener al menos 1 letra, y 1 número.
  static passwordPattern = '^(?=.*[A-Za-z])(?=.*\\d).{8,}$';
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

        case 'mustMatch':
          return `Las contraseñas no coinciden.`;

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
            return 'La contraseña debe tener al menos 8 caracteres, con al menos una letra y un número.';
          }

          // Nombre de Usuario (Username)
          if (errors['pattern'].requiredPattern === this.usernamePattern) {
            return 'Solo se permiten letras, números, puntos (.) y guiones bajos (_) y guiones medios (-).';
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
            return 'Solo se permiten números, espacios, guiones (-) y el signo más (+).';
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

  static isValidField(form: FormGroup, fieldName: string): boolean | null {
    return (
      !!form.controls[fieldName].errors && form.controls[fieldName].touched
    );
  }

  static getFieldError(form: FormGroup, fieldName: string): string | null {
    if (!form.controls[fieldName]) return null;

    const errors = form.controls[fieldName].errors ?? {};

    return FormUtils.getTextError(errors);
  }

  static isValidFieldInArray(formArray: FormArray, index: number) {
    return (
      formArray.controls[index].errors && formArray.controls[index].touched
    );
  }

  static getFieldErrorInArray(
    formArray: FormArray,
    index: number,
  ): string | null {
    if (formArray.controls.length === 0) return null;

    const errors = formArray.controls[index].errors ?? {};

    return FormUtils.getTextError(errors);
  }

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

  /**
   * Validador asíncrono para verificar la unicidad de campos en el backend.
   *
   * @param entity Nombre de la entidad (ej: 'Admin', 'Client', 'Product', 'Category')
   * @param field Nombre del campo a validar (ej: 'email', 'username', 'dni', 'cuit', 'name')
   * @param http Instancia de HttpClient (inyectada con inject(HttpClient))
   * @param excludeId ID opcional a excluir de la validación (útil en ediciones)
   * @returns AsyncValidatorFn que retorna { [field + 'Taken']: true } si el valor ya existe
   */
  static uniqueFieldValidator(
    entity: string,
    field: string,
    http: HttpClient,
    excludeId?: number,
  ): AsyncValidatorFn {
    return (control: AbstractControl): Observable<ValidationErrors | null> => {
      if (!control.value || control.pristine) {
        return of(null);
      }

      return timer(400).pipe(
        switchMap(() => {
          const value = control.value;
          // La validación la resuelve la función SQL check_field_unique, que se
          // invoca por la API REST de Supabase
          const url = `${environment.supabaseUrl}/rest/v1/rpc/check_field_unique`;
          const body = {
            p_entity: entity,
            p_field: field,
            p_value: value,
            p_exclude_id: excludeId ?? null,
          };

          return http.post<{ available: boolean }>(url, body).pipe(
            map((res) => (res.available ? null : { [`${field}Taken`]: true })),
            catchError(() => of(null)),
          );
        }),
      );
    };
  }
}
