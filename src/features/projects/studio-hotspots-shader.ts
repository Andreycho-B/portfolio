import type { StudioFocusTarget } from "./studio-prop-focus";

export type StudioHotspotId = StudioFocusTarget | "tv_power";

export interface HotspotSpec {
  readonly target: StudioHotspotId;
  readonly pos: readonly [number, number, number];
  readonly phase: number;
  readonly frontOnly?: boolean;
  readonly warm?: boolean;
}

export const HOTSPOT_SPECS: readonly HotspotSpec[] = [
  { target: "tv", pos: [0.0, 0.165, 1.32], phase: 0.0, frontOnly: true },
  { target: "tv_power", pos: [0.487, -0.805, 1.36], phase: 0.4, frontOnly: true, warm: true },
  { target: "bust", pos: [2.22, 0.44, -0.24], phase: 1.25 },
  { target: "thermos", pos: [2.28, -0.18, 1.18], phase: 2.5 },
  { target: "phone", pos: [1.42, -0.94, 1.36], phase: 3.75 },
  { target: "computer", pos: [-2.62, -0.12, -0.22], phase: 4.35 },
  { target: "clock", pos: [-1.77, -0.84, 0.69], phase: 5.0 },
  { target: "chair", pos: [-1.82, -1.65, 3.82], phase: 5.65 },
];

export const HOTSPOT_VS = `varying vec2 vUv;
void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`;

export const HOTSPOT_FS = `uniform float uTime;
uniform float uHover;
uniform float uOpacity;
uniform float uPhase;
uniform float uReduced;
uniform float uWarm;
varying vec2 vUv;
void main(){
  vec2 p=vUv*2.0-1.0;
  float r=length(p);
  if(r>1.0)discard;
  float aa=max(fwidth(r),0.025);
  float motion=1.0-uReduced;
  float breath=motion*sin(uTime*2.35+uPhase);
  float wave=fract(uTime*0.42+uPhase*0.15915);
  float ringR=mix(0.38+breath*0.032,0.58,uHover);
  float ringW=mix(0.038,0.054,uHover);
  float ring=1.0-smoothstep(ringW-aa,ringW+aa,abs(r-ringR));
  float dotR=mix(0.11-breath*0.012,0.17,uHover);
  float core=1.0-smoothstep(dotR-aa,dotR+aa,r);
  float pulseR=mix(0.26,0.92,wave);
  float pulseW=mix(0.032,0.012,wave);
  float pulseFade=(1.0-wave)*(1.0-wave)*smoothstep(0.0,0.12,wave);
  float pulse=(1.0-smoothstep(pulseW-aa,pulseW+aa,abs(r-pulseR)))*pulseFade*0.58*motion*(1.0-uHover*0.75);
  float fill=(1.0-smoothstep(ringR-aa,ringR+aa,r))*uHover*0.22;
  float halo=exp(-pow((r-ringR)/0.16,2.0))*mix(0.56,0.72,uWarm)+exp(-pow(r/0.26,2.0))*mix(0.42,0.58,uWarm);
  float ink=clamp(ring*mix(0.94,1.0,uHover)+core+pulse+fill,0.0,1.0);
  float alpha=clamp(max(ink,halo*(0.82+uHover*0.18)),0.0,1.0)*uOpacity;
  if(alpha<0.004)discard;
  vec3 bg=mix(vec3(0.05,0.06,0.09),vec3(0.20,0.07,0.02),uWarm);
  vec3 coolFg=mix(vec3(1.0,0.985,0.96),vec3(1.0,0.92,0.78),uHover*0.45);
  vec3 warmFg=mix(vec3(1.0,0.62,0.22),vec3(1.0,0.94,0.82),uHover*0.65);
  vec3 fg=mix(coolFg,warmFg,uWarm);
  float t=clamp(ink/max(alpha/max(uOpacity,0.001),0.001),0.0,1.0);
  gl_FragColor=vec4(mix(bg,fg,t),alpha);
}`;
