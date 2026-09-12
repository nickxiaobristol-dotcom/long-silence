// Object-interaction data/proximity logic (js/interactables.js). The
// visual toggle (js/interactables.js's buildInteractables) needs a THREE
// scene, but findNearbyInteractable/toggleInteractable/promptFor are pure
// enough to test directly, same as findNearbyCrew in test/crew.test.mjs.
import { test } from "node:test";
import assert from "node:assert/strict";
import { isWalkable } from "../js/ship.js";
import {
  INTERACTABLES,
  ACTION_RANGE,
  findNearbyInteractable,
  toggleInteractable,
  isActive,
  promptFor,
} from "../js/interactables.js";

const PLAYER_RADIUS = 0.4;

test("there are between 3 and 5 interactables", () => {
  assert.ok(INTERACTABLES.length >= 3 && INTERACTABLES.length <= 5);
});

test("every interactable sits somewhere walkable", () => {
  for (const item of INTERACTABLES) {
    assert.ok(
      isWalkable(item.x, item.z, PLAYER_RADIUS),
      `${item.id} (${item.x}, ${item.z}) should be walkable`
    );
  }
});

test("findNearbyInteractable returns the closest interactable in range", () => {
  const item = INTERACTABLES[0];
  assert.equal(findNearbyInteractable(item.x, item.z), item);
});

test("findNearbyInteractable returns null out of range", () => {
  assert.equal(findNearbyInteractable(1000, 1000), null);
});

test("findNearbyInteractable respects ACTION_RANGE", () => {
  const item = INTERACTABLES[0];
  assert.equal(findNearbyInteractable(item.x, item.z + ACTION_RANGE + 1), null);
});

test("toggleInteractable flips active state and promptFor reflects it", () => {
  const item = INTERACTABLES.find((i) => i.id === "footlocker");
  assert.equal(isActive(item.id), false);
  assert.equal(promptFor(item), item.promptOn);

  const active = toggleInteractable(item.id);
  assert.equal(active, true);
  assert.equal(isActive(item.id), true);
  assert.equal(promptFor(item), item.promptOff);

  toggleInteractable(item.id); // restore, so other tests see a clean slate
  assert.equal(isActive(item.id), false);
});
