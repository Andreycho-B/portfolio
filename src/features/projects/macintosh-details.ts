import {
  type BufferGeometry,
  CircleGeometry,
  ExtrudeGeometry,
  Group,
  Mesh,
  type MeshPhysicalMaterial,
  MeshStandardMaterial,
} from "three";
import {
  createCurvedPedestalGeometry,
  createRoundedSquareShape,
} from "./macintosh-detail-geometries";
import {
  evalFrontSlope,
  evalFrontSurfaceZ,
  evalGrooveY,
  MACINTOSH_SPEC,
} from "./macintosh-profile";

export interface MacintoshDetailsHandle {
  readonly group: Group;
  readonly powerButtonMesh: Mesh;
  readonly setPowerButtonDepth: (pressedRatio: number) => void;
  readonly dispose: () => void;
}

export const createMacintoshDetails = (
  platinumMaterial: MeshPhysicalMaterial,
): MacintoshDetailsHandle => {
  const group = new Group();
  const geometries: BufferGeometry[] = [];
  const materials: (MeshStandardMaterial | MeshPhysicalMaterial)[] = [];

  const pwrX = MACINTOSH_SPEC.powerButtonX;
  const pwrY = MACINTOSH_SPEC.powerButtonY;
  const pwrSlope = evalFrontSlope(pwrX, pwrY);
  const powerGroup = new Group();
  powerGroup.position.set(pwrX, pwrY, evalFrontSurfaceZ(pwrX, pwrY) + 0.0028);
  powerGroup.rotation.set(Math.atan(pwrSlope.y), -Math.atan(pwrSlope.x), 0);

  const pocketGeo = new ExtrudeGeometry(createRoundedSquareShape(0.048, 0.012), {
    depth: 0.001,
    bevelEnabled: false,
    curveSegments: 8,
  });
  const pocketMat = new MeshStandardMaterial({
    color: 0x6c7076,
    roughness: 0.88,
    polygonOffset: true,
    polygonOffsetFactor: -2,
  });
  geometries.push(pocketGeo);
  materials.push(pocketMat);
  const pocketMesh = new Mesh(pocketGeo, pocketMat);
  pocketMesh.position.set(0, 0, 0.0003);
  powerGroup.add(pocketMesh);

  const btnGeo = new ExtrudeGeometry(createRoundedSquareShape(0.042, 0.01), {
    depth: 0.004,
    bevelEnabled: true,
    bevelThickness: 0.002,
    bevelSize: 0.002,
    bevelSegments: 4,
    curveSegments: 8,
  });
  const btnMat = platinumMaterial.clone();
  btnMat.vertexColors = false;
  btnMat.color.setHex(0xe2e0dc);
  geometries.push(btnGeo);
  materials.push(btnMat);
  const powerButtonMesh = new Mesh(btnGeo, btnMat);
  powerButtonMesh.name = "powerButton";
  const baseButtonZ = 0.0015;
  powerButtonMesh.position.set(0, 0, baseButtonZ);
  powerGroup.add(powerButtonMesh);
  group.add(powerGroup);

  const pinX = MACINTOSH_SPEC.pinholeX;
  const pinY = evalGrooveY(pinX) - 0.022;
  const pinSlope = evalFrontSlope(pinX, pinY);
  const pinGeo = new CircleGeometry(0.0095, 20);
  const pinMat = new MeshStandardMaterial({
    color: 0x0c0e12,
    roughness: 0.94,
    metalness: 0.0,
    polygonOffset: true,
    polygonOffsetFactor: -3,
  });
  geometries.push(pinGeo);
  materials.push(pinMat);
  const pinMesh = new Mesh(pinGeo, pinMat);
  pinMesh.position.set(pinX, pinY, evalFrontSurfaceZ(pinX, pinY) + 0.0018);
  pinMesh.rotation.set(Math.atan(pinSlope.y), -Math.atan(pinSlope.x), 0);
  group.add(pinMesh);

  const pedestalGeo = createCurvedPedestalGeometry();
  const pedestalMat = new MeshStandardMaterial({
    color: 0x5c6872,
    vertexColors: true,
    roughness: 0.66,
    metalness: 0.0,
    envMapIntensity: 0.52,
  });
  geometries.push(pedestalGeo);
  materials.push(pedestalMat);
  group.add(new Mesh(pedestalGeo, pedestalMat));

  return {
    group,
    powerButtonMesh,
    setPowerButtonDepth: (pressedRatio: number) => {
      powerButtonMesh.position.z = baseButtonZ - pressedRatio * 0.0011;
    },
    dispose: () => {
      for (const geo of geometries) geo.dispose();
      for (const mat of materials) mat.dispose();
    },
  };
};
