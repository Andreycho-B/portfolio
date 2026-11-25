import {
  BoxGeometry,
  type BufferGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  type Object3D,
} from "three";
import {
  buildNokiaDarkTrimGeo,
  buildNokiaKeycapGeo,
  buildNokiaSilverBezelGeo,
} from "./studio-nokia-bezel";
import { createNokiaKeycapAtlas } from "./studio-nokia-keycap-atlas";
import {
  applyNokiaShellPbr,
  buildNokiaDomedLensGeo,
  buildNokiaShellPbrMaps,
  NOKIA_FRONT_Y,
  NOKIA_KEY_SPECS,
  NOKIA_PRESS_DEPTH,
  type NokiaButtonId,
} from "./studio-nokia-keypad";

export type { NokiaButtonId } from "./studio-nokia-keypad";

interface AnimatedButton {
  readonly id: NokiaButtonId;
  readonly node: Object3D;
  readonly baseY: number;
  press: number;
}

export interface StudioNokiaHardwareHandle {
  readonly root: Group;
  readonly buttonMeshes: readonly Mesh[];
  readonly resolveButtonId: (object: Object3D) => NokiaButtonId | null;
  readonly triggerPress: (id: NokiaButtonId) => void;
  readonly update: (dtSeconds: number) => boolean;
  readonly dispose: () => void;
}

const freezeMesh = (mesh: Mesh): void => {
  mesh.updateMatrix();
  mesh.matrixAutoUpdate = false;
};

export const createStudioNokiaHardware = (nokiaModel: Object3D): StudioNokiaHardwareHandle => {
  const root = new Group();
  root.name = "nokiaTactileHardware";
  const { bump, rough } = buildNokiaShellPbrMaps();
  const keycapAtlas = createNokiaKeycapAtlas();
  const disposables: BufferGeometry[] = [];
  applyNokiaShellPbr(nokiaModel, bump, rough);

  const silverBezelGeo = buildNokiaSilverBezelGeo();
  const darkTrimGeo = buildNokiaDarkTrimGeo();
  const lensGeo = buildNokiaDomedLensGeo();
  const blueBarGeo = new CylinderGeometry(0.0016, 0.0016, 0.036, 8);
  const hitBoxGeo = new BoxGeometry(1, 1, 1);
  disposables.push(silverBezelGeo, lensGeo, blueBarGeo, hitBoxGeo);

  const silverMat = new MeshStandardMaterial({
    color: 0xbac4d2,
    roughness: 0.28,
    metalness: 0.36,
    envMapIntensity: 1.65,
  });
  const silverBezel = new Mesh(silverBezelGeo, silverMat);
  silverBezel.position.set(0, NOKIA_FRONT_Y - 0.0002, 0);
  silverBezel.castShadow = false;
  silverBezel.receiveShadow = true;
  freezeMesh(silverBezel);
  root.add(silverBezel);

  const darkMat = new MeshStandardMaterial({ color: 0x10141d, roughness: 0.65, metalness: 0.12 });
  if (darkTrimGeo) {
    disposables.push(darkTrimGeo);
    const darkMesh = new Mesh(darkTrimGeo, darkMat);
    freezeMesh(darkMesh);
    root.add(darkMesh);
  }

  const lensMat = new MeshStandardMaterial({
    color: 0xf4f8ff,
    transparent: true,
    opacity: 0.18,
    depthWrite: false,
    roughness: 0.02,
    metalness: 0.12,
    envMapIntensity: 4.2,
  });
  const lensMesh = new Mesh(lensGeo, lensMat);
  lensMesh.name = "nokiaAcrylicLens";
  lensMesh.rotation.x = -Math.PI * 0.5;
  lensMesh.position.set(-0.001, NOKIA_FRONT_Y + 0.002, -0.094);
  lensMesh.renderOrder = 2;
  freezeMesh(lensMesh);
  root.add(lensMesh);

  const blueMat = new MeshStandardMaterial({ color: 0x0d68d6, roughness: 0.22, metalness: 0.16 });
  const hitMat = new MeshBasicMaterial({ visible: false });
  const pearlKeyMat = new MeshStandardMaterial({
    map: keycapAtlas,
    metalness: 0.18,
    roughness: 0.25,
    envMapIntensity: 1.65,
  });
  const clusterKeyMat = new MeshStandardMaterial({
    map: keycapAtlas,
    metalness: 0.34,
    roughness: 0.24,
    envMapIntensity: 1.75,
  });

  const buttonMeshes: Mesh[] = [];
  const lookup = new Map<Object3D, NokiaButtonId>();
  const animated: AnimatedButton[] = [];

  for (const spec of NOKIA_KEY_SPECS) {
    const baseY = NOKIA_FRONT_Y + (spec.bridgeLift ?? 0);
    const capGeo = buildNokiaKeycapGeo(spec);
    disposables.push(capGeo);

    const keyGroup = new Group();
    keyGroup.position.set(spec.x, baseY + 0.0004, spec.z);
    keyGroup.rotation.y = spec.rotY;
    const cap = new Mesh(capGeo, spec.shape === "pill" ? pearlKeyMat : clusterKeyMat);
    cap.name = `nokiaBtn_${spec.id}`;
    cap.castShadow = false;
    cap.receiveShadow = true;
    freezeMesh(cap);
    keyGroup.add(cap);

    if (spec.id === "call") {
      const bar = new Mesh(blueBarGeo, blueMat);
      bar.rotation.z = Math.PI * 0.5;
      bar.position.y = 0.0066;
      freezeMesh(bar);
      keyGroup.add(bar);
    }
    keyGroup.updateMatrix();
    keyGroup.matrixAutoUpdate = false;
    root.add(keyGroup);

    const proxy = new Mesh(hitBoxGeo, hitMat);
    proxy.position.set(spec.x, baseY + 0.0045, spec.z);
    proxy.rotation.y = spec.rotY;
    proxy.scale.set(spec.w, 0.012, spec.d);
    freezeMesh(proxy);
    root.add(proxy);

    buttonMeshes.push(proxy);
    lookup.set(proxy, spec.id);
    animated.push({ id: spec.id, node: keyGroup, baseY: baseY + 0.0004, press: 0 });
  }

  return {
    root,
    buttonMeshes,
    resolveButtonId: (obj) => lookup.get(obj) ?? null,
    triggerPress: (id) => {
      const target = animated.find((item) => item.id === id);
      if (!target) return;
      target.press = 1;
      target.node.position.y = target.baseY - NOKIA_PRESS_DEPTH;
      target.node.updateMatrix();
    },
    update: (dtSeconds) => {
      let moving = false;
      const decay = Math.exp(-16 * Math.min(dtSeconds, 0.05));
      for (const item of animated) {
        if (item.press <= 0.005) {
          if (item.press !== 0) {
            item.press = 0;
            item.node.position.y = item.baseY;
            item.node.updateMatrix();
          }
          continue;
        }
        item.press *= decay;
        item.node.position.y = item.baseY - item.press * NOKIA_PRESS_DEPTH;
        item.node.updateMatrix();
        moving = true;
      }
      return moving;
    },
    dispose: () => {
      for (const g of disposables) g.dispose();
      const mats = [bump, rough, keycapAtlas, silverMat, darkMat, blueMat, lensMat, hitMat];
      for (const r of [...mats, pearlKeyMat, clusterKeyMat]) r.dispose();
    },
  };
};
