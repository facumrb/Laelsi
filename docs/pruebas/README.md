# Pruebas automáticas

[Volver a la documentación](../README.md) · [Evidencia de la última ejecución](evidencia-2026-11-26.md)

## Qué pruebas hay y qué requisito cubre cada una

| Tipo | Herramienta | Dónde | Qué prueba | Requisito de la cátedra |
| :-- | :-- | :-- | :-- | :-- |
| Unitaria de componente | Vitest + TestBed (`ng test`) | `fe/src/app/pages/admin/components/table-components/entity-state-badge/entity-state-badge.component.spec.ts` | La insignia de estado pinta verde, ámbar o rojo según el `input` `state` | Frontend: al menos 1 test unitario de un componente |
| Unitaria de componente | Vitest + TestBed (`ng test`) | `fe/src/app/pages/admin/components/form-actions/form-actions.component.spec.ts` | El pie de los formularios: `input` (textos, deshabilitado, ruta) y `output` (`cancelClick`) | Frontend: test unitario de un componente (input y output property) |
| End-to-end | Playwright (Chromium) | `fe/e2e/compra.spec.ts` | Recorrido de compra (portada, categoría, filtro por marca, detalle, carrito) y la ruta protegida `/profile` sin sesión, en SM, MD y LG | Frontend: al menos 1 test end-to-end |
| Integración | Deno test + pila local de Supabase | `supabase/tests/integracion/categorias_integracion_test.ts` | El CRUD de categorías por HTTP real (Edge Function, Supabase Auth y PostgreSQL): login, niveles de acceso (401 y 403), validación (400) y persistencia | Backend: 1 test de integración, y login con rutas protegidas |
| Unitarias de backend | Deno test | `supabase/functions/_tests/*_unit_test.ts` | Reglas puras de las Edge Functions: portada, publicación, estado de usuarios, caché pública, profundidad y subárbol de categorías, campos de usuario, tarjeta de producto | Backend: 1 test automatizado por integrante |
| Concordancia entre capas e interfaz | Deno test | `supabase/functions/_tests/*_test.ts` (no unitarias) | Constantes que comparten frontend, backend y base; accesibilidad, diseño adaptable y peso del bundle, leyendo el código como texto | Buenas prácticas (alcance adicional) |
| Base de datos | pgTAP (`supabase test db`) | `supabase/tests/database/*.test.sql` | Estados Activo, Inactivo y Pausado de usuarios y productos, a nivel de la base | Buenas prácticas (alcance adicional) |

Estas pruebas cubren requisitos de la cátedra y **se conservan**: no se borran como las pruebas temporales de UI (ver `CLAUDE.md`).

## Cómo correrlas

Desde la raíz del repositorio:

| Comando | Qué corre | Qué necesita |
| :-- | :-- | :-- |
| `npm run test:fe` | Unitarias de componentes (Vitest) | Node.js |
| `npm run test:e2e` | End-to-end (Playwright). Levanta `ng serve` si no está corriendo | Node.js y Chromium de Playwright (`npx playwright install chromium`, una sola vez) |
| `npm run test:funciones` | Unitarias y de concordancia del backend | Deno |
| `npm run test:db` | pgTAP de la base | Docker y la pila local (`npx supabase start`) |
| `npm run test:integracion` | Integración del backend | Docker, la pila local (`npx supabase start`) y las funciones servidas (`npx supabase functions serve`) |

Cómo instalar Deno y Docker: [README del proyecto](../../README.md#pruebas).

La e2e no llama al backend: `fe/e2e/api-simulada.ts` responde con datos de prueba que siguen los modelos del frontend y corta cualquier petición que salga de la máquina.

La prueba de integración **solo corre contra la pila local**: toma la URL y las claves de `npx supabase status` (las guarda en `supabase/.env.integracion`, que no se versiona) y se niega a arrancar si la URL no es `127.0.0.1` o `localhost`. Crea sus propias cuentas y su categoría, y las borra al terminar aunque falle algún paso.

Para apagar la pila local: `npx supabase stop`.
