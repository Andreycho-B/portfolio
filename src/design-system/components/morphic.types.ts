/**
 * Contrato de tipos para la animación de texto mórfico y transiciones SVG.
 * Define la estructura de nodos requerida para los filtros cromáticos y revelación.
 */
export interface MorphicNodes {
  readonly element: HTMLElement;
  readonly blurNode: SVGFEGaussianBlurElement;
  readonly matrixNode: SVGFEColorMatrixElement;
  readonly cyanTopNode: SVGFEOffsetElement | null;
  readonly cyanBottomNode: SVGFEOffsetElement | null;
  readonly isChromatic: boolean;
  readonly shiftX: number;
  readonly shiftY: number;
  readonly delay: number;
  readonly duration: number;
  readonly exitDelay: number | null;
  readonly loop: boolean;
  readonly filterId: string;
  readonly phrases: readonly string[];
  readonly mutateWord?: string;
  readonly textColorNode: SVGFEColorMatrixElement | null;
}
