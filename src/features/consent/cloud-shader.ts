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
uniform float u_cloudOpacity;
uniform vec4 u_textClearZone;
uniform vec4 u_actionZone;
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

float fbm(vec3 p) {
  float v = 0.0;
  float a = 0.54;
  vec3 shift = vec3(100.0, 42.0, 17.0);
  for (int i = 0; i < 3; i++) {
    v += a * snoise(p);
    p = p * 2.12 + shift;
    a *= 0.46;
  }
  return v;
}

void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution.xy;
  float aspect = u_resolution.x / u_resolution.y;
  vec2 p = uv;
  p.x *= aspect;

  // Deriva continua del viento de izquierda a derecha + evolución volumétrica
  float wind = u_time * 0.035;
  vec3 cloudPos = vec3(p * 1.35 - vec2(wind, 0.0), u_time * 0.012);

  // Deformación de dominio para cúmulos algodonados
  vec2 warp = vec2(
    snoise(cloudPos + vec3(0.0, 0.0, 1.2)),
    snoise(cloudPos + vec3(5.2, 1.3, 2.8))
  );

  float density = fbm(cloudPos + vec3(warp * 0.42, 0.0));

  // Interacción suave con el cursor del ratón (despeje de nubes)
  if (u_cursorActive > 0.01) {
    vec2 cur = u_cursor / u_resolution.xy;
    cur.x *= aspect;
    float dist = distance(p, cur);
    float repulse = smoothstep(0.24, 0.0, dist) * 0.38 * u_cursorActive;
    density -= repulse;
  }

  // Gradiente de cielo para concentración natural de cúmulos en franja media-alta
  float heightBias = smoothstep(0.12, 0.48, uv.y) * 0.28;
  float cloudField = smoothstep(-0.08, 0.56, density + heightBias);

  // Desvanecimiento progresivo y suave hacia el texto central ("Desarrollador Creativo")
  // Sin hueco abrupto: las nubes se disuelven orgánicamente a través del tramado Bayer
  if (u_textClearZone.z > 0.0) {
    vec2 textCenter = u_textClearZone.xy / u_resolution.xy;
    textCenter.x *= aspect;
    vec2 textRadii = u_textClearZone.zw / u_resolution.xy;
    textRadii.x *= aspect;
    vec2 textOffset = (p - textCenter) / max(textRadii, vec2(0.001));
    float textDist = length(textOffset);
    float textFade = smoothstep(0.75, 2.6, textDist);
    // Disolución progresiva debajo de los textos: la nube se desvanece hacia el
    // borde inferior con un gradiente vertical continuo, sin generar un hueco recortado
    float zoneBottom = textCenter.y - textRadii.y * 0.33;
    float belowT = clamp((zoneBottom - p.y) / max(zoneBottom, 0.001), 0.0, 1.0);
    float belowFade = 1.0 - smoothstep(0.0, 0.9, belowT);
    cloudField *= textFade * belowFade;
  }

  // Desvanecimiento progresivo y suave a medida que las nubes se aproximan al texto inferior
  // No genera un corte o hueco abrupto: modula la masa de nube para disolverla gradualmente
  if (u_actionZone.z > 0.0) {
    vec2 actionCenter = u_actionZone.xy / u_resolution.xy;
    actionCenter.x *= aspect;
    vec2 actionRadii = u_actionZone.zw / u_resolution.xy;
    actionRadii.x *= aspect;
    vec2 actionOffset = (p - actionCenter) / max(actionRadii, vec2(0.001));
    actionOffset.x *= 0.65;
    float actionDist = length(actionOffset);
    float actionFade = smoothstep(0.8, 3.2, actionDist);
    cloudField *= actionFade;
  }

  // Muestreo del tramado Bayer con paso de píxel gráfico nítido
  float pixelScale = u_pixelScale > 0.0 ? u_pixelScale : 2.4;
  ivec2 ditherCoord = ivec2(floor(gl_FragCoord.xy / pixelScale));
  float ditherThreshold = getBayerValue(ditherCoord);

  // Gradiente de cielo diagonal idéntico a la referencia (azul eléctrico a blanco puro)
  vec2 screenUv = gl_FragCoord.xy / u_resolution.xy;
  float diag = (1.0 - screenUv.y) * 0.62 + screenUv.x * 0.52;

  vec3 cDeepBlue = vec3(0.0, 0.38, 0.92);
  vec3 cMidBlue  = vec3(0.12, 0.58, 1.0);
  vec3 cSoftBlue = vec3(0.68, 0.85, 1.0);
  vec3 cWhite    = vec3(1.0, 1.0, 1.0);

  vec3 skyColor = mix(cDeepBlue, cMidBlue, smoothstep(0.0, 0.42, diag));
  skyColor = mix(skyColor, cSoftBlue, smoothstep(0.5, 0.86, diag));
  skyColor = mix(skyColor, cWhite, smoothstep(0.8, 1.12, diag));

  // 1-bit dither: Las nubes emergen moduladas por u_cloudOpacity sobre el degradado
  float cloudPresence = cloudField * smoothstep(0.0, 1.0, u_cloudOpacity);
  float isWhite = step(ditherThreshold, cloudPresence);
  vec3 finalColor = mix(skyColor, vec3(1.0), isWhite);

  fragColor = vec4(finalColor, 1.0);
}
`;
