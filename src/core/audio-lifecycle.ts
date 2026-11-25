let pendingSuspendTimer: number | null = null;

export const cancelPendingSuspend = (): void => {
  if (pendingSuspendTimer !== null) {
    window.clearTimeout(pendingSuspendTimer);
    pendingSuspendTimer = null;
  }
};

const holdGainAtTime = (param: AudioParam, now: number): void => {
  if (typeof param.cancelAndHoldAtTime === "function") {
    param.cancelAndHoldAtTime(now);
  } else {
    param.cancelScheduledValues(now);
    param.setValueAtTime(param.value, now);
  }
};

export const rampGainTo = (
  ctx: AudioContext | null,
  gainNode: GainNode | null,
  target: number,
  durationSec: number,
): void => {
  if (!ctx || !gainNode) return;
  const now = ctx.currentTime;
  const safeTarget = Math.max(0, Math.min(1, target));
  holdGainAtTime(gainNode.gain, now);
  gainNode.gain.linearRampToValueAtTime(safeTarget, now + durationSec);
};

export const tryResumeAudioContext = async (
  ctx: AudioContext,
  timeoutMs = 120,
): Promise<boolean> => {
  const isRunning = (): boolean => ctx.state === "running";
  if (isRunning()) return true;
  const resumed = ctx.resume().then(
    () => true,
    () => false,
  );
  const settled = await Promise.race([
    resumed,
    new Promise<boolean>((resolve) => window.setTimeout(() => resolve(false), timeoutMs)),
  ]);
  return settled && isRunning();
};

export const persistMutePreference = (muted: boolean): void => {
  try {
    localStorage.setItem("portfolio_sound_enabled", muted ? "false" : "true");
  } catch (err) {
    console.warn("[AudioEngine] Failed to persist mute preference:", err);
  }
};

export const createMasterGainChain = (ctx: AudioContext): GainNode => {
  const now = ctx.currentTime;
  const dcBlocker = ctx.createBiquadFilter();
  dcBlocker.type = "highpass";
  dcBlocker.frequency.setValueAtTime(42, now);
  dcBlocker.Q.setValueAtTime(Math.SQRT1_2, now);

  const airSoftener = ctx.createBiquadFilter();
  airSoftener.type = "lowpass";
  airSoftener.frequency.setValueAtTime(15500, now);
  airSoftener.Q.setValueAtTime(Math.SQRT1_2, now);

  const limiter = ctx.createDynamicsCompressor();
  limiter.threshold.setValueAtTime(-3.0, now);
  limiter.knee.setValueAtTime(3, now);
  limiter.ratio.setValueAtTime(18, now);
  limiter.attack.setValueAtTime(0.002, now);
  limiter.release.setValueAtTime(0.08, now);

  const masterGain = ctx.createGain();
  masterGain.gain.setValueAtTime(0, now);
  masterGain.connect(dcBlocker);
  dcBlocker.connect(airSoftener);
  airSoftener.connect(limiter);
  limiter.connect(ctx.destination);
  return masterGain;
};

export const gracefulMute = (
  audioContext: AudioContext | null,
  masterGain: GainNode | null,
  durationSec = 0.045,
): void => {
  if (!audioContext || !masterGain) return;
  cancelPendingSuspend();

  const now = audioContext.currentTime;
  holdGainAtTime(masterGain.gain, now);
  masterGain.gain.linearRampToValueAtTime(0, now + durationSec);

  pendingSuspendTimer = window.setTimeout(
    () => {
      pendingSuspendTimer = null;
      if (audioContext.state === "running") {
        void audioContext.suspend().catch((err: unknown) => {
          console.warn("[AudioLifecycle] Suspend failed:", err);
        });
      }
    },
    Math.floor(durationSec * 1000) + 25,
  );
};

export const bindTeardownAndVisibility = (
  onTeardownRamp: () => void,
  onVisibilityChange: () => void,
): (() => void) => {
  if (typeof window === "undefined") return () => {};

  for (const evt of ["pagehide", "beforeunload"] as const) {
    window.addEventListener(evt, onTeardownRamp, { capture: true });
  }
  document.addEventListener("visibilitychange", onVisibilityChange);

  return () => {
    cancelPendingSuspend();
    for (const evt of ["pagehide", "beforeunload"] as const) {
      window.removeEventListener(evt, onTeardownRamp, { capture: true });
    }
    document.removeEventListener("visibilitychange", onVisibilityChange);
  };
};
