import { IApiUserPhoto } from './photo.model';
import { UserRole } from './user.model';

/*
 Datos del usuario que la app guarda en el navegador. Si se agrega un campo acá, hay que sumarlo a
 SESSION_FIELDS (auth.service.ts): si no, se descarta al guardar.
*/
export interface UserSession {
  id: number;
  // Pueden ser null: el registro y el acceso con Google no los piden
  name: string | null;
  lastName: string | null;
  role: UserRole;
  photo?: IApiUserPhoto | null;

  // false = todavía no aceptó los Términos y la Política de Privacidad (cuentas de Google y cuentas anteriores a la casilla del registro).
  termsAccepted?: boolean;

  // false = la cuenta no tiene contraseña propia (entra solo con Google): no hay "contraseña actual" que pedir.
  hasPassword?: boolean;
}

// Respuesta de POST /auth/login: los tokens de Supabase Auth y el usuario de la sesión
export interface LoginData {
  token: string;
  refreshToken: string;
  user: UserSession;
}

// Registro propio de un cliente: solo los datos mínimos (POST /auth/register)
export interface IClientRegister {
  username: string;
  email: string;
  password: string;
  // Casilla de aceptación de los Términos y la Política de Privacidad, y la versión que se mostró
  acceptTerms: boolean;
  termsVersion: string;
}

// Estado de un enlace de recuperación de contraseña
export interface ResetTokenStatus {
  valid: boolean; // false si el enlace venció, ya se usó o no existe
  username?: string; // Cuenta a la que pertenece (solo si es válido)
}
