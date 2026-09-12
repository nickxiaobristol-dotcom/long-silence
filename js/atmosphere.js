import * as THREE from "three";

// Scene mood: fog, a gradient sky, and a warm-key/cool-fill light rig.
// The goal is atmospheric depth over the flat-shaded look — distant rooms
// haze out, curved surfaces pick up a warm-to-cool gradient instead of one
// uniform tone. Geometry and materials stay plain low-poly primitives; no
// post-processing, shaders, or textures.

const SKY_HIGH = 0x2b3d55; // cool slate toward the top of the void
const SKY_LOW = 0x0b1119; // deep blue-black underneath the ship
// Deliberately lighter than the ship's surfaces: distant geometry washes
// out toward it, which reads as haze rather than as things going dark.
const FOG_COLOR = 0x1d2b3b;
const SKY_RADIUS = 60;

// Inverted sphere with a vertical vertex-color gradient, standing in for a
// sky. Fog is disabled on it so it stays a backdrop rather than flattening
// into the fog color.
function addSky(scene) {
  const geometry = new THREE.SphereGeometry(SKY_RADIUS, 16, 12);
  const low = new THREE.Color(SKY_LOW);
  const high = new THREE.Color(SKY_HIGH);
  const position = geometry.attributes.position;
  const colors = [];
  for (let i = 0; i < position.count; i++) {
    const t = (position.getY(i) / SKY_RADIUS + 1) / 2;
    const color = low.clone().lerp(high, t);
    colors.push(color.r, color.g, color.b);
  }
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));

  const sky = new THREE.Mesh(
    geometry,
    new THREE.MeshBasicMaterial({
      side: THREE.BackSide,
      vertexColors: true,
      fog: false,
      depthWrite: false,
    })
  );
  scene.add(sky);
}

// Small colored point lights tied to the props that would be emitting them
// (see decorations.js): the cockpit viewport, the reactor, a common-area
// lamp, and a dimmer cargo bay fixture. The reactor light tracks the core
// to its new position in the detail pass; the fifth is a short-range lamp
// for the engine room's workbench, which is the one focal area none of the
// original four reach. These are per-fragment costs
// on every lit surface, so the list only grows for a room with no source
// of its own — the sixth is the Crew Quarters, far enough north that the
// common area lamp's 12m radius dies well before it.
const ACCENT_LIGHTS = [
  { color: 0x66b8ff, intensity: 14, distance: 14, x: -13.4, y: 1.7, z: 0 },
  { color: 0xffa15c, intensity: 18, distance: 12, x: 14, y: 1.5, z: 0 },
  { color: 0xffd39a, intensity: 14, distance: 12, x: 1, y: 2.4, z: 1 },
  { color: 0x9fc2dd, intensity: 12, distance: 13, x: 0, y: 2.4, z: -12 },
  { color: 0xffca8f, intensity: 7, distance: 5.5, x: 11.5, y: 1.5, z: -3.5 },
  // Deliberately the warmest and among the dimmest of the six: berthing
  // lit for sleeping, not for working.
  { color: 0xffbf85, intensity: 10, distance: 11, x: 0, y: 2.3, z: 12 },
];

export function buildAtmosphere(scene) {
  scene.background = new THREE.Color(SKY_LOW);
  scene.fog = new THREE.Fog(FOG_COLOR, 10, 34);
  addSky(scene);

  // Cool sky over warm bounce: the cheapest way to get a gradient across
  // curved surfaces rather than one flat ambient tone.
  scene.add(new THREE.HemisphereLight(0x8fb0d4, 0x6b4c34, 2.4));

  const keyLight = new THREE.DirectionalLight(0xffd2a1, 2.4);
  keyLight.position.set(8, 14, 6);
  scene.add(keyLight);

  const fillLight = new THREE.DirectionalLight(0x7fa0dd, 1.0);
  fillLight.position.set(-10, 6, -8);
  scene.add(fillLight);

  for (const spec of ACCENT_LIGHTS) {
    const light = new THREE.PointLight(spec.color, spec.intensity, spec.distance);
    light.position.set(spec.x, spec.y, spec.z);
    scene.add(light);
  }
}
