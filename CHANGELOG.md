# Changelog

Todos los cambios relevantes de este proyecto se documentan en este archivo.

El formato sigue [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/) y el proyecto adopta [Versionado Semántico](https://semver.org/lang/es/).

## [No publicado]

### Corregido

- **Favicons opacos en resultados de búsqueda.** DuckDuckGo mostraba el logo sin fondo blanco porque los assets raster eran arte lineal negro con transparencia. Se regeneró el conjunto completo desde `public/icon-512.png` sobre un lienzo blanco opaco (`#ffffff`), con la mascota escalada al 85 % y centrada para sobrevivir a las máscaras circulares de los buscadores.
- **Etiqueta duplicada en el cursor del botón de sonido.** En `/sobre-mi`, el botón declaraba `data-cursor-expand="Sonido"` mientras `initSoundToggle` ya gestionaba el cursor con el icono de silencio y la etiqueta `Activar`. Ambos controladores escribían sobre el mismo estado y podían dejar `is-expanded` e `is-muted` activos a la vez, lo que recortaba el texto `SONIDO` dentro de la píldora circular. Se eliminó el binding duplicado para que el toggle de sonido sea el único propietario del estado del cursor, en línea con el comportamiento de la Home y del Detalle de proyecto.
- **Invariante del cursor personalizado.** `setExpanded(true)` ahora limpia `is-muted`, igual que `setMuted(true)` ya colapsaba `is-expanded`. Los estados expandido y silenciado quedan mutuamente excluyentes y no pueden volver a producir una píldora recortada.
- **Hero editorial ilegible al hacer scroll en diseños apilados.** El desenfoque progresivo de la entrada se aplicaba en todos los tamaños, pero en una columna y en landscape los párrafos quedaban por debajo del pliegue y se difuminaban antes de poder leerse. Ahora el efecto solo se activa cuando la rejilla del hero cabe completa en el viewport; si no cabe, el contenido permanece nítido y el estado se recalcula al redimensionar.
- **Tambor de proyectos desbordado en móvil, tablet y landscape.** La composición de escritorio mantenía el canvas a pantalla completa mientras el título, el año, «sobre mí» y el pie competían por el mismo espacio en viewports estrechos; en landscape corto el año llegaba a dibujarse sobre el teléfono del pie. El canvas ahora se limita a la banda libre entre la información del proyecto y la acción, el título y el año comparten una fila, «sobre mí» pasa al extremo inferior derecho y, con altura ≤ 560 px y ancho ≥ 480 px, la escena usa una rejilla de tres columnas con tipos reducidos. El pie conserva los dos contactos en una sola línea desde 320 px.
- **Bordes de vidrio recortados y fondo gris en el tambor.** En escritorio y pantalla completa el canvas terminaba exactamente en los bordes físicos del monitor, por lo que las bandas superior e inferior de refracción y aberración cromática quedaban cortadas. El canvas conserva ahora un margen vertical de 48 px en escritorio; en móvil y landscape mantiene la banda libre entre los controles. Además, la atenuación luminosa del shader se aplica solo al contenido no blanco: las zonas vacías conservan `#ffffff` en lugar de mostrar sombras grises, sin eliminar la distorsión ni la dispersión cromática de las tarjetas.

### Añadido

- `public/favicon-32x32.png` y `public/favicon-48x48.png` como iconos PNG explícitos para navegadores y buscadores.
- Copias versionadas `public/favicon-20261031.*`, `public/apple-touch-icon-20261031.png` y `public/apple-touch-icon-precomposed-20261031.png` para forzar a los rastreadores a solicitar una URL de icono que no esté en caché.
- `CHANGELOG.md` como registro de cambios del proyecto.

### Cambiado

- `public/favicon.ico`: ICO multirresolución (16, 32 y 48 px) generado desde el maestro opaco.
- `public/favicon.svg`: lienzo cuadrado de 678 × 678 con fondo blanco y mascota centrada.
- `public/favicon.png`, `public/icon-192.png`, `public/icon-512.png`, `public/apple-touch-icon.png` y `public/apple-touch-icon-precomposed.png`: fondo blanco opaco; los apple-touch-icon se normalizaron a 180 × 180.
- `src/layouts/BaseLayout.astro`: los `<link rel="icon">` apuntan a las URLs versionadas del 31 de octubre de 2026, priorizan el ICO y los PNG (32, 48, 192 y 512 px) y dejan el SVG al final. Los apple-touch-icon declaran `sizes="180x180"`. Los archivos raíz (`/favicon.ico`, `/favicon.svg`, etc.) se conservan para solicitudes directas y compatibilidad.
- `src/features/about/AboutHeader.astro`: el botón de volver usa el mismo chevron sin asta que el enlace «sobre mí» del tambor de proyectos, reflejado hacia la izquierda.
- `src/features/about/about.css`: la rejilla editorial pasa a 3 columnas por encima de 1120 px, 2 columnas entre 721 y 1120 px (con la mascota centrada arriba) y 1 columna hasta 720 px. Los párrafos se alinean a la izquierda en los diseños apilados y la tipografía conserva un mínimo de 1 rem.
- `src/features/about/about.css`: el botón de volver, el toggle de sonido y, hasta 1120 px, los enlaces del pie garantizan 44 px de alto; el encabezado fijo incorpora un degradado blanco para que el contenido desplazado no choque con sus controles; los enlaces de contacto se apilan hasta 720 px; el banner de partículas reduce su altura hasta 720 px y usa `touch-action: pan-y`; en landscape de hasta 520 px de alto se recorta el padding superior y la mascota.
- `src/features/about/particle-text.ts`: el texto de partículas conserva un 10 % de margen interno en cada eje para no tocar los bordes del canvas.
- `src/features/projects/projects-drum.css`: el layout apilado arranca en 900 px con título y año en línea, acción alineada al borde inferior y pie en rejilla de dos columnas con la paginación centrada arriba. Hasta 360 px se reduce el padding lateral a 16 px y el pie a 0.68 rem para que el teléfono y el correo no se partan. El modo landscape corto, desde 480 px de ancho, usa tres columnas, tipografía de 1.35 a 2.6 rem, un pie de 0.68 a 12 px según el ancho y objetivos táctiles de 44 px en controles y enlaces.
- `src/features/projects/project-drum-controller.ts`: `syncCanvasBand()` mide la banda disponible y fija `top` y `height` del canvas; un `ResizeObserver` sobre etapa, información, acción, pie y canvas vuelve a medir tras los cambios de contenido, y el listener de `resize` cubre los cambios de orientación. Las mediciones se agrupan en un frame para no realimentar al observador. En escritorio el canvas queda centrado con 48 px de margen superior e inferior para que el vidrio no toque los bordes físicos; el primer frame usa ya el tamaño de la banda.
- `src/features/projects/drum-glass-shader.ts`: la atenuación `exp(-dist * 1.5)` se mezcla según una máscara de blanco calculada desde el texel de origen. El fondo vacío permanece blanco puro y el contenido de las tarjetas conserva la atenuación óptica, la refracción y la aberración cromática.

### Notas de despliegue

- El favicon con la letra «A» que Google muestra en los resultados no es el icono actual ni el favicon por defecto de Astro: es el placeholder que se introdujo en `39dcd43` y se mantuvo hasta `22bf859`; `94ae554` restauró la mascota. Google todavía conserva esa copia incrustada como `data:image/png` en su índice. Las URLs versionadas del 31 de octubre buscan forzar una descarga nueva en el próximo rastreo.
- Google no permite invalidar el favicon de sus resultados desde el código. Tras desplegar, hay que solicitar la indexación de `https://www.andreyrondon.dev/` en Google Search Console y esperar a que Google vuelva a rastrear el sitio. Puede tardar días o semanas.
- DuckDuckGo se apoya en el índice de Bing. Para actualizar su caché, solicitar la indexación en Bing Webmaster Tools.
- Los archivos raíz se mantienen, pero los `<link>` apuntan a nombres versionados; puede ser necesaria una recarga forzada para verlos en el navegador.

### Verificación

- `pnpm check`: 0 errores, 0 advertencias, 0 sugerencias.
- `pnpm lint`: Biome sin incidencias.
- `pnpm build`: compilación estática correcta (5 páginas).
- Prueba manual del toggle de sonido en `/`, `/sobre-mi` y `/proyectos/mias-hamburguesas-de-lujo`: el cursor muestra el icono de silencio cuando hay audio y la etiqueta `Activar` cuando está silenciado, sin estados superpuestos.
- Despliegue `0f692cf`: el HTML de producción referencia las URLs versionadas y los ocho assets responden HTTP 200 con hashes SHA-256 idénticos a `public/`.
- El servicio de favicons de Google ya devuelve la mascota al solicitar 256 px para `www.andreyrondon.dev` y `andreyrondon.dev`; las respuestas de 64 px todavía pueden llegar desde la caché perimetral. El icono de 28 × 28 incrustado en el SERP se actualizará cuando Google vuelva a rastrear la página.
- Revisión manual de `/sobre-mi` en anchos de 280, 320, 375, 414, 768, 1024, 1120, 1121, 1280, 1440 y 1920 px, además de landscape 667 × 375 y 844 × 390: sin desbordamiento horizontal, rejilla en 1, 2 o 3 columnas según el breakpoint y párrafos legibles al hacer scroll.
- Objetivos táctiles de 44 px verificados en el botón de volver y el toggle de sonido, y en los enlaces del pie dentro de las vistas estrechas; el degradado del encabezado fijo mantiene legibles los controles sobre el contenido desplazado.
- Despliegue `4379450`: el HTML de producción referencia el CSS y el JS nuevos; ambos assets responden HTTP 200 con SHA-256 idéntico a `dist/`. La prueba en 375 px confirma que el párrafo derecho conserva `opacity: 1` y ningún filtro tras 520 px de scroll.
- Despliegue `61ae388`: producción referencia `index.F4g9PcPq.css` y `ProjectsLensDrum.astro_astro_type_script_index_0_lang.D4spHgpk.js`, ambos con SHA-256 idéntico a `dist/`. La revisión en 320 × 568, 390 × 844, 480 × 320, 568 × 320, 667 × 375, 768 × 1024, 844 × 390 y 1440 × 900 confirma los mismos rectángulos que en local, sin desbordamiento ni errores de consola.
- `pnpm verify`: 0 errores, 0 advertencias, 0 sugerencias; compilación estática de 5 páginas.
- Revisión manual de `/` en 320 × 568, 360 × 640, 390 × 844, 480 × 320, 568 × 320, 667 × 375, 768 × 1024, 844 × 390, 1024 × 768, 1440 × 900 y 1920 × 1080: sin desbordamiento horizontal ni solapes entre título, año, acción y pie; el canvas mide 553 px de alto a 390 × 844, 277 px a 320 × 568, 216 px en landscape de 480/568 px y 271/286 px en landscape de 667/844 px.
- Prueba de rueda, arrastre, flechas, clic en la tarjeta frontal, enlace «sobre mí», toggle de sonido, copia del correo, cambio de orientación y `prefers-reduced-motion`; los enlaces del pie conservan 44 px de alto y el teléfono no se parte a 320 px.
- Revisión óptica de `/` en 390 × 844, 568 × 320, 768 × 1024, 1024 × 768, 1440 × 900 y 1920 × 1080: las bandas de vidrio quedan completas dentro del viewport y los píxeles vacíos muestreados devuelven `255,255,255`, también dentro de las bandas. El canvas de escritorio mide 804 px de alto a 1440 × 900 y 984 px a 1920 × 1080; a DPR 2 el buffer móvil es 780 × 1106. Rueda, arrastre, flechas y clic frontal verificados sin errores de consola.
- Despliegue `a03157d`: producción sirve `ProjectsLensDrum.astro_astro_type_script_index_0_lang.wMJ6RQ17.js` con SHA-256 idéntico a `dist/`. La revisión en 1920 × 1080, 1440 × 900, 768 × 1024, 390 × 844 y 568 × 320 mantiene el canvas con 48 px de margen en escritorio, el fondo blanco puro dentro y fuera de las bandas, y la rueda y el clic frontal funcionando sin errores de consola.
