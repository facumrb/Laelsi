# Programación Lineal aplicada a LaElsi

Para el dominio de **LaElsi**, la Programación Lineal (PL) es una herramienta matemática excelente para tomar decisiones basadas en datos. Se puede integrar como un módulo especial en el backend (`be/src/optimization/`) utilizando bibliotecas de Node.js (`highs-js`).

A continuación se detallan tres propuestas que aportan valor directo al negocio, con sus respectivas variables, restricciones y objetivos de optimización.

---

## 1. Planificación de Compras e Inventario de Insumos (Librería e Imprenta)
**Valor para el negocio:** Comprar de manera inteligente. Ayuda a decidir a qué proveedores comprarle cada insumo (resmas, cartuchos, tóners, útiles de alta rotación) para gastar lo menos posible, considerando los costos de envío y límites de presupuesto.

*   **Variables de Decisión:** 
    $X_{ij}$ = cantidad de unidades del insumo $i$ a comprar al proveedor $j$ en el mes.
*   **Objetivo de Optimización:** **Minimizar** los costos totales de adquisición (Costo del insumo + Costo de logística/envío).
*   **Restricciones Preliminares:**
    *   **Demanda a satisfacer:** Cantidad mínima mensual que el local necesita de cada insumo para no quebrar stock.
    *   **Capacidad máxima:** Espacio volumétrico máximo disponible en el depósito o local para guardar mercadería.
    *   **Recurso limitante (Financiero):** Presupuesto máximo disponible para compras en el mes.
    *   **Condiciones del proveedor:** Cantidad mínima de compra que exige el proveedor $j$ para hacer un envío.

---

## 2. Asignación y Enrutamiento de Trabajos de Impresión
**Valor para el negocio:** Si LaElsi cuenta con múltiples equipos de impresión o fotocopiado (ej. una impresora láser rápida B/N, una multifunción color, y un plotter o equipo menor), elegir qué máquina procesa qué pedido reduce el desgaste y ahorra dinero.

*   **Variables de Decisión:** 
    $X_{ij}$ = cantidad de páginas (o trabajos) del tipo $i$ asignadas a la impresora $j$ por día.
*   **Objetivo de Optimización:** **Minimizar** el costo operativo total (tinta + papel + desgaste) O **Minimizar** el tiempo total para entregar los trabajos a los clientes.
*   **Restricciones Preliminares:**
    *   **Demanda a satisfacer:** Todas las páginas de los trabajos solicitados por los clientes deben ser procesadas.
    *   **Capacidad máxima:** Velocidad máxima de la impresora $j$ multiplicada por las horas operativas de la librería.
    *   **Compatibilidad:** Ciertos trabajos solo pueden ir a ciertas máquinas (ej. si el trabajo es color, $X_{\text{color}, \text{impresora\_bn}} = 0$).

---

## 3. Optimización del Espacio de Exhibición (Rentabilidad por estante)
**Valor para el negocio:** El espacio físico de la librería es oro. La PL te dice cuántos estantes o metros cuadrados dedicarle a cada rubro basándose en qué vende más y deja más margen.

*   **Variables de Decisión:** 
    $X_i$ = Cantidad de metros lineales (o número de estantes) asignados a la categoría $i$ (con $i$ = útiles, artística, regalería, insumos de PC).
*   **Objetivo de Optimización:** **Maximizar** la rentabilidad mensual esperada por metro exhibido.
*   **Restricciones Preliminares:**
    *   **Capacidad máxima:** La suma de todos los estantes asignados no puede superar la superficie total comercial de LaElsi.
    *   **Restricción de marketing:** Espacio mínimo requerido por categoría (para asegurar que la librería se vea surtida y ofrezca variedad).
    *   **Capacidad del inventario:** No se le puede asignar más estantes a un rubro que el stock físico existente para llenarlos (evitar góndolas vacías).

---

## Integración a Nivel Software

La integración de la Programación Lineal en el ecosistema de LaElsi, considerando la arquitectura actual (Angular 21 + Express + MikroORM), se plantearía de la siguiente manera:

### 1. Backend (Express + Node.js)
Se crearía un módulo de optimización enfocado en resolver estos modelos matemáticos:
*   **Estructura de Carpetas:** Siguiendo la arquitectura basada en features, se incluiría en `be/src/optimization/`.
*   **Controladores y Servicios:** Los controladores (gestionados con `asyncHandler`) expondrían endpoints específicos (ej: `POST /api/optimization/inventory` o `POST /api/optimization/shelf-space`). Estos delegarían el procesamiento matemático a las clases de servicio.
*   **Librerías de Resolución (Solvers):** En la capa de servicio se utilizaría un solver compatible con Node.js, como `javascript-lp-solver` o `glpk.js`. El servicio recolecta los datos necesarios desde MikroORM (inventario actual, precios, demanda estimada), formatea la matriz del modelo (variables, función objetivo y restricciones), y solicita la resolución matemática.
*   **Respuesta Estandarizada:** El resultado optimizado se devuelve al cliente envuelto en la utilidad `ApiResponse`.

### 2. Frontend (Angular 21)
La interfaz se encargaría de brindar a los administradores una herramienta visual y reactiva para interactuar con los modelos sin conocer su complejidad matemática:
*   **Componentes Standalone:** Se crearían páginas o componentes modulares, por ejemplo en `fe/src/app/pages/admin/optimization/`.
*   **Estado con Signals:** Se utilizarían `signals` y `computed` para gestionar los parámetros de entrada que el administrador pueda querer ajustar en tiempo real (ej. aumentar el presupuesto hipotético, o cambiar la estimación de demanda).
*   **Servicios API:** Un `OptimizationApiService` consumirá el backend y utilizará RxJS (`map(res => res.data)`) para inyectar los resultados en el flujo de datos.
*   **Presentación de Resultados (UI):** Los resultados matemáticos se transformarían en instrucciones de negocio claras mediante cuadros de mando. Por ejemplo, alertas (usando *SweetAlert2* o un panel de información) indicando: *"Para maximizar la ganancia, destine 3 estantes a regalería y compre 10 resmas a Proveedor X"*.
