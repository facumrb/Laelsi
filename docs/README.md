# Documentación de LAELSI

[Volver al README del proyecto](../README.md)

## Por dónde empezar

1. [Propuesta](catedra/proposal.md): qué es el sistema, el modelo y el alcance.
2. [Cómo se armó el proyecto](proceso/historia.md): del análisis inicial al sistema publicado, y cómo se trabajó en equipo.
3. [Puesta en marcha de la infraestructura](guias/infraestructura.md): cómo crear un entorno nuevo.

## Entregables de la cátedra

Según [docs.md de la cátedra](catedra/docs.md).

| Contenido | Dónde está | Estado |
| :-- | :-- | :-- |
| Propuesta | [catedra/proposal.md](catedra/proposal.md) | Actualizada |
| Enlaces a los PR | [Propuesta → Pull requests](catedra/proposal.md#pull-requests) | Pendiente |
| Instrucciones de instalación y ejecución | [README del proyecto](../README.md#cómo-ejecutarlo) | Hecho |
| Análisis del sistema | [Google Docs](https://docs.google.com/document/d/1HJCefDRzAz0mr4CpLiGTYG3TdgRNXVhfDio3AsXsBkw/edit?usp=sharing) | Hecho |
| Minutas de reuniones y avances | [Forma de trabajo](proceso/historia.md#2-forma-de-trabajo-y-seguimiento-de-tareas) y [seguimiento de tareas (Google Docs)](https://docs.google.com/document/d/1jEKCvSY9ZdxJsL7xmmaUbu1CgqGjxH3w9dCpH4vFtaM/edit?usp=sharing) | Hecho |
| Seguimiento de features, bugs e issues | [Seguimiento de tareas (Google Docs)](https://docs.google.com/document/d/1jEKCvSY9ZdxJsL7xmmaUbu1CgqGjxH3w9dCpH4vFtaM/edit?usp=sharing), [requerimientos/discusiones.md](requerimientos/discusiones.md) y [deuda-tecnica/](deuda-tecnica/) | En curso |
| Documentación de la API | — | Pendiente |
| Evidencia de la ejecución de las pruebas automáticas | — | Pendiente |
| Video demostración | [Google Drive](https://drive.google.com/file/d/1qXaOcWWohlrfDlq3GMMrZ0Pog4uzKca6/view?usp=drive_link) | Hecho |
| Deploy | [laelsi.com.ar](https://laelsi.com.ar) | Hecho |

## Carpetas

| Carpeta | Qué tiene |
| :-- | :-- |
| [catedra/](catedra/) | Consignas de la cátedra ([TP-Requisitos.md](catedra/TP-Requisitos.md), [docs.md](catedra/docs.md), [FAQ.md](catedra/FAQ.md)) y la propuesta |
| [proceso/](proceso/) | Historia del proyecto y forma de trabajo |
| [guias/](guias/) | [Infraestructura](guias/infraestructura.md), [seguridad](guias/seguridad.md) y [textos legales y verificación de Google](guias/textos-legales-y-google.md) |
| [despliegue/](despliegue/) | Configuración aplicada en Supabase, R2 y Turnstile, y despliegues a producción |
| [seguridad/](seguridad/) | Revisiones de seguridad y datos, páginas legales y botón de arrepentimiento |
| [requerimientos/](requerimientos/) | Pedidos ([discusiones.md](requerimientos/discusiones.md)) e investigaciones previas: accesibilidad, diseño adaptable, rendimiento y campos de clientes |
| [cambios/](cambios/) | Planes y registros de los cambios hechos: rendimiento, CSS, modales y revisión de servicios y formularios |
| [deuda-tecnica/](deuda-tecnica/) | Trabajo postergado, con un documento por tema |
| [archivo/](archivo/) | Documentos históricos: plan maestro de la migración ([Tareas.md](archivo/Tareas.md)), prompts y material de otras materias (`futuresystems/`) |
