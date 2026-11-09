// ============================================================================
// Utilidades HTTP compartidas por todas las Edge Functions
// ============================================================================
// Reemplazan a las piezas transversales del backend Express:
//   - AppError + errorHandler  -> AppError + serveRoutes (manejo global de errores)
//   - ApiResponse              -> ok() / created()
//   - cors()                   -> buildCorsHeaders() (Tarea 5.5)
//   - trimMiddleware           -> trimStrings()
//   - getPaginationParams      -> getPagination() / paginated()
//
// Todas las respuestas mantienen el formato que ya consume el frontend:
//   éxito: { statusCode, message, data, status: 'success' }
//   error: { status: 'error', message }
// ============================================================================
import { cabecerasDeCache } from './cache-publica.ts';

/** Error controlado: su mensaje se envía tal cual al cliente con el código indicado. */
export class AppError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number = 400,
  ) {
    super(message);
  }
}

export interface ApiResult {
  status: number;
  message: string;
  data: unknown;
  /**
   * Segundos que el navegador puede reutilizar esta respuesta (Cache-Control: max-age). Solo lo declaran las
   * rutas públicas del catálogo; lo que no declara tiempo no se cachea. Ver cache-publica.ts.
   */
  cacheSeconds?: number;
}

/** `cacheSeconds`: solo para respuestas públicas que no dependen de quién pide (ver cache-publica.ts). */
export const ok = (message: string, data: unknown = null, cacheSeconds?: number): ApiResult => ({
  status: 200,
  message,
  data,
  cacheSeconds,
});
export const created = (message: string, data: unknown = null): ApiResult => ({ status: 201, message, data });

export interface RequestContext {
  req: Request;
  url: URL;
  /** Parámetros de la ruta (ej: /:id) */
  params: Record<string, string>;
  /** Parámetros del query string */
  query: URLSearchParams;
  /** Body JSON ya parseado y con los textos recortados ({} si no hay body) */
  // deno-lint-ignore no-explicit-any
  body: any;
}

export type Handler = (ctx: RequestContext) => Promise<ApiResult> | ApiResult;
/** [método HTTP, ruta relativa a la función, handler]. Ej: ['GET', '/:id', findOne] */
export type Route = [method: string, path: string, handler: Handler];

// ─── CORS ────────────────────────────────────────────────────────────────────

const DEFAULT_ALLOWED_ORIGINS = ['http://localhost:4200'];

/** Orígenes permitidos: los de la variable ALLOWED_ORIGINS (separados por coma) + localhost. */
function getAllowedOrigins(): string[] {
  const fromEnv = (Deno.env.get('ALLOWED_ORIGINS') ?? '')
    .split(',')
    .map((o) => o.trim().replace(/\/$/, ''))
    .filter(Boolean);
  return [...DEFAULT_ALLOWED_ORIGINS, ...fromEnv];
}

function isAllowedOrigin(origin: string): boolean {
  if (getAllowedOrigins().includes(origin)) return true;

  // Despliegues de Vercel (producción y previews): https://<algo>.vercel.app
  try {
    const { protocol, hostname } = new URL(origin);
    return protocol === 'https:' && hostname.endsWith('.vercel.app');
  } catch {
    return false;
  }
}

/**
 * Devuelve la URL base del sitio para armar los enlaces que se envían por email
 * (por ejemplo, el de recuperación de contraseña).
 *
 * SEGURIDAD: el enlace lleva un token secreto, así que su destino NO puede
 * salir de un dato que controle quien hace la petición. Si se usara el header
 * Origin tal cual, un atacante podría pedir la recuperación de la cuenta de
 * otra persona indicando su propio sitio, y el token le llegaría a él cuando
 * la víctima hiciera clic.
 *
 * Por eso el Origin solo se respeta si figura en la lista EXPLÍCITA de orígenes
 * (ALLOWED_ORIGINS + localhost). El comodín *.vercel.app queda afuera a
 * propósito: cualquiera puede publicar un sitio ahí. En el resto de los casos
 * se usa SITE_URL.
 */
export function resolveSiteUrl(req: Request): string {
  const origin = (req.headers.get('Origin') ?? '').trim().replace(/\/$/, '');
  if (origin && getAllowedOrigins().includes(origin)) return origin;

  const siteUrl = (Deno.env.get('SITE_URL') ?? '').trim().replace(/\/$/, '');
  if (siteUrl) return siteUrl;

  throw new AppError('El sitio no está configurado para enviar correos', 500);
}

export function buildCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get('Origin') ?? '';
  const headers: Record<string, string> = {
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-turnstile-token',
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };

  // Solo se refleja el origen si está permitido: el navegador bloquea al resto
  if (origin && isAllowedOrigin(origin)) {
    headers['Access-Control-Allow-Origin'] = origin;
  }

  return headers;
}

// ─── Entrada ─────────────────────────────────────────────────────────────────

/**
 * Campos que se leen EXACTAMENTE como llegan. Una contraseña no se recorta ni se le colapsan
 * los espacios: hacerlo cambiaba la contraseña que la persona creyó elegir y recortaba su
 * entropía. Las cuentas creadas antes de este cambio se guardaron ya normalizadas; por eso el
 * login prueba también la versión normalizada (ver _shared/contrasenas.ts).
 */
const RAW_FIELDS: ReadonlySet<string> = new Set(['password', 'confirmPassword', 'currentPassword']);

/**
 * Limpia los espacios en blanco de los textos entrantes: recorta los extremos
 * y colapsa los espacios repetidos. Recorre objetos y arrays anidados.
 *
 * @param rawKeys Nombres de campo que se dejan sin tocar (ej: las contraseñas)
 */
// deno-lint-ignore no-explicit-any
export function trimStrings(value: any, rawKeys: ReadonlySet<string> = new Set()): any {
  if (typeof value === 'string') return value.trim().replace(/\s{2,}/g, ' ');
  if (Array.isArray(value)) return value.map((item) => trimStrings(item, rawKeys));
  if (value !== null && typeof value === 'object') {
    // Seguridad: Object.entries + Object.fromEntries evita la contaminación de prototipos (CWE-1321)
    return Object.fromEntries(
      Object.entries(value).map(([key, inner]) => [key, rawKeys.has(key) ? inner : trimStrings(inner, rawKeys)]),
    );
  }
  return value;
}

// deno-lint-ignore no-explicit-any
async function readJsonBody(req: Request): Promise<any> {
  if (req.method === 'GET' || req.method === 'HEAD') return {};
  if (!(req.headers.get('Content-Type') ?? '').includes('application/json')) return {};

  // Un cuerpo vacío es válido (ej: PATCH /orders/:id/cancel); uno mal formado es un error del cliente
  const text = await req.text();
  if (text.trim() === '') return {};

  try {
    const body = JSON.parse(text);
    return body !== null && typeof body === 'object' ? trimStrings(body, RAW_FIELDS) : {};
  } catch {
    throw new AppError('El cuerpo de la petición no es un JSON válido', 400);
  }
}

/**
 * Deja en el objeto solo los campos permitidos y descarta los `undefined`.
 * Reemplaza a los middlewares sanitize*Input del backend Express.
 */
// deno-lint-ignore no-explicit-any
export function pickFields(body: any, allowed: string[]): Record<string, any> {
  // deno-lint-ignore no-explicit-any
  const result = new Map<string, any>();
  for (const key of allowed) {
    const value = Object.prototype.hasOwnProperty.call(body ?? {}, key) ? Reflect.get(body, key) : undefined;
    if (value !== undefined) result.set(key, value);
  }
  return Object.fromEntries(result);
}

/**
 * Lee un ID numérico de la ruta o lanza un 400 con el mensaje indicado.
 * Es estricto: "12abc" no se interpreta como 12 (parseInt lo aceptaría).
 */
export function intParam(ctx: RequestContext, name: string, errorMessage: string): number {
  const raw = ctx.params[name] ?? '';
  const value = Number(raw);
  if (!/^\d+$/.test(raw) || !Number.isSafeInteger(value)) throw new AppError(errorMessage, 400);
  return value;
}

/** Lee un parámetro del query string ya recortado (undefined si no viene o está vacío). */
export function queryParam(ctx: RequestContext, name: string): string | undefined {
  const value = ctx.query.get(name);
  if (value === null) return undefined;
  const trimmed = trimStrings(value) as string;
  return trimmed === '' ? undefined : trimmed;
}

// ─── Paginación ──────────────────────────────────────────────────────────────

export const DEFAULT_PAGE_SIZE = 16;
export const MAX_PAGE_SIZE = 100;

/**
 * Extrae y sanea los parámetros de paginación del request.
 * Garantiza un límite máximo (MAX_PAGE_SIZE) para evitar la extracción masiva de datos.
 */
export function getPagination(ctx: RequestContext): { page: number; limit: number; offset: number } {
  const page = Math.max(1, Number.parseInt(ctx.query.get('page') ?? '', 10) || 1);
  const requested = Number.parseInt(ctx.query.get('limit') ?? '', 10) || DEFAULT_PAGE_SIZE;
  const limit = Math.min(Math.max(1, requested), MAX_PAGE_SIZE);
  return { page, limit, offset: (page - 1) * limit };
}

/** Construye el objeto de respuesta estructurado para la paginación. */
export function paginated<T>(data: T[], total: number, page: number, limit: number) {
  return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
}

// ─── Tareas en segundo plano ─────────────────────────────────────────────────

/**
 * Ejecuta una tarea sin hacer esperar a quien llamó: la respuesta HTTP sale
 * enseguida y la tarea termina después.
 *
 * Se usa para enviar correos. Además de responder más rápido, hace que la
 * petición tarde lo mismo exista o no la cuenta consultada: si el envío se
 * esperara, medir el tiempo de respuesta alcanzaría para saber qué emails
 * están registrados.
 *
 * EdgeRuntime.waitUntil es la API de Supabase para que la función siga viva
 * hasta que la tarea termine. Si no está disponible, la tarea se espera.
 */
export async function runInBackground(task: Promise<unknown>): Promise<void> {
  // Los errores se registran acá: en segundo plano ya no hay a quién devolvérselos
  const safeTask = task.catch((err) => console.error('Falló una tarea en segundo plano', err));

  // deno-lint-ignore no-explicit-any
  const runtime = (globalThis as any).EdgeRuntime;
  if (typeof runtime?.waitUntil === 'function') {
    runtime.waitUntil(safeTask);
    return;
  }

  await safeTask;
}

// ─── Servidor ────────────────────────────────────────────────────────────────

function jsonResponse(
  body: unknown,
  status: number,
  cors: Record<string, string>,
  extraHeaders: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, ...extraHeaders, 'Content-Type': 'application/json; charset=utf-8' },
  });
}

/** Decodifica un segmento de la URL. Un percent-encoding inválido es un error del cliente (400), no del servidor. */
function decodeSegment(segment: string): string {
  try {
    return decodeURIComponent(segment);
  } catch {
    throw new AppError('La URL contiene caracteres inválidos', 400);
  }
}

/** Compara la ruta declarada (ej: /:id/children) con los segmentos recibidos. */
function matchPath(pattern: string, segments: string[]): Record<string, string> | null {
  const patternSegments = pattern.split('/').filter(Boolean);
  if (patternSegments.length !== segments.length) return null;

  const params = new Map<string, string>();
  for (const [index, part] of patternSegments.entries()) {
    const received = segments.at(index) as string;
    if (part.startsWith(':')) params.set(part.slice(1), received);
    else if (part !== received) return null;
  }
  return Object.fromEntries(params);
}

/** Traduce un error cualquiera a la respuesta HTTP que corresponde. */
// deno-lint-ignore no-explicit-any
function errorToResponse(err: any, cors: Record<string, string>): Response {
  if (err instanceof AppError) {
    return jsonResponse({ status: 'error', message: err.message }, err.statusCode, cors);
  }

  // Errores lanzados por las funciones SQL con un SQLSTATE propio (ver funciones_rpc.sql)
  if (err?.code === 'LE400') return jsonResponse({ status: 'error', message: err.message }, 400, cors);
  if (err?.code === 'LE404') return jsonResponse({ status: 'error', message: err.message }, 404, cors);

  // Violación de unicidad
  if (err?.code === '23505') {
    return jsonResponse({ status: 'error', message: 'Ya existe un registro con los mismos datos únicos' }, 409, cors);
  }
  // Violación de clave foránea: el registro está referenciado por otros datos
  if (err?.code === '23503') {
    return jsonResponse(
      { status: 'error', message: 'No se puede completar la operación porque el registro tiene datos asociados' },
      409,
      cors,
    );
  }
  // Valor inválido para el tipo de la columna (enum inexistente, número fuera de rango, etc.)
  if (err?.code === '22P02' || err?.code === '22003' || err?.code === '23514' || err?.code === '22001') {
    return jsonResponse({ status: 'error', message: 'Los datos enviados no son válidos' }, 400, cors);
  }

  // Errores de programación u otros desconocidos: no se filtran detalles al cliente
  console.error('ERROR', err);
  return jsonResponse({ status: 'error', message: 'Algo salió muy mal!' }, 500, cors);
}

/**
 * Levanta el servidor de una Edge Function con sus rutas.
 * Las rutas se evalúan en orden, igual que en Express: las fijas (/search)
 * deben declararse antes que las que tienen parámetros (/:id).
 *
 * @param functionName Nombre de la función (primer segmento de la URL pública)
 */
export function serveRoutes(functionName: string, routes: Route[]): void {
  Deno.serve(async (req: Request) => {
    const cors = buildCorsHeaders(req);

    // Preflight de CORS
    if (req.method === 'OPTIONS') {
      return new Response('ok', { headers: cors });
    }

    try {
      const url = new URL(req.url);
      const segments = url.pathname.split('/').filter(Boolean).map(decodeSegment);
      // La ruta llega como /<función>/... (o con el prefijo /functions/v1 en algunos entornos)
      const functionIndex = segments.indexOf(functionName);
      const rest = functionIndex >= 0 ? segments.slice(functionIndex + 1) : segments;

      for (const [method, path, handler] of routes) {
        if (method !== req.method) continue;
        const params = matchPath(path, rest);
        if (!params) continue;

        const body = await readJsonBody(req);
        const result = await handler({ req, url, params, query: url.searchParams, body });
        return jsonResponse(
          { statusCode: result.status, message: result.message, data: result.data, status: 'success' },
          result.status,
          cors,
          cabecerasDeCache(req.method, result.status, result.cacheSeconds),
        );
      }

      throw new AppError(`No se encontró la ruta ${url.pathname} en este servidor`, 404);
    } catch (err) {
      return errorToResponse(err, cors);
    }
  });
}
