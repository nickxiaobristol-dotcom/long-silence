import * as THREE from "three";

// Asteroid field: pure spawn/drift/collision math (testable without THREE)
// plus a THREE mesh-pool builder, the same split js/flight-physics.js and
// js/flight.js keep.
//
// A fixed-size pool drifts near the ship at all times rather than being
// "placed" along the whole multi-thousand-unit system: each asteroid that
// falls too far behind gets respawned somewhere ahead, so the field always
// reads as present regardless of where the ship is between the Sun and
// Neptune.

export const ASTEROID_COUNT = 60;
export const MIN_RADIUS = 3;
export const MAX_RADIUS = 9;
export const SPAWN_AHEAD = 260; // how far in front of the ship a fresh asteroid appears
export const SPAWN_SPREAD = 90; // lateral/vertical scatter around that forward point
export const DESPAWN_BEHIND = 120; // how far behind the ship triggers a respawn
export const DRIFT_SPEED = 4; // max per-axis drift, units/second

export function distanceTo(a, x, y, z) {
  return Math.hypot(a.x - x, a.y - y, a.z - z);
}

export function checkCollision(shipPos, shipRadius, asteroid) {
  return distanceTo(asteroid, shipPos.x, shipPos.y, shipPos.z) < shipRadius + asteroid.radius;
}

export function stepAsteroid(asteroid, dt) {
  return {
    ...asteroid,
    x: asteroid.x + asteroid.vx * dt,
    y: asteroid.y + asteroid.vy * dt,
    z: asteroid.z + asteroid.vz * dt,
  };
}

// True once an asteroid has drifted far enough behind the ship's forward
// heading (not just "far away" — an asteroid off to the side ahead
// shouldn't be recycled just because it's not dead ahead).
export function isBehind(asteroid, shipPos, forward, margin) {
  const dx = asteroid.x - shipPos.x;
  const dy = asteroid.y - shipPos.y;
  const dz = asteroid.z - shipPos.z;
  const along = dx * forward.x + dy * forward.y + dz * forward.z;
  return along < -margin;
}

// Spawns a fresh asteroid ahead of the ship along `forward`, offset by a
// random lateral/vertical scatter. `rng` defaults to Math.random but takes
// an injected function so tests can make placement deterministic.
export function spawnAsteroid(shipPos, forward, rng = Math.random) {
  // Any vector not parallel to forward works as a basis seed; forward is
  // never exactly (0, 1, 0) in this game (pitch is clamped below vertical
  // in js/flight-physics.js), so this cross product is always well-formed.
  const up = { x: 0, y: 1, z: 0 };
  const rightX = forward.y * up.z - forward.z * up.y;
  const rightY = forward.z * up.x - forward.x * up.z;
  const rightZ = forward.x * up.y - forward.y * up.x;
  const rightLen = Math.hypot(rightX, rightY, rightZ) || 1;
  const right = { x: rightX / rightLen, y: rightY / rightLen, z: rightZ / rightLen };
  const trueUp = {
    x: forward.y * right.z - forward.z * right.y,
    y: forward.z * right.x - forward.x * right.z,
    z: forward.x * right.y - forward.y * right.x,
  };

  const lateral = (rng() - 0.5) * 2 * SPAWN_SPREAD;
  const vertical = (rng() - 0.5) * 2 * SPAWN_SPREAD;
  const ahead = SPAWN_AHEAD * (0.7 + rng() * 0.6);

  return {
    x: shipPos.x + forward.x * ahead + right.x * lateral + trueUp.x * vertical,
    y: shipPos.y + forward.y * ahead + right.y * lateral + trueUp.y * vertical,
    z: shipPos.z + forward.z * ahead + right.z * lateral + trueUp.z * vertical,
    vx: (rng() - 0.5) * 2 * DRIFT_SPEED,
    vy: (rng() - 0.5) * 2 * DRIFT_SPEED,
    vz: (rng() - 0.5) * 2 * DRIFT_SPEED,
    radius: MIN_RADIUS + rng() * (MAX_RADIUS - MIN_RADIUS),
    rotSpeed: (rng() - 0.5) * 1.5,
  };
}

export function createField(shipPos, forward, rng = Math.random) {
  const field = [];
  for (let i = 0; i < ASTEROID_COUNT; i++) field.push(spawnAsteroid(shipPos, forward, rng));
  return field;
}

// Advances the whole field one step: drifts every asteroid, recycles any
// that fell behind, and reports which (if any) newly overlap the ship.
// Returns { field, collided } rather than mutating in place, consistent
// with js/flight-physics.js's stepFlight.
export function stepField(field, shipPos, shipRadius, forward, dt, rng = Math.random) {
  const next = [];
  let collided = null;
  for (const asteroid of field) {
    let a = stepAsteroid(asteroid, dt);
    if (isBehind(a, shipPos, forward, DESPAWN_BEHIND)) {
      a = spawnAsteroid(shipPos, forward, rng);
    } else if (!collided && checkCollision(shipPos, shipRadius, a)) {
      collided = a;
    }
    next.push(a);
  }
  return { field: next, collided };
}

// A jittered icosahedron reads as "irregular rock" for near-zero cost —
// perturb each vertex along its own normal by a random amount.
function buildAsteroidGeometry(radius, seedRng) {
  const geo = new THREE.IcosahedronGeometry(radius, 0);
  const pos = geo.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const scale = 0.75 + seedRng() * 0.5;
    v.multiplyScalar(scale);
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  geo.computeVertexNormals();
  return geo;
}

// Builds ASTEROID_COUNT meshes into `scene`, positioned from `field`, and
// returns the mesh array in the same order so js/flight.js can sync
// positions each frame without rebuilding geometry.
export function buildAsteroidField(scene, field) {
  const material = new THREE.MeshStandardMaterial({ color: 0x6b6357, roughness: 0.95 });
  const meshes = [];
  for (const asteroid of field) {
    const mesh = new THREE.Mesh(buildAsteroidGeometry(asteroid.radius, Math.random), material);
    mesh.position.set(asteroid.x, asteroid.y, asteroid.z);
    mesh.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
    scene.add(mesh);
    meshes.push(mesh);
  }
  return meshes;
}

export function syncAsteroidMeshes(meshes, field, dt) {
  for (let i = 0; i < meshes.length; i++) {
    const mesh = meshes[i];
    const a = field[i];
    mesh.position.set(a.x, a.y, a.z);
    mesh.rotation.y += a.rotSpeed * dt;
  }
}
