import * as THREE from "three";
import { isWalkable } from "./ship.js";

const SPEED = 4.2; // meters/second
const RADIUS = 0.4; // collision radius against room/corridor walls

const KEY_TO_AXIS = {
  KeyW: [0, -1],
  ArrowUp: [0, -1],
  KeyS: [0, 1],
  ArrowDown: [0, 1],
  KeyA: [-1, 0],
  ArrowLeft: [-1, 0],
  KeyD: [1, 0],
  ArrowRight: [1, 0],
};

export class PlayerController {
  constructor(camera, startX, startZ) {
    this.camera = camera;
    this.x = startX;
    this.z = startZ;
    this.pressed = new Set();

    this.marker = new THREE.Mesh(
      new THREE.CapsuleGeometry(RADIUS * 0.8, 1, 4, 8),
      new THREE.MeshStandardMaterial({ color: 0x4fd1c5 })
    );
    this.marker.position.set(this.x, 0.9, this.z);

    window.addEventListener("keydown", (e) => this.pressed.add(e.code));
    window.addEventListener("keyup", (e) => this.pressed.delete(e.code));

    this._syncCamera();
  }

  addTo(scene) {
    scene.add(this.marker);
  }

  update(dt) {
    let dx = 0;
    let dz = 0;
    for (const code of this.pressed) {
      const axis = KEY_TO_AXIS[code];
      if (axis) {
        dx += axis[0];
        dz += axis[1];
      }
    }
    if (dx !== 0 || dz !== 0) {
      const len = Math.hypot(dx, dz);
      dx = (dx / len) * SPEED * dt;
      dz = (dz / len) * SPEED * dt;

      // Slide along walls: try both axes together, then each alone.
      if (isWalkable(this.x + dx, this.z + dz, RADIUS)) {
        this.x += dx;
        this.z += dz;
      } else if (isWalkable(this.x + dx, this.z, RADIUS)) {
        this.x += dx;
      } else if (isWalkable(this.x, this.z + dz, RADIUS)) {
        this.z += dz;
      }
    }

    this.marker.position.set(this.x, 0.9, this.z);
    this._syncCamera();
  }

  _syncCamera() {
    this.camera.position.set(this.x, 9, this.z + 5.5);
    this.camera.lookAt(this.x, 0.5, this.z);
  }
}
