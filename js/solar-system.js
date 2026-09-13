import * as THREE from "three";

// The real Sol system, compressed to a scale that's actually flyable.
//
// Distance uses one honest linear scale, derived from real AU distances:
// 1 unit = 250,000 km (DISTANCE_UNITS_PER_MILLION_KM below), so every
// planet's distance from the Sun keeps its real ratio to every other
// planet's. That puts Neptune at ~18,000 units out — chosen together with
// js/flight-physics.js's LIGHT_SPEED (120 units/s) so a full end-to-end
// run at max throttle takes a couple of minutes, not a real-world eternity
// of empty space.
//
// Radius does NOT use that same scale, on purpose: at 1 unit = 250,000 km,
// Earth's radius would be 0.025 units (invisible) and the Sun's would be
// ~2,780 units — bigger than Mercury's entire orbit, swallowing the inner
// system. Every real "solar system to scale" visualization hits this and
// picks one scale or the other; this one uses a separate, hand-picked
// radius per body that preserves each body's real *order* and rough
// *grouping* (small rocky planets, mid ice giants, big gas giants, and the
// Sun clearly biggest) without being linearly tied to the distance scale.
export const DISTANCE_UNITS_PER_MILLION_KM = 4;

export const SUN_RADIUS = 100;

// distanceMillionKm: real Sun-to-planet distance. radius: hand-picked, see
// the comment above — not derived from distanceMillionKm.
export const PLANETS = [
  { name: "Mercury", distanceMillionKm: 57.9, radius: 6, color: 0x9c8f7c },
  { name: "Venus", distanceMillionKm: 108.2, radius: 11, color: 0xd9c27a },
  { name: "Earth", distanceMillionKm: 149.6, radius: 12, color: 0x3a7bd0 },
  { name: "Mars", distanceMillionKm: 227.9, radius: 8, color: 0xb0562f },
  { name: "Jupiter", distanceMillionKm: 778.5, radius: 55, color: 0xc9a76d },
  { name: "Saturn", distanceMillionKm: 1434, radius: 46, color: 0xdccb8f, ring: true },
  { name: "Uranus", distanceMillionKm: 2871, radius: 28, color: 0x9fd8d8 },
  { name: "Neptune", distanceMillionKm: 4495, radius: 26, color: 0x3a5fcd },
];

export function planetDistance(planet) {
  return planet.distanceMillionKm * DISTANCE_UNITS_PER_MILLION_KM;
}

// Planets are laid out along +X at z = 0, in order, purely so the flight
// corridor reads as one traversable line rather than requiring the player
// to hunt around a full orbital plane for each one.
export function planetPosition(planet) {
  return { x: planetDistance(planet), y: 0, z: 0 };
}

export const SYSTEM_END = planetDistance(PLANETS[PLANETS.length - 1]);

function buildPlanetMesh(planet) {
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(planet.radius, 20, 14),
    new THREE.MeshStandardMaterial({ color: planet.color, roughness: 0.85, metalness: 0.05 })
  );
  const pos = planetPosition(planet);
  mesh.position.set(pos.x, pos.y, pos.z);

  const group = new THREE.Group();
  group.add(mesh);

  if (planet.ring) {
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(planet.radius * 1.4, planet.radius * 2.2, 48),
      new THREE.MeshStandardMaterial({
        color: 0xc9bb95,
        side: THREE.DoubleSide,
        roughness: 0.9,
        transparent: true,
        opacity: 0.75,
      })
    );
    ring.rotation.x = Math.PI / 2 - 0.35; // tilted, not flat-on, so it reads as a ring rather than a disc
    ring.position.copy(mesh.position);
    group.add(ring);
  }

  group.userData.spinSpeed = 0.05 + Math.random() * 0.1;
  group.userData.mesh = mesh;
  return group;
}

function buildSun() {
  const sun = new THREE.Mesh(
    new THREE.SphereGeometry(SUN_RADIUS, 24, 16),
    new THREE.MeshStandardMaterial({
      color: 0xffd27a,
      emissive: 0xffae42,
      emissiveIntensity: 1.6,
    })
  );
  sun.position.set(0, 0, 0);
  return sun;
}

// A cheap wide-field starfield: a shell of points centered on the origin,
// far enough out (SYSTEM_END * 2.2) that flying through the whole system
// never visibly approaches it. Kept small enough (STAR_COUNT) that a
// Points draw call is effectively free next to the rest of the scene.
const STAR_COUNT = 2200;

function buildStarfield() {
  const radius = SYSTEM_END * 2.2;
  const positions = new Float32Array(STAR_COUNT * 3);
  for (let i = 0; i < STAR_COUNT; i++) {
    // Uniform on a sphere shell: reject-free via a normalized Gaussian-ish
    // trick (three independent uniforms, normalized) is overkill here —
    // a normalized uniform-cube direction is visually indistinguishable
    // for a starfield backdrop.
    const dir = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize();
    const r = radius * (0.6 + Math.random() * 0.4);
    positions[i * 3] = dir.x * r;
    positions[i * 3 + 1] = dir.y * r;
    positions[i * 3 + 2] = dir.z * r;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  const material = new THREE.PointsMaterial({ color: 0xffffff, size: 4, sizeAttenuation: false });
  return new THREE.Points(geometry, material);
}

// Builds the Sun, all 8 planets, and the backdrop starfield into `scene`.
// Returns the planet groups (for the slow self-rotation js/flight.js's
// update loop drives) keyed by name.
export function buildSolarSystem(scene) {
  scene.add(buildSun());
  scene.add(new THREE.AmbientLight(0x30343c, 1.2));
  const sunLight = new THREE.PointLight(0xfff2d8, 3.2, 0, 0);
  sunLight.position.set(0, 0, 0);
  scene.add(sunLight);
  scene.add(buildStarfield());

  const groups = {};
  for (const planet of PLANETS) {
    const group = buildPlanetMesh(planet);
    scene.add(group);
    groups[planet.name] = group;
  }
  return groups;
}

// Slow cosmetic self-rotation, called once per frame per planet group.
export function spinPlanet(group, dt) {
  group.userData.mesh.rotation.y += group.userData.spinSpeed * dt;
}
