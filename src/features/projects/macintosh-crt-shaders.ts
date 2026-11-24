export const CRT_GLASS_VERTEX_SHADER = `
  varying vec2 vUv, vScreenCoord;
  varying vec3 vWorldNormal, vWorldPos;
  void main() {
    vUv = uv;
    vScreenCoord = uv * 2.0 - 1.0;
    vWorldNormal = normalize(mat3(modelMatrix) * normal);
    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
    vWorldPos = worldPosition.xyz;
    gl_Position = projectionMatrix * viewMatrix * worldPosition;
  }
`;

export const CRT_GLASS_FRAGMENT_SHADER = `
  uniform vec2 uPointer;
  uniform float uPower, uHasRoughness, uPortalMode, uPortalCutout, uTitleFade, uDrumUvScale;
  uniform vec4 uFluidWave;
  uniform sampler2D tDrum, tEditorial, tPortal, tRoughness;
  varying vec2 vUv, vScreenCoord;
  varying vec3 vWorldNormal, vWorldPos;

  float sdCrtTube(vec2 p) {
    float rCorner = p.y > 0.0 ? 0.13 : 0.115;
    vec2 q = abs(p) - 0.992 + rCorner;
    return min(max(q.x, q.y), 0.0) + length(max(q, 0.0)) - rCorner;
  }

  float ditherNoise(vec2 fragCoord) {
    return (fract(52.9829189 * fract(dot(fragCoord, vec2(0.06711056, 0.00583715)))) - 0.5) * 1.1;
  }

  vec3 sampleConstructStudioLinear(vec3 dir) {
    float horizon = smoothstep(-0.18, 0.58, dir.y);
    float duskBand = exp(-pow((dir.y - 0.04) * 4.8, 2.0));
    float sunAz = smoothstep(-0.2, 0.85, dot(normalize(vec2(dir.x, dir.z)), normalize(vec2(-0.49, 0.87))));
    vec3 skySrgb = mix(vec3(0.86, 0.72, 0.58), vec3(0.32, 0.54, 0.84), horizon);
    skySrgb += vec3(0.28, 0.14, 0.02) * duskBand * (0.4 + 0.6 * sunAz);
    vec3 s = clamp(skySrgb, 0.0, 1.0);
    return s * s;
  }

  vec3 crtToneMapSrgb(vec3 color) {
    color = max(color, vec3(0.0));
    float x = min(color.r, min(color.g, color.b));
    color -= x < 0.08 ? x - 6.25 * x * x : 0.04;
    float peak = max(color.r, max(color.g, color.b));
    if (peak >= 0.76) {
      float newPeak = 1.0 - 0.0576 / (peak - 0.52);
      color *= newPeak / peak;
      color = mix(color, vec3(newPeak), 1.0 - 1.0 / (0.15 * (peak - newPeak) + 1.0));
    }
    color = clamp(color, 0.0, 1.0);
    return mix(color * 12.92, 1.055 * pow(color, vec3(1.0 / 2.4)) - 0.055, step(vec3(0.0031308), color));
  }

  float fluidCurveY(float p, float tension, float u) {
    float bulge = sin(clamp(p, 0.0, 1.0) * 3.14159265) * 0.285 * tension;
    return min(1.0, p + bulge * 4.0 * u * (1.0 - u));
  }

  vec2 evaluateFluidMasks(vec2 uv, vec4 w) {
    if (w.x <= 0.0005 && w.y <= 0.0005 && w.z <= 0.0005 && w.w <= 0.0005) return vec2(0.0);
    float aa = max(fwidth(uv.y) * 1.5, 0.0025);
    if (w.z > 0.0005 || w.w > 0.0005) {
      float yLead = fluidCurveY(w.w, 1.25, uv.x);
      float yBody = fluidCurveY(w.z, 0.95, uv.x);
      float leadM = w.w <= 0.0005 ? 1.0 : (w.w >= 0.999 ? 0.0 : smoothstep(yLead - aa, yLead + aa, uv.y));
      float bodyM = w.z <= 0.0005 ? 1.0 : (w.z >= 0.999 ? 0.0 : smoothstep(yBody - aa, yBody + aa, uv.y));
      return vec2(max(leadM, bodyM), bodyM);
    }
    float yLead = fluidCurveY(w.x, 1.25, uv.x);
    float yBody = fluidCurveY(w.y, 0.95, uv.x);
    float leadM = w.x <= 0.0005 ? 0.0 : (w.x >= 0.999 ? 1.0 : 1.0 - smoothstep(yLead - aa, yLead + aa, uv.y));
    float bodyM = w.y <= 0.0005 ? 0.0 : (w.y >= 0.999 ? 1.0 : 1.0 - smoothstep(yBody - aa, yBody + aa, uv.y));
    return vec2(max(leadM, bodyM), bodyM);
  }

  vec4 evalCutoutGlass(vec3 gCol, vec3 sky, vec3 bloom, vec3 pTint, float envW, float gMask, float passBase, float dith) {
    vec3 refLin = gCol * (1.0 - gMask) + sky * envW + bloom;
    vec3 c0 = crtToneMapSrgb(refLin);
    vec3 c1 = crtToneMapSrgb(refLin + pTint * passBase * (1.0 - envW));
    float t = clamp(dot(c1 - c0, vec3(0.299, 0.587, 0.114)), 0.0, min(c1.r, min(c1.g, c1.b)));
    float a = 1.0 - t;
    return vec4(clamp(c1 - vec3(t) + dith * a, vec3(0.0), vec3(a)), a);
  }

  void main() {
    vec2 sc = vScreenCoord;
    float r2 = dot(sc, sc);
    float edgeMargin = max(0.0, -sdCrtTube(sc));

    vec3 N = normalize(vWorldNormal), V = normalize(cameraPosition - vWorldPos);
    vec3 R = reflect(-V, N);
    float omv = 1.0 - clamp(dot(N, V), 0.0, 1.0), omv2 = omv * omv;
    float fresnel = 0.085 + 0.915 * omv2 * sqrt(sqrt(omv));
    float studioPresence = smoothstep(2.55, 3.65, length(cameraPosition - vec3(0.0, 0.165, 1.1)));
    vec2 glbScreenUv = vec2(mix(0.211, 0.025, vUv.y), mix(0.496, 0.739, vUv.x));
    float glassRough = uHasRoughness > 0.5 ? clamp(texture2D(tRoughness, glbScreenUv).g, 0.06, 0.94) : 0.14;
    float wipeStreaks = smoothstep(0.14, 0.52, glassRough), edgeDust = smoothstep(0.32, 0.86, glassRough);
    float p = clamp(uPower, 0.0, 1.0), vDeflect = smoothstep(0.28, 0.92, p), hDeflect = smoothstep(0.03, 0.36, p);
    vec2 beamSc = vec2(sc.x / max(0.008, hDeflect), sc.y / max(0.006, vDeflect));
    float beamMask = (1.0 - smoothstep(0.98, 1.05, abs(beamSc.x))) * (1.0 - smoothstep(0.98, 1.06, abs(beamSc.y))) * smoothstep(0.0, 0.04, p);
    float beamR2 = dot(beamSc, beamSc);
    vec2 glassParallax = (N.xy - V.xy * 0.24) * (0.0065 * (0.35 + 0.65 * r2));
    vec2 barrelUv = clamp((beamSc * (0.972 + 0.026 * beamR2) + glassParallax) * 0.5 + 0.5, vec2(0.001), vec2(0.999));
    vec2 fluidMask = evaluateFluidMasks(barrelUv, uFluidWave);
    float cutout = clamp(uPortalCutout * (1.0 - fluidMask.x) * beamMask, 0.0, 1.0);

    float scanVis = smoothstep(1.6, 3.2, 1.0 / max(fwidth(vUv.y) * 220.0, 0.0001));
    float triadVis = smoothstep(2.0, 3.6, 1.0 / max(fwidth(vUv.x) * 300.0, 0.0001));
    float scanLuma = 1.0;
    if (scanVis > 0.001) {
      float scanWave = 0.5 + 0.5 * cos((fract(vUv.y * 220.0) - 0.5) * 6.2831853);
      scanLuma = mix(1.0, 0.90 + 0.13 * pow(scanWave, 0.72), scanVis);
    }
    float pixelLuma = scanLuma;
    vec3 pixelRgb = vec3(1.0);
    if (triadVis > 0.001) {
      float subX = fract(vUv.x * 300.0);
      float slotY = fract(vUv.y * 220.0 + 0.5 * mod(floor(vUv.x * 300.0), 2.0));
      float slotGap = smoothstep(0.0, 0.14, slotY) * smoothstep(1.0, 0.86, slotY);
      float pillarGap = smoothstep(0.0, 0.11, subX) * smoothstep(1.0, 0.89, subX);
      pixelLuma = scanLuma * mix(1.0, 0.92 + 0.10 * pillarGap * mix(0.82, 1.0, slotGap), triadVis);
      if (cutout < 0.999) {
        float tAng = subX * 6.2831853;
        pixelRgb = mix(vec3(1.0), vec3(1.0 + 0.16 * cos(tAng), 1.0 + 0.16 * cos(tAng - 2.0943951), 1.0 + 0.16 * cos(tAng - 4.1887902)), triadVis);
      }
    }

    float phosphorGain = mix(0.92, 0.86, studioPresence);
    float vignette = 1.0 - mix(0.11, 0.085, studioPresence) * r2;
    vec3 phosphorTint = vec3(1.0);
    float bezelShadow = smoothstep(0.0, 0.18, edgeMargin);
    float topOverhang = mix(0.20, 0.24, studioPresence) * exp(-max(0.0, 0.992 - sc.y) / 0.055);
    float sideDepth = 0.065 * exp(-max(0.0, 0.992 - abs(sc.x)) / 0.045);
    float aoFactor = clamp(mix(mix(0.58, 0.64, studioPresence), 1.0, pow(bezelShadow, 0.62)) - topOverhang - sideDepth, 0.32, 1.0);
    float gasketMask = smoothstep(0.0, 0.024, edgeMargin);
    vec3 gasketCol = vec3(0.012, 0.013, 0.015);

    vec3 keyDir = normalize(vec3(-0.46 + uPointer.x * 0.12, 0.34 + uPointer.y * 0.08, 0.82));
    float keyDot = max(0.0, dot(R, keyDir));
    float kd2 = keyDot * keyDot;
    float kd4 = kd2 * kd2;
    float kd16 = (kd4 * kd4) * (kd4 * kd4);
    float ndoth = max(0.0, dot(N, normalize(keyDir + V)));

    float envBlend = clamp(fresnel * mix(0.62, mix(0.08, 0.22, studioPresence), beamMask) + edgeDust * mix(0.05, 0.08, studioPresence), 0.0, 0.68);
    vec3 skyLinear = sampleConstructStudioLinear(R);
    vec2 skySpot = R.xy - keyDir.xy * 0.84;
    float softSheen = exp(-dot(skySpot, skySpot) * 4.6) * smoothstep(0.0, 0.25, R.z) * 0.42 * mix(1.0, mix(0.14, 0.58, studioPresence), beamMask);
    float gRough2 = clamp(glassRough * glassRough, 0.05, 0.65);
    float a2 = gRough2 * gRough2;
    float denom = ndoth * ndoth * (a2 - 1.0) + 1.0;
    float streakScatter = min(1.4, (a2 / (3.14159 * denom * denom)) * 0.08) * (0.28 + 0.72 * wipeStreaks);
    float keyHalo = kd16 * 0.14 + kd4 * (0.04 + 0.09 * wipeStreaks);
    float dustCatch = edgeDust * (0.03 + 0.10 * kd2);
    float innerRim = (omv2 * omv) * smoothstep(0.02, 0.10, edgeMargin) * (1.0 - smoothstep(0.10, 0.25, edgeMargin)) * 0.14;
    float glareScale = mix(0.92, mix(0.16, 0.44, studioPresence), beamMask) * smoothstep(0.0, 0.02, edgeMargin);
    vec3 glareTint = mix(vec3(1.0, 0.97, 0.94), vec3(1.0, 0.95, 0.90), studioPresence);
    vec3 specBloom = glareTint * (softSheen + streakScatter + keyHalo + dustCatch + innerRim) * glareScale;
    float dither = ditherNoise(gl_FragCoord.xy) / 255.0;
    float envWeight = envBlend * gasketMask;
    float passBase = phosphorGain * vignette * pixelLuma * aoFactor * gasketMask;

    if (uPortalCutout >= 0.999 && uPower >= 0.999 && uFluidWave.x <= 0.0005 && uFluidWave.y <= 0.0005 && uFluidWave.z <= 0.0005 && uFluidWave.w <= 0.0005) {
      gl_FragColor = evalCutoutGlass(gasketCol, skyLinear, specBloom, phosphorTint, envWeight, gasketMask, passBase, dither);
      return;
    }

    vec2 caShift = beamSc * (mix(0.00075, 0.0013, studioPresence) * beamR2);
    vec3 compSrgb;
    if (uPortalMode > 0.5) {
      vec2 pUv = mix(clamp(beamSc * 0.5 + 0.5, vec2(0.001), vec2(0.999)), barrelUv, studioPresence);
      vec3 pLin = vec3(texture2D(tPortal, clamp(pUv + caShift * 0.85, vec2(0.001), vec2(0.999))).r, texture2D(tPortal, pUv).g, texture2D(tPortal, clamp(pUv - caShift * 0.85, vec2(0.001), vec2(0.999))).b);
      compSrgb = pow(clamp(pLin, 0.0, 1.0), vec3(1.0 / 2.2));
    } else {
      float hi = max(0.002, uDrumUvScale - 0.0015);
      vec2 dUv = barrelUv * uDrumUvScale, dShift = caShift * uDrumUvScale;
      vec3 drumLin = vec3(texture2D(tDrum, clamp(dUv + dShift, vec2(0.001), vec2(hi))).r, texture2D(tDrum, clamp(dUv, vec2(0.001), vec2(hi))).g, texture2D(tDrum, clamp(dUv - dShift, vec2(0.001), vec2(hi))).b);
      vec3 drumSrgb = pow(clamp(drumLin, 0.0, 1.0), vec3(1.0 / 2.2));
      vec4 ed = texture2D(tEditorial, barrelUv);
      compSrgb = mix(drumSrgb, vec3(1.0) - drumSrgb, ed.a * mix(uTitleFade, 1.0, ed.r));
    }
    if (fluidMask.x > 0.001) {
      compSrgb = mix(compSrgb, mix(vec3(0.102, 0.090, 0.078), vec3(1.0), fluidMask.y), fluidMask.x);
    }
    vec3 basePhosphor = pow(clamp(compSrgb, 0.0, 1.0), vec3(2.2)) * phosphorGain * phosphorTint * vignette;
    vec3 litPhosphor = basePhosphor * pixelLuma * pixelRgb + vec3(0.94, 0.97, 1.0) * ((1.0 - vDeflect) * smoothstep(0.02, 0.25, p) * 1.25);
    vec3 offGlass = vec3(0.048, 0.054, 0.06) * (1.0 - 0.22 * r2) + vec3(0.05) * edgeDust;
    vec3 crtBody = mix(gasketCol, mix(offGlass, litPhosphor, beamMask) * aoFactor, gasketMask);
    vec3 opaqueSrgb = crtToneMapSrgb(mix(crtBody, skyLinear, envWeight) + specBloom) + dither;
    if (cutout <= 0.001) {
      gl_FragColor = vec4(clamp(opaqueSrgb, 0.0, 1.0), 1.0);
      return;
    }
    vec4 cutCol = evalCutoutGlass(gasketCol, skyLinear, specBloom, phosphorTint, envWeight, gasketMask, passBase, dither);
    gl_FragColor = mix(vec4(clamp(opaqueSrgb, 0.0, 1.0), 1.0), cutCol, cutout);
  }
`;
