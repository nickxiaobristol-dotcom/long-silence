// Pure flight-mode state machine (js/flight-physics.js): throttle/heading
// integration and the asteroid-hit collision response. No THREE involved,
// same split js/ship.js's isWalkable gets tested with in
// test/decorations.test.mjs.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  LIGHT_SPEED,
  WARP_THROTTLE,
  MAX_PITCH,
  createFlightState,
  clampThrottle,
  throttleToSpeed,
  headingVector,
  stepFlight,
  applyAsteroidHit,
  isFlashing,
  isWarping,
} from "../js/flight-physics.js";

test("clampThrottle keeps throttle within [0, 1]", () => {
  assert.equal(clampThrottle(-0.5), 0);
  assert.equal(clampThrottle(1.5), 1);
  assert.equal(clampThrottle(0.4), 0.4);
});

test("throttleToSpeed is linear up to LIGHT_SPEED at throttle = 1", () => {
  assert.equal(throttleToSpeed(0), 0);
  assert.equal(throttleToSpeed(1), LIGHT_SPEED);
  assert.equal(throttleToSpeed(0.5), LIGHT_SPEED * 0.5);
});

test("headingVector at yaw=0, pitch=0 points along +Z", () => {
  const v = headingVector(0, 0);
  assert.ok(Math.abs(v.x) < 1e-9);
  assert.ok(Math.abs(v.y) < 1e-9);
  assert.ok(Math.abs(v.z - 1) < 1e-9);
});

test("stepFlight ramps throttle up under thrustUp and integrates position along heading", () => {
  const state = createFlightState(0, 0, 0);
  const next = stepFlight(state, { thrustUp: true }, 1);
  assert.ok(next.throttle > 0);
  assert.equal(next.speed, throttleToSpeed(next.throttle));
  // Facing yaw = PI (spawn heading), so +throttle moves toward -Z.
  assert.ok(next.z < 0);
});

test("stepFlight never exceeds LIGHT_SPEED regardless of held thrust duration", () => {
  let state = createFlightState();
  for (let i = 0; i < 100; i++) state = stepFlight(state, { thrustUp: true }, 1);
  assert.equal(state.throttle, 1);
  assert.equal(state.speed, LIGHT_SPEED);
});

test("stepFlight clamps pitch so it can never flip through vertical", () => {
  let state = createFlightState();
  for (let i = 0; i < 100; i++) state = stepFlight(state, { pitchUp: true }, 1);
  assert.equal(state.pitch, MAX_PITCH);
});

test("isWarping is true only once throttle reaches WARP_THROTTLE", () => {
  assert.equal(isWarping({ throttle: WARP_THROTTLE - 0.01 }), false);
  assert.equal(isWarping({ throttle: WARP_THROTTLE }), true);
  assert.equal(isWarping({ throttle: 1 }), true);
});

test("applyAsteroidHit sheds speed, knocks the ship back, and starts a flash window", () => {
  const state = { ...createFlightState(10, 0, 10), yaw: 0, pitch: 0, throttle: 1, speed: LIGHT_SPEED };
  const hit = applyAsteroidHit(state, 1000);
  assert.ok(hit.throttle < state.throttle);
  assert.ok(hit.speed < state.speed);
  // Heading is +Z here, so knockback along -heading pushes z down.
  assert.ok(hit.z < state.z);
  assert.equal(isFlashing(hit, 1000), true);
  assert.equal(isFlashing(hit, hit.flashUntil + 1), false);
});
