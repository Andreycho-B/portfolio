import * as THREE from "three";

// Cámara teleobjetivo: FOV estrecho (32°) que comprime la perspectiva
export const CAMERA_FOV_DEG = 32;

// Encuadre automático sobre el arco visible (tarjetas 1..8): la tarjeta
// frontal queda deliberadamente recortada por el borde inferior-izquierdo
// del encuadre, como en la referencia. FOV teleobjetivo conservado.
// El bbox es canónico (slots 1..8): el encuadre no depende del avance.
export const frameHelix = (
  camera: THREE.PerspectiveCamera,
  framingBox: THREE.Box3,
  aspect: number,
): void => {
  const center = framingBox.getCenter(new THREE.Vector3());
  const size = framingBox.getSize(new THREE.Vector3());

  const margin = 1.06;
  const halfHeight = (size.y * margin) / 2;
  const halfWidth = (size.x * margin) / 2;
  const halfFovRad = THREE.MathUtils.degToRad(CAMERA_FOV_DEG) / 2;
  const distanceByHeight = halfHeight / Math.tan(halfFovRad);
  const distanceByWidth = halfWidth / (Math.tan(halfFovRad) * aspect);
  const distance = Math.max(distanceByHeight, distanceByWidth);

  camera.position.set(center.x, center.y + distance * 0.1, center.z + distance);
  camera.lookAt(center);
};
