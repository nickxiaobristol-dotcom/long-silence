import * as THREE from "three";
import {
  createFlightState,
  stepFlight,
  applyAsteroidHit,
  isWarping,
  isFlashing,
  headingVector,
} from "./flight-physics.js";
import { buildShipExterior } from "./ship-exterior.js";
import { buildSolarSystem, spinPlanet, PLANETS, SYSTEM_END } from "./solar-system.js";
import { createField, stepField, buildAsteroidField, syncAsteroidMeshes } from "./asteroids.js";

// THREE-side wiring for flight mode: owns the flight scene/camera, drives
// js/flight-physics.js's pure state from keyboard input, and positions the
// ship/camera/warp effect/asteroid meshes off it each frame. Mirrors the
// split js/player.js keeps from js/ship.js — physics stays pure and
// testable, this is just the render glue.

const SHIP_COLLISION_RADIUS = 5;
const CAMERA_BACK = 16;
const CAMERA_UP = 5;
const LOOKAHEAD = 40;

const KEY_MAP = {
  KeyW: "thrustUp",
  // Inverted vertical axis (flight-sim convention): Up pitches the nose
  // down, Down pitches it up. Applies to the touch heading stick too,
  // since it drives the same ArrowUp/ArrowDown codes.
  ArrowUp: "pitchDown",
  KeyS: "thrustDown",
  ArrowDown: "pitchUp",
  // Yaw was backwards on screen (Right turned the nose left and vice
  // versa) — the chase camera's lookAt basis ends up mirrored relative to
  // world yaw, so Left/Right are swapped here to match what they turn on
  // screen rather than flipping the underlying yaw math.
  ArrowLeft: "yawRight",
  ArrowRight: "yawLeft",
};

function buildWarpEffect() {
  // A cone of streak lines parented to the camera, radiating from just in
  // front of the lens out into the distance. Screen-space by construction
  // (it inherits the camera's own transform), so it needs building once,
  // never per-frame — only .visible toggles with throttle.
  const count = 160;
  const positions = new Float32Array(count * 2 * 3);
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const r = 2 + Math.random() * 16;
    const nearZ = -3 - Math.random() * 3;
    const farZ = nearZ - 14 - Math.random() * 26;
    positions[i * 6 + 0] = Math.cos(angle) * r * 0.25;
    positions[i * 6 + 1] = Math.sin(angle) * r * 0.25;
    positions[i * 6 + 2] = nearZ;
    positions[i * 6 + 3] = Math.cos(angle) * r;
    positions[i * 6 + 4] = Math.sin(angle) * r;
    positions[i * 6 + 5] = farZ;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  const material = new THREE.LineBasicMaterial({ color: 0xbfe8ff, transparent: true, opacity: 0.85 });
  return new THREE.LineSegments(geometry, material);
}

export class FlightController {
  constructor() {
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.5, SYSTEM_END * 3);

    this.planetGroups = buildSolarSystem(this.scene);
    this.shipGroup = buildShipExterior();
    this.scene.add(this.shipGroup);

    this.warpGroup = buildWarpEffect();
    this.warpGroup.visible = false;
    this.camera.add(this.warpGroup);
    this.scene.add(this.camera);

    this.pressed = new Set();
    this.active = false;
    this.state = createFlightState();

    this._onKeyDown = (e) => {
      if (this.active) this.pressed.add(e.code);
    };
    this._onKeyUp = (e) => this.pressed.delete(e.code);
    window.addEventListener("keydown", this._onKeyDown);
    window.addEventListener("keyup", this._onKeyUp);

    const forward = headingVector(this.state.yaw, this.state.pitch);
    this.field = createField(this.state, forward);
    this.asteroidMeshes = buildAsteroidField(this.scene, this.field);

    this._justCollided = false;
    this._syncVisuals();
  }

  // Re-armed every time the player takes the helm: a fresh flight state
  // and asteroid field near a fixed start point just outside the ship,
  // rather than resuming wherever a previous flight left off — flight mode
  // is a self-contained excursion, not a persistent position to track.
  activate() {
    this.active = true;
    this.pressed.clear();
    this.state = createFlightState();
    const forward = headingVector(this.state.yaw, this.state.pitch);
    this.field = createField(this.state, forward);
    syncAsteroidMeshes(this.asteroidMeshes, this.field, 0);
    this._syncVisuals();
  }

  deactivate() {
    this.active = false;
    this.pressed.clear();
  }

  get throttle() {
    return this.state.throttle;
  }

  get speed() {
    return this.state.speed;
  }

  get warping() {
    return isWarping(this.state);
  }

  flashing(now = Date.now()) {
    return isFlashing(this.state, now);
  }

  update(dt) {
    if (!this.active) return;

    const input = {};
    for (const code of this.pressed) {
      const action = KEY_MAP[code];
      if (action) input[action] = true;
    }
    this.state = stepFlight(this.state, input, dt);

    const forward = headingVector(this.state.yaw, this.state.pitch);
    const result = stepField(this.field, this.state, SHIP_COLLISION_RADIUS, forward, dt);
    this.field = result.field;
    this._justCollided = !!result.collided;
    if (result.collided) this.state = applyAsteroidHit(this.state, Date.now());
    syncAsteroidMeshes(this.asteroidMeshes, this.field, dt);

    for (const planet of PLANETS) spinPlanet(this.planetGroups[planet.name], dt);

    this._syncVisuals();
  }

  _syncVisuals() {
    const { x, y, z, yaw, pitch } = this.state;
    this.shipGroup.position.set(x, y, z);
    this.shipGroup.rotation.order = "YXZ";
    this.shipGroup.rotation.set(-pitch, yaw, 0);

    const dir = headingVector(yaw, pitch);
    this.camera.position.set(x - dir.x * CAMERA_BACK, y - dir.y * CAMERA_BACK + CAMERA_UP, z - dir.z * CAMERA_BACK);
    this.camera.lookAt(x + dir.x * LOOKAHEAD, y + dir.y * LOOKAHEAD, z + dir.z * LOOKAHEAD);

    this.warpGroup.visible = isWarping(this.state);
  }
}
