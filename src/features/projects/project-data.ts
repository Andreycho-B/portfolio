export type ProjectTheme = "dark" | "light";

export type ProjectId = "mias" | "tusuper" | "estandar";
export type ProjectSlug = "mias-hamburguesas-de-lujo" | "tu-super" | "estandar-gobernanza-agentes";

export interface ProjectItem {
  readonly id: ProjectId;
  readonly title: string;
  readonly subtitle?: string;
  readonly role?: string;
  readonly period?: string;
  readonly year: string;
  readonly location?: string;
  readonly imageSrc: string;
  readonly slug: ProjectSlug;
  readonly theme: ProjectTheme;
  readonly liveUrl?: string;
  readonly repoUrl?: string;
  readonly externalUrl?: string;
  readonly tags?: readonly string[];
  readonly highlights?: readonly string[];
  readonly statementTitle?: string;
  readonly statementChallenge?: string;
  readonly statementSolution?: string;
  readonly gallery?: readonly string[];
}

export const PROJECTS: readonly [ProjectItem, ...ProjectItem[]] = [
  {
    id: "mias",
    title: "Mías",
    subtitle: "Hamburguesas de Lujo",
    role: "Desarrollador Fullstack (Sistema de Pedidos y Fidelización)",
    period: "2026 – Actualidad",
    year: "2026",
    location: "Remoto, Duitama",
    imageSrc: "/projects/mias/cover.webp",
    slug: "mias-hamburguesas-de-lujo",
    theme: "dark",
    liveUrl: "https://mias-hamburguesas-de-lujo.pages.dev",
    repoUrl: "https://github.com/Andreycho-B/mias-hamburguesas-de-lujo",
    tags: [
      "Go (Chi v5)",
      "PostgreSQL 16",
      "SQLC",
      "Svelte 5",
      "Tailwind CSS",
      "PWA",
      "Argon2id",
      "SSE",
    ],
    highlights: [
      "Integridad contable del programa de fidelización mediante libro mayor inmutable sobre PostgreSQL 16 con SQLC.",
      "Sesiones blindadas con Argon2id (RFC 9106) y JWT Dual con canal SSE nativo para comandas en tiempo real.",
    ],
    statementTitle: "Arquitectura Inmutable y Comandas en Tiempo Real",
    statementChallenge:
      "Garantizar trazabilidad contable a prueba de fraude en el balance de recompensas y sincronizar estados de pedidos en caliente entre cocina y mostrador sin saturar la red móvil.",
    statementSolution:
      "Diseño de un libro mayor inmutable en PostgreSQL 16 operado exclusivamente mediante consultas estrictamente tipadas con SQLC y transacciones serializables en pgxpool. Las comandas se distribuyen vía Server-Sent Events (SSE) nativo con latencia inferior a 45 ms sobre Go (Chi v5).",
    gallery: [
      "/projects/mias/cover.webp",
      "/projects/mias/IMG_0398.webp",
      "/projects/mias/IMG_0399.webp",
      "/projects/mias/IMG_0400.webp",
      "/projects/mias/IMG_0409.webp",
    ],
  },
  {
    id: "tusuper",
    title: "Tu Súper",
    subtitle: "E-commerce Local de Comestibles",
    role: "Desarrollador Frontend y Colaborador Fullstack",
    period: "2024 – 2026",
    year: "2025",
    location: "Remoto, Colombia",
    imageSrc: "/projects/tusuper/cover.webp",
    slug: "tu-super",
    theme: "light",
    liveUrl: "https://tusuperfront.onrender.com",
    repoUrl: "https://github.com/Andreycho-B/tusuper-backend",
    tags: [
      "Angular 21",
      "Signals",
      "Tailwind CSS",
      "PWA",
      "NestJS 11",
      "PostgreSQL",
      "WebSockets",
      "Render",
    ],
    highlights: [
      "Digitalización del flujo de compra móvil mediante interfaz reactiva construida en Angular 21 (Signals) y PWA.",
      "Sincronización de carrito e inventario en tiempo real con WebSockets para evitar inconsistencias en compras concurrentes.",
    ],
    statementTitle: "Consistencia Reactiva en Compras Concurrentes",
    statementChallenge:
      "Sincronizar variaciones de inventario en tiempo real en un e-commerce local de alta rotación, evitando la venta de stock fantasma ante compras simultáneas desde conexiones móviles inestables.",
    statementSolution:
      "Implementación de un motor de sincronización bidireccional sobre NestJS y WebSockets con transacciones atómicas en PostgreSQL. En el cliente, la reactividad de grano fino con Angular 21 Signals asegura consistencia total antes de la pasarela de pago.",
    gallery: [
      "/projects/tusuper/cover.webp",
      "/projects/tusuper/IMG_0403.webp",
      "/projects/tusuper/IMG_0404.webp",
      "/projects/tusuper/IMG_0405.webp",
      "/projects/tusuper/IMG_0410.webp",
    ],
  },
  {
    id: "estandar",
    title: "Estándar",
    subtitle: "AI Agent Engineering Standard",
    role: "Autor y Mantenedor (Especificación Open Source)",
    period: "2026 – Actualidad",
    year: "2026",
    location: "Remoto, Colombia",
    imageSrc: "/projects/estandar/cover.webp",
    slug: "estandar-gobernanza-agentes",
    theme: "dark",
    externalUrl: "https://github.com/Andreycho-B/ai-agent-engineering-standard",
    repoUrl: "https://github.com/Andreycho-B/ai-agent-engineering-standard",
    tags: ["AI Agents", "RFC Standard", "Auditorías", "CC BY 4.0", "Zero AI-Slop"],
    highlights: [
      "Norma técnica abierta de 32 documentos en 7 niveles jerárquicos para erradicar el código defectuoso en flujos con IA.",
      "Sistema formal de propuestas de cambio (RFC) bajo licencia CC BY 4.0 y protocolos de auditoría de cumplimiento.",
    ],
    statementTitle: "Gobernanza Rigurosa para Ingeniería Asistida por IA",
    statementChallenge:
      "Mitigar la degradación de código, alucinaciones arquitectónicas y acumulación de deuda técnica generada por agentes LLM en entornos de producción sin estándares formales.",
    statementSolution:
      "Constitución técnica estructurada en 32 documentos distribuidos en 7 niveles de autoridad, integrando protocolos de convergencia estricta, RFC-2026 y matrices de auditoría deterministas bajo licencia abierta CC BY 4.0.",
  },
] as const;

export const PROJECT_COUNT = PROJECTS.length;
export const DRUM_SLOTS = 9;

export function getProjectBySlug(slug: string): ProjectItem | undefined {
  return PROJECTS.find((p) => p.slug === slug);
}
