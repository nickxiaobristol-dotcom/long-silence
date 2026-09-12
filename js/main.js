import * as THREE from "three";
import { buildShip } from "./ship.js";
import { PlayerController } from "./player.js";
import { buildCrew, findNearbyCrew } from "./crew.js";

const container = document.getElementById("scene-container");
const interactPrompt = document.getElementById("interact-prompt");
const dialoguePanel = document.getElementById("dialogue-panel");
const dialogueSpeaker = document.getElementById("dialogue-speaker");
const dialogueLine = document.getElementById("dialogue-line");

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
buildCrew(scene);

// Start in the Common Area, the ship's central hub.
const player = new PlayerController(camera, 1, 0);
player.addTo(scene);

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// Step 3 placeholder: pressing E near a crew member shows their name and
// one flavor line. Step 4 replaces this with real branching dialogue.
let dialogueOpen = false;
let nearbyCrew = null;

function openDialogue(member) {
  dialogueOpen = true;
  dialogueSpeaker.textContent = `${member.name} — ${member.role}`;
  dialogueLine.textContent = member.line;
  dialoguePanel.hidden = false;
  interactPrompt.hidden = true;
}

function closeDialogue() {
  dialogueOpen = false;
  dialoguePanel.hidden = true;
}

window.addEventListener("keydown", (e) => {
  if (e.code === "KeyE") {
    if (dialogueOpen) {
      closeDialogue();
    } else if (nearbyCrew) {
      openDialogue(nearbyCrew);
    }
  } else if (e.code === "Escape" && dialogueOpen) {
    closeDialogue();
  }
});

let lastTime = performance.now();
function animate() {
  requestAnimationFrame(animate);
  const now = performance.now();
  const dt = Math.min((now - lastTime) / 1000, 0.1);
  lastTime = now;

  player.update(dt);

  nearbyCrew = findNearbyCrew(player.x, player.z);
  if (dialogueOpen && !nearbyCrew) closeDialogue();
  if (!dialogueOpen) {
    interactPrompt.hidden = !nearbyCrew;
    if (nearbyCrew) {
      interactPrompt.textContent = `Press E to talk to ${nearbyCrew.name}`;
    }
  }

  renderer.render(scene, camera);
}
animate();
