// Headless verification for this pass's two features: furniture collision
// and the richer NPC activity repertoire. Throwaway script, same
// convention as test/playthrough.mjs and test/feature-pass-verify.mjs: not
// part of `npm test` (Playwright isn't a devDependency), run manually with:
//
//   node test/collision-behavior-verify.mjs

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
const SHOT_DIR = process.env.LS_SHOT_DIR || "/home/nickx/.openclaw/workspace/scratch";

const consoleErrors = [];
const pageErrors = [];
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

async function waitMs(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function shoot(page, name, { hideHud = true } = {}) {
  await waitMs(300);
  if (hideHud) {
    await page.evaluate(() => {
      const hint = document.getElementById("hint");
      if (hint) hint.style.display = "none";
    });
  }
  await waitMs(150);
  const file = path.join(SHOT_DIR, name);
  await page.screenshot({ path: file });
  console.log(`  ok - saved ${file}`);
}

// --- Movement helpers, same wall-clamp technique as test/playthrough.mjs ---

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

async function walkTo(page, x, z) {
  const here = await playerPos(page);
  await walk(page, x >= here.x ? "KeyD" : "KeyA", x);
  await walk(page, z >= here.z ? "KeyS" : "KeyW", z);
}

async function promptText(id, page) {
  return page.evaluate((elId) => {
    const el = document.getElementById(elId);
    return el.hidden ? null : el.textContent;
  }, id);
}

async function isDialogueOpen(page) {
  return page.evaluate(() => !document.getElementById("dialogue-panel").hidden);
}

async function speakerText(page) {
  return page.evaluate(() => document.getElementById("dialogue-speaker").textContent);
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

async function approachLiveCrew(page, memberId, name, attempts = 6) {
  for (let i = 0; i < attempts; i++) {
    const pos = await page.evaluate(
      (id) => {
        const m = window.__lsCrew.find((c) => c.id === id);
        return { x: m.curX, z: m.curZ };
      },
      memberId
    );
    await walkTo(page, pos.x, pos.z);
    if (await waitForNearbyCrew(page, name, 1500)) return true;
  }
  return false;
}

// Room-to-room routes below deliberately stay off the naive walkTo's
// diagonal-then-axis approach: crossing between rooms only works by
// threading each doorway's corridor band (see js/ship.js's CORRIDORS), so
// every leg here moves one axis at a time, timed to pass through a
// corridor while the cross-axis coordinate is still inside that band.
async function goHubToCockpitPilotSeat(page) {
  await walkTo(page, 1, 0); // hub: Common Area, on the z=0 corridor spine
  await walk(page, "KeyA", -11.7); // west through the Fwd Corridor (z=0 is within its [-1,1] band)
  await walk(page, "KeyS", -1.5); // south to the pilot seat's z
}

async function main() {
  console.log("Starting static server...");
  const server = spawn("python3", ["-m", "http.server", String(PORT)], {
    cwd: repoRoot,
    stdio: "ignore",
  });
  await waitMs(500);

  const browser = await chromium.launch();
  const page = await browser.newPage();
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });
  page.on("pageerror", (err) => pageErrors.push(String(err)));

  try {
    section("Boot");
    await page.goto(BASE_URL, { waitUntil: "load" });
    await page.waitForSelector("#scene-container canvas");
    await waitMs(1000);
    check(consoleErrors.length === 0, `zero console errors on boot (got ${consoleErrors.length})`);
    check(pageErrors.length === 0, `zero uncaught page errors on boot (got ${pageErrors.length})`);

    // --- Furniture collision: second confirmation first, the Engine Room --
    // reactor at (14, 0) — a pure excursion along the z=0 corridor spine
    // from spawn (1, 0), so getting there and back never has to thread a
    // doorway off-axis.
    section("Furniture collision — the Engine Room reactor");
    await walk(page, "KeyD", 12);
    const reachedReactorCenter = await walk(page, "KeyD", 14.0);
    const reactorBlockedPos = await playerPos(page);
    check(!reachedReactorCenter, "walking straight at the reactor's center did not reach it");
    check(
      reactorBlockedPos.x < 12.6,
      `player was stopped before the reactor core (x=${reactorBlockedPos.x.toFixed(2)}, reactor center x=14, r=1.3)`
    );
    await walk(page, "KeyA", 1); // back to the hub, still along z=0

    // --- Furniture collision: walk straight into the Common Area mess table
    section("Furniture collision — walking into the Common Area mess table");
    // The mess table + bench collider is x[-2.5,-0.6] z[2.85,3.95] (see
    // ship.js's PROP_COLLIDERS) — approach along x first, then stop just
    // short of it for the "before" shot.
    await walk(page, "KeyA", -1.55);
    await walk(page, "KeyS", 2.0);
    const beforePos = await playerPos(page);
    check(beforePos.z < 2.85, `player stopped short of the table for the "before" shot (z=${beforePos.z.toFixed(2)})`);
    await shoot(page, "ls_collision_before.png");

    // Now push straight at and through the table's full depth (3.95 -> well
    // past it at 6.0). If collision works, the player never gets there.
    const reachedFarSide = await walk(page, "KeyS", 6.0);
    const blockedPos = await playerPos(page);
    check(!reachedFarSide, "walking straight at the table did not reach the far side (6.0m south of spawn)");
    check(
      blockedPos.z < 3.0,
      `player was physically stopped by the table, not standing inside/past it (z=${blockedPos.z.toFixed(2)}, table spans z[2.85, 3.95])`
    );
    await shoot(page, "ls_collision_blocked.png");

    // --- NPC activity repertoire: catch a crew member mid stationary
    // activity, confirm it visually and that "Press E to talk" still works
    // on them mid-activity. The player is already parked right next to the
    // mess stool from the collision check above, and Dessa and Marcus both
    // sit there periodically — wait for either, which needs no further
    // cross-room travel at all. Falls back to Kaia's pilot's seat (a
    // longer, room-crossing trip, via the axis-at-a-time route above) only
    // if neither shows up in the first minute.
    section("NPC activity repertoire — catching a stationary activity pose");
    const SIT_SPOT = { x: -1.5, z: 2.28 };
    let capturedMember = null;

    async function tryCapture(id, name, spot) {
      await walkTo(page, spot.x, spot.z);
      const stillActive = await page.evaluate((mid) => {
        const m = window.__lsCrew.find((c) => c.id === mid);
        return m && ["sit", "sit_read", "lean", "clean", "sleep"].includes(m.pose);
      }, id);
      if (!stillActive) return false;
      capturedMember = { id, name };
      console.log(`  info - caught ${name} mid-activity at (${spot.x}, ${spot.z})`);
      await shoot(page, "ls_activity_pose.png");
      return true;
    }

    let waited = 0;
    while (waited < 60000 && !capturedMember) {
      const sitter = await page.evaluate(() => {
        const m = window.__lsCrew.find((c) => (c.id === "dessa" || c.id === "marcus") && c.pose === "sit");
        return m ? { id: m.id, name: m.name } : null;
      });
      if (sitter && (await tryCapture(sitter.id, sitter.name, SIT_SPOT))) break;
      await waitMs(300);
      waited += 300;
    }

    if (!capturedMember) {
      console.log("  info - neither Dessa nor Marcus sat within 60s, falling back to Kaia's pilot seat");
      let kaiaWaited = 0;
      while (kaiaWaited < 90000 && !capturedMember) {
        const kaiaSitting = await page.evaluate(
          () => window.__lsCrew.find((c) => c.id === "kaia")?.pose === "sit"
        );
        if (kaiaSitting) {
          await goHubToCockpitPilotSeat(page);
          await tryCapture("kaia", "Kaia Brenn", { x: -11.7, z: -1.5 });
        }
        await waitMs(300);
        kaiaWaited += 300;
      }
    }
    check(!!capturedMember, "caught a crew member's stationary activity pose in a screenshot");

    if (capturedMember) {
      section("NPC activity repertoire — 'Press E to talk' still works mid-activity");
      const caughtUp = await approachLiveCrew(page, capturedMember.id, capturedMember.name.split(" ")[0]);
      check(caughtUp, `walked up to ${capturedMember.name} and got the "Press E to talk" prompt`);
      await page.keyboard.press("KeyE");
      await waitMs(200);
      check(await isDialogueOpen(page), `dialogue opens for ${capturedMember.name} while mid-activity or shortly after`);
      check((await speakerText(page)).includes(capturedMember.name), `speaker line correctly names ${capturedMember.name}`);
      await page.keyboard.press("Escape");
      await waitMs(150);
      check(!(await isDialogueOpen(page)), "dialogue closes");
    }

    // --- Extended run: let the sim keep going, watching for zero errors --
    // and opportunistically catching the rare stumble or a sleep cycle.
    // Neither is required to actually land within this window.
    section("Extended run — zero errors, opportunistic stumble/sleep watch");
    let sawStumble = false;
    let sawSleep = false;
    const extendedDeadline = Date.now() + 30000;
    while (Date.now() < extendedDeadline) {
      const poses = await page.evaluate(() => window.__lsCrew.map((c) => c.pose));
      if (poses.includes("stumble")) sawStumble = true;
      if (poses.includes("sleep")) sawSleep = true;
      await waitMs(500);
    }
    console.log(`  info - stumble observed: ${sawStumble}, sleep observed: ${sawSleep}`);
    check(consoleErrors.length === 0, `zero console errors across the whole extended run (got ${consoleErrors.length})`);
    check(pageErrors.length === 0, `zero uncaught page errors across the whole extended run (got ${pageErrors.length})`);
    if (consoleErrors.length) console.log("Console errors:", consoleErrors);
    if (pageErrors.length) console.log("Page errors:", pageErrors);
  } finally {
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
