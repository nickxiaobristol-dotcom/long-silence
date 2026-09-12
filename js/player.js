import { isWalkable } from "./ship.js";
import { buildHumanoid, stepWalkCycle, setSitPose } from "./character.js";

const SPEED = 4.2; // meters/second
const RADIUS = 0.4; // collision radius against room/corridor walls
const SIT_Y_DROP = 0.22; // purely cosmetic: hips settle toward seat height

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

    this.marker = buildHumanoid(0x4fd1c5);
    this.marker.position.set(this.x, 0, this.z);
    this.sitting = false;

    window.addEventListener("keydown", (e) => this.pressed.add(e.code));
    window.addEventListener("keyup", (e) => this.pressed.delete(e.code));

    this._syncCamera();
  }

  addTo(scene) {
    scene.add(this.marker);
  }

  // Snaps the player onto a seat interactable (js/interactables.js),
  // freezing WASD movement until standUp() and posing the rig as seated.
  // Position/facing come from the interactable's own coordinates so the
  // character lines up with the seat prop it's sitting in.
  sitAt(x, z, facing) {
    this.sitting = true;
    this.x = x;
    this.z = z;
    this.marker.position.set(x, -SIT_Y_DROP, z);
    this.marker.rotation.y = facing;
    setSitPose(this.marker, true);
    this._syncCamera();
  }

  standUp() {
    this.sitting = false;
    this.marker.position.y = 0;
    setSitPose(this.marker, false);
  }

  update(dt) {
    if (this.sitting) {
      this._syncCamera();
      return;
    }

    let dx = 0;
    let dz = 0;
    for (const code of this.pressed) {
      const axis = KEY_TO_AXIS[code];
      if (axis) {
        dx += axis[0];
        dz += axis[1];
      }
    }
    const moving = dx !== 0 || dz !== 0;
    if (moving) {
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
      this.marker.rotation.y = Math.atan2(dx, dz);
    }

    this.marker.position.set(this.x, 0, this.z);
    stepWalkCycle(this.marker, dt, moving);
    this._syncCamera();
  }

  _syncCamera() {
    this.camera.position.set(this.x, 9, this.z + 5.5);
    this.camera.lookAt(this.x, 0.5, this.z);
  }
}
