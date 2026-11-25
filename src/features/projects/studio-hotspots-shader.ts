import type { StudioFocusTarget } from "./studio-prop-focus";

export type StudioHotspotId = StudioFocusTarget | "tv_power";

export interface HotspotSpec {
  readonly target: StudioHotspotId;
  readonly pos: readonly [number, number, number];
  readonly phase: number;
  readonly frontOnly?: boolean;
  readonly highlight?: boolean;
  readonly rayPull?: number;
  readonly scale?: readonly [number, number, number];
}

export const HOTSPOT_SPECS: readonly HotspotSpec[] = [
  {
    target: "tv",
    pos: [0.0, 0.165, 1.125],
    phase: 0.0,
    frontOnly: true,
    highlight: true,
    rayPull: 0.18,
    scale: [0.062, 0.28, 0.72],
  },
  {
    target: "tv_power",
    pos: [0.486, -0.804, 1.232],
    phase: 0.4,
    frontOnly: true,
    highlight: true,
    rayPull: 0.16,
    scale: [0.056, 0.24, 0.62],
  },
  { target: "bust", pos: [2.22, 0.44, -0.24], phase: 1.25 },
  { target: "thermos", pos: [2.28, -0.18, 1.18], phase: 2.5 },
  { target: "phone", pos: [1.42, -0.94, 1.36], phase: 3.75 },
  { target: "clock", pos: [-1.77, -0.84, 0.69], phase: 5.0 },
  { target: "chair", pos: [-1.82, -1.65, 3.82], phase: 5.65 },
];

const HOTSPOT_SDF_BODY = `if(uOpacity<0.004)discard;
  vec2 p=vUv*2.0-1.0;
  float r=length(p);
  if(r>1.0)discard;
  float aa=max(fwidth(r),0.025);
  float motion=1.0-uReduced;
  float breath=motion*sin(uTime*2.35+uPhase);
  float wave=fract(uTime*0.42+uPhase*0.15915);
  float ringR=mix(0.38+breath*0.032,0.58,uHover);
  float ringW=mix(0.038+uHighlight*0.014,0.056+uHighlight*0.012,uHover);
  float ring=1.0-smoothstep(ringW-aa,ringW+aa,abs(r-ringR));
  float dotR=mix(0.11+uHighlight*0.032-breath*0.012,0.18,uHover);
  float core=1.0-smoothstep(dotR-aa,dotR+aa,r);
  float pulseR=mix(0.26,0.94,wave);
  float pulseW=mix(0.034+uHighlight*0.012,0.014,wave);
  float pulseFade=(1.0-wave)*(1.0-wave)*smoothstep(0.0,0.12,wave);
  float pulse=(1.0-smoothstep(pulseW-aa,pulseW+aa,abs(r-pulseR)))*pulseFade*mix(0.58,0.88,uHighlight)*motion*(1.0-uHover*0.75);
  float fill=(1.0-smoothstep(ringR-aa,ringR+aa,r))*uHover*0.24;
  float halo=exp(-pow((r-ringR)/0.18,2.0))*mix(0.56,0.86,uHighlight)+exp(-pow(r/0.29,2.0))*mix(0.42,0.72,uHighlight);
  float ink=clamp(ring*mix(0.96,1.0,max(uHover,uHighlight))+core+pulse+fill,0.0,1.0);
  float alpha=clamp(max(ink,halo*mix(0.82+uHover*0.18,0.96,uHighlight)),0.0,1.0)*uOpacity;
  if(alpha<0.004)discard;
  vec3 bg=vec3(0.04,0.05,0.08);
  vec3 fg=mix(vec3(1.0,0.99,0.97),vec3(1.0),uHighlight);
  float t=clamp(ink/max(alpha/max(uOpacity,0.001),0.001),0.0,1.0);
  gl_FragColor=vec4(mix(bg,fg,t),alpha);`;

export const HOTSPOT_VS = `varying vec2 vUv;
void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`;

export const HOTSPOT_FS = `uniform float uTime,uHover,uOpacity,uPhase,uReduced,uHighlight;
varying vec2 vUv;
void main(){${HOTSPOT_SDF_BODY}}`;

export const HOTSPOT_INSTANCED_VS = `attribute vec4 aHotspotState;
varying vec2 vUv;
varying vec4 vState;
void main(){
  vUv=uv;
  vState=aHotspotState;
  gl_Position=projectionMatrix*modelViewMatrix*instanceMatrix*vec4(position,1.0);
}`;

export const HOTSPOT_INSTANCED_FS = `uniform float uTime,uReduced;
varying vec2 vUv;
varying vec4 vState;
void main(){
  float uHover=vState.x,uOpacity=vState.y,uPhase=vState.z,uHighlight=vState.w;
  ${HOTSPOT_SDF_BODY}
}`;
