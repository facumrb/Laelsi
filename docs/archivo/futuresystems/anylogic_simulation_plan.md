# Plan de Simulación AnyLogic (PLE) para LaElsi

Este documento describe cómo utilizar los datos del repositorio LaElsi para crear una simulación de negocio útil en **AnyLogic Personal Learning Edition (PLE)**, respetando sus restricciones técnicas (1 hora de ejecución, max 10 tipos de agentes, 50k agentes totales, optimización limitada).

---

## 1. Integración de Datos (LaElsi -> AnyLogic)
Debido a que AnyLogic PLE no soporta conectores de bases de datos profesionales, la mejor estrategia es exportar los datos desde MySQL (MikroORM) a archivos **CSV/Excel** y cargarlos al inicializar el modelo.

**Datasets a exportar:**
1. `products.csv`: ID, Categoría, Precio, Stock Inicial. *(Limitado al top 100 productos más vendidos para no saturar la memoria y simplificar la lógica)*.
2. `clients.csv`: ID, Frecuencia de compra histórica.
3. `orders.csv`: Timestamp de llegada (`dateTime`), `deliveryMethod`, `paymentMethod`, `totalAmount` por cada tipo de producto en el pedido. *(Se usarán para calcular las tasas de llegada reales - distribuciones de Poisson/Exponencial)*.

> [!TIP]
> **Datos Sintéticos:** Dado que faltan los tiempos exactos de *preparación*, se generarán desde AnyLogic usando código Java puro (ej. `triangular(5, 10, 15)` minutos) para simular el trabajo interno.

---

## 2. Paradigmas de Simulación Aplicados a LaElsi

### A. Eventos Discretos (DES) y Teoría de Colas
**Objetivo:** Modelar el embudo de preparación de pedidos (`Order`).
- **Flujo:** Llega un pedido $\rightarrow$ Cola de Pendientes $\rightarrow$ Asignación de Empleado (Recurso) $\rightarrow$ Preparación $\rightarrow$ Cola de Retiro/Envío.
- **Implementación (Process Modeling Library):** 
  - `Source` (lee `orders.csv` para generar llegadas).
  - `Queue` (pedidos en estado `Pending`).
  - `Seize` / `Release` (captura al empleado que atiende).
  - `Delay` (tiempo de procesamiento, diferenciando si es *RetiroSucursal* o *Envío*).
  - `Sink` (pedido completado).
- **Aporte al Negocio:** Determinar el **cuello de botella**. ¿Se necesitan más empleados en horas pico? ¿Cuánto es el tiempo de espera promedio de un cliente?

### B. Sistemas de Inventario
**Objetivo:** Evitar quiebres de stock en los productos del negocio.
- **Flujo:** Cada vez que un `Order` es procesado, se descuenta el `stock` del `Product`. Cuando el stock llega a un punto de reorden ($s$), se lanza un pedido al proveedor por una cantidad ($Q$).
- **Implementación (Dinámica de Sistemas / Eventos):**
  - Un evento cíclico en Java revisa diariamente el inventario.
  - Variables de estado para los costos: `Costo de Almacenamiento` y `Costo de Quiebre de Stock` (ventas perdidas).
- **Aporte al Negocio:** Descubrir la política óptima de inventario ($s, Q$) para maximizar ganancias sin inmovilizar capital.

### C. Modelo Basado en Agentes (ABM)
**Objetivo:** Simular el comportamiento de compra.
- **Agentes (Máximo 10 tipos en PLE):**
  1. `Main`: El entorno y el negocio.
  2. `Client`: Máquina de estados: *Inactivo* $\rightarrow$ *Navegando Tienda* $\rightarrow$ *Comprando* (genera Order) $\rightarrow$ *Esperando Pedido*.
  3. `OrderAgent`: Entidad que fluye por el proceso DES.
- **Restricción 50,000 agentes:** Se simulará una muestra representativa (ej. 1,000 clientes concurrentes en 1 mes virtual, ejecutado en < 1 hr de tiempo real).

### D. Programación Lineal y Optimización
**Objetivo:** Maximizar el margen de ganancia equilibrando precios y stock.
- **Implementación (OptQuest):** AnyLogic PLE permite 7 variables y 500 iteraciones.
  - **Variables de decisión:** Nivel de reorden ($s$) para 2 categorías principales (ej. Librería, Juguetería, Electrónica), y Cantidad a pedir ($Q$). (Total: 5 variables).
  - **Función Objetivo:** Maximizar `Beneficio = Ventas - Costos de Stock - Costos Operativos`.
  - **Restricciones:** Nivel de servicio $\ge 95\%$ (clientes que reciben su pedido a tiempo).

---

## 3. Plan de Arquitectura en AnyLogic (PLE)

1. **Setup de Java Local:**
   Se creará una clase Java nativa dentro de AnyLogic para hacer la reducción en memoria y evitar el uso de librerías de BBDD complejas. Las colecciones de Java (`HashMap`) almacenarán el catálogo de `Product` y actualizarán su `stock` en O(1).
2. **UI de Simulación (Dashboard):**
   - Gráficos de barra: Cantidad de pedidos `Pending` vs `Completed`.
   - Gráfico de tiempo (Time plot): Fluctuación del stock del producto estrella.
   - Textos dinámicos (KPIs): Ingresos totales, Tasa de abandono por demora.
3. **Ajuste de Experimentos:**
   - **Simulation Experiment:** Para ver la animación en vivo del flujo de pedidos.
   - **Optimization Experiment:** 500 iteraciones automáticas para encontrar el punto de reorden ideal de los productos más costosos.

---

## 4. Próximos Pasos para Desarrollo
1. Crear un script en Express (`be/src/shared/utils/exportCsv.ts`) que vuelque `Order`, `Product` y `Client` en 3 archivos `.csv`.
2. Crear un nuevo proyecto en AnyLogic, arrastrar el objeto `Excel File` e inicializar las colecciones en la acción `On Startup` de `Main`.
3. Construir el diagrama de bloques DES (Process Modeling) para el ciclo de vida del `Order`.
