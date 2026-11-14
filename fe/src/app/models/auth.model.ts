import { IApiUserPhoto } from './photo.model';
import { UserRole } from './user.model';

export interface UserSession {
  id: number;
  name: string;
  lastName: string;
  role: UserRole;
  photo?: IApiUserPhoto | null;
  // false = todavía no aceptó los Términos y la Política de Privacidad (cuentas de Google y cuentas
  // anteriores a la casilla del registro). Ausente en copias locales viejas: se completa desde /auth/me
  termsAccepted?: boolean;
  // false = la cuenta no tiene contraseña propia (entra solo con Google): no hay "contraseña actual" que pedir
  hasPassword?: boolean;
}

export interface LoginData {
  token: string;
  refreshToken: string;
  user: UserSession;
}

export interface IApiResponse<T> {
  status: string;
  message: string;
  data: T;
}

// Registro completo (Admin/Client)
export interface RegisterData {
  name: string;
  lastName: string;
  dni: string;
  phone: string;
  username: string;
  email: string;
  password: string;
}

// Pre-registro simplificado (Client)
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

