// Sol system layout data (js/solar-system.js): real order and relative
// distance ratios, preserved through one documented linear scale factor.
// The THREE mesh builders aren't tested directly, same convention used
// elsewhere for THREE-side code (see js/decorations.js).
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  PLANETS,
  DISTANCE_UNITS_PER_MILLION_KM,
  SUN_RADIUS,
  SYSTEM_END,
  planetDistance,
  planetPosition,
} from "../js/solar-system.js";

test("all 8 planets are present in real Sun-outward order", () => {
  assert.deepEqual(
    PLANETS.map((p) => p.name),
    ["Mercury", "Venus", "Earth", "Mars", "Jupiter", "Saturn", "Uranus", "Neptune"]
  );
});

test("planetDistance applies the single documented linear scale to real AU distances", () => {
  for (const planet of PLANETS) {
    assert.equal(planetDistance(planet), planet.distanceMillionKm * DISTANCE_UNITS_PER_MILLION_KM);
  }
});

test("scaled distances preserve every planet's real distance ratio to every other planet", () => {
  for (const a of PLANETS) {
    for (const b of PLANETS) {
      if (a === b) continue;
      const realRatio = a.distanceMillionKm / b.distanceMillionKm;
      const scaledRatio = planetDistance(a) / planetDistance(b);
      assert.ok(Math.abs(realRatio - scaledRatio) < 1e-9, `${a.name}/${b.name} ratio should be preserved`);
    }
  }
});

test("planets are laid out strictly outward along +X with increasing distance", () => {
  let last = 0;
  for (const planet of PLANETS) {
    const pos = planetPosition(planet);
    assert.equal(pos.y, 0);
    assert.equal(pos.z, 0);
    assert.ok(pos.x > last, `${planet.name} should be farther out than the previous planet`);
    last = pos.x;
  }
});

test("SYSTEM_END is Neptune's scaled distance, the far edge of the flight corridor", () => {
  assert.equal(SYSTEM_END, planetDistance(PLANETS[PLANETS.length - 1]));
});

test("every planet radius is smaller than the Sun's, so the Sun reads as the biggest body", () => {
  for (const planet of PLANETS) {
    assert.ok(planet.radius < SUN_RADIUS, `${planet.name}'s radius should be smaller than the Sun's`);
  }
});
