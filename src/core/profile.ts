interface SocialLink {
  readonly label: string;
  readonly url: string;
  readonly handle?: string;
}

interface ProfileData {
  readonly fullName: string;
  readonly shortName: string;
  readonly alternateNames: readonly string[];
  readonly role: string;
  readonly bioShort: string;
  readonly bioLong: string;
  readonly siteUrl: string;
  readonly email: string;
  readonly phone: string;
  readonly whatsappUrl: string;
  readonly location: {
    readonly city: string;
    readonly region: string;
    readonly country: string;
    readonly countryCode: string;
  };
  readonly education: {
    readonly institution: string;
    readonly degree: string;
  };
  readonly socials: {
    readonly github: SocialLink;
    readonly linkedin: SocialLink;
    readonly instagram: SocialLink;
  };
  readonly services: readonly string[];
  readonly skills: readonly string[];
}

export const PROFILE: ProfileData = {
  fullName: "Andrey Ernesto Rondón Corredor",
  shortName: "Andrey Rondón",
  alternateNames: ["Andrey Rondón", "Andreycho-B"],
  role: "Desarrollador Web Fullstack y Frontend Creativo",
  bioShort:
    "Andrey Rondón es desarrollador web full-stack y frontend creativo en Duitama, Boyacá, Colombia. Tecnólogo ADSO (SENA) especializado en desarrollo web a medida, e-commerce, PWA, Astro, Three.js, WebGL, TypeScript, Go y PostgreSQL.",
  bioLong:
    "Andrey Rondón, desarrollador web full-stack y frontend creativo en Duitama, Boyacá, Colombia. E-commerce, PWA, Astro, Three.js, TypeScript, Go y PostgreSQL.",
  siteUrl: "https://www.andreyrondon.dev",
  email: "rondonandrey42@gmail.com",
  phone: "+57 314 803 9636",
  whatsappUrl: "https://wa.me/573148039636",
  location: {
    city: "Duitama",
    region: "Boyacá",
    country: "Colombia",
    countryCode: "CO",
  },
  education: {
    institution: "Servicio Nacional de Aprendizaje (SENA)",
    degree: "Tecnólogo en Análisis y Desarrollo de Software (ADSO)",
  },
  socials: {
    github: {
      label: "GitHub",
      url: "https://github.com/Andreycho-B",
      handle: "Andreycho-B",
    },
    linkedin: {
      label: "LinkedIn",
      url: "https://linkedin.com/in/andrey-rond%C3%B3n-980345426",
      handle: "andrey-rondón",
    },
    instagram: {
      label: "Instagram",
      url: "https://instagram.com/andrey_rondonikov",
      handle: "@andrey_rondonikov",
    },
  },
  services: [
    "Desarrollo web full-stack a medida",
    "Tiendas e-commerce y aplicaciones web progresivas (PWA)",
    "Experiencias web interactivas 3D con Three.js y WebGL",
    "Arquitectura backend concurrente con Go, Node.js y PostgreSQL",
    "Diseño e ingeniería frontend UI/UX con Astro, Svelte y Angular",
  ],
  skills: [
    "Desarrollo Web Full-Stack",
    "Desarrollo Frontend Creativo",
    "E-commerce",
    "PWA",
    "Astro",
    "UI/UX",
    "TypeScript",
    "Go (Golang)",
    "PostgreSQL",
    "SQLC",
    "Svelte 5",
    "Angular",
    "Tailwind CSS",
    "Node.js",
    "NestJS",
    "Argon2id",
    "WebSockets",
    "Server-Sent Events",
    "Docker",
    "WebGL",
    "Three.js",
    "Arquitectura de Software",
  ],
};
