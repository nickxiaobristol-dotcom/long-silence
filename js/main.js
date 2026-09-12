import * as THREE from "three";
import { buildShip } from "./ship.js";
import { PlayerController } from "./player.js";

const container = document.getElementById("scene-container");

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x05070a);

const camera = new THREE.PerspectiveCamera(
  55,
  window.innerWidth / window.innerHeight,
  0.1,
  100
);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
container.appendChild(renderer.domElement);

scene.add(new THREE.AmbientLight(0x8899aa, 0.7));
const keyLight = new THREE.DirectionalLight(0xffffff, 0.7);
keyLight.position.set(5, 12, 6);
scene.add(keyLight);

buildShip(scene);

// Start in the Common Area, the ship's central hub.
const player = new PlayerController(camera, 1, 0);
player.addTo(scene);

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

let lastTime = performance.now();
function animate() {
  requestAnimationFrame(animate);
  const now = performance.now();
  const dt = Math.min((now - lastTime) / 1000, 0.1);
  lastTime = now;

  player.update(dt);
  renderer.render(scene, camera);
}
animate();
