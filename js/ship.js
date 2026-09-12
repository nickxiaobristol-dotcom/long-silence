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
];

export const WALKABLE = [...ROOMS, ...CORRIDORS];

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
  { x1: -3, z1: 5, x2: 5, z2: 5 },
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
// inside at least one walkable rect (room or corridor).
export function isWalkable(x, z, radius) {
  return WALKABLE.some(
    (rect) =>
      x - radius >= rect.minX &&
      x + radius <= rect.maxX &&
      z - radius >= rect.minZ &&
      z + radius <= rect.maxZ
  );
}
