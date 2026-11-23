import { IApiUserPhoto } from './photo.model';

export enum UserRole {
  Admin = 'Admin',
  Client = 'Client',
}

export enum FiscalCondition {
  ConsumidorFinal = 'Consumidor Final',
  ResponsableInscripto = 'Responsable Inscripto',
  Monotributista = 'Monotributista',
  Exento = 'Exento',
}

// Estado de un cliente o administrador (ID 65 de docs/requerimientos/discusiones.md): por ahora no se
// elimina a nadie, solo se lo DESACTIVA. Un usuario Inactivo conserva sus datos y su historial, pero no
// puede ingresar ni hacer pedidos. Es un texto (no un enum) para poder usarlo en el filtro y en la insignia.
export type UserState = 'Activo' | 'Inactivo';

// Filtro de las pestañas de Administradores y Clientes
export type UserStateFilter = UserState | 'Todos';

// ==========================================================
// MODELOS DE LECTURA (READ / GET)
// ==========================================================

// Sin contraseña: vive en Supabase Auth.
// Nombre, apellido, DNI y teléfono pueden ser null, ya que son opcionales para un cliente.
export interface IApiUser {
  id: number;
  name: string | null;
  lastName: string | null;
  dni: string | null;
  phone: string | null;
  username: string;
  email: string;
  role: UserRole;
  photo: IApiUserPhoto | null; // null si el usuario no cargó una foto de perfil
  state: UserState;

  // Las fechas vienen como string ISO desde la API
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
}

export interface IApiAdmin extends IApiUser {}

// Agrega los datos de envío y facturación
export interface IApiClient extends IApiUser {
  cuit?: string;
  fiscalCondition?: FiscalCondition;
  street?: string;
  streetNumber?: number;
  city?: string;
  province?: string;
  postalCode?: string;
  floor?: string;
  apartment?: string;
}

// ==========================================================
// MODELOS DE CREACIÓN (CREATE / POST)
// ==========================================================

// Campos que no se envían al crear ni al editar. El estado se cambia con su propia ruta, PATCH /:id/state
type OmitAutoFields =
  | 'id'
  | 'photo'
  | 'state'
  | 'createdAt'
  | 'updatedAt'
  | 'deletedAt';

export type ICreateAdmin = Omit<IApiAdmin, OmitAutoFields> & {
  password: string;
};

export type ICreateClient = Omit<IApiClient, OmitAutoFields> & {
  password: string;
};

// ==========================================================
// MODELOS DE ACTUALIZACIÓN (UPDATE / PUT / PATCH)
// ==========================================================

export type IUpdateClient = Partial<
  Omit<IApiClient, OmitAutoFields | 'streetNumber'>
> & {
  // null borra la altura guardada
  streetNumber?: number | null;
  password?: string;
  // La contraseña ACTUAL: el servidor la exige para que una persona cambie su propio email o contraseña
  currentPassword?: string;
};

export type IUpdateAdmin = Partial<Omit<IApiAdmin, OmitAutoFields>> & {
  password?: string;
  // La contraseña ACTUAL: el servidor la exige para que un administrador cambie su propio email o contraseña
  currentPassword?: string;
};
