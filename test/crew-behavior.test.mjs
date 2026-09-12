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
      assert.ok(
        isWalkable(member.curX, member.curZ, RADIUS),
        `${member.name} wandered to an unwalkable spot (${member.curX}, ${member.curZ})`
      );
    }
  }
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
