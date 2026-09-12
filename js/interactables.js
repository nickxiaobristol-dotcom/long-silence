import * as THREE from "three";

// Lightweight, individually-toggleable interaction points layered on top
// of decorations.js's set dressing. decorations.js deliberately merges
// every room's props into a handful of static buckets per material (see
// its top-of-file note: "nothing merged into a bucket can be moved,
// recolored, or hidden individually afterward") — exactly what a locker
// door swinging open or a console changing color needs to do. So, the
// same way the player and crew already exist as live objects layered over
// the static ship geometry, interactables get their own small objects
// here rather than trying to reach into decorations.js's merged meshes.

export const ACTION_RANGE = 1.5;

export const INTERACTABLES = [
  {
    id: "pilot_seat",
    type: "seat",
    // Coincides with the crewSeat prop decorations.js already places here
    // (buildCockpit), so sitting drops the player rig right into it.
    x: -11.7,
    z: -1.5,
    facing: { x: -14, z: -1.5 }, // look forward, toward the viewport
    promptOn: "Press F to sit in the pilot's seat",
    promptOff: "Press F to stand up",
  },
  {
    id: "mess_stool",
    type: "seat",
    x: -2.2,
    z: 2.35,
    facing: { x: -1.55, z: 3.15 }, // look toward the mess table
    promptOn: "Press F to sit at the mess table",
    promptOff: "Press F to stand up",
  },
  {
    id: "diagnostic_console",
    type: "console",
    // Stood just off the diagnostic terminal decorations.js builds in
    // engineSouthWall, close enough that the new indicator light (below)
    // reads as part of it.
    x: 12.5,
    z: -3.2,
    promptOn: "Press F to power up the diagnostic console",
    promptOff: "Press F to power down the console",
  },
  {
    id: "footlocker",
    type: "locker",
    // A standalone chest in open Cargo Bay floor, clear of the crate
    // stacks and the merged wall lockers in Common Area.
    x: 3.6,
    z: -13.4,
    promptOn: "Press F to open the footlocker",
    promptOff: "Press F to close the footlocker",
  },
];

const state = new Map(INTERACTABLES.map((item) => [item.id, { active: false }]));
const visuals = new Map(); // id -> { toggle(active) }

export function isActive(id) {
  return state.get(id)?.active ?? false;
}

export function toggleInteractable(id) {
  const s = state.get(id);
  s.active = !s.active;
  visuals.get(id)?.toggle(s.active);
  return s.active;
}

export function promptFor(item) {
  return isActive(item.id) ? item.promptOff : item.promptOn;
}

// Nearest interactable within ACTION_RANGE of (x, z), or null. Mirrors
// crew.js's findNearbyCrew so the two proximity prompts behave the same
// way.
export function findNearbyInteractable(x, z) {
  let closest = null;
  let closestDist = Infinity;
  for (const item of INTERACTABLES) {
    const dist = Math.hypot(item.x - x, item.z - z);
    if (dist <= ACTION_RANGE && dist < closestDist) {
      closest = item;
      closestDist = dist;
    }
  }
  return closest;
}

export function buildInteractables(scene) {
  // Console: a small indicator plane dropped right in front of the
  // diagnostic terminal, since that terminal's own geometry is merged and
  // static. Dim teal when idle, warm amber-lit when "powered up".
  const consoleLight = new THREE.Mesh(
    new THREE.PlaneGeometry(0.3, 0.18),
    new THREE.MeshStandardMaterial({
      color: 0x123a2c,
      emissive: 0x2f8f62,
      emissiveIntensity: 0.35,
    })
  );
  consoleLight.position.set(12.5, 1.62, -3.7);
  scene.add(consoleLight);
  visuals.set("diagnostic_console", {
    toggle(active) {
      consoleLight.material.color.set(active ? 0x3a2a10 : 0x123a2c);
      consoleLight.material.emissive.set(active ? 0xc98a2a : 0x2f8f62);
      consoleLight.material.emissiveIntensity = active ? 1.8 : 0.35;
    },
  });

  // Footlocker: a small chest with a lid hinged along its back edge, so
  // "opening" it is a real rotation rather than a swapped texture.
  const chestGroup = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0x40493b });
  const trimMat = new THREE.MeshStandardMaterial({ color: 0x4a5764 });

  const body = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.4, 0.42), bodyMat);
  body.position.set(0, 0.2, 0);
  chestGroup.add(body);

  const lidPivot = new THREE.Group();
  lidPivot.position.set(0, 0.4, -0.21); // hinge along the back edge
  const lid = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.06, 0.42), trimMat);
  lid.position.set(0, 0.03, 0.21);
  lidPivot.add(lid);
  chestGroup.add(lidPivot);

  const footlocker = INTERACTABLES.find((i) => i.id === "footlocker");
  chestGroup.position.set(footlocker.x, 0, footlocker.z);
  scene.add(chestGroup);
  visuals.set("footlocker", {
    toggle(active) {
      lidPivot.rotation.x = active ? -1.9 : 0;
    },
  });
}
