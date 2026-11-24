import { BackSide, Mesh, ShaderMaterial, SphereGeometry, type Vector3 } from "three";
import type { StudioSkyDomeHandle } from "./studio.types";

const SKY_VERTEX_SHADER = `
  varying vec3 vWorldDir;
  void main() {
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWorldDir = normalize(wp.xyz);
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

const SKY_FRAGMENT_SHADER = `
  uniform vec3 uSunDir;
  varying vec3 vWorldDir;

  void main() {
    vec3 dir = normalize(vWorldDir);
    vec3 sunUnit = normalize(uSunDir);

    float skyT = smoothstep(-0.11, 0.22, dir.y);
    vec3 cHorizon = vec3(0.902, 0.949, 1.0);
    vec3 sky = mix(cHorizon, vec3(0.68, 0.85, 1.0), smoothstep(0.0, 0.22, skyT));
    sky = mix(sky, vec3(0.12, 0.58, 1.0), smoothstep(0.18, 0.58, skyT));
    sky = mix(sky, vec3(0.0, 0.38, 0.92), smoothstep(0.55, 0.96, skyT));
    sky = mix(sky, vec3(0.0, 0.31, 0.84), smoothstep(0.24, 0.85, dir.y) * 0.65);

    float sunDot = max(0.0, dot(dir, sunUnit));
    float sunDisk = smoothstep(0.99935, 0.99985, sunDot) * 14.0;
    float sunBloom = pow(sunDot, 220.0) * 4.6 + pow(sunDot, 36.0) * 1.15 + pow(sunDot, 6.5) * 0.34;
    float mistMask = smoothstep(-0.115, -0.072, dir.y);

    vec3 baseLinear = pow(max(mix(cHorizon, sky, mistMask), vec3(0.0)), vec3(2.2));
    vec3 sunLinear = vec3(1.0, 0.992, 0.955) * (sunDisk + sunBloom) * mistMask;
    gl_FragColor = vec4(baseLinear + sunLinear, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

export const createStudioGhibliSky = (sunDirection: Vector3): StudioSkyDomeHandle => {
  const geometry = new SphereGeometry(68, 32, 24);
  const material = new ShaderMaterial({
    uniforms: {
      uSunDir: { value: sunDirection.clone() },
    },
    vertexShader: SKY_VERTEX_SHADER,
    fragmentShader: SKY_FRAGMENT_SHADER,
    side: BackSide,
    depthWrite: false,
    fog: false,
  });

  const mesh = new Mesh(geometry, material);
  mesh.name = "studioSkyDome";

  const updateTime = (_dtSeconds: number): boolean => false;

  const dispose = (): void => {
    geometry.dispose();
    material.dispose();
  };

  return { mesh, geometry, material, updateTime, dispose };
};
