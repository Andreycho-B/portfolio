import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { createCardFaceTexture } from "./card-face-texture";
import type {
  HelixCardDatum,
  HelixCardEntry,
  HelixConfig,
  HelixWorldLayout,
} from "./helix-cards.types";
import { createHelixChoreography } from "./helix-choreography";
import { createAcrylicMaterial, createArtMaterial } from "./helix-materials";

export const HELIX_CONFIG: HelixConfig = {
  cardCount: 12,
  radius: 5.5,
  angleStep: THREE.MathUtils.degToRad(16),
  axialStep: 0.85,
  cardWidth: 3.0,
  cardHeight: 4.25,
  cardThickness: 0.08,
  pitch: THREE.MathUtils.degToRad(-32),
  yaw: THREE.MathUtils.degToRad(22),
  groupRoll: THREE.MathUtils.degToRad(-135),
  groupElevation: THREE.MathUtils.degToRad(15),
};

// Margen de acrílico visible alrededor del núcleo gráfico (mat perimetral)
const ART_INSET = 0.075;
// Bisel suficiente para atrapar el destello especular en el canto
const BEVEL_RADIUS = 0.03;
const BEVEL_SEGMENTS = 4;

export const createHelixWorld = async (
  config: HelixConfig,
  cardData: readonly HelixCardDatum[],
  maxAnisotropy: number,
): Promise<HelixWorldLayout> => {
  const group = new THREE.Group();

  const shellGeometry = new RoundedBoxGeometry(
    config.cardWidth,
    config.cardHeight,
    config.cardThickness,
    BEVEL_SEGMENTS,
    BEVEL_RADIUS,
  );
  const artGeometry = new THREE.PlaneGeometry(
    config.cardWidth - ART_INSET,
    config.cardHeight - ART_INSET,
  );

  // 3 texturas reales compartidas entre las repeticiones honestas (Spec §9.1)
  const artTextures = await Promise.all(
    cardData.map((card) => createCardFaceTexture(card, maxAnisotropy)),
  );

  const entries: HelixCardEntry[] = [];
  for (let i = 0; i < config.cardCount; i++) {
    const artTexture = artTextures[i % artTextures.length];
    if (!artTexture) throw new Error("Textura de tarjeta no disponible para la hélice");

    // Materiales por tarjeta: el fade de envoltura requiere opacidad individual
    const shellMaterial = createAcrylicMaterial();
    const artMaterial = createArtMaterial(artTexture);

    const shell = new THREE.Mesh(shellGeometry, shellMaterial);
    shell.rotation.set(config.pitch, config.yaw, 0);

    const art = new THREE.Mesh(artGeometry, artMaterial);
    shell.add(art);

    group.add(shell);
    entries.push({ shell, shellMaterial, artMaterial });
  }

  const choreography = createHelixChoreography(entries, config);
  choreography.setAdvance(0);

  group.rotation.z = config.groupRoll;
  group.rotation.x = config.groupElevation;
  group.updateMatrixWorld(true);

  const framingBox = new THREE.Box3();
  for (let i = 1; i <= 8 && i < entries.length; i++) {
    const shell = entries[i]?.shell;
    if (shell) framingBox.expandByObject(shell);
  }

  // Plano de enfoque fijo en el mundo: las tarjetas fluyen a través de él
  const focusCard = entries[Math.floor(config.cardCount * 0.22)]?.shell ?? entries[0]?.shell;
  if (!focusCard) {
    throw new Error("La hélice no contiene tarjetas para calcular el foco del DoF");
  }
  const focusTarget = new THREE.Vector3();
  focusCard.getWorldPosition(focusTarget);

  return {
    group,
    focusTarget,
    framingBox,
    setAdvance: choreography.setAdvance,
    setArtAlphaToCoverage: choreography.setArtAlphaToCoverage,
  };
};
