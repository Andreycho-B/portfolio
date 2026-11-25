import {
  CanvasTexture,
  LatheGeometry,
  LinearFilter,
  LinearMipmapLinearFilter,
  Mesh,
  MeshStandardMaterial,
  NoColorSpace,
  RepeatWrapping,
  SRGBColorSpace,
  Vector2,
} from "three";

interface StudioQuartzPlatformHandle {
  readonly mesh: Mesh;
  readonly dispose: () => void;
}

const TEX_SIZE = 512;
const PLATFORM_RADIUS = 9.6;
const PLATFORM_HEIGHT = 0.62;
const PLATFORM_BEVEL = 0.085;
const BEVEL_STEPS = 4;
const RADIAL_SEGMENTS = 64;
const PLATFORM_X = -0.35;
const PLATFORM_Z = 0.9;

const createSeededRandom = (seed: number): (() => number) => {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let mixed = Math.imul(state ^ (state >>> 15), 1 | state);
    mixed = (mixed + Math.imul(mixed ^ (mixed >>> 7), 61 | mixed)) ^ mixed;
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
  };
};

const drawQuartzVeins = (
  ctx: CanvasRenderingContext2D,
  nextRand: () => number,
  strokeStyle: string,
  count: number,
  widthMin: number,
  widthMax: number,
  blurPx: number,
): void => {
  ctx.save();
  ctx.filter = `blur(${blurPx}px)`;
  ctx.strokeStyle = strokeStyle;
  ctx.lineCap = "round";
  ctx.lineWidth = (widthMin + widthMax) * 0.5;
  ctx.beginPath();
  for (let i = 0; i < count; i += 1) {
    let x = nextRand() * TEX_SIZE;
    let y = nextRand() * TEX_SIZE;
    const angleBase = 0.35 + (nextRand() - 0.5) * 0.6;
    ctx.moveTo(x, y);
    for (let seg = 0; seg < 6; seg += 1) {
      const step = 45 + nextRand() * 55;
      const a = angleBase + (nextRand() - 0.5) * 0.9;
      const cx = x + Math.cos(a) * step * 0.5;
      const cy = y + Math.sin(a) * step * 0.5;
      x += Math.cos(a) * step;
      y += Math.sin(a) * step;
      ctx.quadraticCurveTo(cx, cy, x, y);
    }
  }
  ctx.stroke();
  ctx.restore();
};

const buildQuartzTextures = (): {
  readonly albedo: CanvasTexture;
  readonly roughness: CanvasTexture;
} => {
  const nextRand = createSeededRandom(20261121);
  const makeCanvas = (): HTMLCanvasElement => {
    const c = document.createElement("canvas");
    c.width = c.height = TEX_SIZE;
    return c;
  };
  const albedoCanvas = makeCanvas();
  const roughCanvas = makeCanvas();
  const aCtx = albedoCanvas.getContext("2d");
  const rCtx = roughCanvas.getContext("2d");

  if (aCtx && rCtx) {
    aCtx.fillStyle = "#f4f2ee";
    aCtx.fillRect(0, 0, TEX_SIZE, TEX_SIZE);
    rCtx.fillStyle = "rgb(86, 86, 86)";
    rCtx.fillRect(0, 0, TEX_SIZE, TEX_SIZE);
    for (let i = 0; i < 36; i += 1) {
      const cx = nextRand() * TEX_SIZE;
      const cy = nextRand() * TEX_SIZE;
      const rad = 48 + nextRand() * 95;
      const warm = nextRand() > 0.5;
      const grad = aCtx.createRadialGradient(cx, cy, 2, cx, cy, rad);
      grad.addColorStop(0, warm ? "rgba(235, 231, 224, 0.24)" : "rgba(226, 229, 234, 0.2)");
      grad.addColorStop(1, "rgba(244, 242, 238, 0)");
      aCtx.fillStyle = grad;
      aCtx.fillRect(cx - rad, cy - rad, rad * 2, rad * 2);
      const rv = warm ? 104 : 74;
      const rGrad = rCtx.createRadialGradient(cx, cy, 2, cx, cy, rad);
      rGrad.addColorStop(0, `rgba(${rv}, ${rv}, ${rv}, 0.28)`);
      rGrad.addColorStop(1, "rgba(86, 86, 86, 0)");
      rCtx.fillStyle = rGrad;
      rCtx.fillRect(cx - rad, cy - rad, rad * 2, rad * 2);
    }
    drawQuartzVeins(aCtx, nextRand, "rgba(174, 170, 165, 0.15)", 14, 3.5, 8, 5);
    drawQuartzVeins(aCtx, nextRand, "rgba(150, 147, 144, 0.13)", 20, 0.9, 2.0, 1.2);
    drawQuartzVeins(rCtx, nextRand, "rgba(128, 128, 128, 0.22)", 16, 2, 5.5, 3);
    for (let i = 0; i < 520; i += 1) {
      const fx = nextRand() * TEX_SIZE;
      const fy = nextRand() * TEX_SIZE;
      const size = 1 + nextRand() * 1.4;
      const bright = nextRand() > 0.42;
      aCtx.fillStyle = bright ? "rgba(255, 255, 255, 0.45)" : "rgba(195, 192, 187, 0.24)";
      aCtx.fillRect(fx, fy, size, size);
      rCtx.fillStyle = bright ? "rgba(56, 56, 56, 0.35)" : "rgba(116, 116, 116, 0.28)";
      rCtx.fillRect(fx, fy, size, size);
    }
  }
  const albedo = new CanvasTexture(albedoCanvas);
  const roughness = new CanvasTexture(roughCanvas);
  albedo.colorSpace = SRGBColorSpace;
  roughness.colorSpace = NoColorSpace;
  for (const tex of [albedo, roughness]) {
    tex.wrapS = tex.wrapT = RepeatWrapping;
    tex.repeat.set(2.4, 2.4);
    tex.minFilter = LinearMipmapLinearFilter;
    tex.magFilter = LinearFilter;
    tex.anisotropy = 4;
    tex.needsUpdate = true;
  }
  return { albedo, roughness };
};

const createCircularQuartzGeometry = (): LatheGeometry => {
  const [r, h, b] = [PLATFORM_RADIUS, PLATFORM_HEIGHT, PLATFORM_BEVEL];
  const profile: Vector2[] = [new Vector2(0, -h), new Vector2(r - b - 0.1, -h)];
  for (let i = 0; i <= BEVEL_STEPS; i += 1) {
    const a = (i / BEVEL_STEPS) * (Math.PI * 0.5);
    profile.push(new Vector2(r - b + Math.sin(a) * b, -h + b - Math.cos(a) * b));
  }
  for (let i = 0; i <= BEVEL_STEPS; i += 1) {
    const a = (i / BEVEL_STEPS) * (Math.PI * 0.5);
    profile.push(new Vector2(r - b + Math.cos(a) * b, -b + Math.sin(a) * b));
  }
  profile.push(new Vector2(r - b - 0.1, 0), new Vector2(0, 0));
  const geometry = new LatheGeometry(profile, RADIAL_SEGMENTS);
  geometry.computeVertexNormals();
  const pos = geometry.getAttribute("position");
  const norm = geometry.getAttribute("normal");
  const uv = geometry.getAttribute("uv");
  const invSpan = 1 / (r * 1.45);
  for (let i = 0; i < pos.count; i += 1) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    if (Math.abs(norm.getY(i)) > 0.45) uv.setXY(i, x * invSpan + 0.5, z * invSpan + 0.5);
    else uv.setXY(i, (Math.atan2(z, x) / (Math.PI * 2) + 0.5) * 6, pos.getY(i) / h + 1);
  }
  uv.needsUpdate = true;
  return geometry;
};

export const createStudioQuartzPlatform = (floorY: number): StudioQuartzPlatformHandle => {
  const geometry = createCircularQuartzGeometry();
  const { albedo, roughness } = buildQuartzTextures();
  const material = new MeshStandardMaterial({
    color: 0xffffff,
    map: albedo,
    roughnessMap: roughness,
    roughness: 1.0,
    metalness: 0.02,
    envMapIntensity: 0.75,
  });
  const mesh = new Mesh(geometry, material);
  mesh.name = "whiteQuartzPlatform";
  mesh.position.set(PLATFORM_X, floorY, PLATFORM_Z);
  mesh.castShadow = false;
  mesh.receiveShadow = true;
  mesh.updateMatrix();
  mesh.updateMatrixWorld(true);
  mesh.matrixAutoUpdate = false;
  return {
    mesh,
    dispose: () => {
      for (const res of [geometry, material, albedo, roughness]) res.dispose();
    },
  };
};
