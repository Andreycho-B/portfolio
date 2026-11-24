export interface ContourSample {
  readonly x: number;
  readonly y: number;
  readonly nx: number;
  readonly ny: number;
  readonly wallT: number;
}

export interface Point2D {
  readonly x: number;
  readonly y: number;
}

export interface TrapezoidSpec {
  readonly halfWTop: number;
  readonly halfWBot: number;
  readonly yTop: number;
  readonly yBot: number;
  readonly rTop: number;
  readonly rBot: number;
  readonly topArch: number;
  readonly botSmile: number;
}

export const MACINTOSH_SPEC = {
  frontCenterZ: 0.74,
  rearZ: -1.42,
  filletDepth: 0.2,
  bezelRecessDepth: 0.145,
  gasketRecessDepth: 0.085,
  grooveCenterY: -0.602,
  grooveCurveK: 0.03,
  grooveTopDy: 0.028,
  grooveBotDy: -0.056,
  screenCenterY: 0.326,
  chinBottomCenterY: -1.12,
  pedestalTopY: -1.07,
  pedestalBottomY: -1.3,
  powerButtonX: 0.405,
  powerButtonY: -0.83,
  floppyStartX: 0.06,
  floppyEndX: 1.075,
  pinholeX: 1.155,
} as const;

export const evalGrooveY = (x: number): number =>
  MACINTOSH_SPEC.grooveCenterY + MACINTOSH_SPEC.grooveCurveK * x * x;

export const evalChinBottomY = (x: number): number =>
  MACINTOSH_SPEC.chinBottomCenterY + 0.052 * x * x;

export const evalFrontSurfaceZ = (x: number, y: number): number => {
  const radialX = 0.058 * x * x;
  const radialY = 0.034 * (y - 0.08) * (y - 0.08);
  const chinRoll = y < -0.94 ? 0.62 * (y + 0.94) * (y + 0.94) : 0;
  return MACINTOSH_SPEC.frontCenterZ - radialX - radialY - chinRoll;
};

export const evalSideBowScaleAtY = (y: number): number =>
  1 + 0.058 * Math.sin(Math.PI * Math.min(1, Math.max(0, (1.02 - y) / 1.594)));

export const evalFrontSlope = (x: number, y: number): Point2D => {
  const eps = 0.005;
  const dzdx = (evalFrontSurfaceZ(x + eps, y) - evalFrontSurfaceZ(x - eps, y)) / (2 * eps);
  const dzdy = (evalFrontSurfaceZ(x, y + eps) - evalFrontSurfaceZ(x, y - eps)) / (2 * eps);
  return { x: dzdx, y: dzdy };
};

const sampleCornerArc = (
  cx: number,
  cy: number,
  r: number,
  a0: number,
  a1: number,
  steps: number,
  out: Point2D[],
): void => {
  for (let i = 0; i < steps; i++) {
    const a = a0 + (a1 - a0) * (i / steps);
    out.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r });
  }
};

const sampleLine = (x0: number, y0: number, x1: number, y1: number, s: number, out: Point2D[]) => {
  for (let i = 0; i < s; i++) {
    out.push({ x: x0 + (x1 - x0) * (i / s), y: y0 + (y1 - y0) * (i / s) });
  }
};

export const sampleRoundedTrapezoid = (spec: TrapezoidSpec): readonly ContourSample[] => {
  const raw: Point2D[] = [];
  const sideSteps = 26;
  const topBotSteps = 34;
  const cornerSteps = 10;

  const { halfWTop, halfWBot, yTop, yBot, rTop, rBot, topArch, botSmile } = spec;
  const trX = halfWTop - rTop;
  const trY = yTop - rTop;
  const tlX = -halfWTop + rTop;
  const tlY = yTop - rTop;
  const blX = -halfWBot + rBot;
  const blY = yBot + rBot;
  const brX = halfWBot - rBot;
  const brY = yBot + rBot;

  const rightAngle = Math.atan2(halfWBot - halfWTop, yTop - yBot);

  sampleLine(
    brX + Math.cos(rightAngle) * rBot,
    brY + Math.sin(rightAngle) * rBot,
    trX + Math.cos(rightAngle) * rTop,
    trY + Math.sin(rightAngle) * rTop,
    sideSteps,
    raw,
  );
  sampleCornerArc(trX, trY, rTop, rightAngle, Math.PI * 0.5, cornerSteps, raw);
  sampleLine(trX, yTop, tlX, yTop, topBotSteps, raw);
  sampleCornerArc(tlX, tlY, rTop, Math.PI * 0.5, Math.PI - rightAngle, cornerSteps, raw);
  sampleLine(
    tlX - Math.cos(rightAngle) * rTop,
    tlY + Math.sin(rightAngle) * rTop,
    blX - Math.cos(rightAngle) * rBot,
    blY + Math.sin(rightAngle) * rBot,
    sideSteps,
    raw,
  );
  sampleCornerArc(blX, blY, rBot, Math.PI - rightAngle, Math.PI * 1.5, cornerSteps, raw);
  sampleLine(blX, yBot, brX, yBot, topBotSteps, raw);
  sampleCornerArc(brX, brY, rBot, Math.PI * 1.5, Math.PI * 2 + rightAngle, cornerSteps, raw);

  const midY = (yTop + yBot) * 0.5;
  const halfH = Math.max(0.001, (yTop - yBot) * 0.5);
  const deformed: Point2D[] = raw.map((pt) => {
    const ny = (pt.y - midY) / halfH;
    const refW = ny > 0 ? halfWTop : halfWBot;
    const nxRatio = Math.min(1.2, Math.abs(pt.x) / Math.max(0.001, refW));
    const archDy = ny > 0 ? topArch * (1 - nxRatio * nxRatio) * ny : 0;
    const smileDy = ny < 0 ? botSmile * nxRatio * nxRatio * -ny : 0;
    const y = pt.y + archDy + smileDy;
    return { x: pt.x * evalSideBowScaleAtY(y), y };
  });

  const count = deformed.length;
  const samples: ContourSample[] = [];
  for (let i = 0; i < count; i++) {
    const prev = deformed[(i - 1 + count) % count];
    const curr = deformed[i];
    const next = deformed[(i + 1) % count];
    if (!prev || !curr || !next) continue;
    const tx = next.x - prev.x;
    const ty = next.y - prev.y;
    const len = Math.hypot(tx, ty) || 1;
    const nx = ty / len;
    const ny = -tx / len;
    samples.push({ x: curr.x, y: curr.y, nx, ny, wallT: i / count });
  }
  const first = samples[0];
  if (first) samples.push({ ...first, wallT: 1 });
  return samples;
};

export const UPPER_OUTER_SPEC: TrapezoidSpec = {
  halfWTop: 1.135,
  halfWBot: 1.385,
  yTop: 1.175,
  yBot: MACINTOSH_SPEC.grooveCenterY + MACINTOSH_SPEC.grooveTopDy,
  rTop: 0.21,
  rBot: 0.004,
  topArch: 0.135,
  botSmile: 0.06,
};

export const BEZEL_RIDGE_SPEC: TrapezoidSpec = {
  halfWTop: 0.948,
  halfWBot: 1.058,
  yTop: 1.008,
  yBot: -0.324,
  rTop: 0.115,
  rBot: 0.056,
  topArch: 0.1,
  botSmile: 0.011,
};

export const SCREEN_INNER_SPEC: TrapezoidSpec = {
  halfWTop: 0.916,
  halfWBot: 1.026,
  yTop: 0.968,
  yBot: -0.315,
  rTop: 0.095,
  rBot: 0.048,
  topArch: 0.095,
  botSmile: 0.01,
};
