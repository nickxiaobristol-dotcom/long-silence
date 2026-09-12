import * as THREE from "three";

// Shared low-poly humanoid rig for the player and all 5 crew: one small
// primitive-based "person" (legs/torso/arms/head), recolored per
// character rather than building six distinct rigs. Origin sits at the
// character's feet (y = 0) so callers can position.set(x, 0, z) directly,
// matching the floor-level coordinates used everywhere else (ship.js,
// crew.js positions).

const LEG_HEIGHT = 0.7;
const TORSO_HEIGHT = 0.6;
const HEAD_RADIUS = 0.18;
const ARM_HEIGHT = 0.55;

// Total standing height, feet to crown — used by callers that need to
// anchor UI (e.g. the dialogue speech bubble) above a character's head.
export const CHARACTER_HEIGHT = LEG_HEIGHT + TORSO_HEIGHT + HEAD_RADIUS * 2;

// Walk-cycle tuning shared by every rig (see stepWalkCycle below).
const WALK_CYCLE_HZ = 1.6; // stride cycles/second at a normal walk
const MAX_LEG_SWING = 0.55; // radians
const ARM_SWING_RATIO = 0.8; // arms swing a bit less than legs
const SIT_BEND = -1.3; // radians; thighs rotated up toward horizontal

// Stationary-activity pose tuning (post-v1 behavior pass). Same
// cheap-primitive-rotation approach as the walk cycle and sit pose above —
// no new geometry beyond the one held-prop mesh in buildHumanoid.
const LEAN_TILT = -0.28; // whole-body forward tilt, working a console
const LEAN_ARM = -1.05;
const READ_ARM = -1.0; // arms raised in front, holding the prop, while seated
const CLEAN_HZ = 1.8; // wipe-motion cycles/second
const CLEAN_ARM_BASE = -0.9;
const CLEAN_ARM_SWING = 0.5;

export function buildHumanoid(color) {
  const group = new THREE.Group();
  const base = new THREE.Color(color);
  // Torso keeps the crew member's identifying color; limbs read as darker
  // fatigues/boots and the head gets a touch of lift, so the flat single-color
  // silhouette breaks up a little without needing a per-crew palette.
  const torsoMaterial = new THREE.MeshStandardMaterial({ color: base });
  const limbMaterial = new THREE.MeshStandardMaterial({
    color: base.clone().multiplyScalar(0.7),
  });
  const headMaterial = new THREE.MeshStandardMaterial({
    color: base.clone().lerp(new THREE.Color(0xffffff), 0.16),
  });

  // Legs and arms are built as a hip/shoulder pivot Group with the limb
  // mesh hung underneath it, rather than a bare Mesh at its own midpoint —
  // that puts each limb's rotation origin at the joint instead of its own
  // center, so stepWalkCycle/setSitPose can swing it like a real pendulum
  // (see below) instead of rotating around its middle.
  const legGeometry = new THREE.BoxGeometry(0.18, LEG_HEIGHT, 0.18);
  const legs = [];
  for (const side of [-1, 1]) {
    const pivot = new THREE.Group();
    pivot.position.set(side * 0.13, LEG_HEIGHT, 0);
    const leg = new THREE.Mesh(legGeometry, limbMaterial);
    leg.position.set(0, -LEG_HEIGHT / 2, 0);
    pivot.add(leg);
    group.add(pivot);
    legs.push(pivot);
  }

  const torso = new THREE.Mesh(
    new THREE.BoxGeometry(0.5, TORSO_HEIGHT, 0.28),
    torsoMaterial
  );
  torso.position.set(0, LEG_HEIGHT + TORSO_HEIGHT / 2, 0);
  group.add(torso);

  const armGeometry = new THREE.BoxGeometry(0.14, ARM_HEIGHT, 0.14);
  const arms = [];
  const shoulderY = LEG_HEIGHT + TORSO_HEIGHT;
  for (const side of [-1, 1]) {
    const pivot = new THREE.Group();
    pivot.position.set(side * 0.32, shoulderY, 0);
    const arm = new THREE.Mesh(armGeometry, limbMaterial);
    arm.position.set(0, -ARM_HEIGHT / 2, 0);
    pivot.add(arm);
    group.add(pivot);
    arms.push(pivot);
  }

  const head = new THREE.Mesh(
    new THREE.SphereGeometry(HEAD_RADIUS, 8, 6),
    headMaterial
  );
  head.position.set(0, LEG_HEIGHT + TORSO_HEIGHT + HEAD_RADIUS, 0);
  group.add(head);

  // A small held prop (clipboard/book), hung under the right arm's own
  // pivot so it moves with that arm's rotation for free. Hidden by
  // default; setHoldingProp toggles it for the "sit and read/take notes"
  // activity pose in js/crew-behavior.js.
  const heldProp = new THREE.Mesh(
    new THREE.BoxGeometry(0.16, 0.02, 0.22),
    new THREE.MeshStandardMaterial({ color: 0xcfc4ab })
  );
  heldProp.position.set(0, -ARM_HEIGHT * 0.55, 0.09);
  heldProp.visible = false;
  arms[1].add(heldProp);

  // Stashed on the group (rather than returned separately) so every
  // existing caller that treats buildHumanoid's return value as a plain
  // THREE.Group to position/add-to-scene keeps working untouched.
  group.userData.legs = legs;
  group.userData.arms = arms;
  group.userData.walkPhase = 0;
  group.userData.cleanPhase = 0;
  group.userData.heldProp = heldProp;

  return group;
}

// Cheap procedural walk cycle: swings the leg/arm pivots opposite each
// other on a sine, phase-accumulated by dt so cadence stays correct
// regardless of frame rate. Resets to the neutral idle pose (all pivots
// at 0) the instant `moving` goes false, rather than letting the cycle
// coast to a stop, so a character that stops dead doesn't finish a stride
// in place.
export function stepWalkCycle(group, dt, moving) {
  const { legs, arms } = group.userData;
  if (!legs) return;
  if (moving) {
    group.userData.walkPhase += dt * WALK_CYCLE_HZ * Math.PI * 2;
    const swing = Math.sin(group.userData.walkPhase) * MAX_LEG_SWING;
    legs[0].rotation.x = swing;
    legs[1].rotation.x = -swing;
    arms[0].rotation.x = -swing * ARM_SWING_RATIO;
    arms[1].rotation.x = swing * ARM_SWING_RATIO;
  } else {
    group.userData.walkPhase = 0;
    legs[0].rotation.x = 0;
    legs[1].rotation.x = 0;
    arms[0].rotation.x = 0;
    arms[1].rotation.x = 0;
  }
}

// Bends both legs up toward horizontal for a seated pose. Callers must not
// also call stepWalkCycle while seated (it would overwrite this), which
// holds naturally since a seated character isn't moving.
export function setSitPose(group, sitting) {
  const { legs } = group.userData;
  if (!legs) return;
  legs[0].rotation.x = sitting ? SIT_BEND : 0;
  legs[1].rotation.x = sitting ? SIT_BEND : 0;
}

// Leaning over a console/workbench: a small forward tilt of the whole rig
// (there's no separate torso pivot, so tilting the group is the cheap
// equivalent) plus both arms down toward the work surface. Standing, not
// combined with setSitPose.
export function setLeanPose(group, leaning) {
  const { arms } = group.userData;
  if (!arms) return;
  group.rotation.x = leaning ? LEAN_TILT : 0;
  arms[0].rotation.x = leaning ? LEAN_ARM : 0;
  arms[1].rotation.x = leaning ? LEAN_ARM : 0;
}

// Arms raised in front, as if holding the prop from setHoldingProp up to
// read it. Meant to be combined with setSitPose(group, true) for "sitting
// and reading/taking notes"; the caller (js/crew-behavior.js) is
// responsible for calling both.
export function setReadPose(group, reading) {
  const { arms } = group.userData;
  if (!arms) return;
  arms[0].rotation.x = reading ? READ_ARM : 0;
  arms[1].rotation.x = reading ? READ_ARM : 0;
}

export function setHoldingProp(group, holding) {
  const { heldProp } = group.userData;
  if (heldProp) heldProp.visible = !!holding;
}

// Lying flat for sleep: tips the whole rig 90 degrees about its own
// feet-origin, which lands it flat along +Z at floor height. The caller
// is responsible for raising position.y to the berth's mattress height —
// this only handles the rotation, the same division of labor as
// PlayerController.sitAt handling the seat's y-drop itself.
export function setSleepPose(group, sleeping) {
  group.rotation.x = sleeping ? -Math.PI / 2 : 0;
}

// Repeated wipe/sweep motion at a fixed spot: one arm swings back and
// forth on a sine, phase-accumulated by dt like the walk cycle. Call every
// frame while the activity holds; stopCleanCycle resets it on exit.
export function stepCleanCycle(group, dt) {
  const { arms } = group.userData;
  if (!arms) return;
  group.userData.cleanPhase += dt * CLEAN_HZ * Math.PI * 2;
  arms[1].rotation.x = CLEAN_ARM_BASE + Math.sin(group.userData.cleanPhase) * CLEAN_ARM_SWING;
}

export function stopCleanCycle(group) {
  const { arms } = group.userData;
  if (!arms) return;
  group.userData.cleanPhase = 0;
  arms[1].rotation.x = 0;
}

// A brief, purely cosmetic trip-and-recover: `progress` runs 0 -> 1 across
// the stumble's duration, driving a half-sine so the dip eases in and back
// out rather than snapping. Both legs kick and the whole rig wobbles
// sideways; no position or state change, see js/crew-behavior.js.
export function applyStumble(group, progress) {
  const { legs } = group.userData;
  if (!legs) return;
  const amount = Math.sin(Math.min(Math.max(progress, 0), 1) * Math.PI);
  legs[0].rotation.x = amount * 0.5;
  legs[1].rotation.x = -amount * 0.3;
  group.rotation.z = amount * 0.25;
}

export function clearStumble(group) {
  const { legs } = group.userData;
  if (!legs) return;
  legs[0].rotation.x = 0;
  legs[1].rotation.x = 0;
  group.rotation.z = 0;
}
