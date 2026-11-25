interface OfficialTechLogo {
  readonly id: string;
  readonly svgUrl: string;
}

interface SplitCharItem {
  readonly char: string;
  readonly index: number;
}

export const splitChars = (text: string): SplitCharItem[] =>
  text.split("").map((char, index) => ({
    char: char === " " ? "\u00A0" : char,
    index,
  }));

const OFFICIAL_TECH_LOGOS: Record<string, OfficialTechLogo> = {
  "Go (Chi v5)": { id: "go", svgUrl: "/tech-logos/go.svg" },
  Go: { id: "go", svgUrl: "/tech-logos/go.svg" },
  TypeScript: { id: "typescript", svgUrl: "/tech-logos/typescript.svg" },
  "PostgreSQL 16": { id: "postgresql", svgUrl: "/tech-logos/postgresql.svg" },
  PostgreSQL: { id: "postgresql", svgUrl: "/tech-logos/postgresql.svg" },
  "Svelte 5": { id: "svelte", svgUrl: "/tech-logos/svelte.svg" },
  "Tailwind CSS": { id: "tailwindcss", svgUrl: "/tech-logos/tailwindcss.svg" },
  PWA: { id: "pwa", svgUrl: "/tech-logos/pwa.svg" },
  "Angular 21": { id: "angular", svgUrl: "/tech-logos/angular.svg" },
  "NestJS 11": { id: "nestjs", svgUrl: "/tech-logos/nestjs.svg" },
  Render: { id: "render", svgUrl: "/tech-logos/render.svg" },
  GitHub: { id: "github", svgUrl: "/tech-logos/github.svg" },
};

export function getProjectLogos(tags: readonly string[], targetCount = 30): OfficialTechLogo[] {
  const validLogos: OfficialTechLogo[] = [];
  for (const tag of tags) {
    const logo = OFFICIAL_TECH_LOGOS[tag];
    if (logo && !validLogos.some((item) => item.id === logo.id)) validLogos.push(logo);
  }

  if (
    validLogos.length < 3 &&
    OFFICIAL_TECH_LOGOS.GitHub &&
    !validLogos.some((item) => item.id === "github")
  ) {
    validLogos.push(OFFICIAL_TECH_LOGOS.GitHub);
  }

  const pool: OfficialTechLogo[] = [];
  let i = 0;
  while (pool.length < targetCount && validLogos.length > 0) {
    const item = validLogos[i % validLogos.length];
    if (item) pool.push(item);
    i++;
  }

  return pool;
}
