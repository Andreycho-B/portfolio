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
  varying vec2 vUv;

  float sag(float t) {
    t = clamp(pow(t, uCurve), 0.0, 1.0);
    return 1.0 - sqrt(1.0 - t * t);
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
      gl_FragColor = texture2D(tDiffuse, uv);
      #include <colorspace_fragment>
      return;
    }

    vec3 finalColor = vec3(0.0);
    vec3 weightSum = vec3(0.0);
    vec2 dispDir = normalize(vec2(dx * 0.45, uv.y > 0.5 ? -1.0 : 1.0));

    for (int i = 0; i < 16; i++) {
      float t = float(i) / 15.0;

      vec3 w = vec3(
        clamp(1.0 - 4.5 * (t - 0.18) * (t - 0.18), 0.0, 1.0),
        clamp(1.0 - 5.5 * (t - 0.50) * (t - 0.50), 0.0, 1.0),
        clamp(1.0 - 4.5 * (t - 0.82) * (t - 0.82), 0.0, 1.0)
      );

      float cauchyShift = (pow(t, 1.35) - 0.392) * uChromaticAberration * dist * 32.0;
      vec2 sampleUv = clamp(uv + dispDir * cauchyShift, vec2(0.0), vec2(1.0));

      finalColor += texture2D(tDiffuse, sampleUv).rgb * w;
      weightSum += w;
    }

    finalColor /= weightSum;
    finalColor *= exp(-dist * 1.5);
    float dither = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453) - 0.5;
    finalColor += dither / 255.0;
    gl_FragColor = vec4(finalColor, 1.0);
    #include <colorspace_fragment>
  }
`;
