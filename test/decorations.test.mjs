// Set dressing is visual only — nothing in decorations.js is added to
// ship.js's WALKABLE list, so the collision solver can't stop the player
// walking into a prop. That makes placement a correctness problem rather
// than a taste one: a crate dropped in a doorway would be walked straight
// through, and a console placed on a crew member's spawn would swallow
// them. These tests walk the world-space AABB of every primitive
// decorations.js places and assert the layout rules the file documents.

import { test } from "node:test";
import assert from "node:assert/strict";
import { decorationBounds } from "../js/decorations.js";
import { CORRIDORS, ROOMS, WALKABLE } from "../js/ship.js";
import { CREW } from "../js/crew.js";

const bounds = decorationBounds();

// Floor decals (painted lines, hazard stripes, deck hatches, scuffs) are
// meant to be walked over, so the keep-out volumes start above them. The
// upper bound clears the 1.66m character rig with margin, which is what
// lets doorway headers span a corridor at 2.2m.
const FLOOR_DECAL_TOP = 0.06;
const HEAD_CLEARANCE = 2.15;

function isStanding(box) {
  return box.max.y > FLOOR_DECAL_TOP && box.min.y < HEAD_CLEARANCE;
}

function overlapsXZ(box, rect) {
  return (
    box.max.x > rect.minX &&
    box.min.x < rect.maxX &&
    box.max.z > rect.minZ &&
    box.min.z < rect.maxZ
  );
}

// Distance from (x, z) to the box's footprint; 0 if inside it.
function distanceXZ(box, x, z) {
  const dx = Math.max(box.min.x - x, 0, x - box.max.x);
  const dz = Math.max(box.min.z - z, 0, z - box.max.z);
  return Math.hypot(dx, dz);
}

function describe(box) {
  const f = (n) => n.toFixed(2);
  return `x[${f(box.min.x)},${f(box.max.x)}] y[${f(box.min.y)},${f(box.max.y)}] z[${f(box.min.z)},${f(box.max.z)}]`;
}

test("the decoration pass actually places a dense set of props", () => {
  assert.ok(
    bounds.length > 600,
    `expected a detailed pass, got only ${bounds.length} primitives`
  );
});

test("no prop stands inside a corridor or doorway", () => {
  for (const box of bounds) {
    if (!isStanding(box)) continue;
    for (const corridor of CORRIDORS) {
      assert.ok(
        !overlapsXZ(box, corridor),
        `prop at ${describe(box)} blocks ${corridor.name}`
      );
    }
  }
});

test("doorway headers clear the character rig", () => {
  // Every prop that does sit over a corridor must be overhead-only.
  const overhead = bounds.filter((box) =>
    CORRIDORS.some((corridor) => overlapsXZ(box, corridor))
  );
  assert.ok(overhead.length > 0, "expected doorway headers over the corridors");
  for (const box of overhead) {
    assert.ok(
      box.min.y >= HEAD_CLEARANCE || box.max.y <= FLOOR_DECAL_TOP,
      `prop at ${describe(box)} sits at body height over a corridor`
    );
  }
});

test("no prop stands on a character's spawn point", () => {
  // The player starts in the Common Area at (1, 0); see js/main.js.
  const spawns = [
    ...CREW.map((m) => ({ name: m.name, x: m.x, z: m.z })),
    { name: "player start", x: 1, z: 0 },
  ];
  for (const spawn of spawns) {
    for (const box of bounds) {
      if (!isStanding(box)) continue;
      assert.ok(
        distanceXZ(box, spawn.x, spawn.z) >= 0.5,
        `prop at ${describe(box)} crowds ${spawn.name} at (${spawn.x}, ${spawn.z})`
      );
    }
  }
});

test("every prop stays inside the hull", () => {
  // Props are allowed to sink slightly into a wall box (wall thickness is
  // 0.2m), but none should be floating out in the void.
  const slack = 0.3;
  for (const box of bounds) {
    const inside = WALKABLE.some(
      (rect) =>
        box.min.x >= rect.minX - slack &&
        box.max.x <= rect.maxX + slack &&
        box.min.z >= rect.minZ - slack &&
        box.max.z <= rect.maxZ + slack
    );
    assert.ok(inside, `prop at ${describe(box)} is outside every room`);
  }
});

test("no prop sinks through the deck or punches through the ceiling", () => {
  for (const box of bounds) {
    assert.ok(box.min.y >= -0.02, `prop at ${describe(box)} is below the floor`);
    // The reactor's exhaust stack is deliberately the tallest thing aboard
    // and pokes above the 2.6m wall line, which reads fine with no ceiling
    // geometry — but nothing should be far above that.
    assert.ok(box.max.y <= 3.0, `prop at ${describe(box)} is above the ship`);
  }
});

test("every room got a meaningful share of the detail", () => {
  const counts = new Map(ROOMS.map((room) => [room.name, 0]));
  for (const box of bounds) {
    const cx = (box.min.x + box.max.x) / 2;
    const cz = (box.min.z + box.max.z) / 2;
    for (const room of ROOMS) {
      if (cx >= room.minX && cx <= room.maxX && cz >= room.minZ && cz <= room.maxZ) {
        counts.set(room.name, counts.get(room.name) + 1);
        break;
      }
    }
  }
  for (const [name, count] of counts) {
    assert.ok(count >= 100, `${name} only has ${count} decoration primitives`);
  }
});
