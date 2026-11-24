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
  { target: "tv_power", pos: [0.487, -0.83, 1.36], phase: 0.4, frontOnly: true, warm: true },
  { target: "bust", pos: [2.18, 0.56, -0.28], phase: 1.25 },
  { target: "thermos", pos: [2.28, 0.26, 1.05], phase: 2.5 },
  { target: "phone", pos: [1.42, -0.94, 1.36], phase: 3.75 },
  { target: "computer", pos: [-2.32, 0.08, -0.26], phase: 4.35 },
  { target: "clock", pos: [-1.77, -0.84, 0.69], phase: 5.0 },
  { target: "chair", pos: [-2.08, -0.55, 4.65], phase: 5.65 },
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
  float halo=exp(-pow((r-ringR)/0.14,2.0))*0.34+exp(-pow(r/0.22,2.0))*0.26;
  float ink=clamp(ring*mix(0.92,1.0,uHover)+core+pulse+fill,0.0,1.0);
  float alpha=clamp(max(ink,halo*(0.72+uHover*0.28)),0.0,1.0)*uOpacity;
  if(alpha<0.004)discard;
  vec3 bg=mix(vec3(0.06,0.07,0.1),vec3(0.16,0.06,0.03),uWarm);
  vec3 coolFg=mix(vec3(1.0,0.985,0.96),vec3(1.0,0.92,0.78),uHover*0.45);
  vec3 warmFg=mix(vec3(1.0,0.72,0.42),vec3(1.0,0.96,0.86),uHover*0.65);
  vec3 fg=mix(coolFg,warmFg,uWarm);
  float t=clamp(ink/max(alpha/max(uOpacity,0.001),0.001),0.0,1.0);
  gl_FragColor=vec4(mix(bg,fg,t),alpha);
}`;
