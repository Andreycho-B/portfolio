# Portafolio Andrey

Portafolio personal con pantalla de consentimiento interactivo, vista espiral de proyectos en WebGL y dirección visual en blanco y negro.

## Stack

- Astro 7 + TypeScript strict
- GSAP para orquestación de timelines
- Three.js + postprocessing para la vista espiral de proyectos
- Web Audio API con síntesis procedural (singleton en `src/core/audio.ts`)
- Biome + Prettier (solo `.astro`) + Husky

## Comandos

| Comando           | Acción                                       |
| :---------------- | :------------------------------------------- |
| `pnpm install`    | Instala dependencias                         |
| `pnpm dev`        | Servidor de desarrollo en `localhost:4321`   |
| `pnpm build`      | Build de producción en `./dist/`             |
| `pnpm preview`    | Preview local del build                      |
| `pnpm check`      | Diagnóstico de tipos (`astro check`)         |
| `pnpm lint`       | Lint con Biome                               |
| `pnpm format`     | Formateo con Biome y Prettier (`.astro`)     |

## Estructura

```text
src/
├── core/               Audio procedural y física de resortes
├── design-system/      Tokens, componentes y motor tipográfico morphic
├── features/
│   ├── consent/        Pantalla de consentimiento (spec §8)
│   ├── projects/       Vista espiral de proyectos (spec §9.3)
│   └── welcome/        Backdrop de nubes WebGL del consentimiento
├── layouts/
└── pages/
```

## Referencias

- Spec del proyecto: `spec/000-master-spec.md` (local)
- Reglas del proyecto: `.agentrules` (local)
- Documentación de Astro: https://docs.astro.build
