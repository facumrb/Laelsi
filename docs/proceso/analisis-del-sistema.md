# **INTRODUCCIÓN**

La librería “Laelsi” es un negocio dedicado a la venta de productos de librería, juguetería, computación, imprenta digital y sellos. El sitio web debe contemplar ventas, administración y distribución de pedidos desde cualquier parte de Rosario, con el objetivo de ofrecer y expandir los servicios del negocio a más personas.

# **OBJETIVOS ESPECÍFICOS**

- Permitir que el cliente pueda ver productos y servicios ofrecidos por la librería.
- Brindar la posibilidad de hacer pedidos sin que haya atención presencial de por medio.
- Habilitar gráficos (de uso administrativo) y mejorar la organización del negocio.
- Ofrecer promociones para ciertos artículos o servicios.
- Mostrar en los artículos “disponibilidad” en caso de stock o “no disponible” en caso de no haber stock y habilitar la opción de “Reservar”.
- Llevar control de stock en línea en un panel para administradores.

# **TIPOS DE USUARIOS Y PERMISOS**

- ADMINISTRADOR:
- Ver gráficos/estadística de artículos más comprados (ordenado, ej: por más o menos vendidos).
- Ver listado de stock de los artículos.
- Ver qué artículos no tienen Stock.
- Actualizar stock.
- Agregar artículos a vender.
- Poner precio a los productos y promociones.
- Actualizar horarios de atención del negocio.
- Poner anuncios en caso de un evento especial que modifique la pagina (quiza se sale de la problemática principal \- ver).
- Tiene un apartado extra de “Pedidos” para ver cuáles son los pedidos que faltan por entregar/preparar.
- Asignar/Eliminar promociones en un apartado.

- USUARIO SIN REGISTRO:
  - Visualización de productos y servicios disponibles.
  - Tiene visible un botón de “Registrarse”.
  - Cuando quiere hacer uso del servicio, redirigir al apartado “Registrarse”.

- CLIENTE:
  - Visualización de productos y servicios disponibles.
  - Tiene visible un botón con su nombre que redirige a su perfil.
  - Puede encargar o reservar productos.
  - Puede ver la disponibilidad de los productos (¿imagen y precio? ¿Especificamos todo lo que vé?).
  - Puede editar sus datos o bien eliminar su perfil si quisiera.
  - Debe ver el carrito de compras.

# **CONTENIDOS DEL SITIO**

# **ENCABEZADO \- HEADER**

(VISIBLE EN TODAS LAS SECCIONES)  
Logo, barra de búsqueda, botón con el nombre de usuario o “Iniciar Sesión” ¿Para registrarse?.  
En caso de estar logueado, agregar carrito de compras con un número que marque precio o cantidad de productos en total. ← ???

# **BARRA DE SECCIONES**

(DEBAJO DEL HEADER, VISIBLE EN TODAS LAS SECCIONES)  
“Juguetería”, “Computación”, “Impresiones”, “Diseño Gráfico”, “Sellos” y “Librería” (Luego, en relevamiento, ver qué orden es conveniente).  
 Cada sección debería tener un efecto hover (cambia el botón al pasar el mouse por encima)

# **PIE DE PÁGINA \- FOOTER**

(VISIBLE EN TODAS LAS SECCIONES)  
![image1](img/analisis-image1.png)  
Datos de contacto: lugar, mail, número de teléfono y horario de atención.  
Se pueden agregar “Enlaces de interés”: información del negocio (historia o datos de los empleados), preguntas frecuentes (el tema de las impresiones o de reservar un artículo).  
Agregar medios de comunicación con ícono, EJ: Instagram, Whatsapp, etc.  
Horario de atención: Lunes a Viernes 8 a 17hs \- Sábados 9 a 13hs (puede cambiar, no es fijo).

# **INICIO \- MAIN**

(ACCEDE DESDE EL LOGO)  
Artículos más vendidos, promociones, anuncios/noticias.  
Productos más destacados de cada sección en forma de carrusel.

# **LIBRERÍA**

Se listan los artículos de la tabla libreria por mayor popularidad.  
Permitiendo al usuario filtrar/ordenar por precio (bajo a alto) (alto a bajo), mayor popularidad y disponibilidad en stock (pone arriba de todo los artículos que tengan stock y por último los que no tienen).  
Mediante una query deberían listarse 16 productos y si en la tabla existen más de 16 productos habilitar más páginas para cargar los próximos 16 productos.  
Se debería habilitar un espacio a la izquierda que permita al cliente seleccionar el tipo de artículo de librería que está buscando.

# **JUGUETERÍA**

Se listan los artículos de la tabla juguetes por mayor popularidad.  
Permitiendo al usuario filtrar/ordenar por precio (bajo a alto) (alto a bajo), mayor popularidad y disponibilidad en stock (pone arriba de todo los artículos que tengan stock y por último los que no tienen).  
Mediante una query deberían listarse 16 productos y si en la tabla existen más de 16 productos habilitar más páginas para cargar los próximos 16 productos.  
Se debería habilitar un espacio a la izquierda que permita al cliente seleccionar el tipo de artículo de juguetería que está buscando. \[Update by valen: no creo\]

# **COMPUTACIÓN**

Se listan los artículos de la tabla computación por mayor popularidad.  
Permitiendo al usuario filtrar/ordenar por precio (bajo a alto) (alto a bajo), mayor popularidad y disponibilidad en stock (pone arriba de todo los artículos que tengan stock y por último los que no tienen).  
Mediante una query deberían listarse 16 productos y si en la tabla existen más de 16 productos habilitar más páginas para cargar los próximos 16 productos.  
Se debería habilitar un espacio a la izquierda que permita al cliente seleccionar el tipo de artículo de computación que está buscando.

# **IMPRESIONES**

El usuario debería ver un mensaje que diga “consultar precios actuales de los servicios por wsp”. Se intuye que en la web se puede actualizar el precio de la hoja.  
\[Ver compatibilidad con la minuta\]  
Debe haber un botón para subir archivos.  
Debe haber una caja de comentarios utilizada para explicitar el tipo de servicio que se requiera.  
Sería útil que hubiera una sección que explicite los tipos de servicios que se pueden solicitar para las impresiones y un costo aproximado del servicio.

# **DISEÑO GRÁFICO**

Debe haber una caja de comentario para que el usuario explicite el tipo de servicio de diseño.  
El administrador debe dar ejemplos de cosas que el negocio puede realizar (logos, folletos, cartas, etc).  
Quizás debería permitirse subir archivos a la web por parte del cliente por si quiere un modelo similar a lo que él nos muestra.  
Quizás el administrador debería dejar preguntas frecuentes que pueden facilitar y agilizar el trabajo del cliente.  
El administrador se contacta con el cliente para establecer un precio por el servicio del diseño gráfico y preguntarle si quiere o no una impresión de ese diseño.

# **SELLOS**

(Importante. Rellenar)

Creación de usuario

---

# **CUESTIONES A TENER EN CUENTA**

**CÓMO FUNCIONA EL STOCK**  
Listado con búsqueda de productos que aparecen divididos por las secciones y subsecciones de artículos y luego por cantidad. Fuera de lo que es Stock, existe un apartado para artículos que están reservados o son faltantes.

# **IMPLEMENTACIONES FUTURAS**

Agregar envíos y ver el tema de tercerizados.  
Agregar un rol de empleado, para que administrador por ejemplo le pueda asignar tareas, como en un sistema de tickets.  
Ver un listado de clientes más frecuentes.  
Al momento en el que el administrador quiera ver el stock de los productos, que pueda filtrar por ejemplo “Mayor a 500 unidades en stock”.  
Que el administrador pueda establecer anuncios en el main.  
Construir un sistema multi-proveedor web para mejorar la experiencia de compra a proveedores, comparar precios, etc.  
Clase Articulo relacionada con clase Promoción.  
CRUDs para futura implementación, ordenado por prioridad:

1. Sello
2. Empleado, Administrador
3. Promoción
4. DiseñoGráfico, Impresión, (Resma u Hoja)
