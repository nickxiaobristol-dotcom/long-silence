// Crew data sanity checks, run headlessly with `node --test` (CREW/
// findNearbyCrew are pure data + geometry, no WebGL/DOM needed).
import { test } from "node:test";
import assert from "node:assert/strict";
import { CREW, INTERACT_RANGE, findNearbyCrew } from "../js/crew.js";
import { isWalkable } from "../js/ship.js";

const PLAYER_RADIUS = 0.4;

test("there are exactly 5 crew members", () => {
  assert.equal(CREW.length, 5);
});

test("every crew member has a name, role, position, and flavor line", () => {
  for (const member of CREW) {
    assert.equal(typeof member.name, "string");
    assert.ok(member.name.length > 0);
    assert.equal(typeof member.role, "string");
    assert.ok(member.role.length > 0);
    assert.equal(typeof member.x, "number");
    assert.equal(typeof member.z, "number");
    assert.equal(typeof member.line, "string");
    assert.ok(member.line.length > 0);
  }
});

test("crew names are unique", () => {
  const names = CREW.map((m) => m.name);
  assert.equal(new Set(names).size, names.length);
});

test("every crew member stands somewhere walkable", () => {
  for (const member of CREW) {
    assert.ok(
      isWalkable(member.x, member.z, PLAYER_RADIUS),
      `${member.name} (${member.x}, ${member.z}) should be walkable`
    );
  }
});

test("findNearbyCrew returns the closest crew member in range", () => {
  const captain = CREW.find((m) => m.name === "Dessa Okafor");
  const found = findNearbyCrew(captain.x, captain.z);
  assert.equal(found, captain);
});

test("findNearbyCrew returns null when no crew member is in range", () => {
  assert.equal(findNearbyCrew(-30, 0), null);
});

test("findNearbyCrew respects INTERACT_RANGE", () => {
  const captain = CREW.find((m) => m.name === "Dessa Okafor");
  const justOutside = captain.z - INTERACT_RANGE - 0.5;
  assert.equal(findNearbyCrew(captain.x, justOutside), null);
});

test("every crew member starts with a live position matching their spawn", () => {
  for (const member of CREW) {
    assert.equal(member.curX, member.x);
    assert.equal(member.curZ, member.z);
  }
});

test("findNearbyCrew checks live position (curX/curZ), not the fixed spawn (x/z)", () => {
  const captain = CREW.find((m) => m.name === "Dessa Okafor");
  const spawnX = captain.x;
  const spawnZ = captain.z;
  try {
    // Simulate autonomous wandering (js/crew-behavior.js) moving the
    // captain well away from her spawn point.
    captain.curX = captain.x + 20;
    captain.curZ = captain.z + 20;

    assert.equal(
      findNearbyCrew(spawnX, spawnZ),
      null,
      "standing on the old spawn point should no longer find her"
    );
    assert.equal(
      findNearbyCrew(captain.curX, captain.curZ),
      captain,
      "standing next to her current position should find her"
    );
  } finally {
    captain.curX = spawnX;
    captain.curZ = spawnZ;
  }
});
