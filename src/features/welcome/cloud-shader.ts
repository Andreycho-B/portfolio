export const VERTEX_SHADER_SOURCE = `#version 300 es
in vec2 a_position;
out vec2 v_uv;

void main() {
  v_uv = (a_position + 1.0) * 0.5;
  gl_Position = vec4(a_position, 0.0, 1.0);
}
`;

export const FRAGMENT_SHADER_SOURCE = `#version 300 es
precision highp float;

in vec2 v_uv;
out vec4 fragColor;

uniform float u_time;
uniform vec2 u_resolution;
uniform vec2 u_cursor;
uniform float u_cursorActive;
uniform vec3 u_blueColor;
uniform float u_cloudOpacity;
uniform vec4 u_textClearZone;
uniform float u_pixelScale;

// Matriz Bayer 8x8 estandarizada para tramado ordenado
const int bayer8[64] = int[64](
   0, 32,  8, 40,  2, 34, 10, 42,
  48, 16, 56, 24, 50, 18, 58, 26,
  12, 44,  4, 36, 14, 46,  6, 38,
  60, 28, 52, 20, 62, 30, 54, 22,
   3, 35, 11, 43,  1, 33,  9, 41,
  51, 19, 59, 27, 49, 17, 57, 25,
  15, 47,  7, 39, 13, 45,  5, 37,
  63, 31, 55, 23, 61, 29, 53, 21
);

float getBayerValue(ivec2 coord) {
  int x = coord.x % 8;
  int y = coord.y % 8;
  if (x < 0) x += 8;
  if (y < 0) y += 8;
  return float(bayer8[y * 8 + x]) / 64.0;
}

vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 permute(vec4 x) { return mod289(((x * 34.0) + 10.0) * x); }
vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

float snoise(vec3 v) {
  const vec2 C = vec2(1.0/6.0, 1.0/3.0);
  const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
  vec3 i  = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);
  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy);
  vec3 i2 = max(g.xyz, l.zxy);
  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy;
  vec3 x3 = x0 - D.yyy;
  i = mod289(i);
  vec4 p = permute(permute(permute(
             i.z + vec4(0.0, i1.z, i2.z, 1.0))
           + i.y + vec4(0.0, i1.y, i2.y, 1.0))
           + i.x + vec4(0.0, i1.x, i2.x, 1.0));
  vec3 ns = 0.142857142857 * D.wyz - D.xzx;
  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_);
  vec4 x = x_ * ns.x + ns.yyyy;
  vec4 y = y_ * ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);
  vec4 b0 = vec4(x.xy, y.xy);
  vec4 b1 = vec4(x.zw, y.zw);
  vec4 s0 = floor(b0) * 2.0 + 1.0;
  vec4 s1 = floor(b1) * 2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));
  vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
  vec3 p0 = vec3(a0.xy, h.x);
  vec3 p1 = vec3(a0.zw, h.y);
  vec3 p2 = vec3(a1.xy, h.z);
  vec3 p3 = vec3(a1.zw, h.w);
  vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
  p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
  vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
  m = m * m;
  return 42.0 * dot(m * m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
}

vec2 hash2(vec2 p) {
  p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
  return fract(sin(p) * 43758.5453123);
}

float worley2D(vec2 p) {
  vec2 n = floor(p);
  vec2 f = fract(p);
  float d = 1.0;
  for (int j = -1; j <= 1; j++) {
    for (int i = -1; i <= 1; i++) {
      vec2 g = vec2(float(i), float(j));
      vec2 o = hash2(n + g);
      vec2 delta = g + o - f;
      d = min(d, dot(delta, delta));
    }
  }
  return clamp(1.0 - sqrt(d), 0.0, 1.0);
}

void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution.xy;
  float aspect = u_resolution.x / u_resolution.y;
  vec2 p = uv;
  p.x *= aspect;

  float alt = uv.y;
  float altBlend = smoothstep(0.38, 0.74, alt);

  // Viento y deformación orgánica por altitud
  float lowWind = u_time * 0.026;
  float highWind = u_time * 0.054;
  vec3 warpPos = vec3(p * 1.25 - vec2(lowWind * 0.8, 0.0), u_time * 0.009);
  vec2 warp = vec2(
    snoise(warpPos + vec3(0.0, 0.0, 1.2)),
    snoise(warpPos + vec3(5.2, 1.3, 2.8))
  );

  // Zona baja: Cúmulos algodonados / Cumulonimbus estilo Studio Ghibli
  vec2 cumulusP = p * 1.35 - vec2(lowWind * 0.65, 0.0) + warp * 0.32;
  float dome1 = worley2D(cumulusP * 1.55);
  float dome2 = worley2D(cumulusP * 3.30 + vec2(1.7, 4.3));
  float dome3 = worley2D(cumulusP * 6.60 + vec2(4.2, 8.1));
  float billowLobes = max(pow(dome1, 0.9), max(pow(dome2, 0.85) * 0.80, pow(dome3, 0.8) * 0.60));
  billowLobes = smoothstep(0.12, 0.94, billowLobes);

  float cumulusBody = snoise(vec3(cumulusP * 1.4, u_time * 0.008)) * 0.5 + 0.5;
  float flatBase = smoothstep(0.18, 0.28, alt + warp.y * 0.035);
  float cumulus = (billowLobes * 0.74 + cumulusBody * 0.26) * flatBase;

  // Zona alta: Filamentos cirros lisos y estirados por el viento en capas superiores
  vec2 highP = vec2((p.x - highWind) * 0.24, alt * 3.4);
  highP.x += snoise(vec3(highP.x * 0.55, alt * 1.4, u_time * 0.008)) * 0.32;
  float streak1 = snoise(vec3(highP * 1.15, u_time * 0.011));
  float streak2 = snoise(vec3(highP * 2.30 + vec2(12.7, 0.0), u_time * 0.015)) * 0.35;
  float highCloud = smoothstep(-0.20, 0.42, streak1 * 0.72 + streak2 * 0.28);

  // Distribución macro de formaciones nubosas sobre el cielo azul
  vec3 macroPos = vec3(p * 0.80 - vec2(lowWind * 0.75, 0.0), u_time * 0.006);
  float macroSky = snoise(macroPos) * 0.55 + snoise(macroPos * 1.8 + vec2(3.1, 7.4).xyx) * 0.25;

  float lowDensity = macroSky * 0.48 + cumulus * 0.62 - 0.16;
  float highDensity = macroSky * 0.40 + highCloud * 0.58 - 0.14;
  float density = mix(lowDensity, highDensity, altBlend);

  // Interacción suave con el cursor del ratón (despeje elástico)
  if (u_cursorActive > 0.01) {
    vec2 cur = u_cursor / u_resolution.xy;
    cur.x *= aspect;
    float dist = distance(p, cur);
    float repulse = smoothstep(0.24, 0.0, dist) * (0.42 * u_cursorActive);
    density -= repulse;
  }

  // Despeje orgánico en la zona de textos
  if (u_textClearZone.z > 0.0) {
    vec2 textOffset = gl_FragCoord.xy - u_textClearZone.xy;
    vec2 textRadii = max(u_textClearZone.zw, vec2(10.0));
    float organicEdge = warp.x * 0.10;
    float textDist = length(textOffset / textRadii) + organicEdge;
    float textClear = smoothstep(1.35, 0.75, textDist);
    density -= textClear * 0.95;
  }

  // Despeje de la barra inferior de acciones ("Ingresar sin sonido")
  float bottomClear = smoothstep(u_resolution.y * 0.16, 0.0, gl_FragCoord.y);
  density -= bottomClear * 0.90;

  // Gradiente de cielo adaptado a la orientación
  float heightBias = aspect < 1.0
    ? smoothstep(1.0, 0.16, uv.y) * 0.20
    : smoothstep(1.0, 0.28, uv.y) * 0.16;
  float cloudField = smoothstep(0.00, 0.68, density + heightBias);

  // Muestreo del tramado Bayer escalado según DPR
  float pixelScale = max(1.8, u_pixelScale);
  ivec2 ditherCoord = ivec2(floor(gl_FragCoord.xy / pixelScale));
  float ditherThreshold = getBayerValue(ditherCoord);

  // 1-bit dither: Nubes condensadas sobre azul cielo puro
  float isWhite = step(ditherThreshold, cloudField * u_cloudOpacity);
  vec3 finalColor = mix(u_blueColor, vec3(1.0), isWhite);

  fragColor = vec4(finalColor, 1.0);
}
`;
