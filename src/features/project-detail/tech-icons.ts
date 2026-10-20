export interface OfficialTechLogo {
  readonly id: string;
  readonly name: string;
  readonly svgUrl: string;
  readonly color: string;
}

export const OFFICIAL_TECH_LOGOS: Record<string, OfficialTechLogo> = {
  "Go (Chi v5)": { id: "go", name: "Go", svgUrl: "/tech-logos/go.svg", color: "#00ADD8" },
  "PostgreSQL 16": {
    id: "postgresql",
    name: "PostgreSQL",
    svgUrl: "/tech-logos/postgresql.svg",
    color: "#4169E1",
  },
  PostgreSQL: {
    id: "postgresql",
    name: "PostgreSQL",
    svgUrl: "/tech-logos/postgresql.svg",
    color: "#4169E1",
  },
  "Svelte 5": { id: "svelte", name: "Svelte", svgUrl: "/tech-logos/svelte.svg", color: "#FF3E00" },
  "Tailwind CSS": {
    id: "tailwindcss",
    name: "Tailwind CSS",
    svgUrl: "/tech-logos/tailwindcss.svg",
    color: "#06B6D4",
  },
  PWA: { id: "pwa", name: "PWA", svgUrl: "/tech-logos/pwa.svg", color: "#5A0FC8" },
  "Angular 21": {
    id: "angular",
    name: "Angular",
    svgUrl: "/tech-logos/angular.svg",
    color: "#DD0031",
  },
  "NestJS 11": { id: "nestjs", name: "NestJS", svgUrl: "/tech-logos/nestjs.svg", color: "#E0234E" },
  Render: { id: "render", name: "Render", svgUrl: "/tech-logos/render.svg", color: "#46E3B7" },
  GitHub: { id: "github", name: "GitHub", svgUrl: "/tech-logos/github.svg", color: "#181717" },
};

export function getProjectLogos(tags: readonly string[], targetCount = 30): OfficialTechLogo[] {
  const validLogos: OfficialTechLogo[] = [];
  for (const tag of tags) {
    const logo = OFFICIAL_TECH_LOGOS[tag];
    if (logo) {
      validLogos.push(logo);
    }
  }

  if (validLogos.length === 0) {
    const fallback = OFFICIAL_TECH_LOGOS.GitHub;
    if (fallback) validLogos.push(fallback);
  }

  const pool: OfficialTechLogo[] = [];
  let i = 0;
  while (pool.length < targetCount && validLogos.length > 0) {
    const item = validLogos[i % validLogos.length];
    if (item) pool.push(item);
    i++;
  }

  return pool.sort((a, b) => ((a.id.charCodeAt(0) + i) % 3) - ((b.id.charCodeAt(0) + i) % 3));
}
