import { type Camera, LoadingManager, type Scene, type WebGLRenderer } from "three";

export type StudioLoadPhase = "assets" | "environment" | "geometry" | "shaders" | "ready";

export interface StudioLoadProgress {
  readonly progress: number;
  readonly phase: StudioLoadPhase;
  readonly label: string;
  readonly ready: boolean;
}

export interface StudioAssetTracker {
  readonly manager: LoadingManager;
  readonly trackTask: (weight: number, phase: StudioLoadPhase, label: string) => () => void;
  readonly enqueuePostLoad: (work: () => void) => void;
}

export interface StudioWarmupOptions {
  readonly renderer: WebGLRenderer;
  readonly scene: Scene;
  readonly camera: Camera;
  readonly prepareFrame: () => void;
  readonly prepareIntroFrame?: () => void;
  readonly isDisposed: () => boolean;
  readonly onReady?: () => void;
}

export interface StudioLoadingTracker extends StudioAssetTracker {
  readonly getProgress: () => StudioLoadProgress;
  readonly subscribe: (listener: (state: StudioLoadProgress) => void) => () => void;
  readonly whenReady: () => Promise<void>;
  readonly scheduleGpuWarmup: (options: StudioWarmupOptions) => void;
  readonly dispose: () => void;
}

interface PendingTask {
  readonly weight: number;
  readonly phase: StudioLoadPhase;
  readonly label: string;
}

const EXPECTED_MIN_ITEMS = 26;
const ASSET_STAGE_CAP = 0.92;
const nextFrame = (): Promise<void> => new Promise((r) => requestAnimationFrame(() => r()));

export const createStudioLoadingTracker = (): StudioLoadingTracker => {
  const manager = new LoadingManager();
  const listeners = new Set<(state: StudioLoadProgress) => void>();
  const activeTasks = new Map<number, PendingTask>();
  const postLoadQueue: (() => void)[] = [];
  const s = {
    postRaf: null as number | null,
    nextId: 1,
    totalW: 0,
    doneW: 0,
    loaded: 0,
    total: 0,
    closed: false,
    assetsDone: false,
    disposed: false,
  };
  let currentState: StudioLoadProgress = {
    progress: 0,
    phase: "assets",
    label: "preparando escena",
    ready: false,
  };
  let resolveAssets: (() => void) | null = null;
  let resolveReady: (() => void) | null = null;
  const assetsDonePromise = new Promise<void>((r) => {
    resolveAssets = r;
  });
  const readyPromise = new Promise<void>((r) => {
    resolveReady = r;
  });

  const emit = (progress: number, phase: StudioLoadPhase, label: string, ready = false): void => {
    currentState = { progress, phase, label, ready };
    if (!s.disposed) for (const listener of listeners) listener(currentState);
  };
  const drainPostLoad = (): void => {
    s.postRaf = null;
    if (s.disposed) return;
    postLoadQueue.shift()?.();
    if (postLoadQueue.length > 0 && !s.disposed) s.postRaf = requestAnimationFrame(drainPostLoad);
  };
  const enqueuePostLoad = (work: () => void): void => {
    if (s.disposed) return;
    postLoadQueue.push(work);
    if (s.postRaf === null) s.postRaf = requestAnimationFrame(drainPostLoad);
  };
  const pickActiveStage = (): { readonly phase: StudioLoadPhase; readonly label: string } => {
    let lead: PendingTask | null = null;
    for (const task of activeTasks.values()) if (!lead || task.weight > lead.weight) lead = task;
    return lead
      ? { phase: lead.phase, label: lead.label }
      : { phase: "shaders", label: "compilando shaders" };
  };
  const recomputeAssetProgress = (): void => {
    if (s.assetsDone || s.disposed) return;
    const taskRatio = s.totalW > 0 ? s.doneW / s.totalW : 0;
    const itemRatio =
      s.total > 0 ? Math.min(1, s.loaded / Math.max(s.total, EXPECTED_MIN_ITEMS)) : 0;
    const blended = (taskRatio * 0.68 + itemRatio * 0.32) * ASSET_STAGE_CAP;
    const { phase, label } = pickActiveStage();
    emit(Math.max(currentState.progress, Math.min(ASSET_STAGE_CAP, blended)), phase, label);
  };
  const maybeResolveAssets = (): void => {
    if (s.assetsDone || !s.closed || activeTasks.size > 0) return;
    s.assetsDone = true;
    emit(Math.max(currentState.progress, ASSET_STAGE_CAP), "shaders", "horneando sombras");
    resolveAssets?.();
  };
  manager.onProgress = (_url, loaded, total) => {
    [s.loaded, s.total] = [loaded, total];
    recomputeAssetProgress();
  };
  const trackTask = (weight: number, phase: StudioLoadPhase, label: string): (() => void) => {
    const id = s.nextId++;
    s.totalW += weight;
    activeTasks.set(id, { weight, phase, label });
    let settled = false;
    return () => {
      if (settled) return;
      settled = true;
      activeTasks.delete(id);
      s.doneW += weight;
      recomputeAssetProgress();
      maybeResolveAssets();
    };
  };
  queueMicrotask(() => {
    s.closed = true;
    recomputeAssetProgress();
    maybeResolveAssets();
  });
  const scheduleGpuWarmup = (options: StudioWarmupOptions): void => {
    const stopped = (): boolean => s.disposed || options.isDisposed();
    void assetsDonePromise.then(async () => {
      if (stopped()) return;
      emit(Math.max(currentState.progress, 0.94), "shaders", "compilando shaders");
      await nextFrame();
      if (stopped()) return;
      options.renderer.shadowMap.needsUpdate = true;
      try {
        await options.renderer.compileAsync(options.scene, options.camera);
      } catch (err) {
        console.warn("[StudioLoadingTracker] Shader precompile warning:", err);
      }
      if (stopped()) return;
      emit(0.97, "shaders", "horneando sombras");
      await nextFrame();
      if (stopped()) return;
      options.prepareFrame();
      await nextFrame();
      if (stopped()) return;
      options.renderer.render(options.scene, options.camera);
      if (options.prepareIntroFrame) {
        await nextFrame();
        if (stopped()) return;
        options.prepareIntroFrame();
        options.renderer.render(options.scene, options.camera);
      }
      await nextFrame();
      await nextFrame();
      if (stopped()) return;
      emit(1, "ready", "escena lista", true);
      resolveReady?.();
      options.onReady?.();
    });
  };
  const subscribe = (listener: (state: StudioLoadProgress) => void): (() => void) => {
    listeners.add(listener);
    listener(currentState);
    return () => listeners.delete(listener);
  };
  const dispose = (): void => {
    s.disposed = true;
    if (s.postRaf !== null) cancelAnimationFrame(s.postRaf);
    postLoadQueue.length = 0;
    listeners.clear();
    resolveReady?.();
  };
  return {
    manager,
    trackTask,
    enqueuePostLoad,
    getProgress: () => currentState,
    subscribe,
    whenReady: () => readyPromise,
    scheduleGpuWarmup,
    dispose,
  };
};
