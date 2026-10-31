# Changelog

Todos los cambios relevantes de este proyecto se documentan en este archivo.

El formato sigue [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/) y el proyecto adopta [Versionado Semántico](https://semver.org/lang/es/).

## [No publicado]

### Corregido

- **Favicons opacos en resultados de búsqueda.** DuckDuckGo mostraba el logo sin fondo blanco porque los assets raster eran arte lineal negro con transparencia. Se regeneró el conjunto completo desde `public/icon-512.png` sobre un lienzo blanco opaco (`#ffffff`), con la mascota escalada al 85 % y centrada para sobrevivir a las máscaras circulares de los buscadores.
- **Etiqueta duplicada en el cursor del botón de sonido.** En `/sobre-mi`, el botón declaraba `data-cursor-expand="Sonido"` mientras `initSoundToggle` ya gestionaba el cursor con el icono de silencio y la etiqueta `Activar`. Ambos controladores escribían sobre el mismo estado y podían dejar `is-expanded` e `is-muted` activos a la vez, lo que recortaba el texto `SONIDO` dentro de la píldora circular. Se eliminó el binding duplicado para que el toggle de sonido sea el único propietario del estado del cursor, en línea con el comportamiento de la Home y del Detalle de proyecto.
- **Invariante del cursor personalizado.** `setExpanded(true)` ahora limpia `is-muted`, igual que `setMuted(true)` ya colapsaba `is-expanded`. Los estados expandido y silenciado quedan mutuamente excluyentes y no pueden volver a producir una píldora recortada.

### Añadido

- `public/favicon-32x32.png` y `public/favicon-48x48.png` como iconos PNG explícitos para navegadores y buscadores.
- `CHANGELOG.md` como registro de cambios del proyecto.

### Cambiado

- `public/favicon.ico`: ICO multirresolución (16, 32 y 48 px) generado desde el maestro opaco.
- `public/favicon.svg`: lienzo cuadrado de 678 × 678 con fondo blanco y mascota centrada.
- `public/favicon.png`, `public/icon-192.png`, `public/icon-512.png`, `public/apple-touch-icon.png` y `public/apple-touch-icon-precomposed.png`: fondo blanco opaco; los apple-touch-icon se normalizaron a 180 × 180.
- `src/layouts/BaseLayout.astro`: los `<link rel="icon">` priorizan `favicon.ico` y los PNG (32, 48, 192 y 512 px); el SVG queda al final. Los apple-touch-icon declaran `sizes="180x180"`.

### Notas de despliegue

- El favicon con la letra «A» que Google muestra en los resultados es el favicon por defecto de Astro que Google conserva en caché; no es el icono que sirve producción. Tras desplegar, hay que solicitar la indexación de `https://www.andreyrondon.dev/` en Google Search Console y esperar a que Google vuelva a rastrear el sitio.
- DuckDuckGo se apoya en el índice de Bing. Para actualizar su caché, solicitar la indexación en Bing Webmaster Tools.
- Los assets conservan sus URLs, por lo que puede ser necesaria una recarga forzada para verlos en el navegador.

### Verificación

- `pnpm check`: 0 errores, 0 advertencias, 0 sugerencias.
- `pnpm lint`: Biome sin incidencias.
- `pnpm build`: compilación estática correcta (5 páginas).
- Prueba manual del toggle de sonido en `/`, `/sobre-mi` y `/proyectos/mias-hamburguesas-de-lujo`: el cursor muestra el icono de silencio cuando hay audio y la etiqueta `Activar` cuando está silenciado, sin estados superpuestos.
