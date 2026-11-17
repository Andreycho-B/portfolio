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
  readonly phraseRoles: readonly string[];
  readonly mutateWord?: string;
  readonly textColorNode: SVGFEColorMatrixElement | null;
  readonly cyanLayerNode: SVGFEColorMatrixElement | null;
}

export const GOOEY = { initSlope: 24, initOffset: -11, targetSlope: 1, targetOffset: 0 } as const;

const parseNum = (val: string | undefined, def: number): number => {
  const n = Number(val);
  return Number.isFinite(n) && val?.trim() !== "" ? n : def;
};

const parseStringArray = (raw: string | undefined, label: string): string[] | null => {
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.every((s) => typeof s === "string")) {
      return parsed;
    }
  } catch {
    console.warn(`[MorphicText] JSON de ${label} inválido`);
  }
  return null;
};

export const resolveMorphicNodes = (el: HTMLElement): MorphicNodes | null => {
  const blurNode = document.getElementById(el.dataset.blurNode ?? "");
  const matrixNode = document.getElementById(el.dataset.matrixNode ?? "");
  if (
    !(blurNode instanceof SVGFEGaussianBlurElement && matrixNode instanceof SVGFEColorMatrixElement)
  ) {
    return null;
  }

  const isChromatic = el.dataset.chromatic === "true";
  const getNode = <T extends Element>(id?: string): T | null =>
    id ? (document.getElementById(id) as T | null) : null;

  const filterId = (el.dataset.blurNode ?? "").replace("-blur", "");
  const exitDelay = el.dataset.exitDelay !== undefined ? parseNum(el.dataset.exitDelay, 1.5) : null;
  const parsedPhrases = parseStringArray(el.dataset.phrases, "data-phrases");
  const phrases =
    parsedPhrases && parsedPhrases.length > 0 ? parsedPhrases : [el.textContent?.trim() ?? ""];
  const phraseRoles = parseStringArray(el.dataset.phraseRoles, "data-phrase-roles") ?? [];

  return {
    element: el,
    blurNode,
    matrixNode,
    cyanTopNode: isChromatic ? getNode<SVGFEOffsetElement>(el.dataset.cyanTop) : null,
    cyanBottomNode: isChromatic ? getNode<SVGFEOffsetElement>(el.dataset.cyanBottom) : null,
    isChromatic,
    shiftX: parseNum(el.dataset.shiftX, 3.5),
    shiftY: parseNum(el.dataset.shiftY, 1.5),
    delay: parseNum(el.dataset.delay, 0),
    duration: parseNum(el.dataset.duration, 1.9),
    exitDelay,
    loop: el.dataset.loop === "true",
    filterId,
    phrases,
    phraseRoles,
    mutateWord: el.dataset.mutateWord,
    textColorNode: getNode<SVGFEColorMatrixElement>(el.dataset.textColor),
    cyanLayerNode: getNode<SVGFEColorMatrixElement>(el.dataset.cyanLayer),
  };
};
