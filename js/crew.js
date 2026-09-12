import { buildHumanoid } from "./character.js";

// The 5 crew of The Long Silence. Positions are hand-placed inside each
// room's floor rect (see ROOMS in ship.js) at spots that fit their role.
// Full backstories and dialogue voice notes live in CREW.md. `id` keys
// into the content bank in js/dialogue-data.js; `line` is the step-3
// placeholder flavor line, kept as a fallback/for tests but no longer
// shown once the branching dialogue system (js/dialogue.js) is wired up.

export const INTERACT_RANGE = 2; // meters; matches player marker scale

export const CREW = [
  {
    id: "dessa",
    name: "Dessa Okafor",
    role: "Captain",
    x: 1,
    z: -3,
    color: 0xd9a441,
    line: "\"Everyone on this ship has a reason to hate somebody. My job is making sure they all hate the same somebody, and it isn't me.\"",
  },
  {
    id: "kaia",
    name: "Kaia Brenn",
    role: "Pilot",
    x: -10,
    z: 0,
    color: 0x6f8fb0,
    line: "\"Ridgeline taught me to fly formation. Nobody taught me what to do when there's no formation left to fly.\"",
  },
  {
    id: "corwin",
    name: "Corwin Talus",
    role: "Engineer",
    x: 12,
    z: 0,
    color: 0xb0562f,
    line: "\"This ship's held together by my wiring and my patience, and I'm running low on both. Mind the coolant line.\"",
  },
  {
    id: "amara",
    name: "Amara Voss",
    role: "Medic/Quartermaster",
    x: 0,
    z: -12,
    color: 0x7fae7a,
    line: "\"We've got two crates of painkillers and a hundred people on Ceres Station who need them more than we need the money. Just so you know.\"",
  },
  {
    id: "marcus",
    name: "Marcus Reyn",
    role: "Security",
    x: 3,
    z: 3,
    color: 0x5a5f66,
    line: "\"You want to know where I served. Everyone does. Ask me something I'll actually answer.\"",
  },
];

// Live position, separate from the hand-placed spawn (x, z) above: crew.js
// itself sets these at module load so they exist as soon as CREW is
// imported anywhere (tests included), and js/crew-behavior.js is the only
// thing that moves them afterward, walking each crew member around their
// room. findNearbyCrew reads curX/curZ rather than x/z specifically so the
// "Press E to talk" range check keeps working once a crew member is no
// longer standing on their spawn point.
for (const member of CREW) {
  member.curX = member.x;
  member.curZ = member.z;
  member.facing = 0;
}

function buildCrewMarker(member) {
  const marker = buildHumanoid(member.color);
  marker.position.set(member.x, 0, member.z);
  return marker;
}

export function buildCrew(scene) {
  for (const member of CREW) {
    const marker = buildCrewMarker(member);
    member.marker = marker;
    scene.add(marker);
  }
}

// Nearest crew member within INTERACT_RANGE of (x, z), or null. Checks the
// live (curX, curZ) position, not the fixed spawn (x, z), so this keeps
// working once crew members wander off their starting spot.
export function findNearbyCrew(x, z) {
  let closest = null;
  let closestDist = Infinity;
  for (const member of CREW) {
    const dist = Math.hypot(member.curX - x, member.curZ - z);
    if (dist <= INTERACT_RANGE && dist < closestDist) {
      closest = member;
      closestDist = dist;
    }
  }
  return closest;
}
