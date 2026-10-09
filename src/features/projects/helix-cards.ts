import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { createCardFaceTexture } from "./card-face-texture";
import type { HelixCardDatum, HelixConfig, HelixWorldLayout } from "./helix-cards.types";
import { createAcrylicMaterial, createArtMaterial } from "./helix-materials";

// Margen de acrílico visible alrededor del núcleo gráfico (mat perimetral)
const ART_INSET = 0.075;
// Bisel suficiente para atrapar el destello especular en el canto
const BEVEL_RADIUS = 0.03;
const BEVEL_SEGMENTS = 4;

// Ventana de salida más allá del frente: la tarjeta crece al pasar la cámara
// mientras se funde; la entrada al extremo lejano se funde dentro del desenfoque.
// Ambos extremos alcanzan opacidad 0 exactamente donde ocurre el teletransporte
// de la envoltura, de modo que el bucle es invisible en ambas direcciones.
const EXIT_WINDOW_SLOTS = 1.0;
const ENTRY_FADE_SLOTS = 1.2;

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));
const modulo = (value: number, period: number): number => ((value % period) + period) % period;

type HelixCardEntry = {
  readonly shell: THREE.Mesh;
  readonly shellMaterial: THREE.MeshPhysicalMaterial;
  readonly artMaterial: THREE.MeshBasicMaterial;
};

export const createHelixWorld = async (
  config: HelixConfig,
  cardData: readonly HelixCardDatum[],
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
  const artTextures = await Promise.all(cardData.map((card) => createCardFaceTexture(card)));

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

  const period = config.cardCount + EXIT_WINDOW_SLOTS;

  const setAdvance = (advance: number): void => {
    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      if (!entry) continue;

      const slot = modulo(i - advance + EXIT_WINDOW_SLOTS, period) - EXIT_WINDOW_SLOTS;
      const theta = slot * config.angleStep;
      entry.shell.position.set(
        config.radius * Math.cos(theta),
        config.radius * Math.sin(theta),
        -slot * config.axialStep,
      );

      const exitFade = slot >= 0 ? 1 : clamp01(1 + slot / EXIT_WINDOW_SLOTS);
      const entryFade = clamp01((config.cardCount - slot) / ENTRY_FADE_SLOTS);
      const opacity = Math.min(exitFade, entryFade);

      entry.shellMaterial.opacity = opacity;
      entry.artMaterial.opacity = opacity;
    }
  };
  setAdvance(0);

  group.rotation.z = config.groupRoll;
  group.rotation.x = config.groupElevation;
  group.updateMatrixWorld(true);

  // Plano de enfoque fijo en el mundo: las tarjetas fluyen a través de él
  const focusCard = entries[Math.floor(config.cardCount * 0.22)]?.shell ?? entries[0]?.shell;
  if (!focusCard) {
    throw new Error("La hélice no contiene tarjetas para calcular el foco del DoF");
  }
  const focusTarget = new THREE.Vector3();
  focusCard.getWorldPosition(focusTarget);

  return { group, focusTarget, setAdvance };
};
