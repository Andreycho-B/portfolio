import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";

const ENVIRONMENT_INTENSITY = 0.5;

const addLights = (scene: THREE.Scene): void => {
  scene.add(new THREE.AmbientLight(0xffffff, 0.55));

  const keyLight = new THREE.DirectionalLight(0xffffff, 1.2);
  keyLight.position.set(2, 4, 10);
  scene.add(keyLight);

  // Rim rasante superior-izquierda y contra desde la derecha, en blanco puro
  const rimUpper = new THREE.DirectionalLight(0xffffff, 4.5);
  rimUpper.position.set(-8, 12, 4);
  scene.add(rimUpper);

  const rimSide = new THREE.DirectionalLight(0xffffff, 3.0);
  rimSide.position.set(8, -6, -2);
  scene.add(rimSide);
};

export const setupHelixEnvironment = (
  scene: THREE.Scene,
  renderer: THREE.WebGLRenderer,
): THREE.Texture => {
  addLights(scene);

  const pmremGenerator = new THREE.PMREMGenerator(renderer);
  const environmentTexture = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
  pmremGenerator.dispose();
  scene.environment = environmentTexture;
  scene.environmentIntensity = ENVIRONMENT_INTENSITY;

  return environmentTexture;
};
