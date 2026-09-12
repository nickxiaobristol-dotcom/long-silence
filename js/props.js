import * as THREE from "three";
import { mergeGeometries } from "./vendor/three/examples/jsm/utils/BufferGeometryUtils.js";

// Low-poly prop toolkit shared by decorations.js.
//
// Two problems this solves. First, hand-detailed set dressing means
// hundreds of small primitives, and one Mesh per primitive would be
// hundreds of draw calls for a few thousand triangles — all the cost, none
// of the geometry. PropBuilder accumulates every primitive as a
// world-transformed BufferGeometry bucketed by material, then merges each
// bucket into a single Mesh on commit(), so the whole ship's decoration
// lands in roughly one draw call per distinct material.
//
// Second, props read better when authored in their own local space ("a
// seat facing +Z") and then placed ("at (-11.7, 1.5), rotated to face the
// console"). push()/pop() maintain a transform stack so a prop function
// can be written once in local coordinates and dropped anywhere.
//
// Everything here is static: nothing merged into a bucket can be moved,
// recolored, or hidden individually afterward. That's fine — none of the
// set dressing animates, and none of it participates in collision (see
// ship.js's WALKABLE, which decorations deliberately stay out of).

// One palette for all four rooms so the ship reads as a single built
// object rather than four unrelated sets. Extends the colors the first
// decoration pass and ship.js already established (hull 0x3a4552, amber
// 0xd9a441, reactor teal 0x1f6f6b) rather than starting over.
export const PAL = {
  hullDark: 0x232c36,
  hull: 0x2f3b47,
  hullLight: 0x46545f,
  panel: 0x27313b,
  trim: 0x4a5764,
  steel: 0x77828e,
  steelDark: 0x4e5862,
  rust: 0x71432c,
  copper: 0x8a5a34,
  amber: 0xd9a441,
  amberGlow: 0x9a5c15,
  hazard: 0x1a1a1a,
  wood: 0x4a3c2e,
  woodLight: 0x5a4a38,
  crateA: 0x6b5a3a,
  crateB: 0x7a6845,
  crateC: 0x55503f,
  crateD: 0x40493b,
  fabric: 0x3d4a55,
  fabricWarm: 0x6d4a3c,
  screenBlue: 0x0d3b52,
  glowBlue: 0x2f7ba8,
  screenGreen: 0x123a2c,
  glowGreen: 0x2f8f62,
  screenAmber: 0x3a2a10,
  glowAmber: 0xc98a2a,
  redDark: 0x4e1a1a,
  redGlow: 0xc2402f,
  reactorTeal: 0x1f6f6b,
  reactorGlow: 0x10403e,
  coreGlow: 0x3fd6c8,
  plant: 0x4e7a4a,
  plantDark: 0x3a5c38,
  paper: 0xcfc4ab,
  glass: 0x7fb8dd,
  void: 0x05080d,
  // Crew accents, mirroring the marker colors in js/crew.js so a berth in
  // the Crew Quarters reads as belonging to the person standing elsewhere
  // on the ship. Dessa's is the amber already in this palette, so only
  // four of the five cost an extra merged bucket.
  crewDessa: 0xd9a441,
  crewKaia: 0x6f8fb0,
  crewCorwin: 0xb0562f,
  crewAmara: 0x7fae7a,
  crewMarcus: 0x5a5f66,
};

const IDENTITY = new THREE.Matrix4();

function transformOf(t) {
  const position = new THREE.Vector3(t.x || 0, t.y || 0, t.z || 0);
  // YXZ: roll/pitch are applied in the prop's own frame, yaw last, so a
  // prop can be tilted in local space and then turned to face a wall.
  const quaternion = new THREE.Quaternion().setFromEuler(
    new THREE.Euler(t.rotX || 0, t.rotY || 0, t.rotZ || 0, "YXZ")
  );
  const scale = new THREE.Vector3(
    t.sx === undefined ? 1 : t.sx,
    t.sy === undefined ? 1 : t.sy,
    t.sz === undefined ? 1 : t.sz
  );
  return new THREE.Matrix4().compose(position, quaternion, scale);
}

const CORNER = new THREE.Vector3();

export class PropBuilder {
  constructor() {
    this._stack = [IDENTITY.clone()];
    this._buckets = new Map();
    this._geoCache = new Map();
    // World-space AABB per placed primitive. decorations.js exports these
    // so test/decorations.test.mjs can assert nothing was dropped into a
    // corridor, a doorway, or on top of a character's feet.
    this.bounds = [];
  }

  get matrix() {
    return this._stack[this._stack.length - 1];
  }

  push(t) {
    this._stack.push(this.matrix.clone().multiply(transformOf(t)));
    return this;
  }

  pop() {
    if (this._stack.length > 1) this._stack.pop();
    return this;
  }

  // Place a prop group: builds `fn`'s contents in the local frame `t`.
  at(t, fn) {
    this.push(t);
    fn(this);
    this.pop();
    return this;
  }

  // Same local frame repeated n times, with `fn(builder, i)` called per
  // step — used for pipe flanges, button rows, locker banks, crate rows.
  repeat(n, fn) {
    for (let i = 0; i < n; i++) fn(this, i);
    return this;
  }

  _cached(key, make) {
    let geometry = this._geoCache.get(key);
    if (!geometry) {
      geometry = make();
      this._geoCache.set(key, geometry);
    }
    return geometry;
  }

  _materialKey(o) {
    return [
      o.basic ? "b" : "s",
      o.color,
      o.emissive === undefined ? "-" : o.emissive,
      o.emissiveIntensity === undefined ? "-" : o.emissiveIntensity,
      o.roughness === undefined ? "-" : o.roughness,
      o.metalness === undefined ? "-" : o.metalness,
      o.opacity === undefined ? "-" : o.opacity,
      o.fog === false ? "nofog" : "fog",
    ].join("|");
  }

  _materialFor(o) {
    const params = { color: o.color };
    if (o.fog === false) params.fog = false;
    if (o.opacity !== undefined) {
      params.transparent = true;
      params.opacity = o.opacity;
    }
    if (o.basic) return new THREE.MeshBasicMaterial(params);
    if (o.emissive !== undefined) params.emissive = o.emissive;
    if (o.emissiveIntensity !== undefined)
      params.emissiveIntensity = o.emissiveIntensity;
    params.roughness = o.roughness === undefined ? 0.85 : o.roughness;
    params.metalness = o.metalness === undefined ? 0.1 : o.metalness;
    return new THREE.MeshStandardMaterial(params);
  }

  _place(geometry, o) {
    const matrix = this.matrix.clone().multiply(transformOf(o));
    const placed = geometry.clone().applyMatrix4(matrix);

    if (!geometry.boundingBox) geometry.computeBoundingBox();
    const box = new THREE.Box3();
    const { min, max } = geometry.boundingBox;
    for (let i = 0; i < 8; i++) {
      CORNER.set(
        i & 1 ? max.x : min.x,
        i & 2 ? max.y : min.y,
        i & 4 ? max.z : min.z
      ).applyMatrix4(matrix);
      box.expandByPoint(CORNER);
    }
    this.bounds.push(box);

    const key = this._materialKey(o);
    let bucket = this._buckets.get(key);
    if (!bucket) {
      bucket = { spec: o, geometries: [] };
      this._buckets.set(key, bucket);
    }
    bucket.geometries.push(placed);
    return this;
  }

  box(o) {
    const key = `box:${o.w}:${o.h}:${o.d}`;
    return this._place(
      this._cached(key, () => new THREE.BoxGeometry(o.w, o.h, o.d)),
      o
    );
  }

  // Thin horizontal plate — floor decals, shelf boards, panel faces.
  plate(o) {
    return this.box({ ...o, h: o.h === undefined ? 0.02 : o.h });
  }

  cyl(o) {
    const rTop = o.rTop === undefined ? o.r : o.rTop;
    const seg = o.seg === undefined ? 12 : o.seg;
    const key = `cyl:${rTop}:${o.r}:${o.h}:${seg}`;
    return this._place(
      this._cached(key, () => new THREE.CylinderGeometry(rTop, o.r, o.h, seg)),
      o
    );
  }

  sphere(o) {
    const key = `sph:${o.r}`;
    return this._place(
      this._cached(key, () => new THREE.SphereGeometry(o.r, 8, 6)),
      o
    );
  }

  // Default orientation lies in the XY plane (normal +Z), which is what a
  // wall-mounted coil or a gauge bezel wants; pass rotX: Math.PI / 2 for a
  // ring lying flat around a vertical cylinder.
  torus(o) {
    const key = `tor:${o.r}:${o.tube}`;
    return this._place(
      this._cached(key, () => new THREE.TorusGeometry(o.r, o.tube, 6, 16)),
      o
    );
  }

  // Flat disc facing +Z by default; used for the cockpit's planet limb.
  disc(o) {
    const key = `disc:${o.r}`;
    return this._place(
      this._cached(key, () => new THREE.CircleGeometry(o.r, 24)),
      o
    );
  }

  ring(o) {
    const key = `ring:${o.r}:${o.r2}`;
    return this._place(
      this._cached(key, () => new THREE.RingGeometry(o.r, o.r2, 24)),
      o
    );
  }

  commit(scene) {
    const meshes = [];
    for (const bucket of this._buckets.values()) {
      const merged = mergeGeometries(bucket.geometries, false);
      if (!merged) continue;
      const mesh = new THREE.Mesh(merged, this._materialFor(bucket.spec));
      // Merged buckets span the whole ship, so per-bucket frustum culling
      // can only ever reject everything or nothing. Skipping the test is
      // marginally cheaper and avoids a room popping out at a room edge.
      mesh.frustumCulled = false;
      scene.add(mesh);
      meshes.push(mesh);
    }
    for (const bucket of this._buckets.values()) {
      for (const geometry of bucket.geometries) geometry.dispose();
    }
    this._buckets.clear();
    return meshes;
  }
}

// ---------------------------------------------------------------------------
// Shared prop vocabulary. Each of these is authored in local space around
// the origin so rooms can place them with builder.at({...}).
// ---------------------------------------------------------------------------

// Deterministic noise so "scattered" details (stars, scuffs, crate wear)
// are identical on every load — screenshots and the layout test would be
// useless against Math.random().
export function seeded(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

// Vertical ribs along a wall, the cheapest way to make a flat wall read as
// a hull. `axis` is the wall's long direction.
export function hullRibs(b, o) {
  const { axis, from, to, at, y = 1.25, h = 2.3, step = 1.6 } = o;
  const color = o.color === undefined ? PAL.hullDark : o.color;
  const count = Math.floor((to - from) / step) + 1;
  const placed = [];
  for (let i = 0; i < count; i++) {
    const p = from + i * step;
    if (p > to) break;
    if (o.skip && o.skip(p)) continue;
    placed.push(p);
    const pos = axis === "x" ? { x: p, z: at } : { x: at, z: p };
    b.box({
      w: axis === "x" ? 0.16 : 0.1,
      h,
      d: axis === "x" ? 0.1 : 0.16,
      y,
      color,
      ...pos,
    });
  }
  // Horizontal stringer tying the ribs together, run as one segment per
  // adjacent pair. A single bar spanning `from` to `to` would cross any
  // gap `skip` opened up — and those gaps are doorways.
  if (o.stringer === false) return;
  for (let i = 1; i < placed.length; i++) {
    const a = placed[i - 1];
    const c = placed[i];
    if (c - a > step * 1.5) continue;
    b.box({
      w: axis === "x" ? c - a : 0.08,
      h: 0.09,
      d: axis === "x" ? 0.08 : c - a,
      x: axis === "x" ? (a + c) / 2 : at,
      y: y + h / 2 - 0.28,
      z: axis === "x" ? at : (a + c) / 2,
      color,
    });
  }
}

// A straight pipe with flange rings, optionally insulated with a lagging
// sleeve. `axis` is the run direction; the cylinder is rotated onto it.
export function pipeRun(b, o) {
  const { axis, from, to, y, r = 0.1, color = PAL.steelDark } = o;
  const len = to - from;
  const mid = (from + to) / 2;
  const along = axis === "x" ? { rotZ: Math.PI / 2 } : { rotX: Math.PI / 2 };
  const base = axis === "x" ? { x: mid, z: o.at } : { x: o.at, z: mid };
  b.cyl({ r, h: len, y, seg: 8, color, ...base, ...along });

  const flangeStep = o.flangeStep === undefined ? 1.6 : o.flangeStep;
  const count = Math.floor(len / flangeStep);
  for (let i = 1; i <= count; i++) {
    const p = from + (i * len) / (count + 1);
    const pos = axis === "x" ? { x: p, z: o.at } : { x: o.at, z: p };
    b.cyl({
      r: r + 0.035,
      h: 0.08,
      y,
      seg: 8,
      color: o.flangeColor === undefined ? PAL.steel : o.flangeColor,
      ...pos,
      ...along,
    });
  }
}

// Hand-wheel valve sitting on top of a horizontal pipe.
export function valveWheel(b, o) {
  const { x, y, z, r = 0.19, color = PAL.rust } = o;
  b.at({ x, y, z }, (p) => {
    p.cyl({ r: 0.04, h: 0.22, y: 0.11, color: PAL.steelDark });
    p.cyl({ r: 0.07, h: 0.07, y: 0.24, color });
    p.torus({ r, tube: 0.028, y: 0.24, rotX: Math.PI / 2, color });
    for (let i = 0; i < 4; i++) {
      p.box({
        w: r * 2,
        h: 0.026,
        d: 0.026,
        y: 0.24,
        rotY: (i * Math.PI) / 4,
        color,
      });
    }
  });
}

// Dark bezel + emissive face + a couple of readout bars. Built facing +Z,
// so it's placed with a rotY that turns it toward the player camera.
export function screenPanel(b, o) {
  const { w = 0.6, h = 0.42, glow = PAL.glowBlue, screen = PAL.screenBlue } = o;
  b.at(o, (p) => {
    p.box({ w: w + 0.07, h: h + 0.07, d: 0.04, color: PAL.hullDark });
    p.box({
      w,
      h,
      d: 0.02,
      z: 0.025,
      color: screen,
      emissive: glow,
      emissiveIntensity: 0.9,
    });
    // Readout: a header bar and three shorter data lines.
    p.box({
      w: w * 0.8,
      h: h * 0.1,
      d: 0.012,
      y: h * 0.3,
      z: 0.04,
      color: glow,
      emissive: glow,
      emissiveIntensity: 1.6,
    });
    for (let i = 0; i < 3; i++) {
      p.box({
        w: w * (0.6 - i * 0.14),
        h: h * 0.07,
        d: 0.012,
        x: -w * (0.1 + i * 0.07),
        y: h * (0.05 - i * 0.16),
        z: 0.04,
        color: glow,
        emissive: glow,
        emissiveIntensity: 1.1,
      });
    }
  });
}

const BUTTON_COLORS = [
  { color: PAL.amber, emissive: PAL.amberGlow },
  { color: PAL.glowBlue, emissive: PAL.screenBlue },
  { color: PAL.steel, emissive: undefined },
  { color: PAL.redGlow, emissive: PAL.redDark },
  { color: PAL.glowGreen, emissive: PAL.screenGreen },
];

// A grid of small keys on an up-facing surface. Placed in the local frame
// of whatever angled panel it sits on, so it tilts with the panel.
export function buttonGrid(b, o) {
  const { cols, rows, spanX, spanZ, size = 0.05, seed: s = 7 } = o;
  const rand = seeded(s);
  b.at(o, (p) => {
    for (let c = 0; c < cols; c++) {
      for (let r = 0; r < rows; r++) {
        const swatch = BUTTON_COLORS[Math.floor(rand() * BUTTON_COLORS.length)];
        p.box({
          w: size,
          h: 0.03,
          d: size,
          x: cols === 1 ? 0 : -spanX / 2 + (c * spanX) / (cols - 1),
          y: 0.02,
          z: rows === 1 ? 0 : -spanZ / 2 + (r * spanZ) / (rows - 1),
          color: swatch.color,
          emissive: swatch.emissive,
          emissiveIntensity: swatch.emissive === undefined ? undefined : 0.8,
        });
      }
    }
  });
}

// Alternating amber/black hazard bar, either a floor decal (default) or a
// vertical band on a post.
export function hazardStripe(b, o) {
  const { length, segments = 6, thickness = 0.3 } = o;
  b.at(o, (p) => {
    for (let i = 0; i < segments; i++) {
      p.box({
        w: length / segments,
        h: o.h === undefined ? 0.02 : o.h,
        d: thickness,
        x: -length / 2 + (i + 0.5) * (length / segments),
        color: i % 2 === 0 ? PAL.amber : PAL.hazard,
      });
    }
  });
}

// A shipping crate: body, edge banding on the visible faces, corner
// blocks, and a stencil label. The banding is what stops it reading as a
// plain cube.
export function crate(b, o) {
  const { s, color = PAL.crateA, label = PAL.amber } = o;
  const h = o.h === undefined ? s : o.h;
  b.at(o, (p) => {
    p.box({ w: s, h, d: s, y: h / 2, color });
    const band = 0.055;
    // Horizontal straps near the top and bottom, on all four sides.
    for (const y of [h * 0.16, h * 0.84]) {
      p.box({ w: s + 0.02, h: band, d: s * 0.92, y, color: PAL.hullDark });
      p.box({ w: s * 0.92, h: band, d: s + 0.02, y, color: PAL.hullDark });
    }
    // Corner posts.
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        p.box({
          w: 0.07,
          h: h * 0.98,
          d: 0.07,
          x: (sx * s) / 2,
          y: h / 2,
          z: (sz * s) / 2,
          color: PAL.steelDark,
        });
      }
    }
    // Lid rim + stencil mark on the +Z face.
    p.box({ w: s * 0.96, h: 0.04, d: s * 0.96, y: h + 0.015, color: PAL.steelDark });
    p.box({
      w: s * 0.3,
      h: s * 0.16,
      d: 0.015,
      y: h * 0.5,
      z: s / 2 + 0.008,
      color: label,
    });
    p.box({
      w: s * 0.42,
      h: 0.02,
      d: 0.012,
      y: h * 0.33,
      z: s / 2 + 0.008,
      color: PAL.paper,
    });
  });
}

// Sealed drum with rolling hoops and a bung on the lid.
export function drum(b, o) {
  const { r = 0.28, h = 0.78, color = PAL.rust } = o;
  b.at(o, (p) => {
    p.cyl({ r, h, y: h / 2, color });
    for (const y of [h * 0.25, h * 0.5, h * 0.75]) {
      p.cyl({ r: r + 0.025, h: 0.05, y, color: PAL.steelDark });
    }
    p.cyl({ r: r * 0.98, h: 0.04, y: h + 0.01, color: PAL.steelDark });
    p.cyl({ r: 0.05, h: 0.04, x: r * 0.45, y: h + 0.04, color: PAL.amber });
  });
}

// Slatted pallet: three runners under five deck boards.
export function pallet(b, o) {
  const w = o.w === undefined ? 1.25 : o.w;
  const d = o.d === undefined ? 1.05 : o.d;
  b.at(o, (p) => {
    for (let i = 0; i < 3; i++) {
      p.box({
        w,
        h: 0.09,
        d: 0.12,
        y: 0.045,
        z: -d / 2 + 0.06 + (i * (d - 0.12)) / 2,
        color: PAL.wood,
      });
    }
    for (let i = 0; i < 5; i++) {
      p.box({
        w: w * 0.17,
        h: 0.05,
        d,
        x: -w / 2 + w * 0.085 + (i * w * 0.83) / 4,
        y: 0.115,
        color: PAL.woodLight,
      });
    }
  });
}

// Crew seat facing +Z: pedestal, pan, reclined back, headrest, armrests,
// and a harness. Used for the cockpit's pilot stations.
export function crewSeat(b, o) {
  const color = o.color === undefined ? PAL.hull : o.color;
  const fabric = o.fabric === undefined ? PAL.fabric : o.fabric;
  b.at(o, (p) => {
    p.cyl({ r: 0.34, h: 0.05, y: 0.025, seg: 8, color: PAL.steelDark });
    p.cyl({ r: 0.1, h: 0.38, y: 0.22, color: PAL.steel });
    p.box({ w: 0.5, h: 0.05, d: 0.7, y: 0.43, color: PAL.steelDark });
    p.box({ w: 0.56, h: 0.12, d: 0.52, y: 0.51, z: 0.02, color });
    p.box({ w: 0.5, h: 0.07, d: 0.46, y: 0.6, z: 0.02, color: fabric });

    p.at({ y: 0.57, z: -0.26, rotX: -0.17 }, (q) => {
      q.box({ w: 0.54, h: 0.74, d: 0.14, y: 0.37, color });
      q.box({ w: 0.46, h: 0.64, d: 0.06, y: 0.37, z: 0.09, color: fabric });
      q.box({ w: 0.32, h: 0.18, d: 0.13, y: 0.85, color });
      // Crossed harness straps.
      for (const sx of [-1, 1]) {
        q.box({
          w: 0.07,
          h: 0.62,
          d: 0.02,
          x: sx * 0.06,
          y: 0.4,
          z: 0.13,
          rotZ: sx * 0.42,
          color: PAL.amber,
        });
      }
      q.box({ w: 0.09, h: 0.09, d: 0.03, y: 0.22, z: 0.14, color: PAL.steelDark });
    });

    for (const sx of [-1, 1]) {
      p.box({ w: 0.09, h: 0.08, d: 0.44, x: sx * 0.31, y: 0.69, z: 0.06, color });
      p.box({ w: 0.07, h: 0.16, d: 0.07, x: sx * 0.31, y: 0.57, z: 0.1, color: PAL.steelDark });
    }
    // Side stick on the right armrest.
    p.cyl({ r: 0.025, h: 0.22, x: 0.31, y: 0.84, z: 0.14, color: PAL.hullDark });
    p.sphere({ r: 0.05, x: 0.31, y: 0.96, z: 0.14, color: PAL.redGlow, emissive: PAL.redDark });
  });
}

// Backless stool with a footring — the common area's seating.
export function stool(b, o) {
  const color = o.color === undefined ? PAL.steelDark : o.color;
  b.at(o, (p) => {
    p.cyl({ r: 0.2, h: 0.04, y: 0.02, seg: 8, color });
    p.cyl({ r: 0.055, h: 0.44, y: 0.22, color: PAL.steel });
    p.torus({ r: 0.14, tube: 0.018, y: 0.14, rotX: Math.PI / 2, color });
    p.cyl({ r: 0.21, h: 0.07, y: 0.47, color: o.seat === undefined ? PAL.fabric : o.seat });
    if (o.back) {
      p.box({ w: 0.34, h: 0.34, d: 0.05, y: 0.69, z: -0.17, rotX: -0.14, color });
    }
  });
}

// Wall-mounted indicator strip: a row of small emissive lamps in a rail.
export function indicatorStrip(b, o) {
  const { length, count = 8, axis = "x" } = o;
  b.at(o, (p) => {
    p.box({
      w: axis === "x" ? length : 0.07,
      h: 0.07,
      d: axis === "x" ? 0.07 : length,
      color: PAL.hullDark,
    });
    const rand = seeded(o.seed === undefined ? 3 : o.seed);
    for (let i = 0; i < count; i++) {
      const t = -length / 2 + ((i + 0.5) * length) / count;
      const swatch = BUTTON_COLORS[Math.floor(rand() * BUTTON_COLORS.length)];
      p.box({
        w: 0.045,
        h: 0.045,
        d: 0.045,
        x: axis === "x" ? t : 0.03,
        z: axis === "x" ? 0.03 : t,
        color: swatch.color,
        emissive: swatch.emissive === undefined ? swatch.color : swatch.emissive,
        emissiveIntensity: 1.4,
      });
    }
  });
}

// Hazard placard facing +Z: amber square, dark diamond, exclamation bar.
export function warningSign(b, o) {
  const s = o.s === undefined ? 0.34 : o.s;
  b.at(o, (p) => {
    p.box({ w: s, h: s, d: 0.025, color: PAL.amber });
    p.box({ w: s * 0.62, h: s * 0.62, d: 0.015, z: 0.02, rotZ: Math.PI / 4, color: PAL.hazard });
    p.box({ w: s * 0.07, h: s * 0.22, d: 0.012, y: s * 0.04, z: 0.03, color: PAL.amber });
    p.box({ w: s * 0.07, h: s * 0.07, d: 0.012, y: -s * 0.14, z: 0.03, color: PAL.amber });
  });
}

// A crew berth: stowage plinth, mattress, blanket in the occupant's accent
// color, padded head panel, privacy fins either side, and a canopy shelf
// with a reading lamp under it.
//
// Authored lying along X (2m head-to-foot, head at -X) and open toward +Z,
// so a wall-mounted berth is placed with the rotY that turns its open side
// into the room. `curtain` is how far the privacy curtain is drawn across
// the opening, 0 to 1 — the cheapest way to say something about whoever
// sleeps there.
export function berth(b, o) {
  const accent = o.accent === undefined ? PAL.fabric : o.accent;
  const curtain = o.curtain === undefined ? 0 : o.curtain;
  b.at(o, (p) => {
    // Stowage plinth with two drawer fronts, the berth's own footlockers.
    p.box({ w: 2.0, h: 0.34, d: 0.85, y: 0.17, color: PAL.panel });
    p.box({ w: 2.04, h: 0.07, d: 0.89, y: 0.035, color: PAL.hullDark });
    for (const x of [-0.5, 0.5]) {
      p.box({ w: 0.86, h: 0.22, d: 0.03, x, y: 0.19, z: 0.43, color: PAL.trim });
      p.box({ w: 0.24, h: 0.04, d: 0.04, x, y: 0.19, z: 0.46, color: PAL.steel });
    }

    // Mattress, blanket, pillow. The blanket is the accent.
    p.box({ w: 1.92, h: 0.16, d: 0.78, y: 0.42, color: PAL.hullLight });
    p.box({ w: 1.24, h: 0.11, d: 0.8, x: 0.32, y: 0.53, color: accent });
    p.box({ w: 0.1, h: 0.12, d: 0.8, x: -0.3, y: 0.54, color: accent });
    p.box({ w: 0.44, h: 0.14, d: 0.52, x: -0.72, y: 0.55, color: PAL.paper });

    // Padded head panel against the wall, plus privacy fins at each end.
    p.box({ w: 2.0, h: 1.05, d: 0.06, y: 0.87, z: -0.42, color: PAL.hullDark });
    for (let i = 0; i < 4; i++) {
      p.box({ w: 1.86, h: 0.04, d: 0.03, y: 0.55 + i * 0.19, z: -0.38, color: PAL.panel });
    }
    for (const sx of [-1, 1]) {
      p.box({ w: 0.08, h: 1.12, d: 0.85, x: sx * 0.99, y: 0.76, color: PAL.trim });
    }

    // Canopy shelf over the bunk with a lip so stowed items read from above.
    p.box({ w: 2.0, h: 0.08, d: 0.72, y: 1.36, z: -0.06, color: PAL.hull });
    p.box({ w: 2.0, h: 0.09, d: 0.04, y: 1.44, z: 0.28, color: PAL.trim });
    p.box({ w: 0.06, h: 0.62, d: 0.06, x: -0.97, y: 1.05, z: 0.3, color: PAL.steelDark });
    p.box({ w: 0.06, h: 0.62, d: 0.06, x: 0.97, y: 1.05, z: 0.3, color: PAL.steelDark });

    // Reading lamp tucked under the canopy at the head end.
    p.cyl({ r: 0.07, rTop: 0.04, h: 0.09, x: -0.66, y: 1.27, z: -0.12, seg: 8, color: PAL.steelDark });
    p.cyl({
      r: 0.055,
      h: 0.02,
      x: -0.66,
      y: 1.22,
      z: -0.12,
      seg: 8,
      color: PAL.amber,
      emissive: PAL.amber,
      emissiveIntensity: 2.0,
    });

    // Name plate on the foot-end fin, plus a stripe lying flat along the
    // canopy's front edge. The plate is for anyone standing in the aisle;
    // the stripe is for the camera, which looks down on the room and would
    // otherwise see the accent color edge-on or not at all.
    p.box({ w: 0.03, h: 0.1, d: 0.34, x: 1.03, y: 1.0, color: accent });
    p.plate({ w: 1.72, d: 0.09, y: 1.41, z: 0.19, color: accent });

    // Curtain rail, and however much curtain is pulled across.
    p.cyl({ r: 0.02, h: 1.96, y: 1.3, z: 0.36, rotZ: Math.PI / 2, color: PAL.steel });
    if (curtain > 0) {
      const w = 1.9 * curtain;
      p.box({ w, h: 0.92, d: 0.05, x: -0.95 + w / 2, y: 0.83, z: 0.36, color: PAL.fabric });
      p.box({ w, h: 0.05, d: 0.06, x: -0.95 + w / 2, y: 1.26, z: 0.36, color: PAL.hullDark });
    }
  });
}

// Louvered equipment cabinet with vent slats, a handle and a status lamp.
export function equipmentCabinet(b, o) {
  const { w = 1.1, h = 1.45, d = 0.8 } = o;
  const color = o.color === undefined ? PAL.panel : o.color;
  b.at(o, (p) => {
    p.box({ w, h, d, y: h / 2, color });
    p.box({ w: w + 0.06, h: 0.09, d: d + 0.06, y: 0.045, color: PAL.hullDark });
    p.box({ w: w + 0.04, h: 0.05, d: d + 0.04, y: h + 0.02, color: PAL.trim });
    // Vent slats on the +Z face.
    for (let i = 0; i < 6; i++) {
      p.box({
        w: w * 0.72,
        h: 0.035,
        d: 0.03,
        y: h * 0.34 + i * 0.11,
        z: d / 2 + 0.01,
        color: PAL.hullDark,
      });
    }
    p.box({ w: w * 0.5, h: 0.045, d: 0.05, y: h * 0.24, z: d / 2 + 0.02, color: PAL.steel });
    p.box({ w: w * 0.28, h: 0.14, d: 0.015, y: h * 0.86, z: d / 2 + 0.01, color: PAL.amber });
    p.sphere({ r: 0.045, x: w * 0.33, y: h * 0.86, z: d / 2 + 0.03, color: PAL.glowGreen, emissive: PAL.glowGreen, emissiveIntensity: 1.5 });
  });
}
