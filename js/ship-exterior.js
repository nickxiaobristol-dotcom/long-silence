import * as THREE from "three";

// A simple low-poly exterior hull for The Long Silence, in the same
// primitive-boxes-and-cylinders style as everything in js/props.js —
// scrappy tramp-freighter silhouette rather than a detailed model, since
// this is only ever seen from a chase camera a few dozen units back.
// Built nose-forward along +Z, matching js/flight-physics.js's heading
// convention (yaw 0, pitch 0 -> (0, 0, 1)) so js/flight.js can drive the
// group's rotation directly from yaw/pitch with no extra offset.

const HULL = 0x4a5764;
const HULL_DARK = 0x2f3b47;
const TRIM = 0xd9a441;
const GLOW = 0x2f8f62;

export function buildShipExterior() {
  const group = new THREE.Group();
  const hullMat = new THREE.MeshStandardMaterial({ color: HULL, roughness: 0.6, metalness: 0.3 });
  const darkMat = new THREE.MeshStandardMaterial({ color: HULL_DARK, roughness: 0.7 });
  const trimMat = new THREE.MeshStandardMaterial({ color: TRIM, roughness: 0.5 });
  const glowMat = new THREE.MeshStandardMaterial({ color: GLOW, emissive: GLOW, emissiveIntensity: 1.6 });

  // Main body, tapered toward the nose.
  const body = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 2.2, 9, 8), hullMat);
  body.rotation.x = Math.PI / 2;
  group.add(body);

  // Cockpit bubble at the nose (+Z).
  const cockpit = new THREE.Mesh(new THREE.SphereGeometry(1.1, 10, 8), darkMat);
  cockpit.position.set(0, 0.6, 4.2);
  group.add(cockpit);

  // Cargo/engine bulk toward the tail (-Z).
  const tail = new THREE.Mesh(new THREE.BoxGeometry(3.2, 2.6, 4.5), hullMat);
  tail.position.set(0, 0, -3.6);
  group.add(tail);

  // Twin engine nacelles, glowing at the exhaust.
  for (const side of [-1, 1]) {
    const nacelle = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.7, 3, 8), darkMat);
    nacelle.rotation.x = Math.PI / 2;
    nacelle.position.set(side * 1.9, -0.4, -4.5);
    group.add(nacelle);

    const glow = new THREE.Mesh(new THREE.CircleGeometry(0.5, 12), glowMat);
    glow.position.set(side * 1.9, -0.4, -6.05);
    glow.rotation.y = Math.PI; // face -Z, toward the chase camera behind the ship
    group.add(glow);
  }

  // Wings/stabilizer fins.
  const finGeo = new THREE.BoxGeometry(4.6, 0.15, 1.6);
  for (const side of [-1, 1]) {
    const fin = new THREE.Mesh(finGeo, trimMat);
    fin.position.set(side * 3, 0, -2.4);
    fin.rotation.z = side * 0.08;
    group.add(fin);
  }

  // A couple of hull-trim stripes so the low-poly shape reads as "built",
  // not just a smooth capsule.
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.1, 8), trimMat);
  stripe.position.set(0, 1.8, -1);
  group.add(stripe);

  return group;
}
