# Andrey Rondón — Creative Engineering Portfolio

Portafolio personal de ingeniería de software y desarrollo creativo. Construido sobre Astro 7 y TypeScript 6 sin dependencias de frameworks de componentes en el cliente, combinando renderizado estático, gráficos 3D en WebGL con Three.js, simulación física 2D con Matter.js y síntesis de audio en tiempo real mediante la Web Audio API.

---

## Arquitectura Técnica

### 1. Escena 3D y Shaders GLSL (`src/features/projects/`, `src/features/consent/`)

- **Tambor Lenticular Vertical (Three.js):** carrusel cilíndrico de 9 ranuras en espacio tridimensional con física de amortiguación exponencial independiente del framerate, arrastre con proyección de inercia y bucle de renderizado bajo demanda (se detiene automáticamente en reposo).
- **Post-procesado Óptico (`drum-glass-shader.ts`):** shader GLSL en segunda pasada sobre `WebGLRenderTarget` (`HalfFloatType`, 4 muestras MSAA) que aplica curvatura sagital en los extremos superior e inferior, dispersión cromática de 16 muestras con pesos espectrales tipo Cauchy y dithering para evitar banding.
- **Fondo Atmosférico con Bayer Dithering (`cloud-shader.ts`):** shader WebGL2 en la pantalla de bienvenida con ruido Simplex tridimensional, movimiento fractal browniano (fBm), cuantización por matriz de Bayer 8×8 y repulsión elástica alrededor del puntero.
- **Carga Diferida y Fallback Semántico:** el módulo de Three.js se precarga en segundo plano mediante `requestIdleCallback` durante la pantalla de bienvenida y conmuta automáticamente a tarjetas HTML estáticas ante pérdida o ausencia de contexto WebGL (`webglcontextlost`).

### 2. Síntesis de Audio Procedural (`src/core/audio.ts`)

- **Generación en Vivo sin Archivos de Audio:** todos los sonidos se sintetizan en memoria mediante osciladores senoidales, buffers de ruido filtrado con filtros biquad IIR, nodos `BiquadFilterNode` (`highpass` bloqueador DC a 30 Hz y `lowpass` dinámico), `StereoPannerNode` y un limitador `DynamicsCompressorNode` en el bus maestro.
- **Capas Acústicas:**
  - *Drone orgánico y aura de proximidad (`audio-synthesis.ts`):* textura continua en Mi (82.41 Hz) con LFO de paneo estéreo y apertura armónica al acercar el cursor al logotipo o a la tarjeta activa.
  - *Campanas generativas (`audio-chime.ts`):* intervalos consonantes disparados en ventanas estocásticas.
  - *Feedback táctil (`audio-wheel-tick.ts`, `audio-tactile.ts`, `audio-arrival.ts`):* detentes mecánicos sincronizados con los pasos del tambor, clics de selección y acorde de llegada.
- **Ciclo de Vida y Consentimiento:** el `AudioContext` se instancia exclusivamente tras la acción explícita del visitante, suspendiendo el procesamiento al ocultar la pestaña (`visibilitychange`) o silenciar el sistema.

### 3. Física Interactiva y Transiciones (`src/features/project-detail/`, `src/features/about/`, `src/features/transitions/`)

- **TechGravity (`tech-gravity-engine.ts`):** simulación 2D con Matter.js en las vistas de estudio de caso, donde los tokens del stack tecnológico caen por gravedad y colisionan con el vector de velocidad del cursor.
- **Escultura Vectorial y Partículas (`mascot-eyes.ts`, `particle-text.ts`):** mascota 2D con seguimiento ocular trigonométrico, parpadeo procedural y banner inferior en Canvas 2D con miles de partículas reactivas que conforman el rótulo `"ANDREY"`.
- **Transición de Barrido Líquido (`fluid-transition-controller.ts`):** navegación entre rutas coordinada con `ClientRouter` de Astro mediante superposición SVG de doble capa y curvas Bézier animadas con GSAP.

### 4. Accesibilidad (WCAG 2.1 AA) y SEO

- **Navegación Completa por Teclado:** soporte en el carrusel 3D para `ArrowUp`, `ArrowDown`, `Home`, `End`, `Enter` y `Space`, con anuncios en vivo (`aria-live="polite"`) al cambiar de proyecto y árbol de navegación indexable (`<nav class="sr-only">`).
- **Respeto a `prefers-reduced-motion`:** desactivación de desplazamientos inerciales, bucles de flotación, simulaciones de partículas y filtros de desenfoque cuando el sistema operativo solicita reducir el movimiento.
- **Datos Estructurados y Metadatos:** esquemas JSON-LD (`WebSite`, `Person` y `SoftwareSourceCode`), OpenGraph, Twitter Cards, `sitemap-index.xml` y `manifest.webmanifest`.

---

## Stack Tecnológico

| Capa | Tecnología | Uso en el proyecto |
| :--- | :--- | :--- |
| **Framework** | [Astro 7](https://astro.build/) | Generación estática (SSG) y enrutamiento con `ClientRouter` |
| **Lenguaje** | [TypeScript 6](https://www.typescriptlang.org/) | Tipado estricto (`strict`, `noUncheckedIndexedAccess`, cero `any`) |
| **Gráficos 3D** | [Three.js](https://threejs.org/) | Carrusel cilíndrico WebGL y post-procesado con shaders GLSL |
| **Física 2D** | [Matter.js](https://brm.io/matter-js/) | Escenario gravitacional interactivo en estudios de caso |
| **Animación** | [GSAP 3](https://greensock.com/gsap/) | Timelines de interfaz, filtros SVG mórficos y transiciones |
| **Scroll Suave** | [Lenis](https://lenis.darkroom.engineering/) | Scroll inercial de documento en vistas de estudio de caso y perfil |
| **Audio** | Web Audio API | Síntesis procedural en tiempo real sin muestras externas |
| **Estilos** | CSS Nativo | Custom properties, CSS Grid, `mix-blend-mode` y diseño fluido |
| **Calidad y Formato** | [Biome](https://biomejs.dev/) + [Prettier](https://prettier.io/) + [Husky](https://typicode.github.io/husky/) | Linting estático, formateo de `.astro` y verificación pre-commit |

---

## Estructura del Proyecto

```text
src/
├── core/                        # Subsistemas transversales
│   ├── audio.ts                 # Motor singleton Web Audio API y bus maestro
│   ├── audio-arrival.ts         # Síntesis de acorde armónico de entrada
│   ├── audio-chime.ts           # Campanas generativas con paneo estéreo
│   ├── audio-lifecycle.ts       # Suspensión, visibilidad y silenciamiento gradual
│   ├── audio-synthesis.ts       # Drone ambiental y aura de proximidad
│   ├── audio-tactile.ts         # Clics táctiles y vibración háptica
│   ├── audio-wheel-tick.ts      # Síntesis IIR del detente de rotación del tambor
│   ├── audio.types.ts           # Contratos del motor de audio
│   ├── profile.ts               # Datos de perfil, contacto y metadatos
│   └── smooth-scroll.ts         # Inicialización y limpieza de Lenis + GSAP ticker
├── design-system/               # Tokens CSS y componentes base
│   ├── components/              # Cursor elástico (spring 2D) y tipografía mórfica SVG
│   ├── tokens/                  # Variables CSS de color, tipografía, espacio y movimiento
│   ├── fonts.css                # Declaraciones @font-face (Author, Karrik y fuentes display)
│   └── reset.css                # Reset CSS y utilidades de accesibilidad
├── features/                    # Módulos por dominio funcional
│   ├── about/                   # Vista Sobre mí, mascota interactiva y canvas de partículas
│   ├── consent/                 # Pantalla de bienvenida, shader WebGL2 de nubes y persistencia
│   ├── project-detail/          # Estudios de caso, especímenes con tilt 3D y TechGravity
│   ├── projects/                # Tambor 3D WebGL, física de scroll, shader de lente y UI
│   └── transitions/             # Transición SVG de barrido líquido entre páginas
├── layouts/
│   └── BaseLayout.astro         # Documento base, metadatos OpenGraph, JSON-LD y cabeceras
└── pages/
    ├── index.astro              # Ruta principal (Bienvenida + Tambor de proyectos)
    ├── sobre-mi.astro           # Perfil profesional y stack técnico
    ├── 404.astro                # Página 404 integrada al sistema de diseño
    └── proyectos/[slug].astro   # Estudios de caso generados estáticamente
```

---

## Scripts de Desarrollo

Requisitos: **Node.js >= 22.12.0** y **pnpm**.

```bash
pnpm install   # Instalar dependencias
pnpm dev       # Iniciar servidor de desarrollo
pnpm check     # Verificar tipos de Astro y TypeScript
pnpm lint      # Ejecutar análisis estático con Biome
pnpm format    # Formatear código con Biome y Prettier (.astro)
pnpm build     # Generar compilación estática en dist/
pnpm preview   # Previsualizar el build de producción
pnpm verify    # Ejecutar pipeline completo (check + lint + build)
```

---

## Autor

**Andrey Ernesto Rondón Corredor**  
Desarrollador de Software Fullstack & Creativo  
Tecnólogo en Análisis y Desarrollo de Software (ADSO — SENA)  
Duitama, Boyacá, Colombia

- **Web:** [www.andreyrondon.dev](https://www.andreyrondon.dev)
- **GitHub:** [@Andreycho-B](https://github.com/Andreycho-B)
- **LinkedIn:** [Andrey Rondón](https://linkedin.com/in/andrey-rond%C3%B3n-980345426)
- **Contacto:** rondonandrey42@gmail.com
