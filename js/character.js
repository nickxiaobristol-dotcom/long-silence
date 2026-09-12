import * as THREE from "three";

// Shared low-poly humanoid rig for the player and all 5 crew: one small
// primitive-based "person" (legs/torso/arms/head), recolored per
// character rather than building six distinct rigs. Origin sits at the
// character's feet (y = 0) so callers can position.set(x, 0, z) directly,
// matching the floor-level coordinates used everywhere else (ship.js,
// crew.js positions).

const LEG_HEIGHT = 0.7;
const TORSO_HEIGHT = 0.6;
const HEAD_RADIUS = 0.18;
const ARM_HEIGHT = 0.55;

export function buildHumanoid(color) {
  const group = new THREE.Group();
  const material = new THREE.MeshStandardMaterial({ color });

  const legGeometry = new THREE.BoxGeometry(0.18, LEG_HEIGHT, 0.18);
  for (const side of [-1, 1]) {
    const leg = new THREE.Mesh(legGeometry, material);
    leg.position.set(side * 0.13, LEG_HEIGHT / 2, 0);
    group.add(leg);
  }

  const torso = new THREE.Mesh(
    new THREE.BoxGeometry(0.5, TORSO_HEIGHT, 0.28),
    material
  );
  torso.position.set(0, LEG_HEIGHT + TORSO_HEIGHT / 2, 0);
  group.add(torso);

  const armGeometry = new THREE.BoxGeometry(0.14, ARM_HEIGHT, 0.14);
  for (const side of [-1, 1]) {
    const arm = new THREE.Mesh(armGeometry, material);
    arm.position.set(
      side * 0.32,
      LEG_HEIGHT + TORSO_HEIGHT - ARM_HEIGHT / 2,
      0
    );
    group.add(arm);
  }

  const head = new THREE.Mesh(
    new THREE.SphereGeometry(HEAD_RADIUS, 8, 6),
    material
  );
  head.position.set(0, LEG_HEIGHT + TORSO_HEIGHT + HEAD_RADIUS, 0);
  group.add(head);

  return group;
}
