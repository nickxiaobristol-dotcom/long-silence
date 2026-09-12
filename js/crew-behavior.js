import { CREW } from "./crew.js";
import { isWalkable } from "./ship.js";

// Simple autonomous wandering for the 5 crew: each one steps between a
// short hand-placed waypoint list inside their own room (matching the
// room each is assigned in js/dialogue-data.js), pausing at each stop
// like they're checking or working on something, then moving on. Pure
// logic, no THREE — js/main.js reads member.curX/curZ/facing/walking off
// CREW each frame to drive the actual THREE objects, the same way
// js/dialogue.js stays pure and main.js wires it into the DOM.
//
// Deliberately does not cross into adjacent rooms: waypoints are inset
// from each room's walls so a member can never wander into a doorway and
// get stuck blocking it, and isWalkable is still checked every step as a
// second guard in case a waypoint or a room edit above ever puts a target
// point somewhere invalid.

const WALK_SPEED = 1.3; // meters/second; well under the player's 4.2
const RADIUS = 0.35;
const PAUSE_MIN_MS = 2500;
const PAUSE_MAX_MS = 5500;
const ARRIVE_EPSILON = 0.08;

// Two or three stops per crew member, chosen to read as a small task loop
// (Corwin between the reactor and his workbench, Amara doing a circuit of
// the cargo hold, etc.) rather than aimless drifting.
const WAYPOINTS = {
  dessa: [
    { x: 1, z: -3 },
    { x: -1.6, z: 1.2 },
    { x: 2.6, z: -3.7 },
  ],
  kaia: [
    { x: -10, z: 0 },
    { x: -11.4, z: 2.6 },
  ],
  corwin: [
    { x: 13, z: 0.5 },
    { x: 10.5, z: -2.6 },
  ],
  amara: [
    { x: 0, z: -12 },
    { x: -3, z: -10.5 },
    { x: 3, z: -13 },
  ],
  marcus: [
    { x: 3, z: 3 },
    { x: 1.8, z: 4 },
  ],
};

const behavior = new Map(); // memberId -> runtime wander state

function ensureBehavior(member) {
  let st = behavior.get(member.id);
  if (!st) {
    st = { waypointIndex: 0, phase: "pausing", pauseUntil: 0, talking: false };
    behavior.set(member.id, st);
  }
  return st;
}

export function initCrewBehavior() {
  for (const member of CREW) ensureBehavior(member);
}

// Freezes (or resumes) a crew member's wandering for dialogue. While
// talking is true, the member holds still and faces `facePos` (updated
// every call, so it keeps facing the player if they shuffle closer).
export function setTalking(memberId, talking, facePos) {
  const st = behavior.get(memberId);
  if (!st) return;
  st.talking = talking;
  if (talking && facePos) {
    const member = CREW.find((m) => m.id === memberId);
    member.facing = Math.atan2(facePos.x - member.curX, facePos.z - member.curZ);
    member.walking = false;
  }
}

export function updateCrewBehavior(dt, now = Date.now()) {
  for (const member of CREW) {
    const st = ensureBehavior(member);
    if (st.talking) continue;

    const waypoints = WAYPOINTS[member.id];
    if (!waypoints || waypoints.length === 0) continue;

    if (st.phase === "pausing") {
      member.walking = false;
      if (now >= st.pauseUntil) st.phase = "walking";
      continue;
    }

    const target = waypoints[st.waypointIndex];
    const dx = target.x - member.curX;
    const dz = target.z - member.curZ;
    const dist = Math.hypot(dx, dz);

    if (dist < ARRIVE_EPSILON) {
      st.phase = "pausing";
      st.pauseUntil = now + PAUSE_MIN_MS + Math.random() * (PAUSE_MAX_MS - PAUSE_MIN_MS);
      st.waypointIndex = (st.waypointIndex + 1) % waypoints.length;
      member.walking = false;
      continue;
    }

    const stepX = (dx / dist) * WALK_SPEED * dt;
    const stepZ = (dz / dist) * WALK_SPEED * dt;
    const nx = member.curX + stepX;
    const nz = member.curZ + stepZ;

    if (isWalkable(nx, nz, RADIUS)) {
      member.curX = nx;
      member.curZ = nz;
      member.facing = Math.atan2(stepX, stepZ);
      member.walking = true;
    } else {
      // Shouldn't happen with in-bounds waypoints, but never let a bad
      // waypoint wedge a crew member against a wall forever.
      st.phase = "pausing";
      st.pauseUntil = now + 1000;
      member.walking = false;
    }
  }
}
