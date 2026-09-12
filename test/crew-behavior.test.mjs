// Autonomous crew wandering (js/crew-behavior.js) is pure logic driving
// plain fields on js/crew.js's CREW array, no THREE/DOM needed to test it.
import { test } from "node:test";
import assert from "node:assert/strict";
import { CREW } from "../js/crew.js";
import { isWalkable } from "../js/ship.js";
import { initCrewBehavior, updateCrewBehavior, setTalking } from "../js/crew-behavior.js";

const RADIUS = 0.35;

function resetPositions() {
  for (const member of CREW) {
    member.curX = member.x;
    member.curZ = member.z;
    member.walking = false;
  }
}

test("initCrewBehavior does not move anyone or throw", () => {
  resetPositions();
  initCrewBehavior();
  for (const member of CREW) {
    assert.equal(member.curX, member.x);
    assert.equal(member.curZ, member.z);
  }
});

// Runs early, before any other test has driven crew-behavior.js's internal
// per-member state far ahead on its own simulated clock (state persists in
// the module across tests in this file, same as it always has) — a stray
// `now < st.pauseUntil`/`performUntil` left over from a later, longer test
// would eat this test's whole 10-second window before anyone ever walks.
test("a stumble does not move a crew member or change their walking state", () => {
  resetPositions();
  initCrewBehavior();
  const originalRandom = Math.random;
  const marcus = CREW.find((m) => m.id === "marcus");

  try {
    // Force the rare stumble roll to trigger on the very first walking
    // frame, so the test doesn't have to wait out the real ~2%/sec odds.
    Math.random = () => 0;
    let now = Date.now();
    let stumbled = false;
    let preStumbleX, preStumbleZ;
    for (let i = 0; i < 100; i++) {
      if (marcus.pose === "stumble" && !stumbled) {
        preStumbleX = marcus.curX;
        preStumbleZ = marcus.curZ;
      }
      updateCrewBehavior(0.1, now);
      now += 100;
      if (marcus.pose === "stumble") {
        stumbled = true;
        assert.equal(marcus.walking, false);
        if (preStumbleX !== undefined) {
          assert.equal(marcus.curX, preStumbleX, "stumbling should not move the crew member");
          assert.equal(marcus.curZ, preStumbleZ, "stumbling should not move the crew member");
        }
      }
    }
    assert.ok(stumbled, "expected the forced stumble chance to trigger");
  } finally {
    Math.random = originalRandom;
  }
});

test("over time, at least one crew member wanders off their spawn point", () => {
  resetPositions();
  initCrewBehavior();

  let now = Date.now();
  let moved = false;
  // Step in 100ms increments for a simulated 30 seconds — long enough to
  // clear the longest pause (5.5s) and cover at least one full stride.
  for (let i = 0; i < 300; i++) {
    updateCrewBehavior(0.1, now);
    now += 100;
  }
  for (const member of CREW) {
    if (Math.hypot(member.curX - member.x, member.curZ - member.z) > 0.05) {
      moved = true;
      break;
    }
  }
  assert.ok(moved, "expected at least one crew member to have moved after 30 simulated seconds");
});

test("wandering never leaves a crew member's walkable footprint", () => {
  resetPositions();
  initCrewBehavior();

  let now = Date.now();
  for (let i = 0; i < 600; i++) {
    updateCrewBehavior(0.1, now);
    now += 100;
    for (const member of CREW) {
      // Sleeping is the one deliberate exception: Dessa's routine ends her
      // commute to the Crew Quarters by snapping onto her berth's exact
      // spot, which sits inside that berth's own collision footprint on
      // purpose (see ship.js's PROP_COLLIDERS and crew-behavior.js's
      // "sleep" activity) — the same way a seated player occupies a
      // chair's footprint via sitAt without a matching isWalkable check.
      if (member.pose === "sleep") continue;
      assert.ok(
        isWalkable(member.curX, member.curZ, RADIUS),
        `${member.name} wandered to an unwalkable spot (${member.curX}, ${member.curZ})`
      );
    }
  }
});

// --- Activity repertoire (new this pass) --------------------------------

test("over time, some crew member performs a stationary activity pose", () => {
  resetPositions();
  initCrewBehavior();

  const seenPoses = new Set();
  let now = Date.now();
  for (let i = 0; i < 1200; i++) {
    updateCrewBehavior(0.1, now);
    now += 100;
    for (const member of CREW) seenPoses.add(member.pose);
  }

  for (const pose of ["sit", "sit_read", "lean", "clean"]) {
    assert.ok(seenPoses.has(pose), `expected to see the "${pose}" activity pose within 120 simulated seconds`);
  }
});

test("Dessa completes a full sleep cycle: commutes to her berth, sleeps, and resumes wandering", () => {
  resetPositions();
  initCrewBehavior();
  const dessa = CREW.find((m) => m.id === "dessa");

  let now = Date.now();
  let sawSleep = false;
  let sawPostSleepActivity = false;
  // Long enough to clear a full round trip through the Quarters Corridor
  // and back, even starting from whatever stop the routine happens to be
  // on (crew-behavior.js's internal state persists across tests in this
  // file, the same way it already did before this pass).
  for (let i = 0; i < 1800; i++) {
    updateCrewBehavior(0.1, now);
    now += 100;
    if (dessa.pose === "sleep") {
      sawSleep = true;
      assert.equal(dessa.curX, 0, "should be lying exactly at her berth");
      assert.equal(dessa.curZ, 14.5, "should be lying exactly at her berth");
    } else if (sawSleep) {
      sawPostSleepActivity = true;
    }
  }

  assert.ok(sawSleep, "expected Dessa to reach her berth and sleep within 180 simulated seconds");
  assert.ok(sawPostSleepActivity, "expected Dessa to wake up and resume her routine afterward");
});

test("setTalking freezes a crew member in place", () => {
  resetPositions();
  initCrewBehavior();
  const corwin = CREW.find((m) => m.id === "corwin");

  setTalking("corwin", true, { x: corwin.curX + 1, z: corwin.curZ });
  const frozenX = corwin.curX;
  const frozenZ = corwin.curZ;

  let now = Date.now();
  for (let i = 0; i < 100; i++) {
    updateCrewBehavior(0.1, now);
    now += 100;
  }

  assert.equal(corwin.curX, frozenX);
  assert.equal(corwin.curZ, frozenZ);
  assert.ok(!corwin.walking);

  setTalking("corwin", false);
});
