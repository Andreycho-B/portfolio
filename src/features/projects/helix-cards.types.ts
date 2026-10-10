import type * as THREE from "three";

export type HelixCardDatum = {
  readonly index: string;
  readonly name: string;
  readonly discipline: string;
};

export type HelixConfig = {
  /** Cantidad de tarjetas en la hélice (3 proyectos reales repetidos honestamente) */
  readonly cardCount: number;
  /** Radio del cilindro de la hélice (≈ 1.8× ancho de tarjeta) */
  readonly radius: number;
  /** Paso angular entre tarjetas consecutivas, en radianes (Δθ ≈ 16°) */
  readonly angleStep: number;
  /** Desplazamiento axial lineal por tarjeta a lo largo del eje */
  readonly axialStep: number;
  /** Dimensiones del prisma: ancho, alto, grosor del acrílico */
  readonly cardWidth: number;
  readonly cardHeight: number;
  readonly cardThickness: number;
  /** Euler local fijo de cada tarjeta: pitch (recostada hacia atrás) y yaw hacia cámara */
  readonly pitch: number;
  readonly yaw: number;
  /** Inclinación global del grupo hélice: caída diagonal Z y elevación cenital X */
  readonly groupRoll: number;
  readonly groupElevation: number;
};

export type HelixSceneHandle = {
  readonly resize: (width: number, height: number) => void;
  readonly start: () => void;
  /** Suma `deltaPx` de gestos (rueda/arrastre) al avance objetivo de la hélice */
  readonly scrollBy: (deltaPx: number) => void;
  readonly dispose: () => void;
};

export type HelixWorldLayout = {
  readonly group: THREE.Group;
  /** Punto de enfoque nítido fijo en el mundo (las tarjetas fluyen a través de él) */
  readonly focusTarget: THREE.Vector3;
  /** Bbox canónico del arco visible (slots 1..8), invariante bajo el avance */
  readonly framingBox: THREE.Box3;
  /** Desplaza las tarjetas `advance` slots a lo largo de la hélice (ilimitado) */
  readonly setAdvance: (advance: number) => void;
};
