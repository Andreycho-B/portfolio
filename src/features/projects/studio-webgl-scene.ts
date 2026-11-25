import { Color, Scene } from "three";
import { createMacintoshChassis } from "./macintosh-chassis";
import { STUDIO_WORLD, type StudioSceneHandle } from "./studio.types";
import { createStudioCameraRig } from "./studio-camera-rig";
import { createStudioCrtEditorial } from "./studio-crt-editorial";
import { createStudioCrtFbo } from "./studio-crt-fbo";
import { createStudioDeskProps } from "./studio-desk-props";
import {
  createStudioEnvironment,
  initStudioRenderer,
  resolveStudioPixelRatio,
} from "./studio-environment";
import { createStudioHotspots } from "./studio-hotspots";
import { createStudioLoadingTracker } from "./studio-loading-tracker";
import { createStudioPortalSnapshot } from "./studio-portal-snapshot";
import { createStudioPropHitProxies, type StudioFocusTarget } from "./studio-prop-focus";
import { createStudioPropProverbs } from "./studio-prop-proverbs";
import { createStudioScenePicker } from "./studio-scene-picker";
import { createStudioTable } from "./studio-table";
import { createStudioTvTitle } from "./studio-tv-title";

export const createStudioWebGLScene = (
  canvas: HTMLCanvasElement,
  onError?: (error: unknown) => void,
  onAssetLoaded?: () => void,
): StudioSceneHandle | null => {
  const gpu = initStudioRenderer(canvas, onError);
  if (!gpu) return null;
  const { renderer } = gpu;
  const scene = new Scene();
  scene.background = new Color(STUDIO_WORLD.backgroundHex);
  const cameraRig = createStudioCameraRig();
  const tracker = createStudioLoadingTracker();
  let isDisposed = false;
  const onAsset = (): void => {
    crtFbo.markDirty();
    onAssetLoaded?.();
  };
  const onShadow = (): void => {
    renderer.shadowMap.needsUpdate = true;
    onAsset();
  };
  const st = { power: 0, copied: false, sound: true, sky: false, portal: false, idx: 0 };
  let [focus, about] = [null as StudioFocusTarget | null, false];
  const environment = createStudioEnvironment(renderer, scene, cameraRig.camera, onShadow, tracker);
  const table = createStudioTable(scene, onShadow, tracker);
  const deskProps = createStudioDeskProps(scene, onShadow, tracker, () => {
    if (!st.portal || focus !== "tv") onAssetLoaded?.();
  });
  const crtFbo = createStudioCrtFbo(renderer, onAsset, tracker);
  const crtEditorial = createStudioCrtEditorial(renderer, onAsset, tracker);
  const portalSnapshot = createStudioPortalSnapshot(renderer);
  const chassis = createMacintoshChassis(
    scene,
    crtFbo.texture,
    crtEditorial.texture,
    portalSnapshot.texture,
    onShadow,
    onAssetLoaded,
    tracker,
  );
  tracker.scheduleGpuWarmup({
    renderer,
    scene,
    camera: cameraRig.camera,
    prepareFrame: () => {
      crtFbo.markDirty();
      chassis.setDrumUvScale(crtFbo.render(0, 0.5));
    },
    prepareIntroFrame: cameraRig.playIntroOrbit,
    isDisposed: () => isDisposed,
    onReady: onAssetLoaded,
  });
  const propProxies = createStudioPropHitProxies(scene);
  const hotspots = createStudioHotspots(scene);
  const propProverbs = createStudioPropProverbs(scene, onAssetLoaded);
  const tvTitle = createStudioTvTitle(scene, onAssetLoaded);
  const picker = createStudioScenePicker({
    camera: cameraRig.camera,
    crtGlassMesh: chassis.crtGlassMesh,
    tvButtons: chassis.tvButtons,
    lightSurfaceMeshes: chassis.lightSurfaceMeshes,
    darkSurfaceMeshes: chassis.darkSurfaceMeshes,
    woodenTableMesh: table.woodenTableMesh,
    propProxies,
    hotspots,
    nokia: deskProps.nokia,
  });
  return {
    scene,
    camera: cameraRig.camera,
    setPointerNormalized: (nx, ny) => {
      cameraRig.setPointerTarget(nx, ny);
      environment.updatePointerLight(nx, ny);
    },
    setGlassPointer: chassis.updatePointer,
    addOrbitDelta: cameraRig.addOrbitDelta,
    addDistanceScaleDelta: cameraRig.addDistanceScaleDelta,
    cycleShowcaseAngle: cameraRig.cycleShowcaseAngle,
    playIntroOrbit: cameraRig.playIntroOrbit,
    isIntroActive: cameraRig.isIntroActive,
    setFocusTarget: (target) => {
      focus = target;
      picker.setExcludedProp(target === "chair" ? "chair" : null);
      deskProps.nokia.setFocused(target === "phone");
      propProverbs.setFocusTarget(target);
      cameraRig.setFocusTarget(target);
    },
    setTvPortalState: (mode, cutout, wave, isAbout = false) => {
      const next = mode > 0.5 || cutout > 0.01;
      if (st.portal && !next) crtFbo.markDirty();
      [st.portal, about] = [next, next && isAbout];
      chassis.setPortalState(mode, cutout, wave);
    },
    capturePortalSnapshot: portalSnapshot.capture,
    getZoomProgress: cameraRig.getZoomProgress,
    isFocusSettled: cameraRig.isFocusSettled,
    pickScreenUv: picker.pickScreenUv,
    pickFocusProp: picker.pickFocusProp,
    pickTvButton: picker.pickTvButton,
    pressTvButtonVisual: chassis.tvButtons.triggerPress,
    setHoveredTvButton: chassis.setHoveredTvButton,
    setTvChannel: chassis.setTvChannel,
    getTvChannel: chassis.getTvChannel,
    pickNokiaButton: picker.pickNokiaButton,
    pressNokiaButton: deskProps.nokia.pressButton,
    steerNokiaSnake: deskProps.nokia.steerSnake,
    handleNokiaKey: deskProps.nokia.handleKey,
    setHoveredNokiaButton: deskProps.nokia.setHoveredButton,
    getNokiaMode: deskProps.nokia.getMode,
    setHoveredHotspot: hotspots.setHoveredTarget,
    setEmailCopied: (copied) => {
      st.copied = copied;
    },
    isPointerOverDarkSurface: (nx, ny) => picker.isPointerOverDarkSurface(nx, ny, st.power),
    isPointerOverPowerButton: picker.isPointerOverPowerButton,
    setPowerState: (power, dep) => {
      st.power = power;
      chassis.updatePower(power);
      chassis.setPowerButtonDepth(dep);
    },
    setDrumState: (a, v, i, idx, s) => {
      [st.idx, st.sound] = [idx, s];
      crtFbo.updateState(a, v, i);
      chassis.setTitleFade(Math.max(0.36, 1 - Math.min(1, Math.abs(v) * 0.25) * 0.64));
      crtEditorial.update(idx, s, st.copied);
    },
    update: (dt) => {
      const [moved, zoom] = [cameraRig.update(dt), cameraRig.getZoomProgress()];
      const { camera: c } = cameraRig;
      const { power, idx, sound } = st;
      const [cue, retro] = [cameraRig.isChairCueReady(), chassis.getTvChannel() !== "portfolio"];
      const h = hotspots.update(dt, c, zoom, power, focus, cue, retro);
      const n = deskProps.nokia.update(dt, sound, c, zoom);
      const p = propProverbs.update(dt, c, zoom);
      const t = tvTitle.update(dt, c, zoom, focus);
      const ch = chassis.update(dt, { camera: c, power, focus, idx, muted: !sound, about });
      st.sky = environment.updateSkyTime(dt, zoom, focus) || h || n || p || t || ch;
      if (moved) {
        const { x, y } = cameraRig.getSmoothedPointer();
        chassis.updatePointer(x, y);
      }
      return moved;
    },
    isSkyAnimated: () => st.sky,
    getLoadProgress: tracker.getProgress,
    onLoadProgress: tracker.subscribe,
    whenReady: tracker.whenReady,
    resize: (w, h) => {
      const [rw, rh] = [Math.max(1, w), Math.max(1, h)];
      picker.invalidateCache();
      renderer.setPixelRatio(resolveStudioPixelRatio(rw, rh));
      renderer.setSize(rw, rh, false);
      cameraRig.resize(rw, rh);
    },
    render: () => {
      const zoom = cameraRig.getZoomProgress();
      const isProp = focus !== null && focus !== "tv" && focus !== "chair";
      const hideFbo =
        st.portal || chassis.getTvChannel() !== "portfolio" || (isProp && zoom > 0.72);
      if (st.power > 0.001 && !hideFbo && cameraRig.camera.position.z > -0.1) {
        const hiRes = focus === "tv" && zoom > 0.25;
        const interval = hiRes ? 0 : cameraRig.isIntroActive() ? 50 : 33;
        chassis.setDrumUvScale(crtFbo.render(interval, hiRes ? 1 : 0.5));
      }
      renderer.render(scene, cameraRig.camera);
    },
    dispose: () => {
      isDisposed = true;
      gpu.unbindContextLost();
      const a = [tracker, propProxies, hotspots, propProverbs, tvTitle, chassis, crtEditorial];
      const b = [crtFbo, portalSnapshot, deskProps, table, environment, cameraRig, renderer];
      for (const p of [...a, ...b]) p.dispose();
    },
  };
};
