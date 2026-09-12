import * as THREE from "three";
import { buildShip } from "./ship.js";
import { PlayerController } from "./player.js";
import { buildCrew, findNearbyCrew } from "./crew.js";
import { CREW_DIALOGUE } from "./dialogue-data.js";
import {
  createDialogueState,
  getActivity,
  startConversation,
  selectTopic,
  resolveRelationshipChoice,
  resolveDecision,
} from "./dialogue.js";

const container = document.getElementById("scene-container");
const interactPrompt = document.getElementById("interact-prompt");
const dialoguePanel = document.getElementById("dialogue-panel");
const dialogueSpeaker = document.getElementById("dialogue-speaker");
const dialogueLine = document.getElementById("dialogue-line");
const dialogueChoices = document.getElementById("dialogue-choices");

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

// Step 4: branching dialogue. dialogueState persists relationship/history
// per crew member for the whole session; the engine in dialogue.js picks
// context-appropriate lines from the content bank in dialogue-data.js.
const dialogueState = createDialogueState();
let dialogueOpen = false;
let nearbyCrew = null;
let activeMember = null;

function renderSpeaker(member, extra) {
  const bank = CREW_DIALOGUE[member.id];
  dialogueSpeaker.textContent = `${member.name} — ${member.role} (${bank.room}${extra ? `, ${extra}` : ""})`;
}

function renderChoices(choices) {
  dialogueChoices.innerHTML = "";
  for (const choice of choices) {
    const li = document.createElement("li");
    li.textContent = choice.label;
    li.addEventListener("click", () => handleChoice(choice.id));
    dialogueChoices.appendChild(li);
  }
}

function renderRelationshipOptions(prompt, options) {
  dialogueLine.textContent = prompt;
  dialogueChoices.innerHTML = "";
  for (const option of options) {
    const li = document.createElement("li");
    li.textContent = option.label;
    li.addEventListener("click", () => {
      const result = resolveRelationshipChoice(CREW_DIALOGUE, activeMember.id, dialogueState, option.id);
      dialogueLine.textContent = result.line;
      renderChoices(result.choices);
    });
    dialogueChoices.appendChild(li);
  }
}

function renderDecisionOptions(prompt, decisionId, options) {
  dialogueLine.textContent = prompt;
  dialogueChoices.innerHTML = "";
  for (const option of options) {
    const li = document.createElement("li");
    li.textContent = option.label;
    li.addEventListener("click", () => {
      const result = resolveDecision(CREW_DIALOGUE, activeMember.id, dialogueState, decisionId, option.id);
      dialogueLine.textContent = result.line;
      renderChoices(result.choices);
    });
    dialogueChoices.appendChild(li);
  }
}

function handleChoice(choiceId) {
  const result = selectTopic(CREW_DIALOGUE, activeMember.id, dialogueState, choiceId);
  if (result.done) {
    closeDialogue();
    return;
  }
  if (result.isRelationshipChoice) {
    renderRelationshipOptions(result.prompt, result.options);
    return;
  }
  if (result.isDecision) {
    renderDecisionOptions(result.prompt, result.decisionId, result.options);
    return;
  }
  dialogueLine.textContent = result.line;
  if (result.activity !== undefined) renderSpeaker(activeMember, result.activity);
  renderChoices(result.choices);
}

function openDialogue(member) {
  dialogueOpen = true;
  activeMember = member;
  const result = startConversation(CREW_DIALOGUE, member.id, dialogueState);
  renderSpeaker(member, result.activity);
  dialogueLine.textContent = result.line;
  renderChoices(result.choices);
  dialoguePanel.hidden = false;
  interactPrompt.hidden = true;
}

function closeDialogue() {
  dialogueOpen = false;
  activeMember = null;
  dialoguePanel.hidden = true;
}

window.addEventListener("keydown", (e) => {
  if (e.code === "KeyE") {
    if (!dialogueOpen && nearbyCrew) {
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
      const activity = getActivity(nearbyCrew.id, Date.now());
      interactPrompt.textContent = `Press E to talk to ${nearbyCrew.name} (${activity})`;
    }
  }

  renderer.render(scene, camera);
}
animate();
