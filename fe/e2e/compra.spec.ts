import { expect, test } from '@playwright/test';
import { CATEGORIA, PRODUCTOS, simularApi } from './api-simulada';

// Recorrido de compra de un cliente: portada → categoría → filtro por marca → detalle → carrito
test.describe('Recorrido de compra en la tienda', () => {
  let noSimuladas: string[];

  test.beforeEach(async ({ page }) => {
    noSimuladas = await simularApi(page);
  });

  test.afterEach(() => {
    expect(noSimuladas, 'La app pidió rutas de la API que la prueba no simula').toEqual([]);
  });

  test('el cliente filtra por marca, abre un producto y lo suma al carrito', async ({ page }) => {
    // 1. Portada: muestra los más vendidos que devolvió la API
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Más vendidos' })).toBeVisible();
    await expect(page.getByRole('heading', { name: PRODUCTOS[0].name }).first()).toBeVisible();

    // 2. Listado de la categoría con todos sus productos
    await page.goto(`/category/${CATEGORIA.id}`);
    await expect(page.getByRole('heading', { level: 1, name: CATEGORIA.name })).toBeVisible();
    const tarjetas = page.locator('app-product-card');
    await expect(tarjetas).toHaveCount(PRODUCTOS.length);

    // 3. Filtro por marca: quedan solo los productos de Bic
    // El botón "Filtros" abre y cierra el menú (su nombre cambia a "Filtros (Filtros activos)" al filtrar)
    const botonFiltros = page.getByRole('button', { name: /^Filtros/ });
    await botonFiltros.click();
    await page.getByRole('button', { name: /Filtrar por Marca/ }).click();
    await page.getByRole('option', { name: 'Bic' }).click();
    await expect(tarjetas).toHaveCount(2);
    await expect(page.getByRole('heading', { name: 'Cuaderno Rivadavia A4' })).toHaveCount(0);
    await botonFiltros.click();
    await expect(page.getByRole('region', { name: 'Opciones de filtro' })).toHaveCount(0);

    // 4. Detalle del producto (la tarjeta lleva a /product/:id)
    await page.getByRole('heading', { name: 'Lapicera Bic Azul' }).click();
    await expect(page).toHaveURL(/\/product\/2$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Lapicera Bic Azul' })).toBeVisible();

    // 5. Sumar al carrito: el contador del carrito pasa a 1
    const carrito = page.locator('a[href="/cart"]').first();
    await page.getByRole('button', { name: 'Sumar al carrito' }).first().click();
    await expect(carrito).toContainText('1');

    // 6. El carrito muestra el producto elegido
    await page.goto('/cart');
    await expect(page.getByText('Lapicera Bic Azul').first()).toBeVisible();
  });

  test('sin sesión, el perfil del cliente redirige al login (ruta protegida)', async ({ page }) => {
    await page.goto('/profile');
    await expect(page).toHaveURL(/\/auth\/login\?returnUrl=%2Fprofile/);
  });
});
