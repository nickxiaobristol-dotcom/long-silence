// Pure asteroid-field spawn/drift/collision logic (js/asteroids.js). The
// THREE mesh builders (buildAsteroidField/syncAsteroidMeshes) are just
// render glue over this and aren't tested directly, same as
// js/interactables.js's buildInteractables in test/interactables.test.mjs.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ASTEROID_COUNT,
  SPAWN_AHEAD,
  DESPAWN_BEHIND,
  distanceTo,
  checkCollision,
  stepAsteroid,
  isBehind,
  spawnAsteroid,
  createField,
  stepField,
} from "../js/asteroids.js";

const FORWARD = { x: 0, y: 0, z: 1 };
const SHIP = { x: 0, y: 0, z: 0 };

test("createField produces ASTEROID_COUNT asteroids, all ahead of the ship", () => {
  const field = createField(SHIP, FORWARD);
  assert.equal(field.length, ASTEROID_COUNT);
  for (const a of field) {
    assert.ok(a.z > 0, "spawned asteroid should be ahead along +Z");
  }
});

test("spawnAsteroid places asteroids within the documented spawn distance band", () => {
  const rng = () => 0.5; // deterministic: dead center, no scatter
  const a = spawnAsteroid(SHIP, FORWARD, rng);
  assert.equal(a.x, 0);
  assert.equal(a.y, 0);
  assert.ok(a.z >= SPAWN_AHEAD * 0.7 && a.z <= SPAWN_AHEAD * 1.3);
});

test("checkCollision is true only once ship and asteroid overlap by their combined radii", () => {
  const asteroid = { x: 0, y: 0, z: 10, radius: 3 };
  assert.equal(checkCollision({ x: 0, y: 0, z: 5 }, 2, asteroid), false); // gap 5, radii sum 5
  assert.equal(checkCollision({ x: 0, y: 0, z: 6 }, 2, asteroid), true); // gap 4 < 5
});

test("stepAsteroid drifts position by velocity * dt", () => {
  const a = { x: 0, y: 0, z: 0, vx: 2, vy: -1, vz: 3, radius: 4 };
  const next = stepAsteroid(a, 0.5);
  assert.equal(next.x, 1);
  assert.equal(next.y, -0.5);
  assert.equal(next.z, 1.5);
});

test("isBehind is true only once an asteroid falls margin units behind the ship along forward", () => {
  const asteroid = { x: 0, y: 0, z: -50 };
  assert.equal(isBehind(asteroid, SHIP, FORWARD, 100), false);
  assert.equal(isBehind(asteroid, SHIP, FORWARD, 40), true);
});

test("stepField recycles an asteroid that falls behind DESPAWN_BEHIND to ahead of the ship again", () => {
  const field = [{ x: 0, y: 0, z: -(DESPAWN_BEHIND + 10), vx: 0, vy: 0, vz: 0, radius: 3 }];
  const result = stepField(field, SHIP, 2, FORWARD, 0.016, () => 0.5);
  assert.equal(result.field.length, 1);
  assert.ok(result.field[0].z > 0, "recycled asteroid should reappear ahead of the ship");
  assert.equal(result.collided, null);
});

test("stepField reports a collision when an asteroid overlaps the ship", () => {
  const field = [{ x: 0, y: 0, z: 1, vx: 0, vy: 0, vz: 0, radius: 3 }];
  const result = stepField(field, SHIP, 2, FORWARD, 0.016);
  assert.ok(result.collided);
});
