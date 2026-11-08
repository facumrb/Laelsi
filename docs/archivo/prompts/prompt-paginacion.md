# Instrucciones de Implementación: Paginación Global

## Objetivo Principal
Agregar soporte de paginación integral a lo largo del sistema para todas las entidades que lo requieran (visuales de listas de datos), considerando su integración con los sistemas de filtrado de datos existentes de manera segura y escalable.

> **Regla Base:** La cantidad de ítems a visualizar por página debe ser de **16 elementos**, siguiendo el estándar de e-commerce.

---

## 🛠️ Tareas del Backend (Capa Express + MikroORM)

1. **Creación de Interfaz / Estructura Base:**
   - Define una estructura genérica para la respuesta paginada dentro de `be/src/shared/utils` (ej: `pagination.interface.ts`):
     ```typescript
     export interface PaginatedResult<T> {
       data: T[];
       total: number;
       page: number;
       limit: number;
       totalPages: number;
     }
     ```
   - Define un config en `be/src/shared/config/pagination.ts` con `DEFAULT_PAGE_SIZE = 16` y **crucialmente** un límite máximo defensivo `MAX_PAGE_SIZE = 100` para evitar ataques DDoS accidentales o provocados pidiendo millones de registros.

2. **Refactorización de Servicios de Entidades:**
   - Para las entidades correspondientes (Admin, Clientes, Categorías, Productos, Pedidos), actualiza los métodos para que acepten `page` y `limit`.
   - Utiliza `findAndCount()` de MikroORM nativamente.
   - 🚨 **Regla de ORO (Fuga de Datos):** Cuidado extremo con los métodos que alimentan el e-commerce público. Debe existir un método que filtre estrictamente `estado = Activo` y `categoría.estado = Activo`. Los métodos `findAll()` sin filtros deben quedar **restringidos única y exclusivamente al Admin Panel**.

3. **Refactorización de Controladores:**
   - Extrae de `req.query` los valores `page` y `limit`.
   - Asegura la aplicación del tope máximo (`limit = Math.min(Number(req.query.limit) || 16, MAX_PAGE_SIZE)`).
   - Envía el `PaginatedResult<T>` usando la clase utilitaria `ApiResponse` (`be/src/shared/utils/apiResponse.ts`).

---

## 🎨 Tareas del Frontend (Capa Angular 21)

1. **Gestión de Estado y URL (Deep Linking):**
   - El nuevo `PaginationComponent` que crees (usando Signals y estilo `< Anterior 1 2 3 Siguiente >`) **no debe vivir en un estado aislado**. 
   - El número de página actual *debe* reflejarse y leerse desde los `QueryParams` de la URL de Angular (ej: `?page=2`). Esto garantiza que los usuarios puedan compartir links hacia una página específica y la aplicación la retome correctamente.

2. **Manejo de Casos Extremos (Empty States):**
   - Si un usuario ingresa forzosamente un parámetro fuera de rango (ej. `?page=500`) donde no hay elementos, la UI no debe colapsar. Asegurate de implementar un estado de "No hay productos para mostrar en esta página".

3. **Componentes y Grillas (Products Cards):**
   - Actualizar las grillas de visualización en pantallas principales utilizando Tailwind 4. Las configuraciones exigidas son:
     - `sm:` -> `grid-cols-2` (2 tarjetas por fila).
     - `md:` -> `grid-cols-3` (3 tarjetas por fila).
     - `lg:` -> `grid-cols-4` (4 tarjetas por fila).

4. **Refactorización de Servicios API:**
   - Los métodos `HttpClient` que piden listas deben añadir vía `HttpParams` los valores `page` y `limit`.
   - Modifica las interfaces (`@models`) para que la aplicación consuma la nueva interfaz homóloga `IPaginatedResult<T>`. 

5. **Secciones a Migrar Obligatoriamente:**
   - **E-Commerce:** Vistas principales, por Categoría, y Perfil del cliente ("Mis Pedidos").
   - **Admin Panel (Todas las tablas):** Administradores, Clientes, Categorías, Productos, y Pedidos.

---

## 📌 Pasos Sugeridos para Ejecución (Protocolo SDD)

1. Ejecutá `/sdd-explore paginacion` analizando un vertical completo (Back y Front) de una entidad, preferentemente `Productos`.
2. Actualizá el Backend para dicha entidad garantizando tu separación de métodos Privados vs Públicos.
3. Actualizá el Frontend de la misma entidad (Service, State The Sync URL y Grilla) para evitar un *Breaking Change*.
4. Repetir la secuencia (vertical por entidades) en el Admin-Panel para el resto del sistema.
