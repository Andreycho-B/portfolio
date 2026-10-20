export interface SocialLink {
  readonly label: string;
  readonly url: string;
  readonly handle?: string;
}

export interface ProfileData {
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
  readonly skills: readonly string[];
}

export const PROFILE: ProfileData = {
  fullName: "Andrey Ernesto Rondón Corredor",
  shortName: "Andrey Rondón",
  alternateNames: ["Andrey Rondón", "Andreycho-B"],
  role: "Desarrollador de Software Fullstack & Creativo",
  bioShort:
    "Desarrollador de Software Fullstack y Tecnólogo SENA (ADSO). Especialista en TypeScript, Go, Three.js, PostgreSQL y arquitectura de software.",
  bioLong:
    "Portafolio de ingeniería de software de Andrey Rondón (Andrey Ernesto Rondón Corredor). Desarrollador de Software Fullstack & Creativo, Tecnólogo ADSO (SENA) en Duitama, Boyacá, Colombia. TypeScript, Go, Three.js, PostgreSQL y arquitectura de software.",
  siteUrl: "https://andreyrondon.dev",
  email: "rondonandrey42@gmail.com",
  phone: "+57 314 803 9636",
  whatsappUrl: "https://wa.me/573148039636",
  location: {
    city: "Duitama",
    region: "Boyacá",
    country: "Colombia",
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
  skills: [
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
