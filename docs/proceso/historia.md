# Cómo se armó el proyecto

[Volver al índice de la documentación](../README.md)

Recorrido del proyecto desde el análisis inicial hasta el sistema publicado.

## 1. Análisis del sistema (abril de 2024)

Antes de escribir código se hizo un análisis del negocio y del sitio que se quería construir:

- **[Minuta de relevamiento del sitio web (02/04/2024)](minutas/2024-04-02-minuta-sitio-web.md)**: reunión con el dueño y la empleada sobre cómo funciona el negocio, sus procesos de venta y lo que se pide del sitio y de los paneles.
- **[Análisis del sistema](analisis-del-sistema.md)** ([original en Google Docs](https://docs.google.com/document/d/1HJCefDRzAz0mr4CpLiGTYG3TdgRNXVhfDio3AsXsBkw)): introducción al negocio, objetivos (ver productos, pedir sin ir al local, estadísticas para la administración, promociones, disponibilidad y control de stock), tipos de usuario y sus permisos (administrador, cliente y visitante sin registro), contenido de cada página del sitio (inicio, Librería, Juguetería, Computación, Impresiones, Diseño Gráfico, Sellos) y orden de prioridad de los CRUD.

De ese análisis salió la [propuesta](../catedra/proposal.md) presentada a la cátedra.

## 2. Forma de trabajo y seguimiento de tareas

Cada tarea e implementación se registró en un documento compartido:

- **[Seguimiento de tareas e implementaciones](seguimiento-de-tareas.md)** ([original en Google Docs](https://docs.google.com/document/d/1jEKCvSY9ZdxJsL7xmmaUbu1CgqGjxH3w9dCpH4vFtaM)): tareas identificadas por número, separadas en pendientes, urgentes, realizadas e implementaciones de mejora, con la especificación de cada una y su responsable.

La metodología de trabajo, descrita en ese documento:

- **Reuniones por Discord** para los temas de implementación que había que decidir entre los dos (paginación, páginas de sellos, impresiones y diseño, hosting).
- **Aviso por WhatsApp de cada cambio subido**, con el detalle de qué se hizo, para saber qué tareas quedaban completas.
- **Revisión del otro integrante** antes de aceptar y subir los cambios.
- **Tareas asignadas por persona**, con una lista de pendientes y de realizadas para cada integrante.

Los pedidos más recientes se siguen en [requerimientos/discusiones.md](../requerimientos/discusiones.md), y el trabajo que quedó postergado, en [deuda-tecnica/](../deuda-tecnica/).

## 3. Regularidad: Angular + Express + MikroORM + MySQL (desde diciembre de 2024)

El sistema de la regularidad cumplía los requisitos técnicos de la cátedra:

- **Frontend** en Angular (`fe/`).
- **Backend** en TypeScript con Express (`be/`): API REST organizada por recurso (categorías, productos, precios, fotos, clientes, administradores y órdenes), con capas de rutas, controladores, servicios y entidades.
- **Persistencia con un ORM**: MikroORM sobre MySQL.
- **Seguridad**: login con JWT, roles Admin y Client que protegen las rutas, contraseñas con bcrypt y límite de intentos.
- **Imágenes**: subida con multer y conversión a WebP con sharp, guardadas en `be/uploads/`.

## 4. Migración a Supabase para publicar el sistema (octubre de 2026)

Para poner el sistema en internet sin mantener un servidor propio ni una base MySQL, el backend se migró a una arquitectura sin servidor:

- **Supabase**: PostgreSQL con RLS, Supabase Auth (incluye Google) y Edge Functions con la lógica de negocio.
- **Cloudflare R2** para las imágenes y **Turnstile** contra bots.
- **Resend** para los correos.
- **Vercel** para el frontend.

El plan de la migración está en [archivo/Tareas.md](../archivo/Tareas.md), y la configuración aplicada, en [despliegue/](../despliegue/). La primera migración de la base es del 12 de octubre de 2026.

La carpeta `be/` conserva el backend anterior. Ya no forma parte de la aplicación, pero se mantiene porque:

- `be/uploads/` es el origen de las imágenes que sube `npm run r2:subir-imagenes`.
- `be/src/` sirve de referencia: cada Edge Function indica en su encabezado a qué archivos reemplaza.
