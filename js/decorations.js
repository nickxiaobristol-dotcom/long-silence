import {
  PAL,
  PropBuilder,
  buttonGrid,
  crate,
  crewSeat,
  drum,
  equipmentCabinet,
  hazardStripe,
  hullRibs,
  indicatorStrip,
  pallet,
  pipeRun,
  screenPanel,
  seeded,
  stool,
  valveWheel,
  warningSign,
} from "./props.js";

// Set dressing for the ship's four rooms. Visual only: nothing here is
// added to ship.js's WALKABLE list, so no prop can ever trap the player.
// The layout rules that keep that honest are asserted by
// test/decorations.test.mjs, which walks the AABB of every primitive
// placed below and checks that nothing above ankle height sits inside a
// corridor rect, on a crew member's or the player's spawn, or outside the
// hull. Change a coordinate here and that test is the safety net.
//
// Two things about the fixed follow camera (player.js: (x, 9, z + 5.5)
// looking at (x, 0.5, z)) drive most of the composition:
//
//   1. It looks down and toward -Z. Surfaces whose normal points -Z face
//      away from it, so a flat panel on a room's *north* wall is never
//      seen. Screens, posters, signage and instrument faces therefore go
//      on south walls and side walls; north walls get objects that read
//      from above instead (counters, pipe runs, shelf contents, fin
//      stacks).
//   2. Anything at ceiling height over open floor sits between the camera
//      and the player. Ceiling detail is kept thin and within ~0.5m of a
//      wall; there are no full ceiling panels over walkable floor.

const HALF_PI = Math.PI / 2;

// Doorway gaps are full-height holes in the wall boxes ship.js builds. A
// shallow header across the top of each turns them into framed hatches
// without narrowing anything the player can walk through: these sit above
// 2.2m, well clear of the 1.6m-tall character rig.
const DOORWAYS = [
  { x: -6, z: 0, span: 2.4, axis: "z" }, // Cockpit <-> Fwd Corridor
  { x: -3, z: 0, span: 2.4, axis: "z" }, // Common Area west
  { x: 5, z: 0, span: 2.4, axis: "z" }, // Common Area east
  { x: 8, z: 0, span: 2.4, axis: "z" }, // Engine Room west
  { x: 0, z: -5, span: 2.4, axis: "x" }, // Common Area south
  { x: 0, z: -9, span: 2.4, axis: "x" }, // Cargo Bay north
];

function doorHeaders(b) {
  for (const d of DOORWAYS) {
    const along = d.axis === "x";
    b.box({
      w: along ? d.span : 0.24,
      h: 0.17,
      d: along ? 0.24 : d.span,
      x: d.x,
      y: 2.31,
      z: d.z,
      color: PAL.trim,
    });
    b.box({
      w: along ? d.span - 0.2 : 0.26,
      h: 0.05,
      d: along ? 0.26 : d.span - 0.2,
      x: d.x,
      y: 2.2,
      z: d.z,
      color: PAL.amber,
      emissive: PAL.amberGlow,
      emissiveIntensity: 0.7,
    });
  }
}

// Thin fixture tucked against a wall, running along one axis. Kept narrow
// and close to the wall so it never sits on the camera-to-player line.
function ceilingStrip(b, o) {
  const along = o.axis === "x";
  b.box({
    w: along ? o.length : 0.2,
    h: 0.08,
    d: along ? 0.2 : o.length,
    x: o.x,
    y: 2.54,
    z: o.z,
    color: PAL.panel,
  });
  b.box({
    w: along ? o.length - 0.3 : 0.13,
    h: 0.03,
    d: along ? 0.13 : o.length - 0.3,
    x: o.x,
    y: 2.49,
    z: o.z,
    color: o.color === undefined ? PAL.glowBlue : o.color,
    emissive: o.color === undefined ? PAL.glowBlue : o.color,
    emissiveIntensity: 1.2,
  });
}

// Flat floor decal: worn deck plate, scuff, painted patch.
function deckHatch(b, o) {
  b.at(o, (p) => {
    p.cyl({ r: 0.5, h: 0.02, y: 0.012, color: PAL.steelDark });
    p.torus({ r: 0.45, tube: 0.03, y: 0.022, rotX: HALF_PI, color: PAL.trim });
    for (let i = 0; i < 8; i++) {
      p.at({ rotY: (i * Math.PI) / 4 }, (q) => {
        q.cyl({ r: 0.045, h: 0.03, x: 0.37, y: 0.025, seg: 6, color: PAL.steel });
      });
    }
  });
}

// ---------------------------------------------------------------------------
// Cockpit — x: -14..-6, z: -4..4. Doorway east (x = -6, z in [-1, 1]).
// Kaia stands at (-10, 0). The nose wall (x = -14) is a dead end, so the
// whole flight deck — viewport, wrap-around console, pilot stations —
// builds forward of her against it.
// ---------------------------------------------------------------------------

// The forward viewport, built as a raked canopy rather than a flat pane in
// the nose wall. Two reasons. The nose wall is one solid box from ship.js,
// so cutting a real hole and putting a starfield behind it is not on the
// table; and a vertical pane there sits at ~70 degrees off the camera's
// eyeline, which foreshortens a 6m window into an unreadable stripe. Rake
// it back 42 degrees and the glass turns to face the camera, which is also
// simply what a cockpit windscreen looks like.
//
// The view itself is painted on the glass with unlit, unfogged materials:
// it reads as a window from the player's angle, and the starfield stays
// crisp while scene fog eats everything around it.
const RAKE = 0.73; // radians back from vertical

function forwardViewport(b) {
  b.at({ x: -13.5, y: 1.75, z: 0, rotZ: RAKE }, (outer) =>
    outer.at({ rotY: HALF_PI }, (p) => {
      p.box({ w: 6.4, h: 1.25, d: 0.04, color: PAL.void, basic: true, fog: false });

      // A planet off the port bow: lit disc, dark terminator, thin limb.
      p.disc({ r: 0.4, x: -1.8, y: -0.04, z: 0.02, color: 0x7b4a33, basic: true, fog: false });
      p.disc({ r: 0.37, x: -2.02, y: 0.01, z: 0.03, color: 0x3d2a22, basic: true, fog: false });
      p.ring({ r: 0.4, r2: 0.45, x: -1.8, y: -0.04, z: 0.025, color: 0xc98a5e, basic: true, fog: false });
      p.disc({ r: 0.08, x: -0.7, y: 0.3, z: 0.02, color: 0x6d7480, basic: true, fog: false });

      // Dust band across the lower half, then a deterministic starfield
      // skipping the planet so stars never sit on top of it.
      for (const [y, h, c] of [[-0.32, 0.1, 0x22303f], [-0.21, 0.05, 0x2b3a4c]]) {
        p.box({ w: 6.1, h, d: 0.008, y, z: 0.012, color: c, basic: true, fog: false });
      }
      const rand = seeded(20260912);
      for (let i = 0; i < 52; i++) {
        const x = -3.0 + rand() * 6.0;
        const y = -0.55 + rand() * 1.1;
        if (Math.hypot(x + 1.8, y + 0.04) < 0.55) continue;
        const s = 0.028 + rand() * 0.038;
        p.box({
          w: s,
          h: s,
          d: 0.01,
          x,
          y,
          z: 0.03,
          color: rand() > 0.75 ? 0xbfd6ea : 0xe8eef5,
          basic: true,
          fog: false,
        });
      }

      // Frame: sill, header, mullions, corner gussets, and a faint sheen.
      for (const y of [-0.68, 0.68]) {
        p.box({ w: 6.7, h: 0.14, d: 0.16, y, z: 0.04, color: PAL.trim });
      }
      for (const x of [-3.3, -1.1, 1.1, 3.3]) {
        p.box({ w: 0.11, h: 1.4, d: 0.14, x, z: 0.04, color: PAL.trim });
        p.box({ w: 0.07, h: 0.07, d: 0.1, x, y: 0.58, z: 0.09, color: PAL.steel });
      }
      p.box({ w: 6.4, h: 1.25, d: 0.008, z: 0.078, color: PAL.glass, basic: true, opacity: 0.07, fog: false });
    })
  );

  // Glare shield bridging the console tops up to the canopy sill.
  b.box({ w: 0.5, h: 0.1, d: 6.5, x: -13.16, y: 1.14, z: 0, rotZ: 0.3, color: PAL.hullDark });
  b.box({ w: 0.46, h: 0.03, d: 6.3, x: -13.16, y: 1.2, z: 0, rotZ: 0.3, color: PAL.panel });
}

// One bay of the wrap-around flight console, authored facing +X (toward
// the pilot) so the five bays can be fanned around the nose.
function consoleBay(b, t, seed) {
  b.at(t, (p) => {
    p.box({ w: 0.62, h: 0.78, d: 1.4, y: 0.39, color: PAL.hull });
    p.box({ w: 0.66, h: 0.1, d: 1.44, y: 0.05, color: PAL.hullDark });
    p.box({ w: 0.64, h: 0.04, d: 1.42, y: 0.76, color: PAL.trim });
    p.box({
      w: 0.02,
      h: 0.1,
      d: 1.24,
      x: 0.32,
      y: 0.58,
      color: PAL.glowBlue,
      emissive: PAL.glowBlue,
      emissiveIntensity: 1.3,
    });

    // Angled work surface: buttons, a flush screen, and toggle switches.
    p.at({ y: 0.8, rotZ: -0.5 }, (q) => {
      q.box({ w: 0.72, h: 0.06, d: 1.42, color: PAL.panel });
      q.box({ w: 0.74, h: 0.02, d: 1.44, y: 0.03, color: PAL.hullDark });
      screenPanel(q, {
        x: -0.13,
        y: 0.04,
        z: 0.42,
        rotX: -HALF_PI,
        w: 0.4,
        h: 0.3,
        glow: seed % 2 ? PAL.glowGreen : PAL.glowBlue,
        screen: seed % 2 ? PAL.screenGreen : PAL.screenBlue,
      });
      buttonGrid(q, {
        x: 0.15,
        y: 0.03,
        z: -0.26,
        cols: 3,
        rows: 6,
        spanX: 0.24,
        spanZ: 0.84,
        seed,
      });
      for (let i = 0; i < 3; i++) {
        q.cyl({ r: 0.018, h: 0.09, x: -0.17, y: 0.07, z: -0.32 - i * 0.14, rotZ: 0.55, color: PAL.steel });
        q.box({ w: 0.07, h: 0.015, d: 0.05, x: -0.17, y: 0.035, z: -0.32 - i * 0.14, color: PAL.hullDark });
      }
    });

    // Instrument riser standing behind the work surface.
    p.at({ x: -0.26, y: 0.96, rotZ: -0.2 }, (q) => {
      q.box({ w: 0.06, h: 0.42, d: 1.34, color: PAL.hullDark });
      for (const z of [-0.34, 0.34]) {
        screenPanel(q, {
          x: 0.04,
          z,
          rotY: HALF_PI,
          w: 0.5,
          h: 0.28,
          glow: PAL.glowAmber,
          screen: PAL.screenAmber,
        });
      }
    });
  });
}

function buildCockpit(b) {
  forwardViewport(b);

  const bays = [
    { x: -13.05, z: 0, rotY: 0 },
    { x: -12.92, z: 1.5, rotY: 0.3 },
    { x: -12.52, z: 2.95, rotY: 0.62 },
    { x: -12.92, z: -1.5, rotY: -0.3 },
    { x: -12.52, z: -2.95, rotY: -0.62 },
  ];
  bays.forEach((t, i) => consoleBay(b, t, i + 3));

  // Throttle quadrant on the centre bay.
  b.at({ x: -12.68, y: 0.96, z: 0 }, (p) => {
    p.box({ w: 0.2, h: 0.1, d: 0.4, color: PAL.hullDark });
    for (const z of [-0.1, 0.1]) {
      p.cyl({ r: 0.024, h: 0.3, y: 0.17, z, rotZ: -0.8, color: PAL.steel });
      p.sphere({ r: 0.05, x: 0.11, y: 0.29, z, color: PAL.amber, emissive: PAL.amberGlow });
    }
  });

  // Pilot and copilot stations, facing the console.
  for (const z of [-1.5, 1.5]) {
    crewSeat(b, { x: -11.7, z, rotY: -HALF_PI, color: PAL.hull, fabric: PAL.fabric });
  }

  // Overhead console, running fore-aft down the centreline between the two
  // pilot seats. It has to sit over the aisle rather than over the flight
  // deck: anything at this height spanning the room would hide the console
  // it belongs to, because the camera looks down on the room from above.
  b.at({ x: -12.4, y: 2.36, z: 0 }, (p) => {
    p.box({ w: 2.1, h: 0.16, d: 0.58, color: PAL.hull });
    p.box({ w: 2.0, h: 0.05, d: 0.48, y: -0.1, color: PAL.panel });
    p.box({ w: 2.14, h: 0.05, d: 0.62, y: 0.09, color: PAL.trim });
    indicatorStrip(p, { y: -0.02, z: 0.27, axis: "x", length: 1.9, count: 14, seed: 11 });
    for (const x of [-0.62, 0, 0.62]) {
      p.box({ w: 0.44, h: 0.05, d: 0.24, x, y: 0.13, color: PAL.steelDark });
      for (let i = 0; i < 3; i++) {
        p.box({ w: 0.06, h: 0.05, d: 0.06, x: x - 0.13 + i * 0.13, y: 0.17, color: PAL.steel });
      }
    }
    for (const z of [-0.31, 0.31]) {
      p.box({ w: 0.16, h: 0.24, d: 0.05, y: -0.2, z, color: PAL.steelDark });
    }
  });

  // South wall (camera-facing): avionics rack and a comms station.
  b.at({ x: -11.6, z: -3.68 }, (p) => {
    p.box({ w: 2.1, h: 1.55, d: 0.42, y: 0.775, color: PAL.panel });
    p.box({ w: 2.16, h: 0.09, d: 0.48, y: 0.045, color: PAL.hullDark });
    p.box({ w: 2.14, h: 0.05, d: 0.46, y: 1.58, color: PAL.trim });
    screenPanel(p, { x: -0.55, y: 1.06, z: 0.23, w: 0.72, h: 0.46, glow: PAL.glowBlue, screen: PAL.screenBlue });
    screenPanel(p, { x: 0.55, y: 1.06, z: 0.23, w: 0.72, h: 0.46, glow: PAL.glowGreen, screen: PAL.screenGreen });
    indicatorStrip(p, { y: 0.62, z: 0.23, length: 1.8, count: 13, seed: 5 });
    for (let i = 0; i < 5; i++) {
      p.box({ w: 1.9, h: 0.035, d: 0.03, y: 0.22 + i * 0.07, z: 0.22, color: PAL.hullDark });
    }
    p.box({ w: 0.13, h: 0.22, d: 0.08, x: 0.92, y: 0.9, z: 0.25, color: PAL.hullDark });
    p.torus({ r: 0.09, tube: 0.022, x: 0.92, y: 0.62, z: 0.24, color: PAL.hazard });
  });

  b.at({ x: -8.4, z: -3.55 }, (p) => {
    p.box({ w: 1.5, h: 0.07, d: 0.62, y: 0.78, color: PAL.steel });
    for (const x of [-0.66, 0.66]) {
      for (const z of [-0.24, 0.24]) {
        p.box({ w: 0.08, h: 0.78, d: 0.08, x, y: 0.39, z, color: PAL.steelDark });
      }
    }
    p.box({ w: 1.4, h: 0.04, d: 0.5, y: 0.3, color: PAL.steelDark });
    screenPanel(p, { x: -0.3, y: 1.14, z: -0.1, rotX: -0.25, w: 0.72, h: 0.46, glow: PAL.glowAmber, screen: PAL.screenAmber });
    p.box({ w: 0.56, h: 0.03, d: 0.22, x: -0.3, y: 0.83, z: 0.12, rotX: 0.1, color: PAL.hullDark });
    buttonGrid(p, { x: -0.3, y: 0.845, z: 0.12, cols: 6, rows: 3, spanX: 0.44, spanZ: 0.14, size: 0.035, seed: 9 });
    p.box({ w: 0.3, h: 0.14, d: 0.24, x: 0.5, y: 0.88, color: PAL.hullDark });
    p.box({ w: 0.26, h: 0.02, d: 0.2, x: 0.5, y: 0.96, color: PAL.glowGreen, emissive: PAL.glowGreen });
  });
  stool(b, { x: -8.4, z: -2.85, color: PAL.steelDark, back: true, rotY: Math.PI });

  // North wall: a backlit nav chart table — read from directly above,
  // which is exactly what this camera sees best.
  b.at({ x: -11.0, z: 3.15 }, (p) => {
    p.box({ w: 2.4, h: 0.09, d: 1.1, y: 0.8, color: PAL.steelDark });
    for (const x of [-1.08, 1.08]) {
      for (const z of [-0.44, 0.44]) {
        p.box({ w: 0.09, h: 0.8, d: 0.09, x, y: 0.4, z, color: PAL.steelDark });
      }
    }
    p.box({ w: 2.2, h: 0.02, d: 0.92, y: 0.855, color: PAL.screenBlue, emissive: PAL.glowBlue, emissiveIntensity: 0.8 });
    const rand = seeded(41);
    for (let i = 0; i < 6; i++) {
      p.box({
        w: 0.5 + rand() * 1.1,
        h: 0.012,
        d: 0.02,
        x: -0.7 + rand() * 1.4,
        y: 0.872,
        z: -0.32 + rand() * 0.64,
        rotY: -0.9 + rand() * 1.8,
        color: PAL.glowAmber,
        emissive: PAL.glowAmber,
        emissiveIntensity: 1.4,
      });
    }
    for (const [x, z] of [[-0.66, 0.2], [0.15, -0.24], [0.82, 0.3]]) {
      p.cyl({ r: 0.036, h: 0.014, x, y: 0.878, z, seg: 8, color: PAL.redGlow, emissive: PAL.redGlow, emissiveIntensity: 1.8 });
    }
    for (const z of [-0.46, 0.46]) p.box({ w: 2.24, h: 0.035, d: 0.04, y: 0.875, z, color: PAL.trim });
    p.box({ w: 0.26, h: 0.02, d: 0.19, x: 0.86, y: 0.875, z: -0.3, rotY: 0.5, color: PAL.screenGreen, emissive: PAL.glowGreen });
    p.cyl({ r: 0.05, h: 0.11, x: -0.95, y: 0.91, z: -0.34, color: PAL.paper });
  });

  // Pressure-suit rack against the north wall.
  b.at({ x: -8.0, z: 3.72 }, (p) => {
    p.box({ w: 1.5, h: 0.06, d: 0.06, y: 1.92, color: PAL.steel });
    for (const x of [-0.72, 0.72]) p.box({ w: 0.07, h: 0.6, d: 0.07, x, y: 1.62, color: PAL.steel });
    const suits = [PAL.fabric, PAL.fabricWarm, PAL.hullLight];
    suits.forEach((color, i) => {
      const x = -0.48 + i * 0.48;
      p.box({ w: 0.3, h: 0.95, d: 0.2, x, y: 1.34, color });
      p.box({ w: 0.36, h: 0.1, d: 0.22, x, y: 1.84, color: PAL.steelDark });
      p.box({ w: 0.2, h: 0.1, d: 0.22, x, y: 1.0, color: PAL.hullDark });
    });
  });

  // Cable conduit skirting the north wall.
  b.box({ w: 7.2, h: 0.12, d: 0.14, x: -10.0, y: 0.07, z: 3.84, color: PAL.hullDark });
  for (let i = 0; i < 6; i++) {
    b.box({ w: 0.1, h: 0.17, d: 0.18, x: -13.2 + i * 1.3, y: 0.085, z: 3.84, color: PAL.steelDark });
  }

  // East wall: stowed jump seat and a fire station.
  b.at({ x: -6.26, z: 2.8 }, (p) => {
    p.box({ w: 0.12, h: 0.62, d: 0.52, y: 0.95, color: PAL.hull });
    p.box({ w: 0.08, h: 0.06, d: 0.56, y: 1.3, color: PAL.steelDark });
    for (const z of [-0.24, 0.24]) p.box({ w: 0.14, h: 0.08, d: 0.06, y: 0.66, z, color: PAL.steelDark });
    p.box({ w: 0.06, h: 0.5, d: 0.05, x: 0.06, y: 1.0, rotZ: 0.25, color: PAL.amber });
  });
  b.at({ x: -6.3, z: -2.7 }, (p) => {
    p.box({ w: 0.32, h: 1.4, d: 0.9, y: 0.7, color: PAL.panel });
    p.box({ w: 0.03, h: 1.24, d: 0.8, x: -0.17, y: 0.7, color: PAL.hullLight });
    p.box({ w: 0.05, h: 0.26, d: 0.05, x: -0.2, y: 0.82, color: PAL.steel });
    p.box({ w: 0.02, h: 0.1, d: 0.34, x: -0.18, y: 1.18, color: PAL.amber });
    p.cyl({ r: 0.11, h: 0.5, x: -0.42, y: 0.25, z: 0.62, color: PAL.redGlow });
    p.cyl({ r: 0.04, h: 0.12, x: -0.42, y: 0.55, z: 0.62, color: PAL.hazard });
    p.box({ w: 0.06, h: 0.24, d: 0.06, x: -0.42, y: 0.62, z: 0.55, rotX: 0.4, color: PAL.hazard });
  });

  // Floor: approach guides, a deck hatch and wear.
  for (const z of [-0.95, 0.95]) {
    b.box({ w: 7.2, h: 0.02, d: 0.07, x: -9.9, y: 0.012, z, color: PAL.amber });
  }
  deckHatch(b, { x: -7.6, z: -2.9 });
  const wear = seeded(88);
  for (let i = 0; i < 6; i++) {
    b.cyl({
      r: 0.14 + wear() * 0.22,
      h: 0.012,
      x: -12.4 + wear() * 5.6,
      y: 0.008,
      z: -3.2 + wear() * 6.4,
      seg: 8,
      color: 0x161f28,
    });
  }

  hullRibs(b, { axis: "x", from: -13.2, to: -6.6, at: 3.85 });
  hullRibs(b, {
    axis: "x",
    from: -13.2,
    to: -6.6,
    at: -3.85,
    skip: (x) => x > -12.8 && x < -10.4,
  });
  hullRibs(b, { axis: "z", from: -3.2, to: 3.2, at: -6.15, skip: (z) => Math.abs(z) < 1.4 });
  ceilingStrip(b, { axis: "x", x: -10.5, z: 3.68, length: 5.2 });
  ceilingStrip(b, { axis: "x", x: -10.5, z: -3.68, length: 5.2 });
}

// ---------------------------------------------------------------------------
// Common Area — x: -3..5, z: -5..5. Three doorways (west and east at
// z in [-1, 1], south at x in [-1, 1]); the north wall is solid. Dessa
// stands at (1, -3), Marcus at (3, 3), the player spawns at (1, 0), so the
// middle cross of the room stays clear and everything lives on the walls
// and in the corners.
// ---------------------------------------------------------------------------

function messTable(b) {
  b.at({ x: -1.55, z: 3.15 }, (p) => {
    p.box({ w: 1.9, h: 0.08, d: 1.02, y: 0.76, color: PAL.steel });
    p.box({ w: 1.7, h: 0.02, d: 0.86, y: 0.805, color: PAL.wood });
    for (const x of [-0.7, 0.7]) {
      p.box({ w: 0.13, h: 0.72, d: 0.86, x, y: 0.36, color: PAL.steelDark });
    }
    p.box({ w: 1.3, h: 0.1, d: 0.1, y: 0.22, color: PAL.steelDark });

    // Table clutter — the thing that makes a table read as "lived at".
    p.cyl({ r: 0.052, h: 0.11, x: -0.5, y: 0.87, z: 0.16, color: PAL.paper });
    p.cyl({ r: 0.052, h: 0.11, x: 0.4, y: 0.87, z: -0.2, color: PAL.fabricWarm });
    p.box({ w: 0.42, h: 0.025, d: 0.3, x: -0.05, y: 0.828, z: 0.24, rotY: 0.22, color: PAL.steelDark });
    p.sphere({ r: 0.12, x: -0.05, y: 0.85, z: 0.24, sy: 0.45, color: PAL.hullLight });
    p.box({
      w: 0.26,
      h: 0.018,
      d: 0.19,
      x: 0.6,
      y: 0.824,
      z: 0.3,
      rotY: -0.5,
      color: PAL.screenGreen,
      emissive: PAL.glowGreen,
      emissiveIntensity: 0.9,
    });
    const rand = seeded(17);
    for (let i = 0; i < 5; i++) {
      p.box({
        w: 0.085,
        h: 0.006,
        d: 0.125,
        x: -0.55 + rand() * 0.22,
        y: 0.818 + i * 0.005,
        z: 0.38 + rand() * 0.14,
        rotY: rand() * 1.6,
        color: PAL.paper,
      });
    }
    p.cyl({ r: 0.045, h: 0.24, x: 0.78, y: 0.93, z: 0.06, color: PAL.screenGreen });
    p.cyl({ r: 0.022, h: 0.07, x: 0.78, y: 1.08, z: 0.06, color: PAL.hazard });

    // Bench on the wall side, stools on the room side.
    p.box({ w: 1.9, h: 0.09, d: 0.42, y: 0.45, z: 0.8, color: PAL.wood });
    for (const x of [-0.76, 0.76]) {
      p.box({ w: 0.1, h: 0.45, d: 0.34, x, y: 0.225, z: 0.8, color: PAL.steelDark });
    }
    // A jacket slung over the bench end.
    p.box({ w: 0.3, h: 0.34, d: 0.14, x: 0.82, y: 0.62, z: 0.78, rotZ: 0.18, color: PAL.fabricWarm });
    // Boots kicked off underneath.
    for (const dx of [0, 0.17]) {
      p.box({ w: 0.13, h: 0.13, d: 0.3, x: -0.38 + dx, y: 0.065, z: -0.42, rotY: 0.3 + dx, color: PAL.hullDark });
    }
  });

  stool(b, { x: -2.2, z: 2.35 });
  stool(b, { x: -1.5, z: 2.28, seat: PAL.fabricWarm, back: true });
  stool(b, { x: -0.8, z: 2.42, rotY: 0.4 });
}

// Galley run along the east wall. It started on the north wall, which was
// wrong for a reason worth recording: a 2.6m wall at z = 5 sits between
// this camera and anything low in front of it, so the worktop — where all
// a galley's detail lives — was occluded by the ship's own hull from most
// of the room. Side walls have no such problem, since the camera shares
// the player's x and looks straight down the room rather than across it.
//
// Authored facing -Z as before and turned a quarter turn, so the local
// frame still reads as "along the counter, out into the room".
function galley(b) {
  b.at({ x: 4.6, z: 2.85, rotY: HALF_PI }, (p) => {
    p.box({ w: 2.9, h: 0.9, d: 0.62, y: 0.45, color: PAL.panel });
    p.box({ w: 2.85, h: 0.11, d: 0.5, y: 0.055, color: PAL.hullDark });
    p.box({ w: 3.0, h: 0.07, d: 0.68, y: 0.925, color: PAL.steel });
    p.box({ w: 3.02, h: 0.04, d: 0.05, y: 0.955, z: -0.33, color: PAL.trim });

    // Sink: recessed basin, rim and a folded-arm faucet.
    p.box({ w: 0.58, h: 0.05, d: 0.48, x: -0.78, y: 0.94, color: PAL.trim });
    p.box({ w: 0.5, h: 0.12, d: 0.4, x: -0.78, y: 0.9, color: PAL.hullDark });
    p.cyl({ r: 0.028, h: 0.3, x: -0.78, y: 1.1, z: 0.2, color: PAL.steel });
    p.box({ w: 0.03, h: 0.03, d: 0.24, x: -0.78, y: 1.24, z: 0.09, color: PAL.steel });

    // Hot plate with two live rings.
    p.box({ w: 0.5, h: 0.035, d: 0.42, x: 0.42, y: 0.96, color: PAL.hazard });
    for (const x of [0.3, 0.56]) {
      p.torus({ r: 0.085, tube: 0.016, x, y: 0.985, rotX: HALF_PI, color: PAL.redGlow, emissive: PAL.redGlow, emissiveIntensity: 1.8 });
    }
    p.cyl({ r: 0.11, h: 0.12, x: 0.3, y: 1.05, color: PAL.steelDark });

    // Kettle, chopping board, tray stack, tins, dish rack.
    p.cyl({ r: 0.13, h: 0.3, x: 1.18, y: 1.11, color: PAL.steel });
    p.cyl({ r: 0.14, h: 0.04, x: 1.18, y: 1.28, color: PAL.steelDark });
    p.box({ w: 0.2, h: 0.035, d: 0.035, x: 1.31, y: 1.16, color: PAL.steelDark });
    p.box({ w: 0.42, h: 0.03, d: 0.28, x: -0.15, y: 0.975, rotY: 0.12, color: PAL.wood });
    for (let i = 0; i < 4; i++) {
      p.box({ w: 0.34, h: 0.025, d: 0.26, x: 1.32, y: 0.975 + i * 0.028, z: -0.16, color: i % 2 ? PAL.trim : PAL.steelDark });
    }
    for (let i = 0; i < 3; i++) {
      p.cyl({ r: 0.055, h: 0.13, x: -1.32 + i * 0.14, y: 1.025, z: 0.1, color: [PAL.crateA, PAL.rust, PAL.crateC][i] });
    }
    for (let i = 0; i < 5; i++) {
      p.box({ w: 0.02, h: 0.16, d: 0.22, x: -1.28 + i * 0.07, y: 1.04, z: -0.16, color: PAL.steel });
    }

    // Open shelf above: contents read from directly overhead.
    p.box({ w: 2.2, h: 0.05, d: 0.36, y: 1.62, z: 0.06, color: PAL.trim });
    for (const x of [-1.06, 1.06]) p.box({ w: 0.06, h: 0.7, d: 0.36, x, y: 1.3, z: 0.06, color: PAL.trim });
    const tins = [PAL.crateA, PAL.rust, PAL.crateC, PAL.crateB, PAL.copper, PAL.crateD];
    tins.forEach((color, i) => {
      p.cyl({ r: 0.07, h: 0.15, x: -0.95 + i * 0.2, y: 1.72, z: 0.08, color });
    });
    for (let i = 0; i < 4; i++) {
      p.cyl({ r: 0.11, h: 0.035, x: 0.75, y: 1.665 + i * 0.038, z: 0.06, color: PAL.hullLight });
    }
    p.box({
      w: 2.0,
      h: 0.04,
      d: 0.1,
      y: 1.56,
      z: 0.06,
      color: PAL.glowAmber,
      emissive: PAL.glowAmber,
      emissiveIntensity: 1.5,
    });
  });
}

function crewLockers(b) {
  // On the north wall, where the locker doors face away from the camera.
  // That's a cheap loss compared to the galley they traded places with:
  // lockers read as a bank of tall volumes from above, and the one left
  // standing open shows its contents regardless of which way it faces.
  const faces = [PAL.panel, PAL.hullLight, PAL.panel, PAL.hull];
  [-0.9, -0.1, 0.7, 1.5].forEach((x, i) => {
    b.at({ x, z: 4.58, rotY: -HALF_PI }, (p) => {
      p.box({ w: 0.5, h: 1.75, d: 0.76, y: 0.875, color: faces[i] });
      if (i === 2) {
        // One locker standing open: swung door, hung jacket, shelf.
        p.at({ x: -0.26, z: -0.35, rotY: -0.75 }, (q) => {
          q.box({ w: 0.04, h: 1.62, d: 0.7, y: 0.875, z: 0.35, color: PAL.hullLight });
          q.box({ w: 0.05, h: 0.2, d: 0.045, x: -0.04, y: 0.95, z: 0.62, color: PAL.steel });
        });
        p.box({ w: 0.44, h: 0.03, d: 0.68, y: 1.4, color: PAL.trim });
        p.box({ w: 0.2, h: 0.74, d: 0.34, x: -0.08, y: 0.95, color: PAL.fabricWarm });
        p.box({ w: 0.26, h: 0.12, d: 0.36, y: 1.48, color: PAL.hullDark });
      } else {
        p.box({ w: 0.04, h: 1.62, d: 0.7, x: -0.26, y: 0.875, color: PAL.hullLight });
        p.box({ w: 0.05, h: 0.2, d: 0.045, x: -0.29, y: 0.95, color: PAL.steel });
        for (let s = 0; s < 3; s++) {
          p.box({ w: 0.02, h: 0.03, d: 0.34, x: -0.29, y: 1.48 + s * 0.08, color: PAL.hullDark });
        }
      }
      p.box({ w: 0.02, h: 0.09, d: 0.36, x: -0.29, y: 1.28, color: PAL.amber });
      p.box({ w: 0.54, h: 0.08, d: 0.8, y: 0.04, color: PAL.hullDark });
    });
  });
  b.box({ w: 3.34, h: 0.06, d: 0.56, x: 0.3, y: 1.79, z: 4.58, color: PAL.trim });

  // Kit piled at the end of the bank.
  b.box({ w: 0.64, h: 0.32, d: 0.44, x: -1.75, y: 0.17, z: 4.42, rotY: 0.22, color: PAL.fabric });
  b.box({ w: 0.12, h: 0.05, d: 0.46, x: -1.75, y: 0.3, z: 4.42, rotY: 0.22, color: PAL.amber });
  for (const dx of [0, 0.17]) {
    b.box({ w: 0.29, h: 0.13, d: 0.13, x: 1.95 + dx, y: 0.065, z: 4.3, rotY: -0.25, color: PAL.hullDark });
  }
}

function storageShelving(b) {
  b.at({ x: 4.62, z: -2.3 }, (p) => {
    for (const x of [-0.2, 0.2]) {
      for (const z of [-0.85, 0.85]) {
        p.box({ w: 0.07, h: 1.56, d: 0.07, x, y: 0.78, z, color: PAL.steelDark });
      }
    }
    p.box({ w: 0.03, h: 1.5, d: 1.78, x: 0.24, y: 0.78, color: PAL.panel });
    for (const y of [0.42, 0.88, 1.34, 1.55]) {
      p.box({ w: 0.44, h: 0.05, d: 1.78, y, color: PAL.trim });
    }

    const bins = [PAL.crateC, PAL.crateD, PAL.fabric];
    bins.forEach((color, i) => {
      p.box({ w: 0.34, h: 0.26, d: 0.4, y: 0.58, z: -0.6 + i * 0.55, color });
      p.box({ w: 0.36, h: 0.04, d: 0.12, x: -0.01, y: 0.7, z: -0.6 + i * 0.55, color: PAL.hullDark });
    });
    p.torus({ r: 0.16, tube: 0.05, y: 0.96, z: -0.6, rotX: HALF_PI, color: PAL.hazard });
    for (let i = 0; i < 3; i++) {
      p.box({ w: 0.34, h: 0.05, d: 0.36, y: 0.935 + i * 0.05, z: 0.1, color: [PAL.fabricWarm, PAL.fabric, PAL.paper][i] });
    }
    p.sphere({ r: 0.15, y: 1.05, z: 0.72, color: PAL.hullLight });
    p.box({ w: 0.07, h: 0.11, d: 0.2, x: -0.14, y: 1.05, z: 0.72, color: PAL.screenBlue, emissive: PAL.glowBlue });
    p.box({ w: 0.3, h: 0.2, d: 0.5, y: 1.67, z: -0.3, color: PAL.rust });
    p.box({ w: 0.32, h: 0.04, d: 0.14, y: 1.79, z: -0.3, color: PAL.steelDark });
    for (const z of [0.5, 0.68]) p.cyl({ r: 0.05, h: 0.22, y: 1.68, z, color: PAL.screenGreen });
  });

  // Mission clock on the east wall above the shelving.
  b.at({ x: 4.84, y: 1.88, z: -3.9 }, (p) => {
    p.cyl({ r: 0.19, h: 0.06, rotZ: HALF_PI, color: PAL.hullDark });
    p.cyl({ r: 0.155, h: 0.02, x: -0.04, rotZ: HALF_PI, color: PAL.screenAmber, emissive: PAL.glowAmber, emissiveIntensity: 0.9 });
    p.box({ w: 0.02, h: 0.12, d: 0.018, x: -0.06, y: 0.04, rotX: 0.5, color: PAL.hazard });
    p.box({ w: 0.02, h: 0.08, d: 0.018, x: -0.06, y: -0.02, rotX: -1.2, color: PAL.hazard });
  });
}

function buildCommonArea(b) {
  messTable(b);
  galley(b);
  crewLockers(b);
  storageShelving(b);

  // South wall (camera-facing): med station, poster wall, notice board.
  b.at({ x: -2.25, z: -4.6 }, (p) => {
    p.box({ w: 1.2, h: 1.6, d: 0.5, y: 0.8, color: PAL.panel });
    p.box({ w: 1.26, h: 0.09, d: 0.56, y: 0.045, color: PAL.hullDark });
    for (const x of [-0.3, 0.3]) {
      p.box({ w: 0.56, h: 1.4, d: 0.03, x, y: 0.82, z: 0.26, color: PAL.hullLight });
      p.box({ w: 0.04, h: 0.3, d: 0.04, x: x * 0.2, y: 0.86, z: 0.29, color: PAL.steel });
    }
    p.box({ w: 0.34, h: 0.1, d: 0.02, y: 1.16, z: 0.29, color: PAL.redGlow });
    p.box({ w: 0.1, h: 0.34, d: 0.02, y: 1.16, z: 0.29, color: PAL.redGlow });
    p.box({ w: 0.32, h: 0.2, d: 0.26, x: -0.36, y: 0.9, color: PAL.paper });
    p.box({ w: 0.16, h: 0.05, d: 0.02, x: -0.36, y: 0.9, z: 0.14, color: PAL.redGlow });
    p.box({ w: 0.05, h: 0.14, d: 0.02, x: -0.36, y: 0.9, z: 0.14, color: PAL.redGlow });
    for (const x of [0.2, 0.34]) p.cyl({ r: 0.05, h: 0.2, x, y: 0.9, color: PAL.screenGreen });
  });
  // Counter extension, kept east of the cabinet but west of x = -1: the
  // Cargo Corridor runs through x in [-1, 1] here.
  b.at({ x: -1.35, z: -4.64 }, (p) => {
    p.box({ w: 0.55, h: 0.06, d: 0.45, y: 0.9, color: PAL.steel });
    for (const x of [-0.2, 0.2]) p.box({ w: 0.06, h: 0.9, d: 0.06, x, y: 0.45, z: 0.16, color: PAL.steelDark });
    p.box({ w: 0.3, h: 0.12, d: 0.3, x: -0.1, y: 0.99, color: PAL.fabricWarm });
    p.box({ w: 0.22, h: 0.03, d: 0.24, x: 0.18, y: 0.945, color: PAL.steelDark });
  });

  b.at({ x: 1.75, y: 1.72, z: -4.86 }, (p) => {
    p.box({ w: 0.84, h: 1.14, d: 0.03, rotZ: 0.035, color: PAL.paper });
    p.at({ rotZ: 0.035 }, (q) => {
      q.disc({ r: 0.2, y: 0.24, z: 0.02, color: PAL.rust });
      q.ring({ r: 0.23, r2: 0.27, y: 0.24, z: 0.02, color: PAL.amber });
      for (let i = 0; i < 3; i++) {
        q.box({ w: 0.7, h: 0.055, d: 0.015, y: -0.06 - i * 0.09, z: 0.02, color: [PAL.rust, PAL.amber, PAL.hull][i] });
      }
      for (let i = 0; i < 4; i++) {
        q.box({ w: 0.46 - i * 0.07, h: 0.028, d: 0.012, x: -0.1, y: -0.34 - i * 0.06, z: 0.02, color: PAL.hullDark });
      }
      for (const sx of [-1, 1]) {
        for (const sy of [-1, 1]) {
          q.box({ w: 0.1, h: 0.1, d: 0.012, x: sx * 0.4, y: sy * 0.54, z: 0.02, rotZ: Math.PI / 4, color: PAL.hullLight });
        }
      }
    });
  });
  const photos = seeded(63);
  for (let i = 0; i < 5; i++) {
    b.box({
      w: 0.17,
      h: 0.21,
      d: 0.02,
      x: 2.45 + (i % 3) * 0.22,
      y: 1.24 - Math.floor(i / 3) * 0.27,
      z: -4.86,
      rotZ: -0.12 + photos() * 0.24,
      color: [PAL.hullLight, PAL.fabricWarm, PAL.paper, PAL.fabric, PAL.crateC][i],
    });
  }

  screenPanel(b, { x: 4.05, y: 1.78, z: -4.84, w: 1.0, h: 0.62, glow: PAL.glowBlue, screen: PAL.screenBlue });
  b.at({ x: 4.05, y: 1.06, z: -4.86 }, (p) => {
    p.box({ w: 1.02, h: 0.52, d: 0.03, color: PAL.wood });
    const rand = seeded(29);
    for (let i = 0; i < 7; i++) {
      p.box({
        w: 0.13,
        h: 0.16,
        d: 0.015,
        x: -0.38 + rand() * 0.76,
        y: -0.16 + rand() * 0.32,
        z: 0.02,
        rotZ: -0.2 + rand() * 0.4,
        color: rand() > 0.5 ? PAL.paper : PAL.amber,
      });
    }
  });
  b.box({ w: 1.6, h: 0.11, d: 0.13, x: 4.05, y: 0.06, z: -4.82, color: PAL.hullDark });

  // West side: potted plant, water tank, fire station.
  b.at({ x: -2.55, z: 1.85 }, (p) => {
    p.box({ w: 0.44, h: 0.34, d: 0.44, y: 0.17, color: PAL.rust });
    p.box({ w: 0.48, h: 0.05, d: 0.48, y: 0.345, color: PAL.steelDark });
    p.box({ w: 0.38, h: 0.04, d: 0.38, y: 0.36, color: PAL.wood });
    for (let i = 0; i < 7; i++) {
      p.at({ y: 0.38, rotY: i * 0.9 }, (q) => {
        q.box({
          w: 0.07,
          h: 0.5,
          d: 0.17,
          x: 0.12,
          y: 0.24,
          rotZ: -0.45,
          color: i % 2 ? PAL.plant : PAL.plantDark,
        });
      });
    }
    p.cyl({ r: 0.02, h: 0.62, y: 0.68, color: PAL.plantDark });
    p.cyl({ r: 0.02, h: 0.5, x: 0.08, y: 0.62, rotZ: -0.2, color: PAL.plantDark });
  });

  b.at({ x: -2.45, z: -2.1 }, (p) => {
    p.cyl({ r: 0.33, h: 1.15, y: 0.6, color: PAL.steelDark });
    for (const y of [0.28, 0.6, 0.95]) p.cyl({ r: 0.36, h: 0.06, y, color: PAL.steel });
    p.cyl({ r: 0.33, rTop: 0.2, h: 0.22, y: 1.28, color: PAL.steelDark });
    p.cyl({ r: 0.05, h: 0.14, y: 1.45, color: PAL.steel });
    p.torus({ r: 0.11, tube: 0.028, y: 1.54, rotX: HALF_PI, color: PAL.rust });
    p.cyl({ r: 0.09, h: 0.04, y: 1.0, z: 0.33, rotX: HALF_PI, color: PAL.hullDark });
    p.cyl({ r: 0.07, h: 0.02, y: 1.0, z: 0.36, rotX: HALF_PI, color: PAL.paper });
    p.box({ w: 0.09, h: 0.014, d: 0.012, x: 0.02, y: 1.01, z: 0.38, rotZ: 0.7, color: PAL.redGlow });
    p.box({ w: 0.26, h: 0.14, d: 0.02, y: 0.75, z: 0.34, color: PAL.amber });
  });

  b.at({ x: -2.78, z: -3.6 }, (p) => {
    p.box({ w: 0.24, h: 1.0, d: 0.55, y: 0.9, color: PAL.redDark });
    p.box({ w: 0.03, h: 0.82, d: 0.45, x: -0.13, y: 0.9, color: PAL.glass, opacity: 0.3 });
    p.cyl({ r: 0.1, h: 0.5, x: -0.02, y: 0.78, color: PAL.redGlow });
    p.cyl({ r: 0.035, h: 0.1, x: -0.02, y: 1.07, color: PAL.hazard });
    p.box({ w: 0.02, h: 0.1, d: 0.3, x: -0.14, y: 1.32, color: PAL.amber });
  });

  // String lights across the north wall — the room's most obviously
  // human-added detail.
  b.box({ w: 5.0, h: 0.02, d: 0.02, x: 0.9, y: 2.18, z: 4.78, color: PAL.hullDark });
  for (let i = 0; i < 11; i++) {
    const x = -1.5 + i * 0.48;
    b.box({ w: 0.014, h: 0.08, d: 0.014, x, y: 2.14, z: 4.78, color: PAL.hullDark });
    b.sphere({
      r: 0.048,
      x,
      y: 2.07,
      z: 4.78,
      color: i % 3 === 0 ? PAL.paper : PAL.amber,
      emissive: i % 3 === 0 ? PAL.paper : PAL.glowAmber,
      emissiveIntensity: 1.6,
    });
  }

  // Card game set up on a crate in the aft corner.
  crate(b, { x: 3.5, z: -3.25, s: 0.85, color: PAL.crateB, rotY: 0.15 });
  stool(b, { x: 2.72, z: -3.72, rotY: 0.5 });
  stool(b, { x: 4.24, z: -2.86, rotY: -0.9, seat: PAL.fabricWarm });
  const cards = seeded(53);
  for (let i = 0; i < 6; i++) {
    b.box({
      w: 0.085,
      h: 0.006,
      d: 0.125,
      x: 3.3 + cards() * 0.4,
      y: 0.895 + i * 0.005,
      z: -3.42 + cards() * 0.36,
      rotY: cards() * 2.2,
      color: PAL.paper,
    });
  }
  for (const [x, z, color] of [[3.22, -3.05, PAL.amber], [3.36, -3.04, PAL.redGlow], [3.5, -3.06, PAL.glowBlue]]) {
    b.cyl({ r: 0.055, h: 0.06, x, y: 0.92, z, seg: 8, color });
  }
  b.cyl({ r: 0.05, h: 0.1, x: 3.82, y: 0.94, z: -3.5, color: PAL.paper });

  // Floor: worn traffic paths, thresholds, a deck hatch and scuffs.
  b.box({ w: 7.9, h: 0.02, d: 1.5, x: 1.0, y: 0.011, z: 0, color: 0x2c3945 });
  b.box({ w: 1.4, h: 0.02, d: 4.2, x: 0, y: 0.011, z: -2.85, color: 0x2c3945 });
  for (const [x, z, along] of [[-2.78, 0, false], [4.78, 0, false], [0, -4.78, true]]) {
    b.box({
      w: along ? 2.0 : 0.45,
      h: 0.025,
      d: along ? 0.45 : 2.0,
      x,
      y: 0.014,
      z,
      color: PAL.steelDark,
    });
  }
  deckHatch(b, { x: 3.6, z: -1.9 });
  const scuff = seeded(99);
  for (let i = 0; i < 8; i++) {
    b.cyl({
      r: 0.12 + scuff() * 0.22,
      h: 0.012,
      x: -2.4 + scuff() * 7.0,
      y: 0.008,
      z: -4.2 + scuff() * 8.6,
      seg: 8,
      color: 0x1c2833,
    });
  }

  hullRibs(b, {
    axis: "z",
    from: -4.2,
    to: 4.2,
    at: -2.85,
    skip: (z) => Math.abs(z) < 1.4 || (z > 2.9 && z < 4.0) || (z > -4.2 && z < -3.0),
  });
  hullRibs(b, { axis: "x", from: -2.4, to: 4.4, at: 4.85, skip: (x) => x > -1.2 && x < 2.9, stringer: false });
  ceilingStrip(b, { axis: "z", x: -2.72, z: 1.2, length: 5.6 });
  ceilingStrip(b, { axis: "z", x: 4.72, z: 1.2, length: 5.6, color: PAL.glowAmber });
}

// ---------------------------------------------------------------------------
// Engine Room — x: 8..16, z: -4..4. Doorway west (x = 8, z in [-1, 1]).
// Corwin stands at (12, 0), so the reactor sits aft of him at (14.0, 0)
// with a clear approach lane; pipework runs the north wall and every
// operator station (bench, terminal, cabinets) faces the camera off the
// south wall.
// ---------------------------------------------------------------------------

function reactor(b) {
  b.at({ x: 14.0, z: 0 }, (p) => {
    p.cyl({ r: 1.6, h: 0.012, y: 0.006, seg: 16, color: 0x1c1712 });
    p.cyl({ r: 1.25, h: 0.22, y: 0.11, seg: 8, color: PAL.hullDark });
    p.cyl({ r: 1.3, h: 0.08, y: 0.2, seg: 8, color: PAL.steelDark });
    for (let i = 0; i < 6; i++) {
      p.at({ rotY: (i * Math.PI) / 3 }, (q) => {
        q.box({ w: 0.62, h: 0.14, d: 0.17, x: 1.04, y: 0.31, rotZ: 0.32, color: PAL.steelDark });
      });
    }

    p.cyl({ r: 0.92, h: 0.56, y: 0.5, color: PAL.hull });
    p.cyl({ r: 0.98, h: 0.09, y: 0.82, color: PAL.steelDark });

    // Containment section: glowing casing slots and a hot retaining band.
    p.cyl({ r: 0.78, h: 0.62, y: 1.17, color: PAL.reactorTeal, emissive: PAL.reactorGlow, emissiveIntensity: 0.9 });
    for (let i = 0; i < 4; i++) {
      p.at({ rotY: (i * Math.PI) / 2 }, (q) => {
        q.box({
          w: 0.1,
          h: 0.46,
          d: 0.2,
          x: 0.76,
          y: 1.17,
          color: PAL.coreGlow,
          emissive: PAL.coreGlow,
          emissiveIntensity: 2.0,
        });
      });
    }
    p.torus({ r: 0.85, tube: 0.055, y: 1.17, rotX: HALF_PI, color: PAL.amber, emissive: PAL.amberGlow, emissiveIntensity: 1.3 });

    p.cyl({ r: 0.98, h: 0.09, y: 1.53, color: PAL.steelDark });
    p.cyl({ r: 0.88, h: 0.4, y: 1.78, color: PAL.hull });
    p.cyl({ r: 0.88, rTop: 0.46, h: 0.36, y: 2.16, color: PAL.steelDark });
    p.cyl({ r: 0.5, h: 0.08, y: 2.38, color: PAL.amber, emissive: PAL.amberGlow, emissiveIntensity: 1.5 });
    p.cyl({ r: 0.21, h: 0.46, y: 2.62, color: PAL.steelDark });
    for (const y of [2.48, 2.66, 2.84]) {
      p.torus({ r: 0.24, tube: 0.03, y, rotX: HALF_PI, color: PAL.steel });
    }

    // Painted exclusion ring at the reactor's foot.
    for (let i = 0; i < 14; i++) {
      p.at({ rotY: (i * 2 * Math.PI) / 14 }, (q) => {
        q.box({ w: 0.34, h: 0.02, d: 0.42, x: 1.48, y: 0.014, color: i % 2 ? PAL.hazard : PAL.amber });
      });
    }
  });

  // Heavy conduits leaving the core for the hull.
  pipeRun(b, { axis: "x", from: 14.75, to: 15.85, at: 0, y: 2.15, r: 0.13, color: PAL.steelDark, flangeStep: 0.7 });
  b.cyl({ r: 0.13, h: 0.85, x: 15.78, y: 1.75, z: 0, color: PAL.steelDark });
  b.sphere({ r: 0.16, x: 15.78, y: 2.15, z: 0, color: PAL.steelDark });
  pipeRun(b, { axis: "z", from: 0.95, to: 3.8, at: 14.0, y: 2.15, r: 0.11, color: PAL.copper, flangeStep: 1.2 });
  pipeRun(b, { axis: "z", from: -3.8, to: -0.95, at: 14.0, y: 2.15, r: 0.11, color: PAL.copper, flangeStep: 1.2 });
  for (const z of [-0.95, 0.95]) {
    b.cyl({ r: 0.12, h: 0.5, x: 14.0, y: 2.3, z: z * 0.72, rotX: z > 0 ? -0.9 : 0.9, color: PAL.copper });
  }
}

function engineNorthWall(b) {
  // Coolant tanks flanking the doorway approach.
  for (const z of [3.2, -3.2]) {
    b.at({ x: 8.75, z }, (p) => {
      p.cyl({ r: 0.36, h: 1.5, y: 0.78, color: PAL.steelDark });
      for (const y of [0.45, 0.95, 1.4]) p.cyl({ r: 0.39, h: 0.07, y, color: PAL.steel });
      p.cyl({ r: 0.36, rTop: 0.2, h: 0.26, y: 1.66, color: PAL.steelDark });
      p.cyl({ r: 0.05, h: 0.16, y: 1.87, color: PAL.steel });
      p.torus({ r: 0.12, tube: 0.03, y: 1.96, rotX: HALF_PI, color: PAL.rust });
      p.box({ w: 0.3, h: 0.16, d: 0.02, x: 0.02, y: 1.1, z: -0.37, color: PAL.amber });
      p.cyl({ r: 0.09, h: 0.05, x: 0.37, y: 1.15, rotZ: HALF_PI, color: PAL.hullDark });
      p.cyl({ r: 0.07, h: 0.02, x: 0.4, y: 1.15, rotZ: HALF_PI, color: PAL.paper });
      p.box({ w: 0.012, h: 0.09, d: 0.014, x: 0.42, y: 1.17, rotZ: -0.6, color: PAL.redGlow });
    });
  }

  // Three parallel runs along the north wall.
  pipeRun(b, { axis: "x", from: 9.5, to: 13.4, at: 3.58, y: 0.62, r: 0.13, color: PAL.steelDark });
  pipeRun(b, { axis: "x", from: 9.5, to: 13.4, at: 3.58, y: 1.16, r: 0.105, color: PAL.copper });
  pipeRun(b, { axis: "x", from: 9.5, to: 13.4, at: 3.58, y: 1.7, r: 0.08, color: PAL.amber });
  valveWheel(b, { x: 11.3, y: 1.22, z: 3.58 });
  for (let i = 0; i < 3; i++) {
    b.cyl({ r: 0.115, h: 0.5, x: 10.2 + i * 1.5, y: 1.7, z: 3.58, rotZ: HALF_PI, color: PAL.paper });
  }
  // Elbows dropping into the deck at the east end of the runs.
  for (const [y, r] of [[0.62, 0.13], [1.16, 0.105], [1.7, 0.08]]) {
    b.sphere({ r: r + 0.02, x: 13.4, y, z: 3.58, color: PAL.steelDark });
    b.cyl({ r, h: y - 0.24, x: 13.4, y: (y + 0.24) / 2, z: 3.58, color: PAL.steelDark });
  }

  // Heat exchanger: the fin stack on top is the part the camera sees.
  b.at({ x: 14.6, z: 3.4 }, (p) => {
    p.box({ w: 2.3, h: 1.0, d: 0.9, y: 0.5, color: PAL.panel });
    p.box({ w: 2.36, h: 0.09, d: 0.96, y: 0.045, color: PAL.hullDark });
    p.box({ w: 2.3, h: 0.06, d: 0.9, y: 1.03, color: PAL.trim });
    for (let i = 0; i < 13; i++) {
      p.box({ w: 0.07, h: 0.34, d: 0.82, x: -1.02 + i * 0.17, y: 1.23, color: PAL.steel });
    }
    p.box({ w: 2.3, h: 0.06, d: 0.9, y: 1.43, color: PAL.trim });
    p.box({ w: 0.34, h: 0.18, d: 0.02, x: -0.8, y: 0.78, z: -0.46, color: PAL.amber });
    for (const x of [-0.7, 0.7]) p.cyl({ r: 0.1, h: 0.36, x, y: 1.6, color: PAL.copper });
  });
}

function engineSouthWall(b) {
  // Workbench.
  b.at({ x: 10.4, z: -3.42 }, (p) => {
    p.box({ w: 2.4, h: 0.09, d: 0.72, y: 0.87, color: PAL.steel });
    p.box({ w: 2.2, h: 0.02, d: 0.6, y: 0.92, color: PAL.hullLight });
    for (const x of [-1.1, 1.1]) {
      for (const z of [-0.3, 0.3]) {
        p.box({ w: 0.09, h: 0.87, d: 0.09, x, y: 0.435, z, color: PAL.steelDark });
      }
    }
    p.box({ w: 2.3, h: 0.05, d: 0.62, y: 0.28, color: PAL.steelDark });
    [PAL.crateC, PAL.crateD, PAL.rust].forEach((color, i) => {
      p.box({ w: 0.36, h: 0.2, d: 0.5, x: -0.9 + i * 0.9, y: 0.41, color });
    });

    p.box({ w: 0.22, h: 0.17, d: 0.2, x: -0.75, y: 1.0, color: PAL.steelDark });
    p.box({ w: 0.07, h: 0.17, d: 0.22, x: -0.62, y: 1.0, color: PAL.steel });
    p.cyl({ r: 0.022, h: 0.26, x: -0.75, y: 1.12, rotX: HALF_PI, color: PAL.steel });
    p.box({ w: 0.12, h: 0.06, d: 0.1, x: -0.2, y: 0.95, rotY: 0.3, color: PAL.hullDark });
    p.cyl({ r: 0.05, h: 0.09, x: 0.1, y: 0.965, z: -0.08, color: PAL.copper });
    p.torus({ r: 0.1, tube: 0.028, x: 0.4, y: 0.935, z: 0.12, rotX: HALF_PI, color: PAL.copper });
    p.box({ w: 0.2, h: 0.03, d: 0.14, x: 0.7, y: 0.935, z: -0.1, rotY: -0.4, color: PAL.amber });

    // Clamp-on work lamp.
    p.cyl({ r: 0.05, h: 0.07, x: 0.95, y: 0.95, z: -0.07, color: PAL.steelDark });
    p.cyl({ r: 0.022, h: 0.58, x: 1.02, y: 1.25, z: -0.07, rotZ: -0.24, color: PAL.steel });
    p.cyl({ r: 0.14, rTop: 0.06, h: 0.16, x: 1.12, y: 1.58, z: -0.07, color: PAL.steelDark });
    p.cyl({ r: 0.12, h: 0.02, x: 1.12, y: 1.51, z: -0.07, color: PAL.amber, emissive: PAL.amber, emissiveIntensity: 2.2 });
  });

  // Pegboard and hanging tools behind the bench.
  b.box({ w: 2.3, h: 0.92, d: 0.04, x: 10.4, y: 1.68, z: -3.78, color: PAL.panel });
  for (let i = 0; i < 3; i++) {
    b.box({ w: 2.2, h: 0.015, d: 0.012, x: 10.4, y: 1.4 + i * 0.28, z: -3.755, color: PAL.hullDark });
  }
  for (let i = 0; i < 3; i++) {
    b.box({ w: 0.05, h: 0.34, d: 0.03, x: 9.5 + i * 0.18, y: 1.62, z: -3.73, color: PAL.steel });
    b.box({ w: 0.09, h: 0.09, d: 0.028, x: 9.5 + i * 0.18, y: 1.81, z: -3.73, color: PAL.steel });
  }
  b.box({ w: 0.04, h: 0.3, d: 0.03, x: 10.16, y: 1.6, z: -3.73, color: PAL.wood });
  b.box({ w: 0.17, h: 0.07, d: 0.05, x: 10.16, y: 1.78, z: -3.73, color: PAL.steelDark });
  b.box({ w: 0.36, h: 0.14, d: 0.02, x: 10.62, y: 1.55, z: -3.73, color: PAL.steel });
  b.box({ w: 0.11, h: 0.12, d: 0.03, x: 10.42, y: 1.55, z: -3.72, color: PAL.wood });
  b.torus({ r: 0.17, tube: 0.05, x: 11.15, y: 1.68, z: -3.72, color: PAL.hazard });
  b.box({ w: 0.06, h: 0.26, d: 0.02, x: 11.48, y: 1.62, z: -3.73, color: PAL.steel });

  // Diagnostic terminal.
  b.at({ x: 12.5, z: -3.45 }, (p) => {
    p.box({ w: 1.1, h: 1.0, d: 0.6, y: 0.5, color: PAL.panel });
    p.box({ w: 1.16, h: 0.09, d: 0.66, y: 0.045, color: PAL.hullDark });
    p.at({ y: 1.04, z: 0.03, rotX: 0.42 }, (q) => {
      q.box({ w: 1.05, h: 0.06, d: 0.5, color: PAL.hullDark });
      q.box({ w: 0.5, h: 0.025, d: 0.2, x: -0.26, y: 0.045, z: 0.06, color: PAL.hazard });
      buttonGrid(q, { x: 0.28, y: 0.03, z: 0.02, cols: 4, rows: 3, spanX: 0.36, spanZ: 0.2, size: 0.04, seed: 21 });
    });
    screenPanel(p, { y: 1.62, z: -0.17, rotX: -0.2, w: 0.86, h: 0.56, glow: PAL.glowGreen, screen: PAL.screenGreen });
    screenPanel(p, { x: -0.56, y: 1.96, z: -0.21, rotX: -0.25, w: 0.36, h: 0.28, glow: PAL.glowBlue, screen: PAL.screenBlue });
    screenPanel(p, { x: 0.56, y: 1.96, z: -0.21, rotX: -0.25, w: 0.36, h: 0.28, glow: PAL.glowAmber, screen: PAL.screenAmber });
    indicatorStrip(p, { y: 1.28, z: 0.29, length: 0.9, count: 9, seed: 33 });
    p.cyl({ r: 0.035, h: 0.95, x: 0.5, y: 0.5, z: 0.28, rotZ: 0.08, color: PAL.hullDark });
  });

  equipmentCabinet(b, { x: 14.1, z: -3.5, w: 1.15, h: 1.5, d: 0.78 });
  equipmentCabinet(b, { x: 15.35, z: -3.5, w: 1.05, h: 1.34, d: 0.78, color: PAL.hull });
}

function buildEngineRoom(b) {
  reactor(b);
  engineNorthWall(b);
  engineSouthWall(b);

  // East wall: signage, risers, breaker panel.
  for (const z of [-1.5, 0, 1.5]) {
    warningSign(b, { x: 15.84, y: 1.92, z, rotY: -HALF_PI });
  }
  for (const z of [-2.7, 2.7]) {
    b.cyl({ r: 0.12, h: 2.2, x: 15.72, y: 1.15, z, color: PAL.steelDark });
    for (let i = 0; i < 4; i++) {
      b.box({ w: 0.14, h: 0.07, d: 0.3, x: 15.78, y: 0.35 + i * 0.6, z, color: PAL.steel });
    }
  }
  b.at({ x: 15.82, y: 1.35, z: 2.1, rotY: -HALF_PI }, (p) => {
    p.box({ w: 0.7, h: 0.8, d: 0.06, color: PAL.panel });
    p.box({ w: 0.6, h: 0.7, d: 0.03, z: 0.04, color: PAL.hullLight });
    for (let i = 0; i < 8; i++) {
      p.box({
        w: 0.05,
        h: 0.09,
        d: 0.025,
        x: -0.21 + (i % 4) * 0.14,
        y: 0.14 - Math.floor(i / 4) * 0.22,
        z: 0.06,
        color: i % 3 ? PAL.steel : PAL.redGlow,
      });
    }
    p.box({ w: 0.04, h: 0.16, d: 0.03, x: 0.26, y: -0.02, z: 0.06, color: PAL.amber });
  });

  // Hazard framing either side of the doorway.
  for (const z of [-1.16, 1.16]) {
    b.box({ w: 0.17, h: 2.3, d: 0.17, x: 8.24, y: 1.15, z, color: PAL.hazard });
    for (let i = 0; i < 4; i++) {
      b.box({ w: 0.19, h: 0.2, d: 0.19, x: 8.24, y: 0.34 + i * 0.56, z, color: PAL.amber });
    }
  }

  // Floor: reactor exclusion box, hatching, walkway guides, a drain.
  for (const z of [-1.9, 1.9]) {
    hazardStripe(b, { x: 14.0, y: 0.012, z, length: 3.2, segments: 8, thickness: 0.14 });
  }
  for (const x of [12.4, 15.6]) {
    hazardStripe(b, { x, y: 0.012, z: 0, length: 3.8, segments: 9, thickness: 0.14, rotY: HALF_PI });
  }
  for (let i = 0; i < 6; i++) {
    b.box({ w: 0.11, h: 0.02, d: 0.8, x: 8.4 + i * 0.16, y: 0.012, z: -3.2, rotY: 0.6, color: i % 2 ? PAL.hazard : PAL.amber });
  }
  for (const z of [-1.15, 1.15]) {
    b.box({ w: 4.0, h: 0.02, d: 0.07, x: 10.2, y: 0.012, z, color: PAL.amber });
  }
  b.box({ w: 0.75, h: 0.02, d: 0.75, x: 9.6, y: 0.012, z: 2.4, color: PAL.hullDark });
  for (let i = 0; i < 6; i++) {
    b.box({ w: 0.7, h: 0.025, d: 0.06, x: 9.6, y: 0.016, z: 2.13 + i * 0.11, color: PAL.steelDark });
  }

  // Overhead runs hugging the walls, plus rotating beacons.
  pipeRun(b, { axis: "x", from: 8.4, to: 15.7, at: 3.55, y: 2.42, r: 0.09, color: PAL.steelDark, flangeStep: 2.0 });
  pipeRun(b, { axis: "x", from: 8.4, to: 15.7, at: -3.6, y: 2.42, r: 0.075, color: PAL.copper, flangeStep: 2.0 });
  pipeRun(b, { axis: "z", from: -3.4, to: 3.4, at: 15.45, y: 2.42, r: 0.08, color: PAL.amber, flangeStep: 2.0 });
  for (const z of [3.55, -3.6]) {
    for (let i = 0; i < 5; i++) {
      b.box({ w: 0.05, h: 0.3, d: 0.05, x: 8.8 + i * 1.7, y: 2.57, z, color: PAL.steelDark });
    }
  }
  for (const z of [3.5, -3.55]) {
    b.box({ w: 0.18, h: 0.14, d: 0.18, x: 11.6, y: 2.5, z, color: PAL.steelDark });
    b.sphere({ r: 0.11, x: 11.6, y: 2.37, z, color: PAL.redGlow, emissive: PAL.redGlow, emissiveIntensity: 2.2 });
  }

  hullRibs(b, { axis: "z", from: -3.2, to: 3.2, at: 8.15, skip: (z) => Math.abs(z) < 1.5 });
  hullRibs(b, { axis: "x", from: 9.4, to: 13.2, at: 3.85, stringer: false });
  ceilingStrip(b, { axis: "x", x: 12.0, z: 3.9, length: 5.0, color: PAL.glowAmber });
}

// ---------------------------------------------------------------------------
// Cargo Bay — x: -5..5, z: -15..-9. Doorway north (z = -9, x in [-1, 1]).
// Amara stands at (0, -12). The centre lane from the door to her stays
// empty; cargo is worked into the side walls and the aft bulkhead.
// ---------------------------------------------------------------------------

function cargoNet(b, o) {
  b.at(o, (p) => {
    for (let i = 0; i < 6; i++) {
      p.box({ w: 0.03, h: o.h, d: 0.03, x: -o.w / 2 + (i * o.w) / 5, y: o.h / 2, color: PAL.hazard });
    }
    for (let i = 0; i < 4; i++) {
      p.box({ w: o.w, h: 0.03, d: 0.03, y: 0.18 + (i * (o.h - 0.36)) / 3, color: PAL.hazard });
    }
    for (const sx of [-1, 1]) {
      p.box({ w: 0.08, h: 0.1, d: 0.08, x: (sx * o.w) / 2, y: 0.06, color: PAL.steelDark });
    }
  });
}

function buildCargoBay(b) {
  // West stack: pallet base, three crates stacked askew, net over the face.
  // The base crate got its own small rotY rather than sitting dead-square
  // on the pallet — nobody drops a 1.35m crate perfectly true by hand.
  pallet(b, { x: -3.3, z: -13.2, w: 1.9, d: 1.5 });
  crate(b, { x: -3.3, y: 0.16, z: -13.2, s: 1.35, color: PAL.crateA, rotY: 0.07 });
  crate(b, { x: -3.52, y: 1.55, z: -13.38, s: 0.9, color: PAL.crateB, rotY: 0.18 });
  crate(b, { x: -2.92, y: 1.55, z: -12.82, s: 0.62, color: PAL.crateC, rotY: -0.3 });
  cargoNet(b, { x: -3.3, z: -12.46, w: 1.3, h: 1.5 });
  for (const [x, z] of [[-4.1, -12.4], [-2.5, -12.4], [-4.1, -14.0], [-2.5, -14.0]]) {
    b.torus({ r: 0.09, tube: 0.025, x, y: 0.02, z, rotX: HALF_PI, color: PAL.steelDark });
  }

  // East stack: mixed crates, a tall one on end, drums, leaning panels. The
  // top crate is offset off the base crate's centre and tipped on two axes
  // rather than spun cleanly on one — a stack a forklift actually dropped,
  // not one placed on a grid.
  crate(b, { x: 3.32, z: -13.64, s: 1.2, color: PAL.crateD, rotY: -0.05 });
  crate(b, { x: 3.56, y: 1.24, z: -13.42, s: 0.95, color: PAL.crateA, rotY: 0.26, rotZ: 0.05 });
  crate(b, { x: 2.3, z: -13.3, s: 0.7, h: 1.6, color: PAL.crateB, rotY: 0.15 });
  // A crate that slid off the stack during loading, lying on its side out
  // in the open floor between the two stacks.
  crate(b, { x: -1.6, y: 0.33, z: -13.5, s: 0.62, color: PAL.crateD, rotZ: 1.2, rotY: 0.4 });
  drum(b, { x: 4.24, z: -11.9 });
  drum(b, { x: 3.62, z: -11.58, r: 0.24, h: 0.66, color: PAL.copper });
  drum(b, { x: 4.28, z: -11.12, r: 0.26, h: 0.72, color: PAL.crateC });
  const leanJitter = seeded(46);
  for (let i = 0; i < 4; i++) {
    b.box({
      w: 0.07,
      h: 1.5,
      d: 0.9,
      x: 4.6 - i * 0.09,
      y: 0.76,
      z: -10.3,
      rotZ: -0.12 + (leanJitter() - 0.5) * 0.16,
      color: i % 2 ? PAL.crateC : PAL.steelDark,
    });
  }
  // Ratchet straps over the east stack.
  for (const z of [-13.28, -13.92]) {
    b.box({ w: 1.4, h: 0.045, d: 0.05, x: 3.4, y: 1.29, z, color: PAL.amber });
    b.box({ w: 0.13, h: 0.1, d: 0.11, x: 3.9, y: 1.32, z, color: PAL.steelDark });
  }
  for (const x of [3.0, 3.8]) {
    b.box({ w: 0.05, h: 1.26, d: 0.04, x, y: 0.63, z: -13.0, color: PAL.amber });
  }

  // Aft bulkhead: a row of mixed shipping containers, facing the camera.
  const containers = [
    { x: -1.9, w: 1.0, h: 1.15, color: PAL.crateC },
    { x: -0.75, w: 1.1, h: 0.9, color: PAL.crateD },
    { x: 0.5, w: 1.2, h: 1.3, color: PAL.crateA },
    { x: 1.8, w: 1.15, h: 1.0, color: PAL.crateB },
  ];
  const rowJitter = seeded(71);
  for (const c of containers) {
    const z = -14.45 + (rowJitter() - 0.5) * 0.1;
    const rotY = (rowJitter() - 0.5) * 0.1;
    b.at({ x: c.x, z, rotY }, (p) => {
      p.box({ w: c.w, h: c.h, d: 0.7, y: c.h / 2, color: c.color });
      p.box({ w: c.w * 0.88, h: c.h * 0.84, d: 0.03, y: c.h / 2, z: 0.36, color: PAL.hullDark });
      for (const sx of [-1, 1]) {
        p.box({ w: 0.08, h: c.h, d: 0.08, x: (sx * c.w) / 2, y: c.h / 2, z: 0.33, color: PAL.steelDark });
        p.box({ w: 0.07, h: 0.14, d: 0.05, x: sx * c.w * 0.3, y: c.h * 0.5, z: 0.38, color: PAL.steel });
      }
      p.box({ w: c.w * 0.34, h: 0.17, d: 0.015, y: c.h * 0.74, z: 0.38, color: PAL.amber });
      p.box({ w: c.w * 0.44, h: 0.025, d: 0.015, y: c.h * 0.26, z: 0.38, color: PAL.paper });
      p.box({ w: c.w + 0.04, h: 0.05, d: 0.74, y: c.h + 0.02, color: PAL.steelDark });
    });
  }

  // Manifest terminal and hazard board on the aft bulkhead.
  b.at({ x: 3.3, z: -14.4 }, (p) => {
    p.box({ w: 0.85, h: 0.95, d: 0.52, y: 0.475, color: PAL.panel });
    p.box({ w: 0.9, h: 0.08, d: 0.58, y: 0.04, color: PAL.hullDark });
    screenPanel(p, { y: 1.4, z: 0.16, rotX: -0.22, w: 0.7, h: 0.5, glow: PAL.glowAmber, screen: PAL.screenAmber });
    p.box({ w: 0.24, h: 0.32, d: 0.03, x: 0.54, y: 1.3, z: 0.26, rotZ: 0.1, color: PAL.paper });
    p.box({ w: 0.2, h: 0.03, d: 0.02, x: 0.54, y: 1.4, z: 0.28, color: PAL.hullDark });
  });
  b.box({ w: 1.3, h: 0.76, d: 0.03, x: -3.5, y: 1.72, z: -14.86, color: PAL.hullDark });
  for (let i = 0; i < 3; i++) {
    warningSign(b, { x: -3.92 + i * 0.42, y: 1.78, z: -14.83, s: 0.28 });
  }
  for (let i = 0; i < 3; i++) {
    b.box({ w: 1.0 - i * 0.16, h: 0.035, d: 0.012, x: -3.5, y: 1.5 - i * 0.07, z: -14.83, color: PAL.paper });
  }
  b.at({ x: -4.72, z: -14.2 }, (p) => {
    p.box({ w: 0.2, h: 0.9, d: 0.55, y: 0.6, color: PAL.redDark });
    for (const z of [-0.14, 0.14]) p.cyl({ r: 0.09, h: 0.46, x: 0.06, y: 0.48, z, color: PAL.redGlow });
  });

  // Pallet jack parked clear of the loading square.
  b.at({ x: -3.1, z: -10.4, rotY: -0.35 }, (p) => {
    for (const sx of [-1, 1]) {
      p.box({ w: 0.16, h: 0.1, d: 1.15, x: sx * 0.24, y: 0.07, z: 0.58, color: PAL.amber });
      p.cyl({ r: 0.075, h: 0.06, x: sx * 0.24, y: 0.075, z: 1.06, rotZ: HALF_PI, color: PAL.hazard });
    }
    p.box({ w: 0.66, h: 0.36, d: 0.42, y: 0.25, color: PAL.amber });
    p.box({ w: 0.7, h: 0.09, d: 0.46, y: 0.46, color: PAL.steelDark });
    p.cyl({ r: 0.07, h: 0.4, y: 0.65, color: PAL.steel });
    for (const sx of [-1, 1]) {
      p.box({ w: 0.09, h: 1.0, d: 0.09, x: sx * 0.26, y: 0.92, color: PAL.steelDark });
      p.cyl({ r: 0.11, h: 0.07, x: sx * 0.3, y: 0.11, z: -0.16, rotZ: HALF_PI, color: PAL.hazard });
    }
    p.box({ w: 0.62, h: 0.09, d: 0.1, y: 1.38, color: PAL.steelDark });
    p.at({ y: 1.3, z: -0.12, rotX: -0.45 }, (q) => {
      q.box({ w: 0.07, h: 0.8, d: 0.07, y: 0.4, color: PAL.hullDark });
      q.box({ w: 0.44, h: 0.07, d: 0.07, y: 0.8, color: PAL.hullDark });
      q.box({ w: 0.1, h: 0.12, d: 0.09, x: 0.14, y: 0.68, color: PAL.redGlow });
    });
    p.box({ w: 0.3, h: 0.14, d: 0.02, y: 0.3, z: 0.22, color: PAL.hazard });
  });

  // Spare pallets: two flat in the corner, one leaning on the east wall.
  pallet(b, { x: -4.1, z: -9.9 });
  pallet(b, { x: -4.1, y: 0.17, z: -9.9, rotY: 0.08 });
  pallet(b, { x: 4.52, y: 0.62, z: -10.95, rotZ: -1.35 });

  // A service hose snaking along the west bulkhead behind the spare
  // pallets, clipped up rather than routed neatly — a "lived-in" line
  // nobody's got round to properly stowing.
  pipeRun(b, {
    axis: "z",
    from: -13.7,
    to: -10.3,
    at: -4.72,
    y: 0.14,
    r: 0.045,
    color: PAL.rust,
    flangeStep: 2.4,
    flangeColor: PAL.steelDark,
  });

  // Netting coiled on the east wall.
  b.at({ x: 4.78, y: 1.3, z: -12.6, rotY: -HALF_PI }, (p) => {
    p.torus({ r: 0.3, tube: 0.09, color: PAL.hazard });
    p.torus({ r: 0.2, tube: 0.07, z: 0.04, color: PAL.hullDark });
    p.box({ w: 0.1, h: 0.16, d: 0.1, y: 0.38, color: PAL.steelDark });
  });

  // Overhead gantry parked against the aft bulkhead.
  b.box({ w: 9.4, h: 0.16, d: 0.22, x: 0, y: 2.42, z: -14.15, color: PAL.steelDark });
  for (const x of [-4.6, 4.6]) {
    b.box({ w: 0.25, h: 0.5, d: 0.3, x, y: 2.25, z: -14.15, color: PAL.steelDark });
  }
  for (const x of [-2.5, 0, 2.5]) {
    b.box({ w: 0.06, h: 0.3, d: 0.06, x, y: 2.6, z: -14.15, color: PAL.steel });
  }
  b.box({ w: 0.42, h: 0.26, d: 0.36, x: 1.9, y: 2.22, z: -14.15, color: PAL.amber });
  b.cyl({ r: 0.02, h: 0.62, x: 1.9, y: 1.88, z: -14.15, color: PAL.steelDark });
  b.box({ w: 0.09, h: 0.2, d: 0.08, x: 1.9, y: 1.5, z: -14.15, color: PAL.steelDark });
  b.torus({ r: 0.08, tube: 0.025, x: 1.9, y: 1.4, z: -14.15, color: PAL.steelDark });

  // Floor: a marked loading square, walkway guides, stencils, grates.
  hazardStripe(b, { x: -2.5, y: 0.012, z: -9.85, length: 2.6, segments: 7, thickness: 0.13 });
  hazardStripe(b, { x: -2.5, y: 0.012, z: -11.55, length: 2.6, segments: 7, thickness: 0.13 });
  hazardStripe(b, { x: -3.75, y: 0.012, z: -10.7, length: 1.7, segments: 5, thickness: 0.13, rotY: HALF_PI });
  hazardStripe(b, { x: -1.25, y: 0.012, z: -10.7, length: 1.7, segments: 5, thickness: 0.13, rotY: HALF_PI });
  for (const z of [-10.35, -11.0]) {
    for (const sx of [-1, 1]) {
      b.box({ w: 0.75, h: 0.02, d: 0.11, x: -2.5 + sx * 0.32, y: 0.013, z, rotY: sx * 0.6, color: PAL.amber });
    }
  }
  for (const x of [-1.55, 1.55]) {
    b.box({ w: 0.08, h: 0.02, d: 5.4, x, y: 0.012, z: -11.8, color: PAL.amber });
  }
  b.box({ w: 1.0, h: 0.02, d: 1.0, x: 2.0, y: 0.012, z: -11.0, color: PAL.hullDark });
  b.box({ w: 0.55, h: 0.025, d: 0.55, x: 2.0, y: 0.015, z: -11.0, rotY: Math.PI / 4, color: PAL.amber });
  b.box({ w: 0.3, h: 0.03, d: 0.3, x: 2.0, y: 0.018, z: -11.0, rotY: Math.PI / 4, color: PAL.hazard });
  for (const [x, z] of [[-4.0, -11.5], [4.1, -14.2]]) {
    b.box({ w: 0.9, h: 0.02, d: 0.9, x, y: 0.012, z, color: PAL.hullDark });
    for (let i = 0; i < 7; i++) {
      b.box({ w: 0.84, h: 0.025, d: 0.06, x, y: 0.016, z: z - 0.36 + i * 0.12, color: PAL.steelDark });
    }
  }
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    b.box({ w: 0.6, h: 0.02, d: 0.1, x: sx * 4.3, y: 0.012, z: -12 + sz * 2.6, rotY: sx * sz * 0.7, color: PAL.amber });
  }

  hullRibs(b, {
    axis: "z",
    from: -14.2,
    to: -9.6,
    at: -4.85,
    skip: (z) => z < -13.9,
  });
  hullRibs(b, {
    axis: "z",
    from: -14.2,
    to: -9.6,
    at: 4.85,
    skip: (z) => (z > -13.0 && z < -12.2) || (z > -11.5 && z < -10.2),
  });
  hullRibs(b, { axis: "x", from: -4.2, to: 4.2, at: -9.15, skip: (x) => Math.abs(x) < 1.4, stringer: false });
  ceilingStrip(b, { axis: "z", x: -4.72, z: -12.0, length: 4.4 });
  ceilingStrip(b, { axis: "z", x: 4.72, z: -12.0, length: 4.4 });
}

function populate(b) {
  buildCockpit(b);
  buildCommonArea(b);
  buildEngineRoom(b);
  buildCargoBay(b);
  doorHeaders(b);
}

export function buildDecorations(scene) {
  const builder = new PropBuilder();
  populate(builder);
  return builder.commit(scene);
}

// World-space AABB of every decoration primitive, without touching a
// scene. Used by test/decorations.test.mjs to prove the set dressing keeps
// out of the corridors, the doorways and the characters' spawn points.
export function decorationBounds() {
  const builder = new PropBuilder();
  populate(builder);
  return builder.bounds;
}
