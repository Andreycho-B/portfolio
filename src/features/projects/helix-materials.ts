import * as THREE from "three";

export const CREME_BACKGROUND = "#f5f1ea";

const RIM_INTENSITY = 0.85;
const RIM_POWER = 3.5;
const FRINGE_STRENGTH = 0.16;

// Acrílico sólido pulido: sin glassmorphism CSS ni hacks DOM (Spec del usuario §1-3).
// La aberración cromática se inyecta como desfase de canales en las zonas
// rasantes del bisel, ponderado por Fresnel (dispersión espectral del PMMA).
const ACRYLIC_FRAG_INJECTION = /* glsl */ `
  float rimFresnel = pow(1.0 - saturate(dot(normalize(normal), normalize(vViewPosition))), ${RIM_POWER});
  float fringe = rimFresnel * ${FRINGE_STRENGTH} * (vViewPosition.x >= 0.0 ? 1.0 : -1.0);
  gl_FragColor.rgb += vec3(1.0) * rimFresnel * ${RIM_INTENSITY};
  gl_FragColor.r += abs(fringe);
  gl_FragColor.b += abs(fringe) * 0.6;
`;

export const createAcrylicMaterial = (): THREE.MeshPhysicalMaterial => {
  const material = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(0xffffff),
    metalness: 0.0,
    roughness: 0.04,
    transmission: 0.98,
    ior: 1.51,
    thickness: 0.15,
    specularIntensity: 1.2,
    specularColor: new THREE.Color(0xffffff),
    clearcoat: 1.0,
    clearcoatRoughness: 0.02,
    transparent: true,
    side: THREE.FrontSide,
  });

  material.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <dithering_fragment>",
      `#include <dithering_fragment>
      ${ACRYLIC_FRAG_INJECTION}`,
    );
  };

  return material;
};

// Núcleo gráfico opaco encapsulado en el acrílico: sin iluminación para
// que el arte se lea retroiluminado como en la referencia
export const createArtMaterial = (texture: THREE.Texture): THREE.MeshBasicMaterial =>
  new THREE.MeshBasicMaterial({
    map: texture,
    toneMapped: true,
    alphaToCoverage: true,
  });
