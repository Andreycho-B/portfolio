import {
  type Camera,
  type Group,
  InstancedBufferAttribute,
  InstancedMesh,
  MathUtils,
  Matrix4,
  PlaneGeometry,
  ShaderMaterial,
  Vector3,
} from "three";
import type { StudioFocusTarget } from "./studio-prop-focus";
import { TV_BUTTON_SPECS, type TvButtonId } from "./studio-tv-buttons";
import type { TvChannelMode } from "./studio-tv-channels";

export interface StudioChassisFrame {
  readonly camera: Camera;
  readonly power: number;
  readonly focus: StudioFocusTarget | null;
  readonly idx: number;
  readonly muted: boolean;
  readonly about?: boolean;
}

export interface TvButtonCueState {
  readonly channel: TvChannelMode;
  readonly isPortalOpen: boolean;
  readonly hoveredButton: TvButtonId | null;
  readonly getPressDepth: (id: TvButtonId) => number;
}

export interface StudioTvButtonCuesHandle {
  readonly update: (dt: number, frame: StudioChassisFrame, state: TvButtonCueState) => boolean;
  readonly dispose: () => void;
}

const CUE_VS = `attribute vec4 aBtnState;
varying vec2 vUv;
varying vec4 vState;
void main(){
  vUv=uv;vState=aBtnState;
  gl_Position=projectionMatrix*modelViewMatrix*instanceMatrix*vec4(position,1.0);
}`;

const CUE_FS = `uniform float uTime,uOpacity,uReduced;
varying vec2 vUv;
varying vec4 vState;
void main(){
  vec2 p=vUv*2.0-1.0;
  float r=length(p);
  if(r>1.0)discard;
  float aa=max(fwidth(r),0.045);
  float hov=vState.x,act=vState.y,acc=vState.z,ph=vState.w;
  float shimmer=(1.0-uReduced)*sin(uTime*1.85+ph)*0.07;
  float coreR=mix(0.20,0.30,max(hov,act*0.65));
  float core=1.0-smoothstep(coreR-aa,coreR+aa,r);
  float ringR=mix(0.56,0.78,hov),ringW=mix(0.065,0.095,hov);
  float ring=(1.0-smoothstep(ringW-aa,ringW+aa,abs(r-ringR)))*mix(0.36,0.96,max(hov,act*0.55));
  float back=exp(-pow(r/0.56,2.0))*mix(0.42,0.62,max(hov,act));
  float glow=exp(-pow(r/0.36,2.0))*mix(0.24,0.58,max(hov,act*0.8));
  float ink=clamp(core+ring+glow*0.45,0.0,1.0);
  float strength=mix(mix(0.46+shimmer,0.92,act),1.0,hov);
  float alpha=clamp(max(ink*strength,back*strength),0.0,1.0)*uOpacity;
  if(alpha<0.004)discard;
  vec3 baseCol=acc>1.5?vec3(1.0,0.72,0.36):(acc>0.5?vec3(1.0,0.46,0.32):vec3(1.0,0.96,0.88));
  vec3 fg=mix(mix(baseCol,vec3(0.54,1.0,0.74),act),vec3(1.0,0.99,0.96),hov*0.85);
  float t=clamp((ink*strength)/max(alpha/max(uOpacity,0.001),0.001),0.0,1.0);
  gl_FragColor=vec4(mix(vec3(0.05,0.04,0.03),fg,t),alpha);
}`;

const RETRO_ACTIVE_BTN: Partial<Record<TvChannelMode, TvButtonId>> = {
  smpte: "ch6",
  static: "ch7",
  terminal: "ch8",
  clock: "ch9",
};

const isButtonActive = (id: TvButtonId, f: StudioChassisFrame, s: TvButtonCueState): boolean => {
  if (s.isPortalOpen && f.about) return id === "ch4";
  if (s.channel === "dvd") return id === "ch5" || id === "dvd";
  if (s.channel !== "portfolio") return RETRO_ACTIVE_BTN[s.channel] === id;
  return id === (["ch1", "ch2", "ch3"][f.idx] ?? "");
};

export const createStudioTvButtonCues = (parent: Group): StudioTvButtonCuesHandle => {
  const count = TV_BUTTON_SPECS.length;
  const geometry = new PlaneGeometry(1, 1);
  const stateData = new Float32Array(count * 4);
  for (let i = 0; i < count; i += 1) stateData[i * 4 + 3] = i * 0.42;
  const stateAttr = new InstancedBufferAttribute(stateData, 4);
  geometry.setAttribute("aBtnState", stateAttr);

  const motionQuery =
    typeof window !== "undefined" ? window.matchMedia("(prefers-reduced-motion: reduce)") : null;
  let prefersReduced = motionQuery?.matches ?? false;
  let elapsed = 0;

  const material = new ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uOpacity: { value: 0 },
      uReduced: { value: prefersReduced ? 1 : 0 },
    },
    vertexShader: CUE_VS,
    fragmentShader: CUE_FS,
    transparent: true,
    depthWrite: false,
    depthTest: true,
    toneMapped: false,
  });

  const mesh = new InstancedMesh(geometry, material, count);
  mesh.name = "tvFrontButtonCues";
  mesh.renderOrder = 11;
  mesh.frustumCulled = false;
  mesh.visible = false;
  parent.add(mesh);

  const onMotionChange = (): void => {
    prefersReduced = motionQuery?.matches ?? false;
    if (material.uniforms.uReduced) material.uniforms.uReduced.value = prefersReduced ? 1 : 0;
  };
  motionQuery?.addEventListener("change", onMotionChange);

  const hovers = new Float32Array(count);
  const mat4 = new Matrix4();
  const center = new Vector3(0, -0.82, 1.24);

  const update = (dtRaw: number, frame: StudioChassisFrame, state: TvButtonCueState): boolean => {
    const dt = Math.min(Math.max(dtRaw, 0), 0.05);
    if (!prefersReduced) elapsed += dt;

    const focusAllowed = frame.focus === null || frame.focus === "chair" || frame.focus === "tv";
    const onFade = MathUtils.smoothstep(frame.power, 0.35, 0.85);
    const frontFade = MathUtils.smoothstep(frame.camera.position.z, 0.35, 1.35);
    const opacity = focusAllowed ? onFade * frontFade : 0;
    const visible = opacity > 0.004;
    mesh.visible = visible;
    if (!visible) return false;

    const dist = frame.camera.position.distanceTo(center);
    const scale = MathUtils.clamp(dist * 0.0078, 0.032, 0.056);
    const hoverLerp = prefersReduced ? 1 : 1 - Math.exp(-14 * dt);
    let animHover = false;

    for (let i = 0; i < count; i += 1) {
      const spec = TV_BUTTON_SPECS[i];
      if (!spec) continue;
      const target = state.hoveredButton === spec.id ? 1 : 0;
      const cur = hovers[i] ?? 0;
      const next = cur + (target - cur) * hoverLerp;
      hovers[i] = Math.abs(target - next) < 0.004 ? target : next;
      if (hovers[i] !== target) animHover = true;

      const idx = i * 4;
      stateData[idx] = hovers[i] ?? 0;
      stateData[idx + 1] = isButtonActive(spec.id, frame, state) ? 1 : 0;
      stateData[idx + 2] = spec.id === "power" ? 1 : spec.id === "mute" && frame.muted ? 2 : 0;

      const z = 1.242 - state.getPressDepth(spec.id) * 0.6;
      mat4.makeScale(scale, scale, 1);
      mat4.setPosition(spec.x, spec.y + 0.043, z);
      mesh.setMatrixAt(i, mat4);
    }
    mesh.instanceMatrix.needsUpdate = true;
    stateAttr.needsUpdate = true;
    if (material.uniforms.uTime) material.uniforms.uTime.value = elapsed;
    if (material.uniforms.uOpacity) material.uniforms.uOpacity.value = opacity;

    const hiddenTab = typeof document !== "undefined" && document.visibilityState === "hidden";
    return animHover || (!state.isPortalOpen && !prefersReduced && !hiddenTab);
  };

  return {
    update,
    dispose: () => {
      motionQuery?.removeEventListener("change", onMotionChange);
      parent.remove(mesh);
      geometry.dispose();
      material.dispose();
    },
  };
};
