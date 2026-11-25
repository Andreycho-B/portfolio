# Andrey Rondón — Portafolio

Portafolio personal de ingeniería de software y desarrollo creativo construido con Astro 7 y TypeScript estricto, sin frameworks de componentes en el cliente.

## Arquitectura

- **Estudio 3D interactivo (`src/features/projects/`):** escena WebGL en Three.js bajo cielo HDRI *golden hour* con monitor CRT interactivo, tambor lenticular interno en render target, botonera frontal funcional con canales retro, portal embebido para estudios de caso y *Sobre mí*, silla Monobloc en primera persona y utilería interactiva (reloj analógico en hora local y teléfono Nokia 3310 con Snake II jugable).
- **Pantalla de bienvenida (`src/features/consent/`):** tipografía variable con deformación SVG y shader WebGL2 de nubes con dithering Bayer 8×8.
- **Audio (`src/core/audio*.ts`):** motor singleton sobre Web Audio API con ambiente continuo, síntesis procedural para interacciones táctiles, zapping CRT y tonos piezoeléctricos, activado bajo consentimiento explícito.
- **Detalle de proyecto y Sobre mí (`src/features/project-detail/`, `src/features/about/`):** scroll suave con Lenis, simulación física 2D con Matter.js en *TechGravity*, mascota vectorial interactiva y banner de partículas en Canvas 2D.
- **Refracción y cursor (`src/design-system/`):** cursor personalizado con resorte 2D y paneles refractivos con `@ybouane/liquidglass` con degradación segura.

## Stack

- **Framework:** Astro 7 (SSG + `ClientRouter`)
- **Lenguaje:** TypeScript 6 (`strict`)
- **Gráficos 3D:** Three.js
- **Física 2D:** Matter.js
- **Animación y scroll:** GSAP 3, Lenis
- **Audio:** Web Audio API
- **Refracción UI:** `@ybouane/liquidglass`
- **Estilos:** CSS nativo
- **Calidad:** Biome, Prettier (`.astro`), Husky

## Comandos

Requisitos: **Node.js >= 22.12.0** y **pnpm**.

```bash
pnpm install
pnpm dev
pnpm check
pnpm lint
pnpm format
pnpm build
pnpm preview
pnpm verify
```

## Autor

**Andrey Ernesto Rondón Corredor**  
Desarrollador de Software Fullstack & Creativo — Duitama, Boyacá, Colombia

- [www.andreyrondon.dev](https://www.andreyrondon.dev)
- [GitHub](https://github.com/Andreycho-B)
- [LinkedIn](https://linkedin.com/in/andrey-rond%C3%B3n-980345426)
- rondonandrey42@gmail.com
