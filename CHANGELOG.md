# Changelog

Todos los cambios relevantes de este proyecto se documentan en este archivo.

El formato sigue [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/) y el proyecto adopta [Versionado Semántico](https://semver.org/lang/es/).

## [No publicado]

### Añadido

- Iconos explícitos `public/favicon-32x32.png` y `public/favicon-48x48.png` para navegadores de escritorio y motores de búsqueda.
- Integración de cabeceras de seguridad HTTP (`Content-Security-Policy`, `Strict-Transport-Security`, `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`) y políticas de caché inmutable en `vercel.json`.

### Cambiado

- **Tambor lenticular a pantalla completa:** el canvas WebGL ocupa el viewport completo en escritorio, móvil y modo horizontal, con altura de tarjeta proporcional al campo visible (42.5 % para la tarjeta frontal) y superposición editorial en `mix-blend-mode: difference`.
- **Calibración óptica del shader de vidrio (`drum-glass-shader.ts`):** banda de refracción del 10 % en reposo con crecimiento dinámico hasta el 13.6 % según la velocidad de giro, dispersión cromática vertical simétrica y preservación del blanco puro (`#ffffff`) en las zonas vacías del lienzo.
- **Rediseño de síntesis acústica (`audio-wheel-tick.ts`, `audio-synthesis.ts`):** el tic táctil de rueda y hover emplea un transitorio de ruido filtrado en banda (4.6 kHz) con envolvente de doble decaimiento de 5 ms; el aura de proximidad evoluciona hacia un acorde consonante de cuatro parciales (E4, B4, E5) con apertura progresiva de filtro lowpass de 240 a 800 Hz.
- **Adaptación responsiva en `/sobre-mi` (`about.css`):** diseño fluido de 3, 2 y 1 columna según el ancho de pantalla, áreas táctiles mínimas de 44 px en controles e hitos de contacto, y preservación de nitidez en párrafos apilados durante el scroll.
- **Normalización de favicons y manifiesto:** conjunto completo de iconos sobre lienzo blanco opaco (`#ffffff`) para garantizar legibilidad en máscaras circulares de buscadores y modo oscuro del sistema.

### Corregido

- **Exclusión mutua de estados del cursor personalizado (`cursor-controller.ts`):** expandir la píldora contextual limpia el estado de silencio y viceversa, evitando colisiones visuales en el control de sonido de `/sobre-mi`.
- **Alineación de coordenadas en el shader de bienvenida (`cloud-controller.ts`):** sincronización de la escala de renderizado del canvas con las zonas de despeje de texto y la posición del puntero.
- **Accesibilidad en textos con animación por carácter (`DetailHeader.astro`, `DetailInfoGrid.astro`):** incorporación de etiquetas semánticas íntegras para lectores de pantalla y aislamiento del árbol DOM decorativo con `aria-hidden="true"`.
- **Prevención de recarga innecesaria en el logotipo principal (`projects-screen-mount.ts`):** el clic primario sin modificadores sobre el monograma en la ruta raíz evita recargar la escena activa.
