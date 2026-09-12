import * as THREE from "three";

// The 5 crew of The Long Silence. Positions are hand-placed inside each
// room's floor rect (see ROOMS in ship.js) at spots that fit their role.
// Full backstories and dialogue voice notes live in CREW.md — this file
// only needs enough per character to render a marker and show a single
// placeholder flavor line (step 4 replaces `line` with a branching tree).

export const INTERACT_RANGE = 2; // meters; matches player marker scale

export const CREW = [
  {
    name: "Dessa Okafor",
    role: "Captain",
    x: 1,
    z: -3,
    color: 0xd9a441,
    line: "\"Everyone on this ship has a reason to hate somebody. My job is making sure they all hate the same somebody, and it isn't me.\"",
  },
  {
    name: "Kaia Brenn",
    role: "Pilot",
    x: -10,
    z: 0,
    color: 0x6f8fb0,
    line: "\"Ridgeline taught me to fly formation. Nobody taught me what to do when there's no formation left to fly.\"",
  },
  {
    name: "Corwin Talus",
    role: "Engineer",
    x: 12,
    z: 0,
    color: 0xb0562f,
    line: "\"This ship's held together by my wiring and my patience, and I'm running low on both. Mind the coolant line.\"",
  },
  {
    name: "Amara Voss",
    role: "Medic/Quartermaster",
    x: 0,
    z: -12,
    color: 0x7fae7a,
    line: "\"We've got two crates of painkillers and a hundred people on Ceres Station who need them more than we need the money. Just so you know.\"",
  },
  {
    name: "Marcus Reyn",
    role: "Security",
    x: 3,
    z: 3,
    color: 0x5a5f66,
    line: "\"You want to know where I served. Everyone does. Ask me something I'll actually answer.\"",
  },
];

function buildCrewMarker(member) {
  const marker = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.35, 1, 4, 8),
    new THREE.MeshStandardMaterial({ color: member.color })
  );
  marker.position.set(member.x, 0.9, member.z);
  return marker;
}

export function buildCrew(scene) {
  for (const member of CREW) {
    scene.add(buildCrewMarker(member));
  }
}

// Nearest crew member within INTERACT_RANGE of (x, z), or null.
export function findNearbyCrew(x, z) {
  let closest = null;
  let closestDist = Infinity;
  for (const member of CREW) {
    const dist = Math.hypot(member.x - x, member.z - z);
    if (dist <= INTERACT_RANGE && dist < closestDist) {
      closest = member;
      closestDist = dist;
    }
  }
  return closest;
}
