import {
  BoxGeometry,
  type BufferGeometry,
  CylinderGeometry,
  ExtrudeGeometry,
  Path,
  Shape,
} from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { mapNokiaKeycapUvs } from "./studio-nokia-keycap-atlas";
import {
  NOKIA_FRONT_Y,
  NOKIA_KEY_SPECS,
  type NokiaKeyShape,
  type NokiaKeySpec,
} from "./studio-nokia-keypad";

const buildOvalPillShape = (w: number, d: number): Shape => {
  const [hw, hd] = [w * 0.5, d * 0.5];
  const s = new Shape();
  s.moveTo(-hw, 0);
  s.bezierCurveTo(-hw, hd * 0.96, -hw * 0.42, hd, 0, hd);
  s.bezierCurveTo(hw * 0.42, hd, hw, hd * 0.96, hw, 0);
  s.bezierCurveTo(hw, -hd * 0.96, hw * 0.42, -hd, 0, -hd);
  s.bezierCurveTo(-hw * 0.42, -hd, -hw, -hd * 0.96, -hw, 0);
  return s;
};
const buildNaviLozengeShape = (w: number, d: number): Shape => {
  const [hw, hd] = [w * 0.5, d * 0.5];
  const s = new Shape();
  s.moveTo(-hw, -hd * 0.35);
  s.quadraticCurveTo(0, hd * 1.15, hw, -hd * 0.35);
  s.quadraticCurveTo(hw * 0.85, -hd * 0.92, 0, -hd * 0.82);
  s.quadraticCurveTo(-hw * 0.85, -hd * 0.92, -hw, -hd * 0.35);
  return s;
};
const buildClearWedgeShape = (w: number, d: number): Shape => {
  const [hw, hd] = [w * 0.5, d * 0.5];
  const s = new Shape();
  s.moveTo(-hw, -hd * 0.25);
  s.quadraticCurveTo(-hw * 0.1, hd * 1.0, hw * 0.96, hd * 0.62);
  s.quadraticCurveTo(hw * 1.04, 0, hw * 0.78, -hd * 0.78);
  s.quadraticCurveTo(-hw * 0.25, -hd * 0.92, -hw, -hd * 0.25);
  return s;
};
const buildRockerBoomerangShape = (w: number, d: number): Shape => {
  const [hw, hd] = [w * 0.5, d * 0.5];
  const s = new Shape();
  s.moveTo(-hw * 0.98, hd * 0.48);
  s.quadraticCurveTo(0, hd * 1.14, hw * 0.98, hd * 0.24);
  s.quadraticCurveTo(hw * 1.02, -hd * 0.52, hw * 0.72, -hd * 0.86);
  s.quadraticCurveTo(0, -hd * 0.38, -hw * 0.8, -hd * 0.68);
  s.quadraticCurveTo(-hw * 1.06, -hd * 0.18, -hw * 0.98, hd * 0.48);
  return s;
};

const createShapeForKind = (kind: NokiaKeyShape, w: number, d: number): Shape => {
  if (kind === "navi") return buildNaviLozengeShape(w, d);
  if (kind === "clear") return buildClearWedgeShape(w, d);
  if (kind === "rocker") return buildRockerBoomerangShape(w, d);
  return buildOvalPillShape(w, d);
};

export const buildNokiaKeycapGeo = (spec: NokiaKeySpec): ExtrudeGeometry => {
  const bevelSize = Math.min(0.0032, spec.d * 0.11);
  const shape = createShapeForKind(spec.shape, spec.w - bevelSize * 2, spec.d - bevelSize * 2);
  const isCluster = spec.shape !== "pill";
  const geo = new ExtrudeGeometry(shape, {
    depth: spec.h * 0.28,
    bevelEnabled: true,
    bevelThickness: spec.h * 0.36,
    bevelSize,
    bevelSegments: 2,
    curveSegments: 10,
  });
  geo.rotateX(-Math.PI * 0.5);

  // Smooth ergonomic pillow crown (rounded cushion feel, zero boxy skyscraper sides)
  geo.computeBoundingBox();
  const box = geo.boundingBox;
  const pos = geo.getAttribute("position");
  if (box && pos) {
    const minY = box.min.y;
    const spanY = Math.max(1e-5, box.max.y - minY);
    const halfW = Math.max(1e-5, (box.max.x - box.min.x) * 0.5);
    const halfD = Math.max(1e-5, (box.max.z - box.min.z) * 0.5);
    const cx = (box.min.x + box.max.x) * 0.5;
    const cz = (box.min.z + box.max.z) * 0.5;
    const domeH = isCluster ? 0.0016 : 0.0024;
    for (let i = 0; i < pos.count; i += 1) {
      const y = pos.getY(i) - minY;
      const topWeight = Math.max(0, (y / spanY - 0.45) / 0.55);
      const nx = (pos.getX(i) - cx) / halfW;
      const nz = (pos.getZ(i) - cz) / halfD;
      const dome = Math.max(0, 1 - (nx * nx + nz * nz) * 0.78) * domeH * topWeight;
      pos.setY(i, y + dome);
    }
    pos.needsUpdate = true;
  }
  geo.computeVertexNormals();
  mapNokiaKeycapUvs(geo, spec.id);
  return geo;
};

const finishFlatGeo = (geo: ExtrudeGeometry): ExtrudeGeometry => {
  geo.rotateX(-Math.PI * 0.5);
  geo.computeBoundingBox();
  if (geo.boundingBox) geo.translate(0, -geo.boundingBox.min.y, 0);
  geo.computeVertexNormals();
  return geo;
};

const buildNokiaKeywellGeo = (spec: NokiaKeySpec): ExtrudeGeometry =>
  finishFlatGeo(
    new ExtrudeGeometry(createShapeForKind(spec.shape, spec.w * 1.07, spec.d * 1.09), {
      depth: 0.0009,
      bevelEnabled: true,
      bevelThickness: 0.0005,
      bevelSize: 0.0008,
      bevelSegments: 1,
      curveSegments: 8,
    }),
  );

const addRoundedRectPath = (
  target: Shape | Path,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void => {
  const rr = Math.min(r, w * 0.5, h * 0.5);
  target.moveTo(x + rr, y);
  target.lineTo(x + w - rr, y);
  target.quadraticCurveTo(x + w, y, x + w, y + rr);
  target.lineTo(x + w, y + h - rr);
  target.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
  target.lineTo(x + rr, y + h);
  target.quadraticCurveTo(x, y + h, x, y + h - rr);
  target.lineTo(x, y + rr);
  target.quadraticCurveTo(x, y, x + rr, y);
};

// Flush low-profile sculpted 3D silver Nokia 3310 U-arch bezel & Navi cluster bridge
export const buildNokiaSilverBezelGeo = (): ExtrudeGeometry => {
  const outer = new Shape();
  addRoundedRectPath(outer, -0.134, -0.092, 0.268, 0.432, 0.076);
  const hole = new Path();
  addRoundedRectPath(hole, -0.114, 0.011, 0.228, 0.312, 0.046);
  outer.holes.push(hole);
  return finishFlatGeo(
    new ExtrudeGeometry(outer, {
      depth: 0.0012,
      bevelEnabled: true,
      bevelThickness: 0.0008,
      bevelSize: 0.0014,
      bevelSegments: 2,
      curveSegments: 12,
    }),
  );
};

const toCleanNonIndexed = (geo: BufferGeometry): BufferGeometry => {
  const out = geo.index ? geo.toNonIndexed() : geo.clone();
  if (out.getAttribute("uv")) out.deleteAttribute("uv");
  geo.dispose();
  return out;
};

// Merges all 24 static dark trim parts (5 earpiece slots + 4 screen rims + 15 keywells) into 1 draw call
export const buildNokiaDarkTrimGeo = (): BufferGeometry | null => {
  const parts: BufferGeometry[] = [];
  for (let i = 0; i < 5; i += 1) {
    const slot = new CylinderGeometry(0.0046, 0.004, 0.0018, 8);
    slot.translate(0, NOKIA_FRONT_Y + 0.0004, -0.252 - i * 0.017);
    parts.push(toCleanNonIndexed(slot));
  }
  const rims: readonly [number, number, number, number][] = [
    [0.222, 0.0045, -0.001, -0.174],
    [0.222, 0.0045, -0.001, -0.014],
    [0.0045, 0.162, -0.111, -0.094],
    [0.0045, 0.162, 0.109, -0.094],
  ];
  for (const [w, d, x, z] of rims) {
    const bar = new BoxGeometry(w, 0.0032, d);
    bar.translate(x, NOKIA_FRONT_Y + 0.0006, z);
    parts.push(toCleanNonIndexed(bar));
  }
  for (const spec of NOKIA_KEY_SPECS) {
    const well = buildNokiaKeywellGeo(spec);
    well.rotateY(spec.rotY);
    well.translate(spec.x, NOKIA_FRONT_Y + (spec.bridgeLift ?? 0) - 0.0002, spec.z);
    parts.push(toCleanNonIndexed(well));
  }
  const merged = mergeGeometries(parts, false);
  for (const g of parts) g.dispose();
  return merged;
};
