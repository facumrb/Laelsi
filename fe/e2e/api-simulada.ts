import type { Page, Route } from '@playwright/test';
import type { IApiCategory } from '../src/app/models/category.model';
import type { IApiProduct, IHome, IPaginatedProducts } from '../src/app/models/product.model';

/*
API simulada para las pruebas e2e. Responde con el mismo sobre que las Edge Functions
({ statusCode, message, data, status }) y con datos que siguen los modelos de src/app/models.
Cualquier otra petición fuera de localhost se corta: las pruebas nunca tocan producción.
*/

const FECHA = '2026-11-01T00:00:00.000Z';

export const CATEGORIA: IApiCategory = {
  id: 1,
  name: 'Librería',
  description: 'Útiles escolares y de oficina',
  order: 0,
  state: 'Activo' as IApiCategory['state'],
  parentId: null,
  parent: null,
  children: [],
  depth: 0,
  createdAt: FECHA,
  updatedAt: FECHA,
};

function producto(id: number, name: string, brand: string, amount: number): IApiProduct {
  return {
    id,
    name,
    description: `Descripción de ${name}`,
    prices: [{ id, amount, currency: 'ARS', validFrom: FECHA, isCurrent: true }],
    brand,
    totalSold: 10 * id,
    state: 'Activo' as IApiProduct['state'],
    stock: 20,
    photos: [],
    category: CATEGORIA,
    createdAt: FECHA,
    updatedAt: FECHA,
  };
}

export const PRODUCTOS: IApiProduct[] = [
  producto(1, 'Cuaderno Rivadavia A4', 'Rivadavia', 4500),
  producto(2, 'Lapicera Bic Azul', 'Bic', 800),
  producto(3, 'Resaltador Bic Amarillo', 'Bic', 1200),
];

const MARCAS = [...new Set(PRODUCTOS.map((p) => p.brand))];

function exito(data: unknown, statusCode = 200) {
  return { statusCode, message: 'OK', data, status: 'success' };
}

function pagina(productos: IApiProduct[]): IPaginatedProducts {
  return { data: productos, total: productos.length, page: 1, limit: 16, totalPages: 1, brands: MARCAS };
}

// Devuelve el cuerpo de la respuesta simulada para una ruta de la API, o null si no está simulada
function responder(metodo: string, ruta: string, query: URLSearchParams): unknown | null {
  if (metodo !== 'GET') return null;

  if (ruta === '/categories/tree' || ruta === '/categories/active') return exito([CATEGORIA]);
  if (ruta === `/categories/${CATEGORIA.id}`) return exito(CATEGORIA);
  if (ruta === `/categories/${CATEGORIA.id}/children`) return exito([]);

  if (ruta === '/products/home') {
    const home: IHome = { bestSellers: PRODUCTOS, categories: [{ category: CATEGORIA, products: PRODUCTOS }] };
    return exito(home);
  }
  if (ruta === `/products/active/category/${CATEGORIA.id}`) {
    const marca = query.get('brand');
    const filtrados = marca && marca !== 'Todas' ? PRODUCTOS.filter((p) => p.brand === marca) : PRODUCTOS;
    return exito(pagina(filtrados));
  }
  if (ruta === '/products/availability') {
    const ids = (query.get('ids') ?? '').split(',').map(Number);
    return exito(PRODUCTOS.filter((p) => ids.includes(p.id)));
  }

  const detalle = ruta.match(/^\/products\/(?:active\/)?(\d+)$/);
  if (detalle) {
    const encontrado = PRODUCTOS.find((p) => p.id === Number(detalle[1]));
    return encontrado ? exito(encontrado) : null;
  }

  return null;
}

/*
Instala la API simulada en la página. Devuelve la lista de peticiones que no estaban simuladas,
para que la prueba falle si la app pide algo inesperado.
*/
export async function simularApi(page: Page): Promise<string[]> {
  const noSimuladas: string[] = [];

  await page.route('**/*', async (route: Route) => {
    const url = new URL(route.request().url());

    if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') return route.continue();

    const indice = url.pathname.indexOf('/functions/v1');
    if (indice >= 0) {
      const ruta = url.pathname.slice(indice + '/functions/v1'.length);
      const cuerpo = responder(route.request().method(), ruta, url.searchParams);
      if (cuerpo) return route.fulfill({ status: 200, json: cuerpo });

      noSimuladas.push(`${route.request().method()} ${ruta}${url.search}`);
      return route.fulfill({ status: 404, json: { status: 'error', message: 'Ruta no simulada' } });
    }

    // Imágenes de R2, fuentes, Turnstile, Supabase Auth, etc.: no salen de la máquina
    return route.abort();
  });

  return noSimuladas;
}
