// Collision/floor-plan sanity checks, run headlessly with `node --test`
// (isWalkable is pure geometry, no WebGL/DOM needed).
import { test } from "node:test";
import assert from "node:assert/strict";
import { isWalkable, ROOMS, CORRIDORS } from "../js/ship.js";

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

// Regression test: rooms and corridors used to meet at exactly flush
// edges, which left a real gap right at each doorway threshold once the
// player's collision radius was subtracted — the player would get stuck
// walking through. Corridors now overlap 1m into each room they connect
// (see the comment on CORRIDORS in ship.js) specifically to close this.
test("no collision gap along any doorway transition", () => {
  const step = 0.05;
  const sweeps = [
    { axis: "x", from: -13, to: 4, fixed: 0, label: "fwd corridor" },
    { axis: "x", from: 4, to: 15, fixed: 0, label: "aft corridor" },
    { axis: "z", from: -14, to: 4, fixed: 0, label: "cargo corridor" },
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
