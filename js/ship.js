import * as THREE from "three";

// Floor plan of The Long Silence, v1 slice: four rooms connected by three
// short corridors, laid out nose-to-tail along +X, with a cargo bay
// branching off the common area toward -Z. Units are meters.
//
// Rects are axis-aligned floor footprints used both for rendering the
// floor/walls and for player movement collision (see isWalkable below).

export const ROOMS = [
  { name: "Cockpit", minX: -14, maxX: -6, minZ: -4, maxZ: 4, color: 0x1d2731 },
  { name: "Common Area", minX: -3, maxX: 5, minZ: -5, maxZ: 5, color: 0x24303a },
  { name: "Engine Room", minX: 8, maxX: 16, minZ: -4, maxZ: 4, color: 0x2a2420 },
  { name: "Cargo Bay", minX: -5, maxX: 5, minZ: -15, maxZ: -9, color: 0x1f241d },
  // Berthing, added north of the Common Area as a deliberate mirror of the
  // Cargo Bay to its south: same width, same 2m spine corridor, so the hub
  // reads as a cross with crew space one way and cargo the other.
  { name: "Crew Quarters", minX: -4, maxX: 4, minZ: 9, maxZ: 15, color: 0x272a33 },
];

// Corridors overlap 1m into each room they connect (rather than meeting
// room edges exactly) so a radius-buffered player circle is always fully
// inside at least one rect while crossing a doorway. With edges flush, a
// point sitting exactly on the seam is outside both rects once you
// subtract the collision radius, and the player gets stuck in doorways.
// The overlap must exceed 2x the player radius (0.4m) on each side or a
// thin gap remains right at the threshold — 1m clears that with margin.
export const CORRIDORS = [
  // Cockpit <-> Common Area
  { name: "Fwd Corridor", minX: -7, maxX: -2, minZ: -1, maxZ: 1, color: 0x161c22 },
  // Common Area <-> Engine Room
  { name: "Aft Corridor", minX: 4, maxX: 9, minZ: -1, maxZ: 1, color: 0x161c22 },
  // Common Area <-> Cargo Bay
  { name: "Cargo Corridor", minX: -1, maxX: 1, minZ: -10, maxZ: -4, color: 0x161c22 },
  // Common Area <-> Crew Quarters
  { name: "Quarters Corridor", minX: -1, maxX: 1, minZ: 4, maxZ: 10, color: 0x161c22 },
];

export const WALKABLE = [...ROOMS, ...CORRIDORS];

// Approximate collision footprints for the "solid" furniture and equipment
// decorations.js places — the pieces a person couldn't walk through in
// real life (consoles, tables, the reactor, crate stacks, lockers,
// berths...). Rects/circles here are deliberately generous-but-inexact:
// good enough to stop a straight walk-in, not a hitbox traced to the mesh.
// Coordinates are hand-matched to decorations.js's own placements (see the
// comments there); kept here rather than in decorations.js because
// isWalkable is the single choke point the player (js/player.js) and every
// wandering crew member (js/crew-behavior.js) already call every frame.
// Every entry has been checked against: the 8 doorway gaps in
// WALL_SEGMENTS (none block one), every crew spawn and interactable
// coordinate in js/crew.js and js/interactables.js (none sit inside one),
// and the wander waypoints in js/crew-behavior.js (moved clear of one
// where they used to overlap).
export const PROP_COLLIDERS = [
  // --- Cockpit ---
  { type: "circle", x: -13.05, z: 0, r: 0.65 }, // console bay
  { type: "circle", x: -12.92, z: 1.5, r: 0.65 }, // console bay
  { type: "circle", x: -12.52, z: 2.95, r: 0.65 }, // console bay
  { type: "circle", x: -12.92, z: -1.5, r: 0.65 }, // console bay
  { type: "circle", x: -12.52, z: -2.95, r: 0.65 }, // console bay
  { type: "rect", minX: -12.65, maxX: -10.55, minZ: -3.89, maxZ: -3.47 }, // avionics/comms rack
  { type: "rect", minX: -12.2, maxX: -9.8, minZ: 2.65, maxZ: 3.65 }, // nav chart table

  // --- Common Area ---
  { type: "rect", minX: -2.5, maxX: -0.6, minZ: 2.85, maxZ: 3.95 }, // mess table + bench
  { type: "rect", minX: 4.29, maxX: 4.91, minZ: 1.4, maxZ: 4.3 }, // galley run
  { type: "rect", minX: -2.98, maxX: -1.42, minZ: 4.33, maxZ: 4.83 }, // crew lockers, west pair
  { type: "rect", minX: 1.42, maxX: 2.98, minZ: 4.33, maxZ: 4.83 }, // crew lockers, east pair
  { type: "rect", minX: 4.4, maxX: 4.84, minZ: -3.19, maxZ: -1.41 }, // storage shelving
  { type: "rect", minX: -2.85, maxX: -1.65, minZ: -4.85, maxZ: -4.35 }, // med station

  // --- Engine Room ---
  { type: "circle", x: 14.0, z: 0, r: 1.3 }, // reactor core
  { type: "rect", minX: 9.2, maxX: 11.6, minZ: -3.78, maxZ: -3.06 }, // workbench
  { type: "rect", minX: 11.95, maxX: 13.05, minZ: -3.75, maxZ: -3.62 }, // diagnostic terminal
  { type: "rect", minX: 13.5, maxX: 15.9, minZ: -3.9, maxZ: -3.1 }, // equipment cabinets
  { type: "circle", x: 8.75, z: 3.2, r: 0.4 }, // coolant tank
  { type: "circle", x: 8.75, z: -3.2, r: 0.4 }, // coolant tank
  { type: "rect", minX: 13.45, maxX: 15.75, minZ: 2.95, maxZ: 3.85 }, // heat exchanger

  // --- Cargo Bay ---
  { type: "rect", minX: -4.25, maxX: -2.35, minZ: -13.95, maxZ: -12.45 }, // west crate stack + pallet
  { type: "rect", minX: 2.72, maxX: 3.15, minZ: -14.24, maxZ: -13.04 }, // east stack, base crate
  { type: "rect", minX: 1.95, maxX: 2.65, minZ: -13.65, maxZ: -12.95 }, // east stack, second crate
  { type: "circle", x: -1.6, z: -13.5, r: 0.45 }, // crate fallen on its side
  { type: "circle", x: 4.24, z: -11.9, r: 0.35 }, // drum
  { type: "circle", x: 3.62, z: -11.58, r: 0.35 }, // drum
  { type: "circle", x: 4.28, z: -11.12, r: 0.35 }, // drum
  { type: "rect", minX: 4.25, maxX: 4.65, minZ: -10.75, maxZ: -9.85 }, // leaning panel stack
  { type: "rect", minX: -2.4, maxX: 2.4, minZ: -14.8, maxZ: -14.5 }, // aft container row
  { type: "rect", minX: 2.85, maxX: 3.75, minZ: -14.66, maxZ: -14.14 }, // manifest terminal

  // --- Crew Quarters ---
  { type: "rect", minX: -3.95, maxX: -3.05, minZ: 10.0, maxZ: 12.0 }, // Kaia's berth
  { type: "rect", minX: -3.95, maxX: -3.05, minZ: 12.4, maxZ: 14.4 }, // Corwin's berth
  { type: "rect", minX: 3.05, maxX: 3.95, minZ: 10.0, maxZ: 12.0 }, // Amara's berth
  { type: "rect", minX: 3.05, maxX: 3.95, minZ: 12.4, maxZ: 14.4 }, // Marcus's berth
  { type: "rect", minX: -1.0, maxX: 1.0, minZ: 14.5, maxZ: 14.95 }, // Dessa's berth
  { type: "rect", minX: -1.65, maxX: -0.65, minZ: 11.97, maxZ: 12.83 }, // off-watch table
  { type: "rect", minX: -3.55, maxX: -1.65, minZ: 9.02, maxZ: 9.58 }, // wash station
];

function circleOverlapsCircle(x, z, r, px, pz, pr) {
  const dx = x - px;
  const dz = z - pz;
  const rad = r + pr;
  return dx * dx + dz * dz < rad * rad;
}

function circleOverlapsRect(x, z, r, rect) {
  const cx = Math.max(rect.minX, Math.min(x, rect.maxX));
  const cz = Math.max(rect.minZ, Math.min(z, rect.maxZ));
  const dx = x - cx;
  const dz = z - cz;
  return dx * dx + dz * dz < r * r;
}

// True if a circle of the given radius centered at (x, z) overlaps any
// solid prop's collision footprint. A seat is deliberately never in this
// list: sitting (js/player.js's sitAt, js/crew-behavior.js's "sit"
// activity) means occupying the same footprint as the chair, the same way
// Dessa's sleep activity occupies her berth's footprint on purpose.
export function isBlockedByProp(x, z, radius) {
  return PROP_COLLIDERS.some((p) =>
    p.type === "circle"
      ? circleOverlapsCircle(x, z, radius, p.x, p.z, p.r)
      : circleOverlapsRect(x, z, radius, p)
  );
}

// Explicit wall segments (start/end points), hand-placed to leave gaps at
// each corridor doorway rather than derived from the rects above — with
// only four rooms this is far simpler and less error-prone than general
// polygon-boolean wall generation.
const WALL_SEGMENTS = [
  // Cockpit
  { x1: -14, z1: 4, x2: -6, z2: 4 },
  { x1: -14, z1: -4, x2: -6, z2: -4 },
  { x1: -14, z1: -4, x2: -14, z2: 4 },
  { x1: -6, z1: -4, x2: -6, z2: -1 },
  { x1: -6, z1: 1, x2: -6, z2: 4 },

  // Common Area
  { x1: -3, z1: -5, x2: -3, z2: -1 },
  { x1: -3, z1: 1, x2: -3, z2: 5 },
  { x1: 5, z1: -5, x2: 5, z2: -1 },
  { x1: 5, z1: 1, x2: 5, z2: 5 },
  { x1: -3, z1: 5, x2: -1, z2: 5 },
  { x1: 1, z1: 5, x2: 5, z2: 5 },
  { x1: -3, z1: -5, x2: -1, z2: -5 },
  { x1: 1, z1: -5, x2: 5, z2: -5 },

  // Engine Room
  { x1: 8, z1: -4, x2: 8, z2: -1 },
  { x1: 8, z1: 1, x2: 8, z2: 4 },
  { x1: 16, z1: -4, x2: 16, z2: 4 },
  { x1: 8, z1: 4, x2: 16, z2: 4 },
  { x1: 8, z1: -4, x2: 16, z2: -4 },

  // Cargo Bay
  { x1: -5, z1: -9, x2: -1, z2: -9 },
  { x1: 1, z1: -9, x2: 5, z2: -9 },
  { x1: -5, z1: -15, x2: 5, z2: -15 },
  { x1: -5, z1: -15, x2: -5, z2: -9 },
  { x1: 5, z1: -15, x2: 5, z2: -9 },

  // Crew Quarters
  { x1: -4, z1: 9, x2: -1, z2: 9 },
  { x1: 1, z1: 9, x2: 4, z2: 9 },
  { x1: -4, z1: 15, x2: 4, z2: 15 },
  { x1: -4, z1: 9, x2: -4, z2: 15 },
  { x1: 4, z1: 9, x2: 4, z2: 15 },
];

const WALL_HEIGHT = 2.6;
const WALL_THICKNESS = 0.2;

function addFloor(scene, rect) {
  const width = rect.maxX - rect.minX;
  const depth = rect.maxZ - rect.minZ;
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(width, depth),
    new THREE.MeshStandardMaterial({ color: rect.color })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(
    (rect.minX + rect.maxX) / 2,
    0,
    (rect.minZ + rect.maxZ) / 2
  );
  scene.add(floor);
}

function addWall(scene, seg) {
  const length = Math.hypot(seg.x2 - seg.x1, seg.z2 - seg.z1);
  const wall = new THREE.Mesh(
    new THREE.BoxGeometry(length, WALL_HEIGHT, WALL_THICKNESS),
    new THREE.MeshStandardMaterial({ color: 0x3a4552 })
  );
  wall.position.set(
    (seg.x1 + seg.x2) / 2,
    WALL_HEIGHT / 2,
    (seg.z1 + seg.z2) / 2
  );
  wall.rotation.y = -Math.atan2(seg.z2 - seg.z1, seg.x2 - seg.x1);
  scene.add(wall);
}

export function buildShip(scene) {
  // Corridors first, rooms second: corridor rects overlap into room
  // footprints (see CORRIDORS comment above), so drawing rooms on top
  // keeps each room's floor color clean right up to its real doorway.
  for (const corridor of CORRIDORS) addFloor(scene, corridor);
  for (const room of ROOMS) addFloor(scene, room);
  for (const seg of WALL_SEGMENTS) addWall(scene, seg);
}

// True if a circle of the given radius centered at (x, z) fits entirely
// inside at least one walkable rect (room or corridor) and doesn't overlap
// a solid prop's collision footprint.
export function isWalkable(x, z, radius) {
  if (isBlockedByProp(x, z, radius)) return false;
  return WALKABLE.some(
    (rect) =>
      x - radius >= rect.minX &&
      x + radius <= rect.maxX &&
      z - radius >= rect.minZ &&
      z + radius <= rect.maxZ
  );
}
