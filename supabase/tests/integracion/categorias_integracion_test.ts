/*
Prueba de integración del backend: Edge Function categories + Supabase Auth + PostgreSQL.

Recorre el CRUD de categorías por HTTP real, como lo hace el frontend: crea dos cuentas (Admin y
Client), inicia sesión con POST /auth/login y prueba que solo el Admin pueda crear, editar y borrar.
También prueba la validación de la entrada y el formato de los errores.

Corre SOLO contra la pila local (nunca contra producción):
  npx supabase start
  npx supabase functions serve
  npm run test:integracion
*/
import assert from 'node:assert/strict';

// Igualdad profunda con mensaje opcional (mismo estilo que las pruebas de supabase/functions/_tests/)
const assertEquals = (actual: unknown, esperado: unknown, mensaje?: string) =>
  assert.deepEqual(actual, esperado, mensaje);

const API_URL = (Deno.env.get('API_URL') ?? '').replace(/\/$/, '');
const SERVICE_ROLE_KEY = Deno.env.get('SERVICE_ROLE_KEY') ?? '';
const FUNCTIONS_URL = `${API_URL}/functions/v1`;

// Protección: la prueba crea y borra datos, así que se niega a correr fuera de la máquina local
if (!/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(API_URL) || !SERVICE_ROLE_KEY) {
  throw new Error(
    `La prueba de integración solo corre contra la pila local de Supabase (API_URL recibido: "${API_URL}"). ` +
      'Usá "npm run test:integracion", que toma las variables de "npx supabase status".',
  );
}

const sufijo = `${Date.now()}`;
const PASSWORD = `Integracion-${sufijo}!`;

interface Cuenta {
  authId: string;
  email: string;
  token: string;
}

// Llama a la API de administración de Auth o a la API REST con la service role key
async function servicio(path: string, init: RequestInit = {}) {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      apikey: SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
      ...init.headers,
    },
  });
  const texto = await res.text();
  if (!res.ok) throw new Error(`${init.method ?? 'GET'} ${path} → ${res.status}: ${texto}`);
  return texto ? JSON.parse(texto) : null;
}

// Llama a una Edge Function y devuelve el código y el cuerpo
async function api(method: string, path: string, opciones: { token?: string; body?: unknown } = {}) {
  const res = await fetch(`${FUNCTIONS_URL}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(opciones.token ? { Authorization: `Bearer ${opciones.token}` } : {}),
    },
    body: opciones.body === undefined ? undefined : JSON.stringify(opciones.body),
  });
  return { status: res.status, body: await res.json() };
}

/*
Crea la cuenta en Auth e inicia sesión. El trigger de auth.users crea el perfil siempre como Client
(nadie puede darse el rol Admin al registrarse), así que el rol se asigna después en el perfil, igual
que en supabase/seed/seed.mjs. La cuenta se anota en "creadas" antes del login para limpiarla aunque falle.
*/
async function crearCuenta(rol: 'Admin' | 'Client', creadas: Cuenta[]): Promise<Cuenta> {
  const username = `integracion_${rol.toLowerCase()}_${sufijo}`;
  const email = `${username}@example.com`;
  const creado = await servicio('/auth/v1/admin/users', {
    method: 'POST',
    body: JSON.stringify({
      email,
      password: PASSWORD,
      email_confirm: true,
      user_metadata: { name: 'Prueba', last_name: rol, username },
    }),
  });
  const cuenta: Cuenta = { authId: creado.id, email, token: '' };
  creadas.push(cuenta);

  await servicio(`/rest/v1/user?supabase_uid=eq.${creado.id}`, {
    method: 'PATCH',
    body: JSON.stringify({ role: rol }),
  });

  const login = await api('POST', '/auth/login', { body: { identifier: username, password: PASSWORD } });
  assertEquals(login.status, 200, `Login de ${rol}: ${JSON.stringify(login.body)}`);
  assertEquals(login.body.data.user.role, rol);

  cuenta.token = login.body.data.token;
  return cuenta;
}

// Borra la cuenta de Auth y su perfil (la FK es ON DELETE SET NULL, el perfil no se va solo)
async function borrarCuenta(cuenta: Cuenta) {
  await servicio(`/auth/v1/admin/users/${cuenta.authId}`, { method: 'DELETE' });
  await servicio(`/rest/v1/user?email=eq.${encodeURIComponent(cuenta.email)}`, { method: 'DELETE' });
}

Deno.test({
  name: 'Integración: CRUD de categorías con autenticación y niveles de acceso',
  sanitizeResources: false,
  sanitizeOps: false,
  fn: async (t) => {
    const creadas: Cuenta[] = [];
    let admin: Cuenta | undefined;
    let cliente: Cuenta | undefined;
    let categoriaId: number | undefined;
    const nombre = `Categoría de integración ${sufijo}`;

    try {
      admin = await crearCuenta('Admin', creadas);
      cliente = await crearCuenta('Client', creadas);

      await t.step('sin token, crear una categoría devuelve 401', async () => {
        const res = await api('POST', '/categories', { body: { name: nombre } });
        assertEquals(res.status, 401);
        assertEquals(res.body.status, 'error');
      });

      await t.step('un Client no puede crear categorías (403)', async () => {
        const res = await api('POST', '/categories', { token: cliente!.token, body: { name: nombre } });
        assertEquals(res.status, 403);
        assertEquals(res.body.status, 'error');
      });

      await t.step('sin nombre, la validación responde 400 con el mensaje', async () => {
        const res = await api('POST', '/categories', { token: admin!.token, body: { description: 'Sin nombre' } });
        assertEquals(res.status, 400);
        assertEquals(res.body, { status: 'error', message: 'El Nombre de la categoría es requerido' });
      });

      await t.step('con un estado inválido responde 400', async () => {
        const res = await api('POST', '/categories', { token: admin!.token, body: { name: nombre, state: 'Borrado' } });
        assertEquals(res.status, 400);
      });

      await t.step('el Admin crea la categoría (201)', async () => {
        const res = await api('POST', '/categories', {
          token: admin!.token,
          body: { name: nombre, description: 'Creada por la prueba de integración' },
        });
        assertEquals(res.status, 201, JSON.stringify(res.body));
        assertEquals(res.body.status, 'success');
        assertEquals(res.body.data.name, nombre);
        categoriaId = res.body.data.id;
        assert(Number.isInteger(categoriaId));
      });

      await t.step('la categoría quedó guardada y se lee por la ruta pública', async () => {
        const res = await api('GET', `/categories/${categoriaId}`);
        assertEquals(res.status, 200);
        assertEquals(res.body.data.name, nombre);
        assertEquals(res.body.data.state, 'Activo');
      });

      await t.step('el Admin la edita y el cambio persiste', async () => {
        const res = await api('PATCH', `/categories/${categoriaId}`, {
          token: admin!.token,
          body: { state: 'Inactivo' },
        });
        assertEquals(res.status, 200, JSON.stringify(res.body));

        const leida = await api('GET', `/categories/${categoriaId}`);
        assertEquals(leida.body.data.state, 'Inactivo');
      });

      await t.step('un Client no puede borrarla (403)', async () => {
        const res = await api('DELETE', `/categories/${categoriaId}`, { token: cliente!.token });
        assertEquals(res.status, 403);
      });

      await t.step('el Admin la borra y deja de existir (404)', async () => {
        const id = categoriaId;
        const res = await api('DELETE', `/categories/${id}`, { token: admin!.token });
        assertEquals(res.status, 200, JSON.stringify(res.body));
        categoriaId = undefined;

        const leida = await api('GET', `/categories/${id}`);
        assertEquals(leida.status, 404);
      });
    } finally {
      // Limpieza: no deja datos de prueba en la base local aunque algún paso falle
      if (categoriaId !== undefined && admin) {
        await api('DELETE', `/categories/${categoriaId}`, { token: admin.token });
      }
      for (const cuenta of creadas) await borrarCuenta(cuenta);
    }
  },
});
