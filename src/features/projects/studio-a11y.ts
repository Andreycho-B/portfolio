import { PROJECTS } from "./project-data";
import type { StudioFocusTarget } from "./studio-prop-focus";
import type { TvChannelMode } from "./studio-tv-channels";

const FOCUS_ORDER: readonly (StudioFocusTarget | null)[] = [
  null,
  "chair",
  "tv",
  "computer",
  "clock",
  "bust",
  "thermos",
  "phone",
];

const FOCUS_LABELS: Readonly<Record<StudioFocusTarget, string>> = {
  tv: "Televisor CRT. Usa flechas arriba y abajo para proyectos, teclas 0 a 9 para canales, Enter para abrir o Escape para volver.",
  chair:
    "Sentado en la silla Monobloc. Pulsa 0 a 9 para cambiar canales del televisor o Escape para levantarte.",
  computer: "Computador retro blanco. Lo simple perdura, lo honesto trasciende.",
  clock: "Reloj analógico en hora local real.",
  bust: "Escultura de mármol.",
  thermos: "Termo de estudio.",
  phone: "Teléfono Nokia 3310. Usa flechas para jugar Snake o Escape para alejar.",
};

const CHANNEL_LABELS: Readonly<Record<TvChannelMode, string>> = {
  portfolio: "Canal 0: Portafolio",
  dvd: "Canal 5: DVD Video",
  smpte: "Canal 6: Carta de color SMPTE",
  static: "Canal 7: Sin señal",
  terminal: "Canal 8: Terminal retro",
  clock: "Canal 9: Reloj local en vivo",
};

const STUDIO_ARIA_LABEL =
  "Estudio 3D interactivo de Andrey Rondón. Usa flechas izquierda o derecha para recorrer silla, televisor, computador, reloj, busto, termo y Nokia; teclas 0 a 9 para canales; Escape para vista general.";

export const stepKeyboardFocusTarget = (
  current: StudioFocusTarget | null,
  dir: -1 | 1,
): StudioFocusTarget | null => {
  const idx = FOCUS_ORDER.indexOf(current);
  const next = (idx + dir + FOCUS_ORDER.length) % FOCUS_ORDER.length;
  return FOCUS_ORDER[next] ?? null;
};

export const tryStepStudioFocusKey = (
  event: KeyboardEvent,
  focus: StudioFocusTarget | null,
  setFocus: (target: StudioFocusTarget | null) => void,
): boolean => {
  if (focus === "tv" || focus === "phone" || event.altKey || event.ctrlKey || event.metaKey) {
    return false;
  }
  if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return false;
  event.preventDefault();
  setFocus(stepKeyboardFocusTarget(focus, event.key === "ArrowRight" ? 1 : -1));
  return true;
};

export interface StudioA11yHandle {
  readonly sync: (
    focus: StudioFocusTarget | null,
    poweredOn: boolean,
    channel: TvChannelMode,
    projectIndex: number,
    portalUrl: string | null,
  ) => void;
  readonly dispose: () => void;
}

export const createStudioA11y = (container: HTMLElement): StudioA11yHandle => {
  const liveEl = document.createElement("div");
  liveEl.className = "sr-only";
  liveEl.setAttribute("role", "status");
  liveEl.setAttribute("aria-live", "polite");
  liveEl.setAttribute("aria-atomic", "true");
  liveEl.setAttribute("data-studio-a11y-live", "");
  container.appendChild(liveEl);

  const viewport = container.querySelector<HTMLElement>("[data-drum-viewport]");
  const prevLabel = viewport?.getAttribute("aria-label") ?? null;
  viewport?.setAttribute("aria-label", STUDIO_ARIA_LABEL);

  const prev = {
    initialized: false,
    focus: null as StudioFocusTarget | null,
    poweredOn: false,
    channel: "portfolio" as TvChannelMode,
    projectIndex: -1,
    portalUrl: null as string | null,
    lastMsg: "",
  };

  const announce = (msg: string): void => {
    if (!msg || msg === prev.lastMsg) return;
    prev.lastMsg = msg;
    liveEl.textContent = msg;
  };

  const sync = (
    focus: StudioFocusTarget | null,
    poweredOn: boolean,
    channel: TvChannelMode,
    projectIndex: number,
    portalUrl: string | null,
  ): void => {
    if (!prev.initialized) {
      prev.initialized = true;
      Object.assign(prev, { focus, poweredOn, channel, projectIndex, portalUrl });
      return;
    }
    if (focus !== prev.focus) {
      announce(focus === null ? "Vista general del estudio 3D." : FOCUS_LABELS[focus]);
    } else if (poweredOn !== prev.poweredOn) {
      announce(poweredOn ? "Televisor encendido." : "Televisor apagado.");
    } else if (portalUrl !== prev.portalUrl) {
      if (portalUrl?.startsWith("/sobre-mi")) announce("Sobre mí abierto en el televisor.");
      else if (portalUrl) announce("Caso de estudio abierto en el televisor.");
      else announce("Volviendo al carrete de proyectos.");
    } else if (channel !== prev.channel) {
      announce(CHANNEL_LABELS[channel]);
    } else if (poweredOn && channel === "portfolio" && projectIndex !== prev.projectIndex) {
      const proj = PROJECTS[projectIndex];
      if (proj && focus === "tv") announce(`Proyecto seleccionado: ${proj.title} (${proj.year}).`);
    }
    Object.assign(prev, { focus, poweredOn, channel, projectIndex, portalUrl });
  };

  return {
    sync,
    dispose: () => {
      if (viewport && prevLabel !== null) viewport.setAttribute("aria-label", prevLabel);
      liveEl.remove();
    },
  };
};
