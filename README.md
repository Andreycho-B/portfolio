# Andrey Rondón — Creative Engineering Portfolio

Portafolio de ingeniería de software y desarrollo creativo. Construido con una arquitectura modular sin dependencias de frameworks reactivos en el cliente, combinando renderizado estático con Astro 7, computación gráfica en WebGL con Three.js, simulación física bidimensional con Matter.js y síntesis de audio procedural en tiempo real mediante la Web Audio API.

Diseñado bajo principios de tipografía editorial en blanco y negro (`#000000` / `#ffffff`), rendimiento extremo en Core Web Vitals y cumplimiento riguroso de accesibilidad universal (WCAG 2.1 AA).

---

## Arquitectura y Módulos Técnicos

### 1. WebGL & Creative Coding (`src/features/projects/`)

- **Cilindro 3D Interactivo (Lens Drum):** Carrusel cilíndrico en espacio tridimensional desarrollado sobre Three.js puro, con física de inercia, arrastre elástico y snap determinista.
- **Shader de Refracción Vítrea (GLSL):** Shader de fragmentos y vértices personalizado (`drum-glass-shader.ts`) para proyectar distorsión óptica, reflexión interna y aberración cromática en la tarjeta activa.
- **Code-Splitting Inteligente:** El chunk de Three.js (~530 kB) se carga de forma asíncrona mediante `requestIdleCallback` durante la pantalla de bienvenida, manteniendo el bundle inicial de la ruta principal en ~25 kB.
- **Resiliencia de Renderizado:** Detección y manejo del ciclo de vida de GPU (`webglcontextlost`), inicialización segura sin doble antialias innecesario y fallback automático a tarjetas semánticas DOM (`.drum-fallback-cards`) ante hardware no compatible.

### 2. Motor de Audio Procedural (`src/core/audio.ts`)

- **Síntesis Aditiva y Sustractiva en Tiempo Real:** 100% sintetizado mediante osciladores matemáticos, nodos de ganancia y filtros convolucionales de la Web Audio API nativa. Sin archivos ni muestras estáticas (`.mp3` o `.wav`).
- **Resonancia Táctil & Chimes Armónicos:** Micro-feedback acústico sincronizado con gestos del ratón, paradas del tambor e interacciones de navegación.
- **Gobernanza de Autoplay:** Inicialización diferida vinculada al gesto explícito de consentimiento del usuario y persistencia local de estado de silencio con sincronización ARIA.

### 3. Simulación Física y Cinemática (`src/features/project-detail/`, `src/features/about/`)

- **TechGravity (Matter.js):** Escenario de física bidimensional con cuerpos rígidos, detección de colisiones elásticas y respuesta interactiva al puntero para los tokens de stack tecnológico.
- **Mascota Interactiva 2D con Eye-Tracking:** Renderizado vectorial y trigonometría en tiempo real para el seguimiento de la pupila hacia las coordenadas del cursor, complementado con un ciclo de parpadeo estocástico y física de flotación.
- **Transición Fluida entre Páginas:** Efecto de barrido líquido ("fluid wipe") generado mediante interpolación paramétrica de curvas Bézier cúbicas sobre SVG proyectado.

### 4. Accesibilidad e Inclusión (WCAG 2.1 AA)

- **Estructura Semántica Completa:** Jerarquía de encabezados estricta (`<h1>` a `<h3>`), landmarks HTML5 (`<main>`, `<nav>`, `<header>`, `<footer>`) y navegación clara.
- **Lista de Proyectos para Crawlers y Lectores de Pantalla:** Estructura `<nav class="sr-only">` con lista numerada indexable que expone el contenido a lectores de pantalla y motores de búsqueda independientemente del canvas WebGL.
- **Navegación Total por Teclado:** Foco coordinado en el viewport 3D (`ArrowUp`, `ArrowDown`, `Home`, `End`, `Space`, `Enter`).
- **Control de Audio WAI-ARIA 1.2:** Atributo `aria-label="Silenciar sonido"` constante sincronizado con `aria-pressed`, aislando las etiquetas visuales del árbol de accesibilidad.

---

## Stack Tecnológico

| Dominio              | Tecnología                                                       | Propósito                                                                       |
| :------------------- | :--------------------------------------------------------------- | :------------------------------------------------------------------------------ |
| **Framework Base**   | [Astro 7](https://astro.build/)                                  | Generación estática (SSG), View Transitions e isla de componentes               |
| **Lenguaje**         | [TypeScript 5](https://www.typescriptlang.org/)                  | Tipado estricto, unión de contratos de dominio y cero `any`                     |
| **Gráficos 3D**      | [Three.js](https://threejs.org/)                                 | Escena tridimensional, cámara en perspectiva y render targets                   |
| **Física 2D**        | [Matter.js](https://brm.io/matter-js/)                           | Simulación de cuerpos rígidos y gravedad interactiva en estudios de caso        |
| **Animación**        | [GSAP 3](https://greensock.com/gsap/)                            | Timelines de precisión, interpolación de curvas y morphing tipográfico          |
| **Smooth Scroll**    | [Lenis](https://lenis.darkroom.engineering/)                     | Desplazamiento inercial suave exclusivo para rutas editoriales con scroll largo |
| **Audio**            | Web Audio API                                                    | Síntesis procedural determinista en tiempo real                                 |
| **Estilos**          | CSS Nativo (Moderno)                                             | Variables CSS, `@layer`, clamp fluido, grid y flexbox sin preprocesadores       |
| **Auditoría & Lint** | [Biome](https://biomejs.dev/) + [Prettier](https://prettier.io/) | Análisis estático, ordenamiento de imports y formateo determinista              |
| **Git Hooks**        | [Husky](https://typicode.github.io/husky/)                       | Pipeline pre-commit para garantizar cero errores en control de versiones        |

---

## Estructura del Proyecto

```text
src/
├── core/                        # Utilidades del sistema central
│   ├── audio.ts                 # Orquestador del subsistema Web Audio
│   ├── audio-synthesis.ts       # Nodos osciladores y curvas de envolvente (ADSR)
│   ├── profile.ts               # Fuente única de datos de perfil, redes y metadatos
│   └── smooth-scroll.ts         # Adaptador y ciclo de vida de Lenis
├── design-system/               # Fundaciones visuales y tokens de diseño
│   ├── components/              # Cursor reactivo, filtros SVG y morphic text
│   ├── tokens/                  # Variables CSS de color, tipografía, espacio y layout
│   └── reset.css                # Normalización estándar y barra de desplazamiento estilizada
├── features/                    # Módulos desacoplados por funcionalidad
│   ├── about/                   # Mascota interactiva, showcase editorial y partículas
│   ├── consent/                 # Pantalla de bienvenida, audio gateway y storage
│   ├── project-detail/          # Estudio de caso, specimens y motor TechGravity
│   ├── projects/                # Escena 3D WebGL, shaders de refracción y controlador
│   └── transitions/             # Orquestación de transición fluida SVG entre vistas
├── layouts/                     # Plantillas base HTML5, SEO y metadatos estructurados
│   └── BaseLayout.astro         # Inyección de ClientRouter y Schema.org JSON-LD
└── pages/                       # Rutas estáticas de la aplicación
    ├── index.astro              # Experiencia principal (Consentimiento + Tambor 3D)
    ├── sobre-mi.astro           # Manifiesto profesional, experiencia y competencias
    ├── 404.astro                # Página de error accesible y navegable
    └── proyectos/[slug].astro   # Rutas dinámicas de estudios de caso
```

---

## Comandos de Desarrollo

El proyecto utiliza [`pnpm`](https://pnpm.io/) como gestor de paquetes.

```bash
# Instalación de dependencias
pnpm install

# Iniciar servidor local de desarrollo
pnpm dev

# Comprobación de tipos de Astro y TypeScript
pnpm check

# Análisis estático y formateo con Biome
pnpm lint

# Formatear archivos del proyecto
pnpm format

# Compilación estática de producción
pnpm build

# Previsualizar el build generado
pnpm preview

# Pipeline de verificación completa (Tipo + Lint + Build)
pnpm verify
```

---

## Rendimiento y Optimización en Producción

- **Sin dependencias pesadas en el cliente:** Cero librerías de componentes UI de terceros (sin React, Vue ni Tailwind CSS).
- **Tipografías Optimizadas:** Tipografías en formato `.woff2` moderno (`Author Variable` y `Karrik`) con subconjuntos optimizados para latencia mínima.
- **Estrategia PWA:** Archivo de manifiesto web válido (`/manifest.webmanifest`) con soporte de iconos responsivos en resolución completa (`192x192`, `512x512` e icono con máscara).
- **SEO Técnico:** Generación automática de `sitemap-index.xml`, archivo `robots.txt` explícito y datos estructurados Schema.org (`Person` y `SoftwareSourceCode`).

---

## Autor

**Andrey Ernesto Rondón Corredor**  
Desarrollador de Software Fullstack & Creativo  
Tecnólogo en Análisis y Desarrollo de Software (ADSO — SENA)  
Duitama, Boyacá, Colombia

- **Sitio Web:** [andreyrondon.dev](https://andreyrondon.dev)
- **GitHub:** [@Andreycho-B](https://github.com/Andreycho-B)
- **LinkedIn:** [Andrey Rondón](https://linkedin.com/in/andrey-rond%C3%B3n-980345426)
- **Correo Electrónico:** rondonandrey42@gmail.com
