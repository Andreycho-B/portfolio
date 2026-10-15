import * as THREE from "three";
import type { HelixCardEntry, HelixConfig, HelixWorldLayout } from "./helix-cards.types";

const EXIT_EXTRA_SLOTS = 1.8;
const EXIT_FADE_WINDOW = 0.5;
const ENTRY_FADE_SLOTS = 1.2;

const VELOCITY_PITCH_GAIN = 0.012;
const VELOCITY_ROLL_GAIN = 0.008;
const MAX_VELOCITY_TILT = 0.06;

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));
const modulo = (value: number, period: number): number => ((value % period) + period) % period;

export const createHelixChoreography = (
  entries: readonly HelixCardEntry[],
  config: HelixConfig,
): Pick<HelixWorldLayout, "setAdvance" | "setArtAlphaToCoverage"> => {
  const period = config.cardCount;

  const setAdvance = (advance: number, velocity = 0, introProgress = 1): void => {
    const pitchOffset = Math.max(
      -MAX_VELOCITY_TILT,
      Math.min(MAX_VELOCITY_TILT, velocity * VELOCITY_PITCH_GAIN),
    );
    const rollOffset = Math.max(
      -MAX_VELOCITY_TILT,
      Math.min(MAX_VELOCITY_TILT, velocity * VELOCITY_ROLL_GAIN),
    );
    const dynamicPitch = config.pitch + pitchOffset;

    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      if (!entry) continue;

      // Desplazamiento ampliado: la tarjeta continúa hacia la cámara y pasa el borde de la pantalla
      const slot = modulo(i - advance + EXIT_EXTRA_SLOTS, period) - EXIT_EXTRA_SLOTS;
      const theta = slot * config.angleStep;

      // Despegue y separación física en la salida (evita amontonamiento y colisiones Z)
      const exitProgress = Math.max(0, 1.8 - slot);
      const exitLiftZ = exitProgress * exitProgress * 0.42;
      const exitTangentX = exitProgress * 0.35;
      const exitTangentY = -exitProgress * 0.75;
      const exitPitchEase = Math.min(
        THREE.MathUtils.degToRad(14),
        exitProgress * THREE.MathUtils.degToRad(7),
      );

      // Despliegue coreografiado de entrada (Unfurling en cascada 3D)
      let introRadial = 1;
      let introLiftZ = 0;
      let introScale = 1;
      let introPitchShift = 0;
      let introRollShift = 0;
      let introFade = 1;

      if (introProgress < 1) {
        const staggerStart = (i / config.cardCount) * 0.4;
        const localT = clamp01((introProgress - staggerStart) / 0.6);
        const u = localT - 1;
        const s = 0.42; // micro-rebote elástico orgánico
        const easeBack = localT < 1 ? 1 + u * u * ((s + 1) * u + s) : 1;

        introRadial = THREE.MathUtils.lerp(0.32, 1.0, easeBack);
        introLiftZ = (1 - localT) * -2.6;
        introScale = THREE.MathUtils.lerp(0.8, 1.0, easeBack);
        introPitchShift = (1 - localT) * THREE.MathUtils.degToRad(-16);
        introRollShift = (1 - localT) * THREE.MathUtils.degToRad(14);
        introFade = clamp01(localT / 0.28);
      }

      entry.shell.rotation.set(
        dynamicPitch + exitPitchEase + introPitchShift,
        config.yaw,
        rollOffset + introRollShift,
      );

      const targetX = config.radius * Math.cos(theta) + exitTangentX;
      const targetY = config.radius * Math.sin(theta) + exitTangentY;
      const targetZ = -slot * config.axialStep + exitLiftZ;

      if (introProgress < 1) {
        entry.shell.position.set(
          targetX * introRadial,
          targetY * introRadial,
          targetZ + introLiftZ,
        );
        entry.shell.scale.setScalar(introScale);
      } else {
        entry.shell.position.set(targetX, targetY, targetZ);
        entry.shell.scale.set(1, 1, 1);
      }

      // No se desvanece en pantalla: solo se funde cuando ya rebasó completamente el borde (-1.3 a -1.8)
      const exitFade = clamp01((slot + EXIT_EXTRA_SLOTS) / EXIT_FADE_WINDOW);
      const entryFade = clamp01((period - EXIT_EXTRA_SLOTS - slot) / ENTRY_FADE_SLOTS);
      const opacity = Math.min(exitFade, entryFade) * introFade;

      entry.shellMaterial.opacity = opacity;
      entry.artMaterial.opacity = opacity;
      entry.shell.visible = opacity > 0.001;
    }
  };

  // El tier degradado apaga el MSAA del compositor: sin muestras la cobertura
  // alfa degenera en recorte binario, así que el fundido pasa a blending real.
  const setArtAlphaToCoverage = (enabled: boolean): void => {
    for (const entry of entries) {
      entry.artMaterial.alphaToCoverage = enabled;
      entry.artMaterial.transparent = !enabled;
    }
  };

  return { setAdvance, setArtAlphaToCoverage };
};
