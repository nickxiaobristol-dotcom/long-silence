// Pure flight-mode physics/state: throttle, heading, position integration,
// and the collision response for hitting an asteroid. No THREE here — this
// is a plain state machine js/flight.js drives a camera/ship rig from, the
// same separation js/crew-behavior.js keeps from js/main.js's rendering.

// Themed "light speed" cap — an arcade top speed, not a relativistic one.
// Chosen together with js/solar-system.js's distance scale (Neptune sits
// at ~18,000 units from the Sun) so a full end-to-end run at max throttle
// takes a couple of minutes: 18000 / 120 = 150s.
export const LIGHT_SPEED = 120; // units/second at throttle = 1
export const THROTTLE_RATE = 0.5; // per second, held key
export const TURN_RATE = 1.1; // radians/second, held key
export const MAX_PITCH = (80 * Math.PI) / 180; // clamp so pitch can't flip through vertical

// Throttle beyond this fraction of max triggers the warp-streak visual.
export const WARP_THROTTLE = 0.82;

// Collision response tuning.
export const COLLISION_SPEED_FACTOR = 0.25; // speed retained after a hit
export const COLLISION_KNOCKBACK = 18; // units pushed back along -heading
export const COLLISION_FLASH_MS = 350;

export function createFlightState(x = 0, y = 0, z = 400) {
  return {
    x,
    y,
    z,
    yaw: Math.PI, // facing back toward the ship/origin at spawn
    pitch: 0,
    throttle: 0,
    speed: 0,
    flashUntil: 0,
  };
}

export function clampThrottle(t) {
  return Math.min(1, Math.max(0, t));
}

// Speed is a direct linear function of throttle, capped at LIGHT_SPEED.
// Kept as its own function (rather than inlined) because it's the one
// place "what does throttle actually mean" lives, and the asteroid warp
// effect and the speed HUD both need to ask the same question.
export function throttleToSpeed(throttle) {
  return clampThrottle(throttle) * LIGHT_SPEED;
}

export function headingVector(yaw, pitch) {
  return {
    x: Math.cos(pitch) * Math.sin(yaw),
    y: Math.sin(pitch),
    z: Math.cos(pitch) * Math.cos(yaw),
  };
}

// Advances throttle/heading from held input, then integrates position along
// the resulting heading at the resulting speed. `input` is a plain set of
// booleans (thrustUp/thrustDown/yawLeft/yawRight/pitchUp/pitchDown) so
// js/flight.js can build it from whatever key state it likes without this
// module knowing about keyboards.
export function stepFlight(state, input, dt) {
  let throttle = state.throttle;
  if (input.thrustUp) throttle += THROTTLE_RATE * dt;
  if (input.thrustDown) throttle -= THROTTLE_RATE * dt;
  throttle = clampThrottle(throttle);

  let yaw = state.yaw;
  if (input.yawLeft) yaw -= TURN_RATE * dt;
  if (input.yawRight) yaw += TURN_RATE * dt;

  let pitch = state.pitch;
  if (input.pitchUp) pitch += TURN_RATE * dt;
  if (input.pitchDown) pitch -= TURN_RATE * dt;
  pitch = Math.min(MAX_PITCH, Math.max(-MAX_PITCH, pitch));

  const speed = throttleToSpeed(throttle);
  const dir = headingVector(yaw, pitch);

  return {
    ...state,
    throttle,
    yaw,
    pitch,
    speed,
    x: state.x + dir.x * speed * dt,
    y: state.y + dir.y * speed * dt,
    z: state.z + dir.z * speed * dt,
  };
}

// Bounces the ship off an asteroid: sheds most of its speed/throttle and
// gets pushed back along the way it came, so a hit is a real setback
// without needing a health/damage system. `now` is the caller's clock
// (Date.now() at runtime, an injected value in tests) so the HUD flash can
// be timed the same way js/crew-behavior.js already times its pauses.
export function applyAsteroidHit(state, now) {
  const dir = headingVector(state.yaw, state.pitch);
  const throttle = clampThrottle(state.throttle * COLLISION_SPEED_FACTOR);
  return {
    ...state,
    throttle,
    speed: throttleToSpeed(throttle),
    x: state.x - dir.x * COLLISION_KNOCKBACK,
    y: state.y - dir.y * COLLISION_KNOCKBACK,
    z: state.z - dir.z * COLLISION_KNOCKBACK,
    flashUntil: now + COLLISION_FLASH_MS,
  };
}

export function isFlashing(state, now) {
  return now < state.flashUntil;
}

export function isWarping(state) {
  return state.throttle >= WARP_THROTTLE;
}
