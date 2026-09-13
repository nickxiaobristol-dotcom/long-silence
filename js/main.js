import * as THREE from "three";
import { buildShip } from "./ship.js";
import { PlayerController } from "./player.js";
import { buildCrew, findNearbyCrew, CREW } from "./crew.js";
import { initCrewBehavior, updateCrewBehavior, setTalking } from "./crew-behavior.js";
import {
  stepWalkCycle,
  setSitPose,
  setLeanPose,
  setReadPose,
  setHoldingProp,
  setSleepPose,
  stepCleanCycle,
  stopCleanCycle,
  applyStumble,
  clearStumble,
  CHARACTER_HEIGHT,
} from "./character.js";
import {
  buildInteractables,
  findNearbyInteractable,
  toggleInteractable,
  promptFor,
} from "./interactables.js";
import { buildDecorations } from "./decorations.js";
import { buildAtmosphere } from "./atmosphere.js";
import { CREW_DIALOGUE } from "./dialogue-data.js";
import {
  createDialogueState,
  getActivity,
  startConversation,
  selectTopic,
  resolveRelationshipChoice,
  resolveDecision,
} from "./dialogue.js";
import { FlightController } from "./flight.js";

const container = document.getElementById("scene-container");
const interactPrompt = document.getElementById("interact-prompt");
const actionPrompt = document.getElementById("action-prompt");
const speechBubble = document.getElementById("speech-bubble");
const dialoguePanel = document.getElementById("dialogue-panel");
const dialogueSpeaker = document.getElementById("dialogue-speaker");
const dialogueLine = document.getElementById("dialogue-line");
const dialogueChoices = document.getElementById("dialogue-choices");
const flightHud = document.getElementById("flight-hud");
const flightReadout = document.getElementById("flight-readout");
const flightFlash = document.getElementById("flight-flash");

const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(
  55,
  window.innerWidth / window.innerHeight,
  0.1,
  100
);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
// Capped: the fog/accent-light rig in atmosphere.js is fill-rate bound, so
// rendering a HiDPI screen at full device ratio costs more than it shows.
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.25;
container.appendChild(renderer.domElement);

buildAtmosphere(scene);
buildShip(scene);
buildCrew(scene);
buildDecorations(scene);
buildInteractables(scene);
initCrewBehavior();

// Start in the Common Area, the ship's central hub.
const player = new PlayerController(camera, 1, 0);player.addTo(scene);

// Flight mode: a second, self-contained scene/camera (its own Sol system,
// exterior ship, asteroid field) reusing the same renderer — see the
// enterFlightMode/exitFlightMode toggle and animate()'s branch below.
// Built once up front rather than lazily so the first "take the helm"
// press doesn't stall on scene construction.
const flight = new FlightController();
let flightModeActive = false;

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  flight.camera.aspect = window.innerWidth / window.innerHeight;
  flight.camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// Step 4: branching dialogue. dialogueState persists relationship/history
// per crew member for the whole session; the engine in dialogue.js picks
// context-appropriate lines from the content bank in dialogue-data.js.
const dialogueState = createDialogueState();let dialogueOpen = false;
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
  setTalking(member.id, true, { x: player.x, z: player.z });
  const result = startConversation(CREW_DIALOGUE, member.id, dialogueState);
  renderSpeaker(member, result.activity);
  dialogueLine.textContent = result.line;
  renderChoices(result.choices);
  dialoguePanel.hidden = false;
  interactPrompt.hidden = true;
  speechBubble.hidden = false;
}

function closeDialogue() {
  dialogueOpen = false;
  if (activeMember) setTalking(activeMember.id, false);
  activeMember = null;
  dialoguePanel.hidden = true;
  speechBubble.hidden = true;
}

// Step 3-of-this-pass: object interaction. A seat locks player movement
// until stood up again (tracked here as sittingSeatId); console/locker
// interactables are plain independent toggles with no movement effect.
let sittingSeatId = null;
let nearbyInteractable = null;

// Flight mode's entry point: the pilot's seat already exists as a "sit"
// interactable from the movement & interaction pass — sitting down at the
// helm and taking the ship out are the same action, so pressing F there
// does both instead of adding a second, redundant control. Every other
// seat (the mess stool) keeps its plain sit-down behavior untouched.
function enterFlightMode() {
  flightModeActive = true;
  flight.activate();
  interactPrompt.hidden = true;
  flightHud.hidden = false;
}

function exitFlightMode() {
  flightModeActive = false;
  flight.deactivate();
  flightHud.hidden = true;
  flightFlash.hidden = true;
}

function handleInteract() {
  if (sittingSeatId) {
    if (sittingSeatId === "pilot_seat" && flightModeActive) exitFlightMode();
    toggleInteractable(sittingSeatId);
    player.standUp();
    sittingSeatId = null;
    return;
  }
  if (dialogueOpen || !nearbyInteractable) return;
  const active = toggleInteractable(nearbyInteractable.id);
  if (nearbyInteractable.type === "seat" && active) {
    const facingAngle = Math.atan2(
      nearbyInteractable.facing.x - nearbyInteractable.x,
      nearbyInteractable.facing.z - nearbyInteractable.z
    );
    player.sitAt(nearbyInteractable.x, nearbyInteractable.z, facingAngle);
    sittingSeatId = nearbyInteractable.id;
    if (nearbyInteractable.id === "pilot_seat") enterFlightMode();
  }
}

window.addEventListener("keydown", (e) => {
  if (e.code === "KeyE") {
    if (!dialogueOpen && nearbyCrew) {
      openDialogue(nearbyCrew);
    }
  } else if (e.code === "KeyF") {
    handleInteract();
  } else if (e.code === "Escape" && dialogueOpen) {
    closeDialogue();
  }
});

// Read-only handle for the headless playthrough harness
// (test/playthrough.mjs), which otherwise has to dead-reckon the player's
// position from key-hold durations — and that breaks the moment the frame
// rate drops, because player.js clamps dt. Exposing the controller lets
// the harness walk to a coordinate and stop when it gets there. Nothing in
// the game reads this.
window.__lsPlayer = player;

// Same rationale as __lsPlayer above: a read-only handle so this pass's
// verification script (test/feature-pass-verify.mjs) can check autonomous
// crew movement and walk-cycle state without adding any gameplay-facing
// API. Nothing in the game reads this either.
window.__lsCrew = CREW;

// Same rationale again: a read-only handle so test/touch-controls-verify.mjs
// can assert flight throttle/yaw/pitch state directly instead of scraping
// the HUD readout string. Nothing in the game reads this either.
window.__lsFlight = flight;

// A crew member's berth sits at floor height; this is roughly the
// mattress top (see props.js's berth()), so lying down doesn't clip into
// it or float above it.
const SLEEP_Y = 0.5;

// Drives a crew member's live marker off the plain fields
// js/crew-behavior.js sets on them each frame (curX/curZ/facing/walking/
// pose), picking whichever js/character.js pose function matches
// member.pose. Reset-then-apply rather than incremental toggling, so a
// pose left over from the previous frame's activity never lingers into
// the next one.
function applyCrewPose(member, dt) {
  const marker = member.marker;
  const pose = member.walking ? "walk" : member.pose || "idle";

  if (pose === "sleep") {
    marker.position.set(member.curX, SLEEP_Y, member.curZ);
    marker.rotation.y = member.facing;
    setSleepPose(marker, true);
    return;
  }
  setSleepPose(marker, false);
  marker.position.set(member.curX, 0, member.curZ);
  marker.rotation.y = member.facing;

  if (pose === "stumble") {
    clearStumble(marker);
    applyStumble(marker, member.stumbleProgress || 0);
    setSitPose(marker, false);
    setLeanPose(marker, false);
    setReadPose(marker, false);
    setHoldingProp(marker, false);
    stopCleanCycle(marker);
    stepWalkCycle(marker, dt, false);
    return;
  }
  clearStumble(marker);

  if (pose === "sit" || pose === "sit_read") {
    setSitPose(marker, true);
    setReadPose(marker, pose === "sit_read");
    setHoldingProp(marker, pose === "sit_read");
    setLeanPose(marker, false);
    stopCleanCycle(marker);
    stepWalkCycle(marker, dt, false);
    return;
  }
  setSitPose(marker, false);
  setReadPose(marker, false);
  setHoldingProp(marker, false);

  if (pose === "lean") {
    setLeanPose(marker, true);
    stopCleanCycle(marker);
    stepWalkCycle(marker, dt, false);
    return;
  }
  setLeanPose(marker, false);

  if (pose === "clean") {
    stepCleanCycle(marker, dt);
    return;
  }
  stopCleanCycle(marker);

  stepWalkCycle(marker, dt, pose === "walk");
}

// Reused across frames to avoid an allocation per speech-bubble update.
const _headPos = new THREE.Vector3();

let lastTime = performance.now();
function animate() {
  requestAnimationFrame(animate);
  const now = performance.now();
  const dt = Math.min((now - lastTime) / 1000, 0.1);
  lastTime = now;

  player.update(dt);

  updateCrewBehavior(dt);
  for (const member of CREW) {
    if (!member.marker) continue;
    applyCrewPose(member, dt);
  }

  nearbyCrew = findNearbyCrew(player.x, player.z);
  if (dialogueOpen && !nearbyCrew) closeDialogue();
  if (!dialogueOpen) {
    interactPrompt.hidden = !nearbyCrew;
    if (nearbyCrew) {
      const activity = getActivity(nearbyCrew.id, Date.now());
      interactPrompt.textContent = `Press E to talk to ${nearbyCrew.name} (${activity})`;
    }
  }

  if (sittingSeatId) {
    nearbyInteractable = null;
    actionPrompt.hidden = false;
    actionPrompt.textContent = "Press F to stand up";
  } else if (dialogueOpen) {
    nearbyInteractable = null;
    actionPrompt.hidden = true;
  } else {
    nearbyInteractable = findNearbyInteractable(player.x, player.z);
    actionPrompt.hidden = !nearbyInteractable;
    if (nearbyInteractable) actionPrompt.textContent = promptFor(nearbyInteractable);
  }

  // Speech bubble: a small in-world indicator above whoever's currently
  // speaking, projected from their live head position to screen space.
  // Purely a visual accent on top of the dialogue panel below — it never
  // carries any text of its own.
  if (dialogueOpen && activeMember && activeMember.marker) {
    _headPos.set(activeMember.marker.position.x, CHARACTER_HEIGHT + 0.18, activeMember.marker.position.z);
    _headPos.project(camera);
    speechBubble.style.left = `${(_headPos.x * 0.5 + 0.5) * window.innerWidth}px`;
    speechBubble.style.top = `${(-_headPos.y * 0.5 + 0.5) * window.innerHeight}px`;
  }

  if (flightModeActive) {
    flight.update(dt);
    flightReadout.textContent = `Throttle ${Math.round(flight.throttle * 100)}%  ·  ${Math.round(flight.speed)} units/s${
      flight.warping ? "  ·  LIGHT SPEED" : ""
    }`;
    flightFlash.hidden = !flight.flashing(Date.now());
    renderer.render(flight.scene, flight.camera);
  } else {
    renderer.render(scene, camera);
  }
}
animate();
