# Guía de Construcción: Simulación AnyLogic de LaElsi

Este documento define de forma práctica los Casos de Uso (CU), flujos de trabajo y detalles técnicos necesarios para modelar el ecosistema de LaElsi en **AnyLogic PLE**, sin exceder sus limitaciones (max 10 tipos de agentes, 200 bloques, 50k agentes, 7 variables de OptQuest).

---

## CU 1: Flujo y Procesamiento de Pedidos (Discrete Event Simulation - DES)

**Objetivo:** Simular el ciclo de vida de un pedido desde que se abona hasta que se entrega, para medir cuellos de botella operativos y tiempos de espera.

*   **Camino Básico (Ideal):**
    1.  Llega la orden al sistema (Inyectada desde `orders.csv` vía `Source`).
    2.  Ingresa a la **Cola de Pendientes** (`Queue`).
    3.  Un empleado se libera y toma la orden (`Seize` de `ResourcePool`).
    4.  Se realiza la preparación (`Delay` con tiempo triangular estocástico).
    5.  Se descuenta el stock de los productos.
    6.  Se entrega/envía al cliente (`Release` del empleado $\rightarrow$ `Sink`).

*   **Caminos Alternativos:**
    *   **1A - Cancelación por Demora Excesiva (Abandono posterior al pago):** Durante el bloque `Delay` o `Queue`, si el tiempo de espera supera el umbral de tolerancia del cliente, la orden se interrumpe (`Timeout` branch), se contabiliza como reembolso (pérdida económica) y se destruye (`Sink` de cancelados).
    *   **1B - Quiebre de Stock:** Al intentar preparar el pedido, se verifica que no hay inventario suficiente. El pedido queda retenido (Backorder) hasta que ingresa stock, o se cancela directamente.

*   **Implementación en AnyLogic:**
    *   **Agente:** `Order` (con parámetros: `totalAmount`, `categoryAmounts`, `toleranciaDemora`).
    *   **Bloques:** `Source`, `Queue`, `Seize`, `Delay`, `Release`, `Sink`, `SelectOutput` (para decisiones lógicas).

---

## CU 2: Gestión de Inventario Continua (System Dynamics / Java Events)

**Objetivo:** Modelar la política de reposición de mercadería (ej. para rubro1 y rubro2) encontrando el equilibrio entre costo de almacenamiento y ventas perdidas.

*   **Camino Básico (Revisión de Stock):**
    1.  Un `Event` cíclico (diario) recorre el catálogo de productos.
    2.  Verifica si el stock actual $\le s$ (Punto de Reorden).
    3.  Si es cierto, genera una orden de compra al proveedor por cantidad $Q$.
    4.  El proveedor entrega instantáneamente (o con un `Delay` fijo de X días) y el stock sube a $Stock + Q$.

*   **Caminos Alternativos:**
    *   **2A - Sin necesidad de compra:** El stock es suficiente ($> s$). No hace nada y el evento termina hasta el día siguiente.
    *   **2B - Capital Insuficiente:** Si las reglas del negocio indican un límite de capital operativo, la compra al proveedor de cantidad $Q$ no se puede realizar completamente y se compra solo lo que el flujo de caja permite.

*   **Implementación en AnyLogic:**
    *   No usar agentes físicos para productos (ahorra memoria). Usar variables Java en el `Main` (`HashMap<Integer, Integer> productStock`).
    *   Variables a exponer para optimización: `s_rubro1`, `Q_rubro1`, `s_rubro2`, `Q_rubro2`.

---

## CU 3: Comportamiento de Clientes y Recurrencia (Agent-Based Modeling)

**Objetivo:** Simular la fidelización y las compras repetitivas de los clientes usando los datos históricos extraídos (`clients.csv`).

*   **Camino Básico:**
    1.  El agente `Client` inicia en estado *Inactivo*.
    2.  Transcurrido el tiempo (basado en su `frequencyOfPurchase_monthly` del CSV), entra a estado *Comprando*.
    3.  Genera un agente `Order` y lo inyecta en el proceso DES (CU 1).
    4.  Pasa a estado *Esperando Pedido*. Al completarse, vuelve a *Inactivo*.

*   **Caminos Alternativos:**
    *   **3A - Castigo por mala experiencia:** Si el `Order` del cliente sufre la alternativa **1A** (Cancelación por demora), el agente `Client` penaliza su frecuencia de compra. Su próxima visita se retrasa un $50\%$ (ej. pasa de comprar cada 30 días a cada 45 días).

*   **Implementación en AnyLogic:**
    *   **Agente:** `Client` (con `Statechart`).
    *   **Población:** Limitar a un subset poblacional o instanciar dinámicamente (`Source` en Main) para no quebrar la restricción de 50,000 agentes de PLE.

---

## Configuración del Experimento de Optimización (OptQuest)

Dado el límite estricto de 7 variables y 500 iteraciones en la versión PLE, la optimización debe apuntar directamente a la rentabilidad.

*   **Función Objetivo (Maximizar):**
    `Beneficio Neto = (Ingresos Totales) - (Costos de Productos Q) - (Penalidad por Cancelaciones/Demora) - (Costos de Mantenimiento de Stock)`

*   **Variables de Decisión (4 en total, muy por debajo del límite de 7):**
    1.  `s_rubro1`: Punto mínimo de stock para la categoría principal 1.
    2.  `Q_rubro1`: Cantidad a pedir al proveedor.
    3.  `s_rubro2`: Punto mínimo de stock (insumos de rubro2).
    4.  `Q_rubro2`: Cantidad a pedir al proveedor.

*   **Restricción del Modelo:**
    *   `Tasa_Cancelaciones_Por_Demora` $\le 5\%$ (Mantener la calidad del servicio).
    *   Duración de la simulación: 3 meses virtuales (se ejecutará rápido en AnyLogic).