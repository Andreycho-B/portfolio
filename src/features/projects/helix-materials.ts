import * as THREE from "three";

export const CREME_BACKGROUND = "#f5f1ea";

const ACRYLIC_DISPERSION = 0.3;

// Acrílico sólido pulido: sin glassmorphism CSS ni hacks DOM (Spec del usuario §1-3).
// La dispersión nativa produce la aberración cromática física en las zonas
// rasantes y cantos del bisel; el rim blanco procede de las luces y el entorno.
export const createAcrylicMaterial = (): THREE.MeshPhysicalMaterial =>
  new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(0xffffff),
    metalness: 0.0,
    roughness: 0.04,
    transmission: 0.98,
    ior: 1.51,
    thickness: 0.15,
    dispersion: ACRYLIC_DISPERSION,
    specularIntensity: 1.2,
    specularColor: new THREE.Color(0xffffff),
    clearcoat: 1.0,
    clearcoatRoughness: 0.02,
    transparent: true,
    side: THREE.FrontSide,
  });

// Núcleo gráfico opaco encapsulado en el acrílico: sin iluminación para
// que el arte se lea retroiluminado como en la referencia
export const createArtMaterial = (texture: THREE.Texture): THREE.MeshBasicMaterial =>
  new THREE.MeshBasicMaterial({
    map: texture,
    toneMapped: true,
    alphaToCoverage: true,
  });
