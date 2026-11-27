import { defineConfig, devices } from '@playwright/test';

/*
Pruebas end-to-end (e2e) con Playwright: abren la tienda en Chromium y la recorren como un usuario.
La API está simulada (ver e2e/api-simulada.ts): ninguna prueba llama al backend real.

Se corren con: npm run e2e (levanta "ng serve" si no está corriendo)
Reporte HTML: npx playwright show-report
*/
export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  retries: 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://localhost:4200',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  // Los tres breakpoints que pide la cátedra: SM (celular), MD (tablet) y LG (escritorio)
  projects: [
    { name: 'sm', use: { ...devices['Desktop Chrome'], viewport: { width: 390, height: 844 } } },
    { name: 'md', use: { ...devices['Desktop Chrome'], viewport: { width: 768, height: 1024 } } },
    { name: 'lg', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } } },
  ],
  webServer: {
    command: 'npm start',
    url: 'http://localhost:4200',
    reuseExistingServer: true,
    timeout: 180_000,
  },
});
