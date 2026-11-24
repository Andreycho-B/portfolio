import type { ProjectItem } from "../features/projects/project-data";
import { PROFILE } from "./profile";

export type SchemaNode = Readonly<Record<string, unknown>>;

const SITE_URL = PROFILE.siteUrl;
const PERSON_ID = `${SITE_URL}/#person`;
const WEBSITE_ID = `${SITE_URL}/#website`;
const SERVICE_ID = `${SITE_URL}/#service`;

const SAME_AS_URLS = [
  PROFILE.socials.github.url,
  PROFILE.socials.linkedin.url,
  PROFILE.socials.instagram.url,
] as const;

const POSTAL_ADDRESS: SchemaNode = {
  "@type": "PostalAddress",
  addressLocality: PROFILE.location.city,
  addressRegion: PROFILE.location.region,
  addressCountry: PROFILE.location.countryCode,
};

const AREA_SERVED: readonly SchemaNode[] = [
  { "@type": "City", name: PROFILE.location.city },
  { "@type": "AdministrativeArea", name: PROFILE.location.region },
  { "@type": "Country", name: PROFILE.location.country },
];

export const buildCanonicalUrl = (pathname: string, site?: URL): string => {
  const normalizedPath =
    pathname.length > 1 && pathname.endsWith("/") ? pathname.slice(0, -1) : pathname;
  const base = site ?? new URL(SITE_URL);
  return new URL(normalizedPath, base).href;
};

export const buildBaseSchemaGraph = (lang: string): readonly SchemaNode[] => {
  const defaultImage = `${SITE_URL}/og-image.jpg`;
  return [
    {
      "@type": "WebSite",
      "@id": WEBSITE_ID,
      name: PROFILE.shortName,
      alternateName: [PROFILE.fullName, "andreyrondon.dev"],
      url: SITE_URL,
      inLanguage: lang,
      publisher: { "@id": PERSON_ID },
    },
    {
      "@type": "Person",
      "@id": PERSON_ID,
      name: PROFILE.fullName,
      alternateName: PROFILE.alternateNames,
      jobTitle: PROFILE.role,
      description: PROFILE.bioShort,
      url: SITE_URL,
      email: `mailto:${PROFILE.email}`,
      telephone: PROFILE.phone,
      image: defaultImage,
      sameAs: SAME_AS_URLS,
      alumniOf: {
        "@type": "EducationalOrganization",
        name: PROFILE.education.institution,
      },
      address: POSTAL_ADDRESS,
      homeLocation: {
        "@type": "Place",
        name: `${PROFILE.location.city}, ${PROFILE.location.region}, ${PROFILE.location.country}`,
        address: POSTAL_ADDRESS,
      },
      knowsLanguage: ["es"],
      knowsAbout: PROFILE.skills,
    },
    {
      "@type": "ProfessionalService",
      "@id": SERVICE_ID,
      name: `${PROFILE.shortName} — ${PROFILE.role}`,
      description: PROFILE.bioShort,
      url: SITE_URL,
      image: defaultImage,
      email: `mailto:${PROFILE.email}`,
      telephone: PROFILE.phone,
      founder: { "@id": PERSON_ID },
      address: POSTAL_ADDRESS,
      areaServed: AREA_SERVED,
      serviceType: PROFILE.services,
      knowsAbout: PROFILE.skills,
      sameAs: SAME_AS_URLS,
    },
  ];
};

export const buildHomeSchemaNodes = (
  projects: readonly ProjectItem[],
  lang: string,
): readonly SchemaNode[] => [
  {
    "@type": "CollectionPage",
    "@id": `${SITE_URL}/#webpage`,
    url: `${SITE_URL}/`,
    name: `${PROFILE.shortName} — ${PROFILE.role} en ${PROFILE.location.city}, ${PROFILE.location.country}`,
    description: PROFILE.bioLong,
    inLanguage: lang,
    isPartOf: { "@id": WEBSITE_ID },
    about: { "@id": PERSON_ID },
    mainEntity: {
      "@type": "ItemList",
      name: "Proyectos seleccionados de Andrey Rondón",
      numberOfItems: projects.length,
      itemListElement: projects.map((project, index) => ({
        "@type": "ListItem",
        position: index + 1,
        url: `${SITE_URL}/proyectos/${project.slug}`,
        name: project.subtitle ? `${project.title} — ${project.subtitle}` : project.title,
        description: project.seoDescription,
        image: `${SITE_URL}${project.imageSrc}`,
      })),
    },
  },
];

export const buildAboutSchemaNodes = (pageUrl: string, lang: string): readonly SchemaNode[] => [
  {
    "@type": "ProfilePage",
    "@id": `${pageUrl}#webpage`,
    url: pageUrl,
    name: `Sobre Mí — ${PROFILE.shortName}`,
    description: PROFILE.bioShort,
    inLanguage: lang,
    isPartOf: { "@id": WEBSITE_ID },
    mainEntity: { "@id": PERSON_ID },
  },
  {
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Inicio", item: `${SITE_URL}/` },
      { "@type": "ListItem", position: 2, name: "Sobre Mí", item: pageUrl },
    ],
  },
];

export const buildProjectSchemaNodes = (
  pageUrl: string,
  project: ProjectItem,
  imageUrl: string,
  lang: string,
): readonly SchemaNode[] => {
  const softwareNode: Record<string, unknown> = {
    "@type": "SoftwareSourceCode",
    "@id": `${pageUrl}#software`,
    url: pageUrl,
    mainEntityOfPage: { "@type": "WebPage", "@id": pageUrl },
    name: project.title,
    headline: project.subtitle ?? project.title,
    description: project.seoDescription,
    inLanguage: lang,
    author: { "@id": PERSON_ID },
    creator: { "@id": PERSON_ID },
    programmingLanguage: project.programmingLanguages,
    keywords: project.tags?.join(", "),
    dateCreated: project.year,
    image: imageUrl,
  };
  if (project.repoUrl) softwareNode.codeRepository = project.repoUrl;
  if (project.licenseUrl) softwareNode.license = project.licenseUrl;

  return [
    softwareNode,
    {
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Inicio", item: `${SITE_URL}/` },
        { "@type": "ListItem", position: 2, name: project.title, item: pageUrl },
      ],
    },
  ];
};
