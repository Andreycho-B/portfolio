import {
  type Camera,
  CanvasTexture,
  ClampToEdgeWrapping,
  DoubleSide,
  Group,
  LinearFilter,
  MathUtils,
  Mesh,
  MeshBasicMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  type Scene,
  SRGBColorSpace,
  Vector3,
} from "three";
import type { StudioFocusTarget } from "./studio-prop-focus";
import {
  PROP_PROVERB_GROUPS,
  type PropProverbEntrySpec,
  type PropProverbGroupSpec,
} from "./studio-prop-proverb-specs";

const FONT_FAMILY = '"Author", system-ui, -apple-system, sans-serif';
const [FONT_WEIGHT, TEX_W, BASE_TEX_H, MULTI_LINE_STEP] = [600, 1024, 240, 68];

const resolveTexHeight = (lineCount: number): number =>
  lineCount <= 2 ? BASE_TEX_H : 64 + lineCount * MULTI_LINE_STEP;

interface StudioPropProverbsHandle {
  readonly setFocusTarget: (target: StudioFocusTarget | null) => void;
  readonly update: (dtSeconds: number, camera: Camera, zoomProgress: number) => boolean;
  readonly dispose: () => void;
}

const paintProverb = (
  ctx: CanvasRenderingContext2D,
  entry: PropProverbEntrySpec,
  group: PropProverbGroupSpec,
  texH: number,
  portrait: boolean,
): void => {
  ctx.clearRect(0, 0, TEX_W, texH);
  ctx.save();
  ctx.fillStyle = "#ffffff";
  ctx.shadowColor = "rgba(14, 18, 30, 0.58)";
  ctx.shadowBlur = 16;
  ctx.shadowOffsetY = 2;
  ctx.textBaseline = "middle";
  const pad = 28;
  const maxWidth = TEX_W - pad * 2;
  const align: CanvasTextAlign = portrait ? "center" : entry.align;
  ctx.textAlign = align;
  const drawX = align === "center" ? TEX_W * 0.5 : align === "right" ? TEX_W - pad : pad;
  const baseSize = portrait ? group.mobileFontPx : group.desktopFontPx;
  const lines = portrait && group.joinOnMobile ? [entry.lines.join(" ")] : entry.lines;
  ctx.font = `${FONT_WEIGHT} ${baseSize}px ${FONT_FAMILY}`;
  const widest = Math.max(...lines.map((line) => ctx.measureText(line).width));
  if (widest > maxWidth) {
    ctx.font = `${FONT_WEIGHT} ${Math.floor((baseSize * maxWidth) / widest)}px ${FONT_FAMILY}`;
  }
  if (lines.length === 1) ctx.fillText(lines[0] ?? "", drawX, texH * 0.52);
  else if (lines.length === 2) {
    ctx.fillText(lines[0] ?? "", drawX, texH * 0.34);
    ctx.fillText(lines[1] ?? "", drawX, texH * 0.68);
  } else {
    const startY = (texH - (lines.length - 1) * MULTI_LINE_STEP) * 0.5;
    for (let i = 0; i < lines.length; i += 1) {
      ctx.fillText(lines[i] ?? "", drawX, startY + i * MULTI_LINE_STEP);
    }
  }
  ctx.restore();
};

export const createStudioPropProverbs = (
  targetScene: Scene,
  onReady?: () => void,
): StudioPropProverbsHandle => {
  const prefersReduced =
    typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const groups = PROP_PROVERB_GROUPS.map((spec) => {
    const anchor = new Vector3(spec.anchor[0], spec.anchor[1], spec.anchor[2]);
    const forward = new Vector3(Math.sin(spec.yawRad), 0, Math.cos(spec.yawRad));
    const root = new Group();
    root.name = spec.name;
    root.position.copy(anchor);
    root.rotation.y = spec.yawRad;
    root.updateMatrix();
    root.matrixAutoUpdate = root.visible = false;
    const items = spec.entries.map((entry) => {
      const texH = resolveTexHeight(entry.lines.length);
      const canvas = document.createElement("canvas");
      [canvas.width, canvas.height] = [TEX_W, texH];
      const texture = new CanvasTexture(canvas);
      texture.colorSpace = SRGBColorSpace;
      texture.wrapS = texture.wrapT = ClampToEdgeWrapping;
      texture.generateMipmaps = false;
      texture.minFilter = texture.magFilter = LinearFilter;
      texture.anisotropy = 2;
      const geometry = new PlaneGeometry(spec.planeWidth, (spec.planeWidth * texH) / TEX_W);
      const material = new MeshBasicMaterial({
        map: texture,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        depthTest: false,
        toneMapped: false,
        side: DoubleSide,
      });
      const mesh = new Mesh(geometry, material);
      mesh.position.set(entry.desktopPos[0], entry.desktopPos[1], entry.desktopPos[2]);
      mesh.updateMatrix();
      mesh.matrixAutoUpdate = false;
      mesh.renderOrder = 14;
      root.add(mesh);
      return { entry, texH, ctx: canvas.getContext("2d"), geometry, texture, material, mesh };
    });
    targetScene.add(root);
    return { spec, anchor, forward, root, items, opacity: 0 };
  });

  let activeFocus: StudioFocusTarget | null = null;
  let isPortrait = false;
  let isDisposed = false;
  const toCam = new Vector3();

  const repaintAll = (portrait: boolean): void => {
    for (const group of groups) {
      for (const item of group.items) {
        if (!item.ctx) continue;
        paintProverb(item.ctx, item.entry, group.spec, item.texH, portrait);
        item.texture.needsUpdate = true;
      }
    }
  };
  repaintAll(false);

  if (typeof document !== "undefined" && document.fonts) {
    void document.fonts
      .load(`${FONT_WEIGHT} 66px "Author"`)
      .then(() => {
        if (isDisposed) return;
        repaintAll(isPortrait);
        onReady?.();
      })
      .catch((err: unknown) => console.warn("[StudioPropProverbs] Font load failed:", err));
  }

  const update = (dtSeconds: number, camera: Camera, zoomProgress: number): boolean => {
    const portrait = camera instanceof PerspectiveCamera && camera.aspect < 0.92;
    if (portrait !== isPortrait) {
      isPortrait = portrait;
      for (const group of groups) {
        for (const item of group.items) {
          const p = portrait ? item.entry.mobilePos : item.entry.desktopPos;
          item.mesh.position.set(p[0], p[1], p[2]);
          item.mesh.updateMatrix();
        }
      }
      repaintAll(portrait);
    }

    const dt = Math.min(Math.max(dtSeconds, 0), 0.05);
    let animating = false;
    for (const group of groups) {
      const focused = activeFocus === group.spec.propId;
      if (!focused && group.opacity <= 0.004) continue;
      toCam.subVectors(camera.position, group.anchor).normalize();
      const facing = MathUtils.smoothstep(toCam.dot(group.forward), 0.15, 0.52);
      const target = (focused ? MathUtils.smoothstep(zoomProgress, 0.45, 0.9) : 0) * facing;
      if (prefersReduced) group.opacity = target;
      else {
        const rate = target > group.opacity ? 5.5 : 10.5;
        group.opacity += (target - group.opacity) * (1 - Math.exp(-rate * dt));
        if (Math.abs(target - group.opacity) < 0.004) group.opacity = target;
      }
      group.root.visible = group.opacity > 0.004;
      if (group.root.visible) for (const item of group.items) item.material.opacity = group.opacity;
      if (Math.abs(target - group.opacity) > 0.004) animating = true;
    }
    return animating;
  };

  return {
    setFocusTarget: (target) => {
      activeFocus = target;
    },
    update,
    dispose: () => {
      isDisposed = true;
      for (const group of groups) {
        targetScene.remove(group.root);
        for (const item of group.items) {
          for (const r of [item.geometry, item.material, item.texture]) r.dispose();
        }
      }
    },
  };
};
