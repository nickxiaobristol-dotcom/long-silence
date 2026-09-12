import * as THREE from "three";

// Visual-only low-poly set dressing for the ship's 4 rooms. Purely
// decorative: no entries here go into ship.js's WALKABLE/collision list,
// so nothing here can trap the player against a wall. Placement keeps
// clear of every doorway gap (see WALL_SEGMENTS in ship.js), the crew
// spawn points (see CREW in crew.js), and the player's start point (1, 0)
// so a decoration is never standing where a character needs to be.

// `emissive` marks a prop as its own light source (the viewport, the
// reactor), so it stays readable once scene fog dims everything around it.
function propMaterial(color, emissive) {
  const params = { color };
  if (emissive !== undefined) params.emissive = emissive;
  return new THREE.MeshStandardMaterial(params);
}

function addBox(scene, { w, h, d, x, y, z, color, emissive, rotY = 0 }) {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    propMaterial(color, emissive)
  );
  mesh.position.set(x, y, z);
  if (rotY) mesh.rotation.y = rotY;
  scene.add(mesh);
}

function addCylinder(scene, { r, h, x, y, z, color, emissive }) {
  const mesh = new THREE.Mesh(
    new THREE.CylinderGeometry(r, r, h, 12),
    propMaterial(color, emissive)
  );
  mesh.position.set(x, y, z);
  scene.add(mesh);
}

// Cockpit (x: -14..-6, z: -4..4). Doorway is on the east wall (x = -6,
// z in [-1, 1]); the nose wall (x = -14) is a dead end, so console banks
// and the viewport strip live there without touching the walk path.
function buildCockpit(scene) {
  for (const z of [-3, -2, 2, 3]) {
    addBox(scene, { w: 0.6, h: 0.9, d: 0.5, x: -13.3, y: 0.45, z, color: 0x2f3b47 });
  }
  addBox(scene, {
    w: 0.1,
    h: 0.7,
    d: 5.5,
    x: -13.92,
    y: 1.6,
    z: 0,
    color: 0x0d3b52,
    emissive: 0x2f7ba8,
  });

  // Captain's chair, tucked off to one side away from Kaia's spot (-10, 0)
  // and the doorway.
  addCylinder(scene, { r: 0.32, h: 0.08, x: -8.8, y: 0.42, z: -2.6, color: 0x3a4552 });
  addBox(scene, { w: 0.5, h: 0.6, d: 0.08, x: -8.8, y: 0.7, z: -2.9, color: 0x3a4552 });
}

// Common Area (x: -3..5, z: -5..5), the hub with 3 doorways (west at
// x=-3, east at x=5, south at z=-5, each z/x-gapped [-1, 1]) plus the
// north wall solid at z=5. Dessa stands at (1, -3), Marcus at (3, 3), the
// player spawns at (1, 0) — decorations go in the corners those miss.
function buildCommonArea(scene) {
  // Table + stools in the north-west corner.
  addBox(scene, { w: 1.2, h: 0.05, d: 1.2, x: -2, y: 0.55, z: 3.6, color: 0x4a3c2e });
  addCylinder(scene, { r: 0.08, h: 0.55, x: -2.4, y: 0.28, z: 3.2, color: 0x4a3c2e });
  addCylinder(scene, { r: 0.08, h: 0.55, x: -1.6, y: 0.28, z: 4.0, color: 0x4a3c2e });
  addBox(scene, { w: 0.4, h: 0.4, d: 0.4, x: -2.4, y: 0.2, z: 2.4, color: 0x5a4a38 });

  // Shelf/locker against the solid north wall, clear of Marcus.
  addBox(scene, { w: 1.4, h: 1.6, d: 0.3, x: 0.5, y: 0.8, z: 4.7, color: 0x2e3a44 });
}

// Engine Room (x: 8..16, z: -4..4). Doorway on the west wall (x = 8, z in
// [-1, 1]). Corwin stands at (12, 0); the reactor and machinery sit
// against the far (east) wall instead of on top of him.
function buildEngineRoom(scene) {
  for (const z of [-2.5, 2.5]) {
    addBox(scene, { w: 1.2, h: 1.4, d: 0.9, x: 14.8, y: 0.7, z, color: 0x39352f });
  }
  // Reactor centerpiece.
  addCylinder(scene, {
    r: 0.6,
    h: 1.8,
    x: 13,
    y: 0.9,
    z: 0,
    color: 0x1f6f6b,
    emissive: 0x10403e,
  });
  addCylinder(scene, {
    r: 0.68,
    h: 0.08,
    x: 13,
    y: 1.82,
    z: 0,
    color: 0xd9a441,
    emissive: 0x9a5c15,
  });

  // Warning stripe along the floor at the reactor's base.
  for (let i = 0; i < 6; i++) {
    addBox(scene, {
      w: 0.35,
      h: 0.02,
      d: 0.35,
      x: 13 + Math.cos((i / 6) * Math.PI * 2) * 1.1,
      y: 0.011,
      z: Math.sin((i / 6) * Math.PI * 2) * 1.1,
      color: i % 2 === 0 ? 0xd9a441 : 0x1a1a1a,
    });
  }
}

// Cargo Bay (x: -5..5, z: -15..-9). Doorway on the north wall (z = -9,
// x in [-1, 1]). Amara stands at (0, -12); crate stacks fill the back
// (south) corners, and the loading marking sits off to one side of her.
function buildCargoBay(scene) {
  const crateColor = 0x6b5a3a;
  addBox(scene, { w: 1.1, h: 1.1, d: 1.1, x: -3.5, y: 0.55, z: -13.5, color: crateColor });
  addBox(scene, { w: 0.9, h: 0.9, d: 0.9, x: -3.5, y: 1.55, z: -13.5, color: 0x7a6845 });
  addBox(scene, { w: 0.9, h: 0.9, d: 0.9, x: -2.3, y: 0.45, z: -13, color: crateColor });

  addBox(scene, { w: 1.1, h: 1.1, d: 1.1, x: 3.5, y: 0.55, z: -13.5, color: crateColor });
  addBox(scene, { w: 0.9, h: 0.9, d: 0.9, x: 2.3, y: 0.45, z: -13, color: 0x7a6845 });

  // Loading area marking: a flat painted rectangle on the floor.
  addBox(scene, { w: 2.2, h: 0.02, d: 1.6, x: -2, y: 0.011, z: -10.5, color: 0xd9a441 });
  addBox(scene, { w: 1.9, h: 0.03, d: 1.3, x: -2, y: 0.021, z: -10.5, color: 0x1f241d });
}

export function buildDecorations(scene) {
  buildCockpit(scene);
  buildCommonArea(scene);
  buildEngineRoom(scene);
  buildCargoBay(scene);
}
