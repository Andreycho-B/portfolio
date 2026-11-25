import {
  BufferAttribute,
  BufferGeometry,
  type Camera,
  MathUtils,
  NormalBlending,
  Points,
  Quaternion,
  type Scene,
  ShaderMaterial,
  Vector3,
} from "three";
import type { StudioFocusTarget } from "./studio-prop-focus";

const MOTE_COUNT = 78;
const SUN_DIR = new Vector3(-11.5, 8.5, 20.5).normalize();

const DUST_VS = `uniform float uTime,uPixelRatio,uReduced,uCursorEnergy;
uniform vec3 uSunDir,uRayOrigin,uRayDir,uCursorVel;
attribute vec4 aSeed;
varying float vAlpha,vSun,vGlint;
void main(){
  float ph=aSeed.x,sz=aSeed.y,spd=aSeed.z,warm=aSeed.w,t=uTime*(1.0-uReduced);
  vec3 pos=position;
  pos.x+=sin(t*0.36*spd+ph)*0.24+cos(t*0.19*spd+ph*1.7)*0.11;
  pos.y+=mod(t*0.055*spd+ph*0.4,1.6)-0.8+sin(t*0.29*spd+ph*2.1)*0.12;
  pos.z+=cos(t*0.31*spd+ph*1.3)*0.22;
  vec3 toP=pos-uRayOrigin;
  vec3 diff=pos-(uRayOrigin+uRayDir*max(0.0,dot(toP,uRayDir)));
  float distRay=length(diff),prox=smoothstep(1.9,0.0,distRay)*(1.0-uReduced);
  vec3 pushDir=distRay>0.001?diff/distRay:vec3(0.0,1.0,0.0);
  pos+=pushDir*prox*(0.24+uCursorEnergy*0.42)+uCursorVel*prox*0.58;
  vec4 mv=modelViewMatrix*vec4(pos,1.0);
  float camDist=max(0.4,-mv.z);
  float scatter=pow(max(0.0,dot(normalize(pos-cameraPosition),-uSunDir)),2.0);
  vSun=clamp(warm*0.45+scatter*0.65+smoothstep(-4.6,1.2,pos.y)*0.25,0.0,1.0);
  vGlint=prox*(0.35+uCursorEnergy*0.65);
  float tw=0.68+0.32*sin(t*(1.4+spd*0.9)+ph*3.1);
  vAlpha=tw*smoothstep(1.1,2.6,camDist)*(0.26+vSun*0.34+vGlint*0.42);
  gl_PointSize=clamp(sz*(42.0/camDist)*uPixelRatio*(1.0+vGlint*0.52),4.0,22.0);
  gl_Position=projectionMatrix*mv;
}`;

const DUST_FS = `uniform float uOpacity;
varying float vAlpha,vSun,vGlint;
void main(){
  float r=length(gl_PointCoord*2.0-1.0);
  if(r>1.0)discard;
  float soft=exp(-r*r*4.8),halo=exp(-r*r*1.85)*0.34;
  float a=clamp((soft*0.78+halo)*(1.0-smoothstep(0.76,1.0,r)),0.0,1.0)*vAlpha*uOpacity;
  if(a<0.004)discard;
  vec3 col=mix(mix(vec3(1.0,0.95,0.86),vec3(1.0,0.80,0.44),vSun),vec3(1.0,0.95,0.78),clamp(soft*0.55+vGlint*0.5,0.0,1.0));
  gl_FragColor=vec4(col,a);
}`;

const makeSeededRand = (seed: number): (() => number) => {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let m = Math.imul(s ^ (s >>> 15), 1 | s);
    m = (m + Math.imul(m ^ (m >>> 7), 61 | m)) ^ m;
    return ((m ^ (m >>> 14)) >>> 0) / 4294967296;
  };
};

interface StudioDustMotesHandle {
  readonly setPointer: (nx: number, ny: number) => void;
  readonly update: (dt: number, cam: Camera, z: number, f: StudioFocusTarget | null) => boolean;
  readonly dispose: () => void;
}

export const createStudioDustMotes = (targetScene: Scene): StudioDustMotesHandle => {
  const rand = makeSeededRand(20261124);
  const positions = new Float32Array(MOTE_COUNT * 3);
  const seeds = new Float32Array(MOTE_COUNT * 4);
  for (let i = 0; i < MOTE_COUNT; ) {
    const tight = i < Math.floor(MOTE_COUNT * 0.65);
    const x = tight ? (rand() - 0.44) * 7.8 : (rand() - 0.48) * 11.4;
    const y = tight ? -2.2 + rand() * 3.9 : -4.4 + rand() * 6.8;
    const z = tight ? -1.8 + rand() * 5.2 : -3.0 + rand() * 8.4;
    if (Math.abs(x) < 1.18 && y > -0.82 && y < 1.12 && z > 0.65 && z < 1.7) continue;
    positions.set([x, y, z], i * 3);
    seeds.set([rand() * Math.PI * 2, 0.72 + rand() * 1.05, 0.55 + rand() * 0.9, rand()], i * 4);
    i += 1;
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(positions, 3));
  geometry.setAttribute("aSeed", new BufferAttribute(seeds, 4));
  const motionQuery =
    typeof window !== "undefined" ? window.matchMedia("(prefers-reduced-motion: reduce)") : null;
  let prefersReduced = motionQuery?.matches ?? false;
  const [rayOrigin, rayDir] = [new Vector3(1e9, 0, 0), new Vector3(0, 0, -1)];
  const [cursorVel, targetVel] = [new Vector3(), new Vector3()];
  const [prevPt, curPt, unproj] = [new Vector3(), new Vector3(), new Vector3()];
  const prevQuat = new Quaternion();
  const ptr = {
    nx: 0,
    ny: 0,
    lastNx: -99,
    lastNy: -99,
    hasPrev: false,
    energy: 0,
    elapsed: 0,
  };

  const material = new ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uOpacity: { value: 0.92 },
      uPixelRatio: { value: Math.min(window.devicePixelRatio || 1, 1.5) },
      uReduced: { value: prefersReduced ? 1 : 0 },
      uSunDir: { value: SUN_DIR.clone() },
      uRayOrigin: { value: rayOrigin },
      uRayDir: { value: rayDir },
      uCursorVel: { value: cursorVel },
      uCursorEnergy: { value: 0 },
    },
    vertexShader: DUST_VS,
    fragmentShader: DUST_FS,
    transparent: true,
    depthWrite: false,
    depthTest: true,
    blending: NormalBlending,
    toneMapped: false,
  });
  const points = new Points(geometry, material);
  points.name = "studioGoldenDustMotes";
  [points.renderOrder, points.frustumCulled] = [8, false];
  targetScene.add(points);

  const onMotionChange = (): void => {
    prefersReduced = motionQuery?.matches ?? false;
    if (material.uniforms.uReduced) material.uniforms.uReduced.value = prefersReduced ? 1 : 0;
  };
  motionQuery?.addEventListener("change", onMotionChange);

  const update = (dtRaw: number, camera: Camera, zoom: number, focus: StudioFocusTarget | null) => {
    const dt = Math.min(Math.max(dtRaw, 0), 0.05);
    const tvHide = focus === "tv" ? 1 - MathUtils.smoothstep(zoom, 0.12, 0.52) : 1;
    const opacity = tvHide * (prefersReduced ? 0.55 : 0.94);
    points.visible = opacity > 0.004;
    if (!points.visible) return false;

    if (!prefersReduced) ptr.elapsed += dt;
    const { position: cp, quaternion: cq } = camera;
    const camMoved =
      cp.distanceToSquared(rayOrigin) > 1e-7 || 1 - Math.abs(cq.dot(prevQuat)) > 1e-6;
    if (ptr.nx !== ptr.lastNx || ptr.ny !== ptr.lastNy || camMoved) {
      [ptr.lastNx, ptr.lastNy] = [ptr.nx, ptr.ny];
      rayOrigin.copy(cp);
      prevQuat.copy(cq);
      rayDir
        .copy(unproj.set(ptr.nx, ptr.ny, 0.5).unproject(camera))
        .sub(cp)
        .normalize();
    }
    const sampleDist = MathUtils.clamp(cp.length() * 0.65, 2.2, 8.5);
    curPt.copy(rayOrigin).addScaledVector(rayDir, sampleDist);
    if (ptr.hasPrev && dt > 0.0005 && !prefersReduced) {
      const [dx, dy, dz] = [curPt.x - prevPt.x, curPt.y - prevPt.y, curPt.z - prevPt.z];
      const wake = MathUtils.clamp((Math.hypot(dx, dy, dz) / dt) * 0.14, 0, 1);
      ptr.energy += (wake - ptr.energy) * (1 - Math.exp(-(wake > ptr.energy ? 10 : 3.2) * dt));
      targetVel.set(
        MathUtils.clamp(dx * 6, -1.2, 1.2),
        MathUtils.clamp(dy * 6, -1.2, 1.2),
        MathUtils.clamp(dz * 6, -1.2, 1.2),
      );
      cursorVel.lerp(targetVel, 1 - Math.exp(-5.5 * dt));
    } else {
      ptr.hasPrev = true;
      const decay = Math.exp(-4 * dt);
      ptr.energy *= decay;
      cursorVel.multiplyScalar(decay);
    }
    prevPt.copy(curPt);

    const u = material.uniforms;
    if (u.uTime) u.uTime.value = ptr.elapsed;
    if (u.uOpacity) u.uOpacity.value = opacity;
    if (u.uCursorEnergy) u.uCursorEnergy.value = ptr.energy;
    if (u.uPixelRatio) u.uPixelRatio.value = Math.min(window.devicePixelRatio || 1, 1.5);
    const hidden = typeof document !== "undefined" && document.visibilityState === "hidden";
    return !prefersReduced && !hidden;
  };

  return {
    setPointer: (nx, ny) => {
      [ptr.nx, ptr.ny] = [nx, ny];
    },
    update,
    dispose: () => {
      motionQuery?.removeEventListener("change", onMotionChange);
      targetScene.remove(points);
      geometry.dispose();
      material.dispose();
    },
  };
};
