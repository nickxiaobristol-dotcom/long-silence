// Collision/floor-plan sanity checks, run headlessly with `node --test`
// (isWalkable is pure geometry, no WebGL/DOM needed).
import { test } from "node:test";
import assert from "node:assert/strict";
import { isWalkable, isBlockedByProp, ROOMS, CORRIDORS, PROP_COLLIDERS } from "../js/ship.js";

const PLAYER_RADIUS = 0.4;

test("room and corridor centers are walkable", () => {
  for (const rect of [...ROOMS, ...CORRIDORS]) {
    const cx = (rect.minX + rect.maxX) / 2;
    const cz = (rect.minZ + rect.maxZ) / 2;
    assert.ok(
      isWalkable(cx, cz, PLAYER_RADIUS),
      `${rect.name} center (${cx}, ${cz}) should be walkable`
    );
  }
});

test("outside the ship is not walkable", () => {
  assert.equal(isWalkable(-30, 0, PLAYER_RADIUS), false);
  assert.equal(isWalkable(0, 30, PLAYER_RADIUS), false);
});

test("gap between Common Area and Cargo Bay, off the corridor, is not walkable", () => {
  assert.equal(isWalkable(3, -6.5, PLAYER_RADIUS), false);
});

// Same check for the Crew Quarters spur: the Common Area's north wall was
// split to open the hatch at x in [-1, 1], and the halves either side of it
// still have to be solid.
test("gap between Common Area and Crew Quarters, off the corridor, is not walkable", () => {
  assert.equal(isWalkable(3, 7, PLAYER_RADIUS), false);
  assert.equal(isWalkable(-2.5, 7, PLAYER_RADIUS), false);
});

// Regression test: rooms and corridors used to meet at exactly flush
// edges, which left a real gap right at each doorway threshold once the
// player's collision radius was subtracted — the player would get stuck
// walking through. Corridors now overlap 1m into each room they connect
// (see the comment on CORRIDORS in ship.js) specifically to close this.
//
// The fwd/aft ranges below stop short of the full room span (originally
// -13..4 and 4..15) now that PROP_COLLIDERS gives the cockpit's console
// row and the engine room's reactor real collision: both sit on this
// z = 0 centerline further into their rooms. That's the furniture bug fix
// working as intended, not a regression — the doorway transition itself
// (the thing this test actually checks) is still fully covered, with a
// clear margin either side of each corridor.
test("no collision gap along any doorway transition", () => {
  const step = 0.05;
  const sweeps = [
    { axis: "x", from: -8, to: 4, fixed: 0, label: "fwd corridor" },
    { axis: "x", from: 4, to: 11, fixed: 0, label: "aft corridor" },
    { axis: "z", from: -14, to: 4, fixed: 0, label: "cargo corridor" },
    { axis: "z", from: 4, to: 14, fixed: 0, label: "quarters corridor" },
  ];
  for (const { axis, from, to, fixed, label } of sweeps) {
    for (let v = from; v <= to + 1e-9; v += step) {
      const [x, z] = axis === "x" ? [v, fixed] : [fixed, v];
      assert.ok(
        isWalkable(x, z, PLAYER_RADIUS),
        `${label}: gap at (${x.toFixed(2)}, ${z.toFixed(2)})`
      );
    }
  }
});

// --- Furniture collision (new this pass) --------------------------------

test("a solid prop is not walkable at its own center", () => {
  for (const p of PROP_COLLIDERS) {
    const [x, z] = p.type === "circle" ? [p.x, p.z] : [(p.minX + p.maxX) / 2, (p.minZ + p.maxZ) / 2];
    assert.equal(
      isWalkable(x, z, PLAYER_RADIUS),
      false,
      `expected prop at (${x}, ${z}) to block movement`
    );
  }
});

test("the Engine Room reactor blocks a straight walk into it", () => {
  // Corwin's spawn (12, 0) is a clear approach lane toward the reactor at
  // (14, 0); the player should be stopped well before reaching its center.
  assert.equal(isWalkable(12, 0, PLAYER_RADIUS), true);
  assert.equal(isWalkable(13.4, 0, PLAYER_RADIUS), false);
  assert.equal(isBlockedByProp(13.4, 0, PLAYER_RADIUS), true);
});

test("a Cockpit console blocks a straight walk into it", () => {
  assert.equal(isWalkable(-13.05, 0, PLAYER_RADIUS), false);
  assert.equal(isBlockedByProp(-13.05, 0, PLAYER_RADIUS), true);
  // Toward the pilot seats, clear of the console row, is walkable again.
  assert.equal(isWalkable(-11.9, 0, PLAYER_RADIUS), true);
});

test("the Common Area mess table blocks a straight walk into it", () => {
  assert.equal(isWalkable(-1.5, 3.3, PLAYER_RADIUS), false);
  assert.equal(isBlockedByProp(-1.5, 3.3, PLAYER_RADIUS), true);
});

test("prop collision never covers a doorway gap", () => {
  // Centers of all 8 doorway gaps (see decorations.js's DOORWAYS and
  // ship.js's WALL_SEGMENTS) — furniture placement must leave every one
  // walkable.
  const doorways = [
    [-6, 0],
    [-3, 0],
    [5, 0],
    [8, 0],
    [0, -5],
    [0, -9],
    [0, 5],
    [0, 9],
  ];
  for (const [x, z] of doorways) {
    assert.ok(isWalkable(x, z, PLAYER_RADIUS), `doorway at (${x}, ${z}) should stay walkable`);
  }
});

test("every crew spawn and the player start point stay clear of furniture", () => {
  const points = [
    [1, 0], // player start
    [1, -3], // Dessa
    [-10, 0], // Kaia
    [12, 0], // Corwin
    [0, -12], // Amara
    [3, 3], // Marcus
  ];
  for (const [x, z] of points) {
    assert.equal(isBlockedByProp(x, z, PLAYER_RADIUS), false, `(${x}, ${z}) should be clear of props`);
  }
});
