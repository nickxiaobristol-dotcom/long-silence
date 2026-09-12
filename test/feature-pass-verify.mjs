// Headless verification for this pass's four features (walk animation,
// autonomous NPC movement, object interaction, dialogue speech bubbles).
// Throwaway script, same convention as test/playthrough.mjs: not part of
// `npm test` (Playwright isn't a devDependency), run manually with:
//
//   node test/feature-pass-verify.mjs

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
const PORT = 8422;
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
const SPINE_AIM = 0.35;

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

async function walkTo(page, x, z) {
  const here = await playerPos(page);
  await walk(page, x >= here.x ? "KeyD" : "KeyA", x);
  await walk(page, z >= here.z ? "KeyS" : "KeyW", z);
}

async function clampToCommonNE(page) {
  await walk(page, "KeyD", 2.5);
  await clamp(page, "KeyS");
  await clamp(page, "KeyD");
}

async function goCommonToKaia(page) {
  await clampToCommonNE(page);
  await walk(page, "KeyW", SPINE_AIM);
  await walk(page, "KeyA", -10);
}

async function goCommonToCorwin(page) {
  await clampToCommonNE(page);
  await walk(page, "KeyW", SPINE_AIM);
  await walk(page, "KeyD", 12);
}

async function goCockpitToSpineX(page, targetX) {
  await clamp(page, "KeyA");
  await clamp(page, "KeyS");
  await walk(page, "KeyW", SPINE_AIM);
  await walk(page, targetX >= -13.6 ? "KeyD" : "KeyA", targetX);
}

async function goEngineToSpineX(page, targetX) {
  await clamp(page, "KeyD");
  await clamp(page, "KeyS");
  await walk(page, "KeyW", SPINE_AIM);
  await walk(page, targetX >= 15.6 ? "KeyD" : "KeyA", targetX);
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

async function interact(page) {
  await page.keyboard.press("KeyE");
  await waitMs(150);
}

async function isDialogueOpen(page) {
  return page.evaluate(() => !document.getElementById("dialogue-panel").hidden);
}

async function speakerText(page) {
  return page.evaluate(() => document.getElementById("dialogue-speaker").textContent);
}

// Corwin walks noticeably faster relative to his 4m waypoint hop than the
// player does closing that same gap, so a couple of corrective walkTo
// passes toward his live position is enough to actually catch up to him.
async function approachLiveCrew(page, memberId, name, attempts = 5) {
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

    // --- Feature 2 setup: capture NPC "before" position early, since ------
    // wandering starts immediately on boot.
    section("Feature 2: autonomous NPC movement — 'before' snapshot");
    const corwinBefore = await page.evaluate(() => {
      const m = window.__lsCrew.find((c) => c.id === "corwin");
      return { x: m.x, z: m.z, curX: m.curX, curZ: m.curZ };
    });
    console.log(`  info - Corwin's position shortly after boot: (${corwinBefore.curX.toFixed(2)}, ${corwinBefore.curZ.toFixed(2)}), spawn is (${corwinBefore.x}, ${corwinBefore.z})`);
    await goCommonToCorwin(page);
    await shoot(page, "ls_npc_before.png");

    // --- Feature 1: walking animation --------------------------------------
    section("Feature 1: walking animation — mid-stride vs idle");
    await page.keyboard.down("KeyD");
    await waitMs(700);
    const midStride = await page.evaluate(() => {
      const legs = window.__lsPlayer.marker.userData.legs;
      return { l0: legs[0].rotation.x, l1: legs[1].rotation.x };
    });
    await shoot(page, "ls_walkcycle_mid.png", { hideHud: false });
    await page.keyboard.up("KeyD");
    check(Math.abs(midStride.l0) > 0.05, `left leg swings while moving (rotation.x=${midStride.l0.toFixed(3)})`);
    check(Math.abs(midStride.l1) > 0.05, `right leg swings while moving (rotation.x=${midStride.l1.toFixed(3)})`);
    check(Math.sign(midStride.l0) !== Math.sign(midStride.l1), "legs swing in opposing phase");

    await waitMs(300);
    const idlePose = await page.evaluate(() => {
      const legs = window.__lsPlayer.marker.userData.legs;
      return { l0: legs[0].rotation.x, l1: legs[1].rotation.x };
    });
    await shoot(page, "ls_walkcycle_idle.png", { hideHud: false });
    check(idlePose.l0 === 0 && idlePose.l1 === 0, `legs reset to neutral idle pose (${idlePose.l0}, ${idlePose.l1})`);

    // --- Feature 2: wait for autonomous movement, then confirm + screenshot
    section("Feature 2: autonomous NPC movement — waiting for displacement");
    let corwinAfter = corwinBefore;
    const deadline = Date.now() + 20000;
    while (Date.now() < deadline) {
      corwinAfter = await page.evaluate(() => {
        const m = window.__lsCrew.find((c) => c.id === "corwin");
        return { x: m.x, z: m.z, curX: m.curX, curZ: m.curZ };
      });
      const disp = Math.hypot(corwinAfter.curX - corwinAfter.x, corwinAfter.curZ - corwinAfter.z);
      if (disp > 1.0) break;
      await waitMs(500);
    }
    const finalDisp = Math.hypot(corwinAfter.curX - corwinAfter.x, corwinAfter.curZ - corwinAfter.z);
    check(finalDisp > 1.0, `Corwin moved ${finalDisp.toFixed(2)}m from his spawn point (${corwinAfter.x}, ${corwinAfter.z}) autonomously`);
    await shoot(page, "ls_npc_after.png");

    // --- Feature 2b: "Press E to talk" still works against live position --
    section("Feature 2b: proximity interaction tracks Corwin's live (moving) position");
    const caughtUp = await approachLiveCrew(page, "corwin", "Corwin");
    check(caughtUp, "walked up to Corwin's current (moved) position and got the 'Press E to talk' prompt");
    await interact(page);
    check(await isDialogueOpen(page), "dialogue opens for Corwin while he's off his spawn point");
    check((await speakerText(page)).includes("Corwin Talus"), "speaker line correctly names Corwin Talus");
    await page.keyboard.press("Escape");
    await waitMs(150);
    check(!(await isDialogueOpen(page)), "dialogue closes");

    // --- Feature 4: dialogue speech bubble ----------------------------------
    section("Feature 4: dialogue speech bubble");
    await interact(page);
    check(await isDialogueOpen(page), "dialogue reopened for the speech-bubble check");
    const bubble = await page.evaluate(() => {
      const el = document.getElementById("speech-bubble");
      const rect = el.getBoundingClientRect();
      return { hidden: el.hidden, width: rect.width, height: rect.height, top: rect.top, left: rect.left };
    });
    check(!bubble.hidden, "speech bubble is shown while dialogue is open");
    check(bubble.width > 0 && bubble.height > 0, `speech bubble has visible dimensions (${bubble.width}x${bubble.height})`);
    check(bubble.top >= 0, `speech bubble is positioned within the viewport (top=${bubble.top.toFixed(0)})`);
    await shoot(page, "ls_speech_bubble.png", { hideHud: false });
    await page.keyboard.press("Escape");
    await waitMs(150);
    const bubbleAfterClose = await page.evaluate(() => document.getElementById("speech-bubble").hidden);
    check(bubbleAfterClose, "speech bubble hides again once dialogue closes");

    // --- Feature 3: object interaction (sit in the pilot's seat) ----------
    section("Feature 3: object interaction — sit in the pilot's seat");
    // Player is currently wherever the Corwin dialogue left them, in the
    // Engine Room — route back through the Common Area spine rather than
    // assuming a direct line to the Cockpit exists from here.
    await goEngineToSpineX(page, 0);
    await goCommonToKaia(page); // Common Area -> Cockpit via the Fwd Corridor
    await goCockpitToSpineX(page, -11.7);
    await walk(page, "KeyW", -1.5);
    let actionText = await promptText("action-prompt", page);
    check(!!actionText && actionText.includes("sit in the pilot's seat"), `action prompt reads "${actionText}"`);
    await page.keyboard.press("KeyF");
    await waitMs(200);
    const sittingState = await page.evaluate(() => ({
      sitting: window.__lsPlayer.sitting,
      legBend: window.__lsPlayer.marker.userData.legs[0].rotation.x,
    }));
    check(sittingState.sitting === true, "player.sitting flips true after pressing F on the seat");
    check(sittingState.legBend !== 0, `player rig visibly bends into a seated pose (leg rotation.x=${sittingState.legBend})`);
    actionText = await promptText("action-prompt", page);
    check(actionText === "Press F to stand up", `action prompt now reads "${actionText}"`);
    await shoot(page, "ls_interact.png", { hideHud: false });
    await page.keyboard.press("KeyF"); // stand back up, tidy state
    await waitMs(150);
    check((await page.evaluate(() => window.__lsPlayer.sitting)) === false, "standing back up clears player.sitting");

    section("Final integrity check");
    check(consoleErrors.length === 0, `zero console errors across the whole session (got ${consoleErrors.length})`);
    check(pageErrors.length === 0, `zero uncaught page errors across the whole session (got ${pageErrors.length})`);
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
