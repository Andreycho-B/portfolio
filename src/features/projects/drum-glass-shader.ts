import {
  Mesh,
  OrthographicCamera,
  PlaneGeometry,
  Scene,
  ShaderMaterial,
  type WebGLRenderTarget,
} from "three";

const LENS_STRENGTH_BASE = 0.95;
const LENS_STRENGTH_GAIN = 0.14;
const CHROMATIC_BASE = 0.016;
const CHROMATIC_GAIN = 0.004;
const LENS_VELOCITY_CAP = 3;
const LENS_BAND_BASE = 0.165;
const LENS_BAND_GAIN = 0.014;

export const DRUM_GLASS_VERTEX_SHADER = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

export const DRUM_GLASS_FRAGMENT_SHADER = `
  uniform sampler2D tDiffuse;
  uniform float uBandTop;
  uniform float uBandBot;
  uniform float uStrength;
  uniform float uCurve;
  uniform float uChromaticAberration;
  uniform float uUvScale;
  varying vec2 vUv;

  float sag(float t) {
    t = clamp(pow(t, uCurve), 0.0, 1.0);
    return 1.0 - sqrt(1.0 - t * t);
  }

  vec2 toSubUv(vec2 unitUv) {
    float hi = max(0.002, uUvScale - 0.0015);
    return clamp(unitUv * uUvScale, vec2(0.001), vec2(hi));
  }

  void main() {
    vec2 uv = vUv;
    float dist = 0.0;
    float dx = (uv.x - 0.5) * 2.0;
    float lateral = dx * dx;

    float bandTop = uBandTop * (1.0 + lateral * 0.45);
    float bandBot = uBandBot * (1.0 + lateral * 0.45);

    if (bandTop > 0.0 && uv.y > 1.0 - bandTop) {
      float t = (uv.y - (1.0 - bandTop)) / bandTop;
      dist = sag(t) * bandTop * uStrength;
      uv.y -= dist;
      uv.x -= dx * dist * 0.35;
    } else if (bandBot > 0.0 && uv.y < bandBot) {
      float t = (bandBot - uv.y) / bandBot;
      dist = sag(t) * bandBot * uStrength;
      uv.y += dist;
      uv.x -= dx * dist * 0.35;
    }

    uv = clamp(uv, vec2(0.0), vec2(1.0));

    if (dist == 0.0 || uChromaticAberration == 0.0) {
      gl_FragColor = texture2D(tDiffuse, toSubUv(uv));
      #include <colorspace_fragment>
      return;
    }

    vec2 dispDir = vec2(0.0, uv.y > 0.5 ? -1.0 : 1.0);
    vec2 stepUv = dispDir * (uChromaticAberration * dist * 30.0);
    vec3 s0 = texture2D(tDiffuse, toSubUv(uv - stepUv * 0.50)).rgb;
    vec3 s1 = texture2D(tDiffuse, toSubUv(uv - stepUv * 0.25)).rgb;
    vec3 s2 = texture2D(tDiffuse, toSubUv(uv)).rgb;
    vec3 s3 = texture2D(tDiffuse, toSubUv(uv + stepUv * 0.25)).rgb;
    vec3 s4 = texture2D(tDiffuse, toSubUv(uv + stepUv * 0.50)).rgb;
    vec3 w0 = vec3(0.8542, 0.0, 0.0);
    vec3 w1 = vec3(0.9780, 0.6562, 0.0);
    vec3 w2 = vec3(0.5392, 1.0, 0.5392);
    vec3 w3 = vec3(0.0, 0.6562, 0.9780);
    vec3 w4 = vec3(0.0, 0.0, 0.8542);
    vec3 finalColor = (s0 * w0 + s1 * w1 + s2 * w2 + s3 * w3 + s4 * w4) / (w0 + w1 + w2 + w3 + w4);
    float whiteMask = smoothstep(0.98, 1.0, min(min(s2.r, s2.g), s2.b));
    finalColor *= mix(exp(-dist * 1.5), 1.0, whiteMask);
    float dither = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453) - 0.5;
    finalColor += dither / 255.0;
    gl_FragColor = vec4(finalColor, 1.0);
    #include <colorspace_fragment>
  }
`;

export interface DrumLensPostPass {
  readonly scene: Scene;
  readonly camera: OrthographicCamera;
  readonly updateUniforms: (scrollVelocity: number, introProgress: number) => void;
  readonly setUvScale: (scale: number) => void;
  readonly dispose: () => void;
}

export const createDrumLensPostPass = (renderTarget: WebGLRenderTarget): DrumLensPostPass => {
  const scene = new Scene();
  const camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const material = new ShaderMaterial({
    uniforms: {
      tDiffuse: { value: renderTarget.texture },
      uBandTop: { value: LENS_BAND_BASE },
      uBandBot: { value: LENS_BAND_BASE },
      uStrength: { value: LENS_STRENGTH_BASE },
      uCurve: { value: 1.0 },
      uChromaticAberration: { value: CHROMATIC_BASE },
      uUvScale: { value: 1.0 },
    },
    vertexShader: DRUM_GLASS_VERTEX_SHADER,
    fragmentShader: DRUM_GLASS_FRAGMENT_SHADER,
    depthTest: false,
    depthWrite: false,
  });
  const quad = new Mesh(new PlaneGeometry(2, 2), material);
  scene.add(quad);

  const updateUniforms = (scrollVelocity: number, introProgress: number): void => {
    const { uStrength, uChromaticAberration, uBandTop, uBandBot } = material.uniforms;
    if (!uStrength || !uChromaticAberration || !uBandTop || !uBandBot) return;
    const spinSpeed = Math.min(Math.abs(scrollVelocity), LENS_VELOCITY_CAP);
    const opticalFactor = 1 - introProgress;
    const dynamicBand = LENS_BAND_BASE + spinSpeed * LENS_BAND_GAIN + opticalFactor * 0.02;
    uBandTop.value = dynamicBand;
    uBandBot.value = dynamicBand;
    uStrength.value = LENS_STRENGTH_BASE + spinSpeed * LENS_STRENGTH_GAIN + opticalFactor * 0.11;
    uChromaticAberration.value =
      CHROMATIC_BASE + spinSpeed * CHROMATIC_GAIN + opticalFactor * 0.012;
  };

  const setUvScale = (scale: number): void => {
    if (material.uniforms.uUvScale) material.uniforms.uUvScale.value = scale;
  };

  const dispose = (): void => {
    material.dispose();
    quad.geometry.dispose();
  };

  return { scene, camera, updateUniforms, setUvScale, dispose };
};
