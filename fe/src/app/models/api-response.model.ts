// Envoltura de toda respuesta exitosa de las edge functions (supabase/functions/_shared/http.ts).
// Los errores no llegan acá: los maneja el interceptor de errores.
export interface IApiResponse<T> {
  status: 'success';
  statusCode: number;
  message: string;
  data: T;
}
