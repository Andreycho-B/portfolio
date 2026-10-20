# Portafolio Andrey

Portafolio interactivo de ingeniería de software y desarrollo creativo: pantalla de consentimiento táctil, carrete lenticular 3D (WebGL), navegación fluida por transiciones SVG dinámicas, audio procedural sintetizado en vivo y dirección visual minimalista monocromática.

## Stack Tecnológico

- **Framework:** Astro 7 (TypeScript strict, SSG)
- **Animación & Timelines:** GSAP
- **Render 3D:** Three.js (Tambor Lenticular con shader de refracción óptica)
- **Física 2D:** Matter.js (TechGravity en Detalle de Proyecto)
- **Scroll Suave:** Lenis (orquestado en ticker de GSAP)
- **Audio:** Web Audio API (síntesis procedural sin archivos de audio estáticos)
- **Calidad de Código:** Biome + Husky + Prettier (exclusivo `.astro`)

## Comandos

| Comando           | Acción                                       |
| :---------------- | :------------------------------------------- |
| `pnpm install`    | Instala dependencias                         |
| `pnpm dev`        | Servidor de desarrollo en `localhost:4321`   |
| `pnpm build`      | Build de producción en `./dist/`             |
| `pnpm preview`    | Preview local del build                      |
| `pnpm check`      | Diagnóstico de tipos (`astro check`)         |
| `pnpm lint`       | Lint y verificación con Biome                |
| `pnpm format`     | Formateo con Biome y Prettier                |

## Estructura del Proyecto

```text
src/
├── core/               Motor de audio procedural, física de resortes y scroll suave
├── design-system/      Tokens CSS, componentes base, cursor elástico y tipografía mórfica
├── features/
│   ├── consent/        Pantalla de consentimiento táctil y backdrop de nubes WebGL
│   ├── projects/       Tambor Lenticular 3D, controladores de interacción y metadatos
│   ├── project-detail/ Escaparate de proyectos, especímenes con tilt 3D y Matter.js
│   ├── about/          Experiencia editorial, mascota interactiva y banner de partículas
│   └── transitions/    Controlador de transiciones fluidas con curvas Bézier SVG
├── layouts/            Layout base con metadatos SEO, Open Graph y JSON-LD
└── pages/              Rutas estáticas (Home, Proyectos y Sobre mí)
```

