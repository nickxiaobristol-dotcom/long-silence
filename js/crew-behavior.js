import { CREW } from "./crew.js";
import { isWalkable } from "./ship.js";

// Autonomous behavior for the 5 crew: each one cycles through an ordered
// list of "stops" — a place to walk to, optionally followed by a
// stationary activity there (sitting, reading, leaning over a console,
// cleaning, sleeping) before moving on to the next stop. A stop with no
// `activity` behaves exactly like the original wander-only waypoints
// (arrive, pause like they're checking or working on something, move on).
// Pure logic, no THREE — js/main.js reads member.curX/curZ/facing/walking/
// pose off CREW each frame to drive the actual THREE objects and pick the
// right js/character.js pose function, the same way js/dialogue.js stays
// pure and main.js wires it into the DOM.
//
// Deliberately does not cross into adjacent rooms except for the one
// hand-authored exception below (Dessa's commute to her Crew Quarters
// berth): every other stop is inset from its room's walls so a member can
// never wander into a doorway and get stuck blocking it, and isWalkable
// (which now also carries furniture collision — see ship.js's
// PROP_COLLIDERS) is still checked every step as a second guard.

const WALK_SPEED = 1.3; // meters/second; well under the player's 4.2
const RADIUS = 0.35;
const PAUSE_MIN_MS = 2500;
const PAUSE_MAX_MS = 5500;
const ARRIVE_EPSILON = 0.08;

// Rare, purely cosmetic mid-walk trip: a per-second chance while actively
// walking (not while paused or performing an activity), so it reads as an
// occasional stumble rather than a tic. No position or route change.
const STUMBLE_CHANCE_PER_SEC = 0.02;
const STUMBLE_MS = 550;

// Every crew member's ordered stop list. Coordinates are chosen clear of
// every footprint in ship.js's PROP_COLLIDERS (activity spots sit right
// next to the furniture they use, the same way a chair sits next to a
// table without overlapping it), and matched to something in
// decorations.js worth doing there. Not every crew member gets every kind
// of activity — spread across the 5 is the point, not exhaustive coverage
// per person.
const ROUTINES = {
  dessa: [
    { x: 1, z: -3 },
    { x: -1.6, z: 1.2 },
    // The middle mess stool, facing the table.
    {
      x: -1.5,
      z: 2.28,
      activity: "sit",
      facing: { x: -1.55, z: 3.15 },
      duration: [4000, 7000],
    },
    { x: 2.6, z: -3.7 },
    // Turns in periodically. `path` is a hand-authored chain of waypoints
    // through the Quarters Corridor (more waypoints, not pathfinding)
    // ending at `sleepAt`, her own aft berth. Getting into bed means
    // standing inside the bed's own collision footprint on purpose — see
    // the "arrived" handling below, which snaps onto it the same way
    // js/player.js's sitAt snaps the player into a seat.
    {
      path: [
        { x: 0, z: 0 },
        { x: 0, z: 6 },
        { x: 0, z: 9.5 },
        { x: 0, z: 13.5 },
      ],
      sleepAt: { x: 0, z: 14.5 },
      activity: "sleep",
      duration: [9000, 14000],
    },
  ],
  kaia: [
    { x: -10, z: 0 },
    // The pilot's seat — same spot as interactables.js's "pilot_seat", so
    // this reads as the same chair the player can also sit in.
    {
      x: -11.7,
      z: -1.5,
      activity: "sit",
      facing: { x: -14, z: -1.5 },
      duration: [4000, 7000],
    },
    { x: -11.4, z: 2.3 },
  ],
  corwin: [
    // Working the reactor console: a standing lean, facing the core.
    {
      x: 12.3,
      z: 1.0,
      activity: "lean",
      facing: { x: 14, z: 0 },
      duration: [4000, 6500],
    },
    // Sits at his workbench "making notes" — sit + read pose, holding the
    // clipboard prop from character.js.
    { x: 10.5, z: -2.6, activity: "sit_read", duration: [4500, 7000] },
  ],
  amara: [
    { x: 0, z: -12 },
    // Checking inventory against the manifest — sit + read, no seat prop
    // needed, she's crouched over a crate lid.
    { x: -3, z: -10.5, activity: "sit_read", duration: [4000, 6500] },
    // Tidying the cargo floor.
    { x: 3, z: -11, activity: "clean", facing: { x: 3, z: -9.5 }, duration: [5000, 8000] },
  ],
  marcus: [
    { x: 3, z: 3 },
    { x: 1.8, z: 4 },
    // Standing watch means he doesn't sit often, but he'll take the mess
    // stool briefly on a pass through.
    {
      x: -1.5,
      z: 2.28,
      activity: "sit",
      facing: { x: -1.55, z: 3.15 },
      duration: [3000, 5000],
    },
  ],
};

const behavior = new Map(); // memberId -> runtime state

function freshState() {
  return {
    stopIndex: 0,
    phase: "pausing",
    pauseUntil: 0,
    performUntil: 0,
    talking: false,
    stumbleUntil: 0,
    pose: undefined, // activity pose while phase === "performing"
    path: null, // the stop's commute path, retained for the return trip
    pathIndex: 0,
    afterPerform: null,
  };
}

function ensureBehavior(member) {
  let st = behavior.get(member.id);
  if (!st) {
    st = freshState();
    behavior.set(member.id, st);
    member.pose = "idle";
  }
  return st;
}

// Resets every crew member to a fresh routine, from the first stop. Called
// once at game boot (js/main.js); also what makes each test in
// test/crew-behavior.test.mjs independent of whatever simulated-time state
// a previous test's run left behind.
export function initCrewBehavior() {
  for (const member of CREW) {
    behavior.set(member.id, freshState());
    member.pose = "idle";
  }
}

// Freezes (or resumes) a crew member's wandering for dialogue. While
// talking is true, the member holds still and faces `facePos` (updated
// every call, so it keeps facing the player if they shuffle closer).
// Interrupts any activity in progress; resolving that activity's own
// leftover pose is handled by updateCrewBehavior's normal flow once
// talking ends, since the state machine just resumes wherever it left off.
export function setTalking(memberId, talking, facePos) {
  const st = behavior.get(memberId);
  if (!st) return;
  st.talking = talking;
  if (talking && facePos) {
    const member = CREW.find((m) => m.id === memberId);
    member.facing = Math.atan2(facePos.x - member.curX, facePos.z - member.curZ);
    member.walking = false;
    member.pose = "idle";
  }
}

function faceToward(member, point) {
  member.facing = Math.atan2(point.x - member.curX, point.z - member.curZ);
}

// Moves member toward (tx, tz) at WALK_SPEED, respecting collision.
// Returns "arrived" once within ARRIVE_EPSILON, "blocked" if the next step
// isn't walkable (shouldn't happen with in-bounds points, but never wedges
// a member against a wall forever), or "moving" otherwise.
function stepToward(member, tx, tz, dt) {
  const dx = tx - member.curX;
  const dz = tz - member.curZ;
  const dist = Math.hypot(dx, dz);
  if (dist < ARRIVE_EPSILON) return "arrived";

  const stepX = (dx / dist) * WALK_SPEED * dt;
  const stepZ = (dz / dist) * WALK_SPEED * dt;
  const nx = member.curX + stepX;
  const nz = member.curZ + stepZ;
  if (!isWalkable(nx, nz, RADIUS)) return "blocked";

  member.curX = nx;
  member.curZ = nz;
  member.facing = Math.atan2(stepX, stepZ);
  member.walking = true;
  member.pose = "walk";
  return "moving";
}

// Rolls the rare stumble chance for a member currently walking. Purely
// cosmetic (see js/character.js's applyStumble): no position/route change.
function maybeStumble(st, dt, now) {
  if (Math.random() < STUMBLE_CHANCE_PER_SEC * dt) {
    st.stumbleUntil = now + STUMBLE_MS;
  }
}

export function updateCrewBehavior(dt, now = Date.now()) {
  for (const member of CREW) {
    const st = ensureBehavior(member);
    if (st.talking) continue;

    const stops = ROUTINES[member.id];
    if (!stops || stops.length === 0) continue;

    if (now < st.stumbleUntil) {
      member.walking = false;
      member.pose = "stumble";
      member.stumbleProgress = 1 - (st.stumbleUntil - now) / STUMBLE_MS;
      continue;
    }

    if (st.phase === "pausing") {
      member.walking = false;
      member.pose = "idle";
      if (now >= st.pauseUntil) st.phase = "walking";
      continue;
    }

    if (st.phase === "performing") {
      member.walking = false;
      member.pose = st.pose;
      if (now < st.performUntil) continue;
      if (st.afterPerform === "return") {
        // Getting up mirrors lying down: teleport straight back onto the
        // last approach waypoint rather than stepping out through
        // isWalkable, which would immediately fail — any point still
        // within a crew radius of the berth's collision rect (including
        // the berth's own footprint) reads as blocked, same as it should
        // for anyone who isn't climbing out of this exact bed.
        const last = st.path[st.path.length - 1];
        member.curX = last.x;
        member.curZ = last.z;
        member.pose = "idle";
        st.phase = "returning";
        st.pathIndex = st.path.length - 1;
      } else {
        st.stopIndex = (st.stopIndex + 1) % stops.length;
        st.phase = "pausing";
        st.pauseUntil = now;
      }
      continue;
    }

    if (st.phase === "returning") {
      const wp = st.path[st.pathIndex];
      const result = stepToward(member, wp.x, wp.z, dt);
      if (result === "moving") {
        maybeStumble(st, dt, now);
        continue;
      }
      if (result === "blocked") {
        st.phase = "pausing";
        st.pauseUntil = now + 1000;
        member.walking = false;
        continue;
      }
      // Arrived at this hop, heading back the way it came.
      if (st.pathIndex === 0) {
        st.stopIndex = (st.stopIndex + 1) % stops.length;
        st.phase = "pausing";
        st.pauseUntil = now;
      } else {
        st.pathIndex -= 1;
      }
      continue;
    }

    const stop = stops[st.stopIndex];

    if (stop.path) {
      // Multi-hop commute: walk the chain in order, then teleport onto
      // sleepAt exactly like a seat interactable snaps the player into a
      // chair — occupying a bed's footprint is the point.
      const wp = stop.path[st.pathIndex];
      const result = stepToward(member, wp.x, wp.z, dt);
      if (result === "moving") {
        maybeStumble(st, dt, now);
        continue;
      }
      if (result === "blocked") {
        st.phase = "pausing";
        st.pauseUntil = now + 1000;
        member.walking = false;
        continue;
      }
      if (st.pathIndex < stop.path.length - 1) {
        st.pathIndex += 1;
        continue;
      }
      member.curX = stop.sleepAt.x;
      member.curZ = stop.sleepAt.z;
      member.walking = false;
      member.pose = stop.activity;
      st.pose = stop.activity;
      st.path = stop.path;
      st.afterPerform = "return";
      const [min, max] = stop.duration;
      st.performUntil = now + min + Math.random() * (max - min);
      st.phase = "performing";
      continue;
    }

    // Plain walk-to-stop, with an optional stationary activity on arrival.
    const result = stepToward(member, stop.x, stop.z, dt);
    if (result === "moving") {
      maybeStumble(st, dt, now);
      continue;
    }
    if (result === "blocked") {
      st.phase = "pausing";
      st.pauseUntil = now + 1000;
      member.walking = false;
      continue;
    }
    member.walking = false;
    if (stop.activity) {
      if (stop.facing) faceToward(member, stop.facing);
      member.pose = stop.activity;
      st.pose = stop.activity;
      st.afterPerform = null;
      const [min, max] = stop.duration;
      st.performUntil = now + min + Math.random() * (max - min);
      st.phase = "performing";
    } else {
      member.pose = "idle";
      st.stopIndex = (st.stopIndex + 1) % stops.length;
      st.phase = "pausing";
      st.pauseUntil = now + PAUSE_MIN_MS + Math.random() * (PAUSE_MAX_MS - PAUSE_MIN_MS);
    }
  }
}
