// Headless verification for the touch-controls pass (js/touch-controls.js,
// css/touch-controls.css). Throwaway script, same convention as
// test/playthrough.mjs and test/feature-pass-verify.mjs: not part of
// `npm test` (Playwright isn't a devDependency), run manually with:
//
//   node test/touch-controls-verify.mjs

import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const PLAYWRIGHT_PATHS = [
  "/home/nickx/.local/share/bobbie-tools/node_modules/playwright",
  "/home/nickx/.npm/_npx/705bc6b22212b352/node_modules/playwright",
];
function loadPlaywright() {
  for (const candidate of PLAYWRIGHT_PATHS) {
    if (fs.existsSync(candidate)) return require(candidate);
  }
  throw new Error(`No cached playwright found in:\n  ${PLAYWRIGHT_PATHS.join("\n  ")}`);
}
const { chromium } = loadPlaywright();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const PORT = 8423;
const BASE_URL = `http://localhost:${PORT}/`;
const SHOT_DIR = path.join(repoRoot, "tmp");
fs.mkdirSync(SHOT_DIR, { recursive: true });

let failures = 0;
function check(condition, message) {
  if (condition) console.log(`  ok - ${message}`);
  else {
    failures += 1;
    console.log(`  FAIL - ${message}`);
  }
}
function section(title) {
  console.log(`\n== ${title} ==`);
}
function waitMs(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// --- synthetic touch dispatch --------------------------------------------
// Constructs real Touch/TouchEvent objects in-page (supported by Chromium
// when the browser context has hasTouch:true) and dispatches them on the
// same targets js/touch-controls.js itself listens on: touchstart on the
// stick's own .tc-base element, touchmove/touchend/touchcancel on window.

async function touchOnElement(page, selector, type, x, y, id) {
  await page.evaluate(
    ({ selector, type, x, y, id }) => {
      const el = document.querySelector(selector);
      const touch = new Touch({ identifier: id, target: el, clientX: x, clientY: y });
      const ended = type === "touchend" || type === "touchcancel";
      el.dispatchEvent(
        new TouchEvent(type, {
          bubbles: true,
          cancelable: true,
          touches: ended ? [] : [touch],
          targetTouches: ended ? [] : [touch],
          changedTouches: [touch],
        })
      );
    },
    { selector, type, x, y, id }
  );
}

async function touchOnWindow(page, type, x, y, id) {
  await page.evaluate(
    ({ type, x, y, id }) => {
      const touch = new Touch({ identifier: id, target: window, clientX: x, clientY: y });
      const ended = type === "touchend" || type === "touchcancel";
      window.dispatchEvent(
        new TouchEvent(type, {
          bubbles: true,
          cancelable: true,
          touches: ended ? [] : [touch],
          targetTouches: ended ? [] : [touch],
          changedTouches: [touch],
        })
      );
    },
    { type, x, y, id }
  );
}

async function stickCenter(page, selector) {
  return page.evaluate((sel) => {
    const rect = document.querySelector(sel).getBoundingClientRect();
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2, r: rect.width / 2 };
  }, selector);
}

// Push a stick in a screen direction (dx, dy in [-1, 1]) and hold it there
// via one touchstart (identifier 1) — mirrors a finger landing on the base
// already offset from center, which is exactly what touch-controls.js's
// `start()` handler treats as an immediate directional input.
async function pushStick(page, baseSelector, dx, dy) {
  const { x, y, r } = await stickCenter(page, baseSelector);
  const px = x + dx * r * 0.8;
  const py = y + dy * r * 0.8;
  await touchOnElement(page, baseSelector, "touchstart", px, py, 1);
  return { x: px, y: py };
}

async function releaseStick(page, point) {
  await touchOnWindow(page, "touchend", point.x, point.y, 1);
}

// --- keyboard-driven helpers, same wall-clamp technique as ---------------
// test/feature-pass-verify.mjs, used only to get set up (walk to the
// pilot's seat) — proves keyboard input still works inside a touch context.

const AXIS_OF = { KeyW: "z", KeyS: "z", KeyA: "x", KeyD: "x" };
const SIGN_OF = { KeyW: -1, KeyS: 1, KeyA: -1, KeyD: 1 };
const ARRIVAL_TOLERANCE = 0.7;

async function playerPos(page) {
  return page.evaluate(() => ({ x: window.__lsPlayer.x, z: window.__lsPlayer.z }));
}

async function walk(page, key, target) {
  const axis = AXIS_OF[key];
  const sign = SIGN_OF[key];
  await page.evaluate(() => {
    window.__lsWalk = null;
  });
  await page.keyboard.down(key);
  try {
    await page.waitForFunction(
      ({ axis, sign, target }) => {
        const here = window.__lsPlayer[axis];
        const state = window.__lsWalk || (window.__lsWalk = { last: here, stalled: 0 });
        if (Math.abs(here - state.last) < 0.01) state.stalled += 1;
        else {
          state.stalled = 0;
          state.last = here;
        }
        return sign * (here - target) >= 0 || state.stalled > 30;
      },
      { axis, sign, target },
      { polling: "raf", timeout: 60000 }
    );
  } finally {
    await page.keyboard.up(key);
  }
  const here = (await playerPos(page))[axis];
  return sign * (here - target) >= -ARRIVAL_TOLERANCE;
}
async function clamp(page, key) {
  await walk(page, key, SIGN_OF[key] * 999);
}
async function goCommonToKaia(page) {
  await walk(page, "KeyD", 2.5);
  await clamp(page, "KeyS");
  await clamp(page, "KeyD");
  await walk(page, "KeyW", 0.35);
  await walk(page, "KeyA", -10);
}
async function goCockpitToSpineX(page, targetX) {
  await clamp(page, "KeyA");
  await clamp(page, "KeyS");
  await walk(page, "KeyW", 0.35);
  await walk(page, targetX >= -13.6 ? "KeyD" : "KeyA", targetX);
}
async function promptText(id, page) {
  return page.evaluate((elId) => {
    const el = document.getElementById(elId);
    return el.hidden ? null : el.textContent;
  }, id);
}
async function waitForNearbyCrew(page, name, timeoutMs = 4000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const text = await promptText("interact-prompt", page);
    if (text && text.includes(name)) return true;
    await waitMs(100);
  }
  return false;
}
async function isDialogueOpen(page) {
  return page.evaluate(() => !document.getElementById("dialogue-panel").hidden);
}
async function speakerText(page) {
  return page.evaluate(() => document.getElementById("dialogue-speaker").textContent);
}

async function shoot(page, name) {
  await waitMs(200);
  const file = path.join(SHOT_DIR, name);
  await page.screenshot({ path: file });
  console.log(`  ok - saved ${file}`);
  return file;
}

async function main() {
  console.log("Starting static server...");
  const server = spawn("python3", ["-m", "http.server", String(PORT)], {
    cwd: repoRoot,
    stdio: "ignore",
  });
  await waitMs(500);

  const browser = await chromium.launch();

  // ---- Pass 1: touch-emulated phone context -------------------------------
  const touchCtx = await browser.newContext({
    hasTouch: true,
    isMobile: true,
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
  });
  const page = await touchCtx.newPage();
  const consoleErrors = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });
  page.on("pageerror", (err) => consoleErrors.push(String(err)));

  try {
    section("Boot (touch context: hasTouch, isMobile, 390x844@3x)");
    await page.goto(BASE_URL, { waitUntil: "load" });
    await page.waitForSelector("#scene-container canvas");
    await page.waitForSelector("#touch-controls", { timeout: 3000 });
    check(true, "#touch-controls was injected on a touch-capable context");
    check(await page.evaluate(() => document.getElementById("hint").hidden), "keyboard hint is hidden on touch");

    const visibility = await page.evaluate(() => ({
      move: getComputedStyle(document.getElementById("tc-move")).display,
      interact: getComputedStyle(document.getElementById("tc-interact")).display,
      throttle: getComputedStyle(document.getElementById("tc-throttle")).display,
      heading: getComputedStyle(document.getElementById("tc-heading")).display,
    }));
    check(visibility.move !== "none" && visibility.interact !== "none", "exploration controls (joystick + interact) are visible before flight mode");
    check(visibility.throttle === "none" && visibility.heading === "none", "flight controls are hidden before flight mode");

    section("Touch movement — joystick pushed forward toward Dessa");
    // Dessa spawns at (1, -3), directly ahead of the player's (1, 0) start,
    // well inside the Common Area (no need to thread the narrower Cargo Bay
    // doorway). Poll tightly with no screenshot mid-hold — a real Playwright
    // round trip is slow enough that a stick held across a screenshot call
    // would coast the player straight into a doorway and stall on the
    // collision there, which is a test-timing artifact, not a touch-layer bug.
    const before = await playerPos(page);
    console.log(`  info - player start position (${before.x}, ${before.z})`);
    const point = await pushStick(page, "#tc-move .tc-base", 0, -1); // push "up" = KeyW = forward (-Z)
    let stalled = 0;
    let last = before.z;
    let foundCrew = false;
    const deadline = Date.now() + 6000;
    while (Date.now() < deadline) {
      const pos = await playerPos(page);
      if (Math.abs(pos.z - last) < 0.01) stalled += 1;
      else {
        stalled = 0;
        last = pos.z;
      }
      const txt = await promptText("interact-prompt", page);
      if (txt && txt.includes("Dessa")) {
        foundCrew = true;
        break;
      }
      if (stalled > 15) break;
      await waitMs(40);
    }
    await releaseStick(page, point);
    const midMove = await playerPos(page);
    check(midMove.z < before.z - 0.3, `joystick-forward moved the player toward -Z (z went from ${before.z} to ${midMove.z.toFixed(2)})`);
    await shoot(page, "touch_joystick_forward.png");

    await waitMs(150);
    const afterRelease1 = await playerPos(page);
    await waitMs(300);
    const afterRelease2 = await playerPos(page);
    check(
      Math.abs(afterRelease2.z - afterRelease1.z) < 0.05,
      `releasing the joystick stops movement (z stayed ~${afterRelease1.z.toFixed(2)} after release)`
    );

    section("Touch interact — tap to open dialogue with Dessa");
    check(foundCrew, `touch-driven movement reached Dessa (interact-prompt shows her name; text="${await promptText("interact-prompt", page)}")`);

    await touchOnElement(page, "#tc-interact", "touchstart", 0, 0, 2);
    await touchOnElement(page, "#tc-interact", "touchend", 0, 0, 2);
    await waitMs(200);
    check(await isDialogueOpen(page), "tapping the interact button opened the dialogue panel");
    check((await speakerText(page)).includes("Dessa"), `dialogue speaker names Dessa (got "${await speakerText(page)}")`);
    await shoot(page, "touch_interact_dialogue.png");

    section("Dialogue advance via tap");
    const before1stChoice = await page.evaluate(() => document.getElementById("dialogue-line").textContent);
    const choiceCount = await page.locator("#dialogue-choices li").count();
    check(choiceCount > 0, `dialogue offers ${choiceCount} choice(s) to tap`);
    if (choiceCount > 0) {
      await page.locator("#dialogue-choices li").first().tap();
      await waitMs(200);
      const stillOpenOrChanged =
        (await isDialogueOpen(page)) === false ||
        (await page.evaluate(() => document.getElementById("dialogue-line").textContent)) !== before1stChoice;
      check(stillOpenOrChanged, "tapping a dialogue choice advanced/closed the conversation, same as a click would");
    }
    if (await isDialogueOpen(page)) {
      await page.keyboard.press("Escape");
      await waitMs(150);
    }

    section("Flight mode — reach the pilot's seat (keyboard, to prove keyboard still works inside a touch context)");
    await goCommonToKaia(page);
    await goCockpitToSpineX(page, -11.7);
    await walk(page, "KeyW", -1.5);
    const actionText = await promptText("action-prompt", page);
    check(!!actionText && actionText.includes("sit in the pilot's seat"), `action prompt reads "${actionText}"`);
    await page.keyboard.press("KeyF");
    await waitMs(300);
    const flightHudVisible = await page.evaluate(() => !document.getElementById("flight-hud").hidden);
    check(flightHudVisible, "flight HUD is visible after sitting in the pilot's seat");

    const flightVisibility = await page.evaluate(() => ({
      move: getComputedStyle(document.getElementById("tc-move")).display,
      throttle: getComputedStyle(document.getElementById("tc-throttle")).display,
      heading: getComputedStyle(document.getElementById("tc-heading")).display,
    }));
    check(flightVisibility.move === "none", "exploration joystick hides once flight mode is entered");
    check(flightVisibility.throttle !== "none" && flightVisibility.heading !== "none", "flight throttle + heading sticks appear once flight mode is entered");

    section("Touch flight throttle");
    const throttleBefore = await page.evaluate(() => window.__lsFlight.throttle);
    const tPoint = await pushStick(page, "#tc-throttle .tc-base", 0, -1); // push "up" = KeyW = thrustUp
    await waitMs(600);
    const throttleDuring = await page.evaluate(() => window.__lsFlight.throttle);
    await shoot(page, "touch_flight_throttle.png");
    check(throttleDuring > throttleBefore, `touch throttle stick increased throttle (${throttleBefore.toFixed(3)} -> ${throttleDuring.toFixed(3)})`);
    await releaseStick(page, tPoint);

    section("Touch flight heading");
    const yawBefore = await page.evaluate(() => window.__lsFlight.state.yaw);
    // push right = ArrowRight = yawLeft (js/flight.js's KEY_MAP swaps
    // Left/Right so the turn matches what's on screen), so yaw decreases.
    const hPoint = await pushStick(page, "#tc-heading .tc-base", 1, 0);
    await waitMs(600);
    const yawDuring = await page.evaluate(() => window.__lsFlight.state.yaw);
    check(yawDuring < yawBefore, `touch heading stick changed yaw (${yawBefore.toFixed(3)} -> ${yawDuring.toFixed(3)})`);
    await releaseStick(page, hPoint);

    section("Exit flight mode and confirm exploration controls return");
    await page.keyboard.press("KeyF");
    await waitMs(300);
    const backVisibility = await page.evaluate(() => ({
      move: getComputedStyle(document.getElementById("tc-move")).display,
      throttle: getComputedStyle(document.getElementById("tc-throttle")).display,
    }));
    check(backVisibility.move !== "none" && backVisibility.throttle === "none", "leaving flight mode swaps the overlay back to exploration controls");

    section("Console/page error check (touch pass)");
    check(consoleErrors.length === 0, `zero console/page errors across the touch pass (got ${consoleErrors.length})`);
    if (consoleErrors.length) console.log(consoleErrors);
  } finally {
    await touchCtx.close();
  }

  // ---- Pass 2: plain desktop context, no touch/mobile emulation ----------
  section("Desktop pass — confirm keyboard/mouse still work and no touch UI appears");
  const desktopCtx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const dpage = await desktopCtx.newPage();
  const desktopErrors = [];
  dpage.on("console", (msg) => {
    if (msg.type() === "error") desktopErrors.push(msg.text());
  });
  dpage.on("pageerror", (err) => desktopErrors.push(String(err)));
  try {
    await dpage.goto(BASE_URL, { waitUntil: "load" });
    await dpage.waitForSelector("#scene-container canvas");
    await waitMs(500);
    const hasTouchUI = await dpage.evaluate(() => !!document.getElementById("touch-controls"));
    check(!hasTouchUI, "no #touch-controls element is injected on a non-touch desktop context");

    const before = await playerPos(dpage);
    await walk(dpage, "KeyD", before.x + 1.5);
    const afterKey = await playerPos(dpage);
    check(afterKey.x > before.x + 0.5, `desktop keyboard (KeyD) still moves the player (x ${before.x} -> ${afterKey.x.toFixed(2)})`);

    await goCommonToKaia(dpage);
    await waitForNearbyCrew(dpage, "Kaia");
    await dpage.keyboard.press("KeyE");
    await waitMs(200);
    check(await isDialogueOpen(dpage), "keyboard interact (KeyE) still opens dialogue on desktop");
    const choiceCount = await dpage.locator("#dialogue-choices li").count();
    if (choiceCount > 0) {
      const beforeLine = await dpage.evaluate(() => document.getElementById("dialogue-line").textContent);
      await dpage.locator("#dialogue-choices li").first().click();
      await waitMs(200);
      const changed =
        (await isDialogueOpen(dpage)) === false ||
        (await dpage.evaluate(() => document.getElementById("dialogue-line").textContent)) !== beforeLine;
      check(changed, "mouse click on a dialogue choice still advances/closes the conversation on desktop");
    }
    check(desktopErrors.length === 0, `zero console/page errors on the desktop pass (got ${desktopErrors.length})`);
    if (desktopErrors.length) console.log(desktopErrors);
  } finally {
    await desktopCtx.close();
    await browser.close();
    server.kill();
  }

  console.log(`\n${failures === 0 ? "ALL CHECKS PASSED" : `${failures} CHECK(S) FAILED`}`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
