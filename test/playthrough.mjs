// Step 6: full end-to-end headless playthrough of the whole game loop, in
// ONE continuous browser session (not isolated per-feature checks like the
// Playwright spot-checks mentioned in TODO.md for steps 4-5). This is a
// throwaway verification script, not part of `npm test` (it drives a real
// browser via Playwright, which isn't a project devDependency — see the
// NODE_PATH bootstrap below), run manually with:
//
//   node test/playthrough.mjs
//
// It boots the game fresh, walks the player through all four rooms via
// WASD (exercising collision against walls and through doorway gaps),
// talks to all 5 crew, triggers a cross-reference, triggers 2 relationship
// choices, triggers all 3 decisions, and confirms cross-crew reactions —
// all while watching for console errors/page crashes.

import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

// Playwright isn't a devDependency of this zero-build project; reuse a
// package (and its already-downloaded chromium binary) already cached on
// this machine instead of adding a new install. Node's ESM resolver
// ignores NODE_PATH, so require() by absolute path via createRequire
// instead of a bare `import "playwright"`.
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
const PORT = 8421;
const BASE_URL = `http://localhost:${PORT}/`;
// Screenshots land outside the repo on purpose — this is a throwaway
// verification script and the shots are review artifacts, not assets.
const SHOT_DIR = process.env.LS_SHOT_DIR || "/home/nickx/.openclaw/workspace/scratch";

const consoleErrors = [];
const pageErrors = [];
let failures = 0;

function check(condition, message) {
  if (condition) {
    console.log(`  ok - ${message}`);
  } else {
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

// Reported for context only — nothing below depends on it. Headless
// chromium has no GPU and rasterizes in software, so this number says
// nothing about the game's speed on real hardware; it's here because a
// sudden collapse would be worth noticing.
async function measureFps(page) {
  return page.evaluate(
    () =>
      new Promise((resolve) => {
        let frames = 0;
        const start = performance.now();
        const tick = () => {
          frames += 1;
          const elapsed = performance.now() - start;
          if (elapsed < 2000) requestAnimationFrame(tick);
          else resolve(frames / (elapsed / 1000));
        };
        requestAnimationFrame(tick);
      })
  );
}

async function interactPromptText(page) {
  return page.evaluate(() => {
    const el = document.getElementById("interact-prompt");
    return el.hidden ? null : el.textContent;
  });
}

async function waitForNearby(page, name, timeoutMs = 4000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const text = await interactPromptText(page);
    if (text && text.includes(name)) return true;
    await waitMs(100);
  }
  return false;
}

async function speakerText(page) {
  return page.evaluate(() => document.getElementById("dialogue-speaker").textContent);
}

async function lineText(page) {
  return page.evaluate(() => document.getElementById("dialogue-line").textContent);
}

async function choiceLabels(page) {
  return page.evaluate(() =>
    Array.from(document.querySelectorAll("#dialogue-choices li")).map((li) => li.textContent)
  );
}

async function clickChoice(page, matchText) {
  const li = page.locator("#dialogue-choices li", { hasText: matchText });
  await li.first().click();
}

async function isDialogueOpen(page) {
  return page.evaluate(() => !document.getElementById("dialogue-panel").hidden);
}

async function interact(page) {
  await page.keyboard.press("KeyE");
  await waitMs(150);
}

// Frame a room and save it. The HUD is hidden first so the shot shows the
// set dressing rather than the overlay, and a beat is given for a few
// frames to settle after the walk that got us here.
async function shoot(page, name) {
  await waitMs(500);
  await page.evaluate(() => {
    for (const id of ["hint", "interact-prompt", "dialogue-panel"]) {
      document.getElementById(id).style.display = "none";
    }
  });
  await waitMs(200);
  const file = path.join(SHOT_DIR, name);
  await page.screenshot({ path: file });
  console.log(`  ok - saved ${file}`);
}

// --- Robust cross-room navigation -------------------------------------------
// Movement is closed-loop against the player's real position (exposed by
// js/main.js as window.__lsPlayer purely for this harness) rather than
// dead-reckoned from key-hold durations. Dead reckoning assumes the player
// covers SPEED metres per second of wall-clock time, which is only true
// above 10fps — js/player.js clamps dt to 0.1s per frame, and headless
// chromium renders this scene on a software rasterizer at well under that.
// Walking until a coordinate is reached is immune to all of it.
//
// Routes still go via wall clamps rather than diagonals: each room has
// exactly one doorway gap and every other wall is solid edge-to-edge (see
// WALL_SEGMENTS in js/ship.js), so pinning into a known corner and then
// running along an axis is a path that always exists.

const AXIS_OF = { KeyW: "z", KeyS: "z", KeyA: "x", KeyD: "x" };
const SIGN_OF = { KeyW: -1, KeyS: 1, KeyA: -1, KeyD: 1 };

async function playerPos(page) {
  return page.evaluate(() => ({ x: window.__lsPlayer.x, z: window.__lsPlayer.z }));
}

// Hold one direction until `target` is reached on that axis, or until the
// player stops moving (a wall). Returns true if the target was reached.
// Pass a target beyond the hull to deliberately clamp into a wall.
//
// Polling happens inside the page (waitForFunction with polling: "raf")
// rather than by round-tripping playerPos every tick. An IPC poll costs
// ~200ms here, during which the player covers most of a metre, and that
// overshoot was enough to leave it mis-aligned with a doorway and pinned
// against a wall. In-page polling cuts the stopping error to roughly one
// rendered frame of travel.
const ARRIVAL_TOLERANCE = 0.7; // one frame of travel at the headless frame rate

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
        // Stop on arrival, or after ~30 frames pinned against a wall.
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

// Walks that line up with a doorway aim a little short of the centre line
// rather than at it: stopping always overshoots by up to a frame of
// travel, and the corridors are only 2m wide against a 0.4m player radius.
const SPINE_AIM = 0.35;

// Deliberately run into a wall on this axis and stop there.
async function clamp(page, key) {
  await walk(page, key, SIGN_OF[key] * 999);
}

async function walkTo(page, x, z) {
  const here = await playerPos(page);
  await walk(page, x >= here.x ? "KeyD" : "KeyA", x);
  await walk(page, z >= here.z ? "KeyS" : "KeyW", z);
}

// Common Area, from anywhere inside it -> deterministic corner (4.6, 4.6).
//
// The step east comes first and is not optional: the Common Area's north
// wall stopped being solid when the Crew Quarters were added, and it now
// has a hatch at x in [-1, 1]. Clamping north from the spine walks straight
// out of the room and up the Quarters Corridor instead of stopping. Getting
// to x >= 2.5 first puts the player in front of a solid span of that wall.
async function clampToCommonNE(page) {
  await walk(page, "KeyD", 2.5); // clear of the Crew Quarters hatch
  await clamp(page, "KeyS"); // north wall, solid east of the hatch
  await clamp(page, "KeyD"); // east wall, solid above the corridor gap
}

async function goCommonToKaia(page) {
  await clampToCommonNE(page);
  await walk(page, "KeyW", SPINE_AIM); // onto the z = 0 spine
  await walk(page, "KeyA", -10); // through the Fwd Corridor to the Cockpit
}

async function goCommonToCorwin(page) {
  await clampToCommonNE(page);
  await walk(page, "KeyW", SPINE_AIM);
  await walk(page, "KeyD", 12); // through the Aft Corridor to the Engine Room
}

async function goCommonToAmara(page) {
  await clampToCommonNE(page);
  await walk(page, "KeyA", SPINE_AIM);
  await walk(page, "KeyW", -12); // through the Cargo Corridor to the Cargo Bay
}

// Same shape as the Cargo Bay run, in the other direction. Approaching the
// corridor's centre line from the east matters: stopping overshoots by up
// to a frame of travel, so the aim has to be the side the player is coming
// from or they end up wide of a 2m-wide corridor mouth and walk into the
// wall beside it instead.
async function goCommonToQuarters(page) {
  await clampToCommonNE(page);
  await walk(page, "KeyA", SPINE_AIM);
  await walk(page, "KeyS", 11.6); // through the Quarters Corridor to the berths
}

// Cockpit, from anywhere inside it -> spine (targetX, 0).
async function goCockpitToSpineX(page, targetX) {
  await clamp(page, "KeyA"); // nose wall, solid full height
  await clamp(page, "KeyS"); // north wall, solid full width
  await walk(page, "KeyW", SPINE_AIM);
  await walk(page, targetX >= -13.6 ? "KeyD" : "KeyA", targetX);
}

// Engine Room, from anywhere inside it -> spine (targetX, 0).
async function goEngineToSpineX(page, targetX) {
  await clamp(page, "KeyD"); // east wall, solid full height
  await clamp(page, "KeyS"); // north wall, solid full width
  await walk(page, "KeyW", SPINE_AIM);
  await walk(page, targetX >= 15.6 ? "KeyD" : "KeyA", targetX);
}

// Cargo Bay, from anywhere inside it -> spine (targetX, 0), via Common Area.
async function goCargoToSpineX(page, targetX) {
  await clamp(page, "KeyW"); // aft wall, solid full width
  await clamp(page, "KeyD"); // east wall, solid full height
  await walk(page, "KeyA", SPINE_AIM); // onto the Cargo Corridor's centre line
  await walk(page, "KeyS", -SPINE_AIM); // north through the corridor to the spine
  if (targetX !== 0) await walk(page, targetX > 0 ? "KeyD" : "KeyA", targetX);
}

async function goEngineToAmara(page) {
  await goEngineToSpineX(page, 0);
  await walk(page, "KeyW", -12);
}

async function spineToDessa(page) {
  await walk(page, "KeyW", -3);
}

async function spineToMarcus(page) {
  await walk(page, "KeyS", 3);
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
    await waitMs(1000); // let a few animation frames run
    check(consoleErrors.length === 0, `zero console errors on boot (got ${consoleErrors.length})`);
    check(pageErrors.length === 0, `zero uncaught page errors on boot (got ${pageErrors.length})`);
    const fps = await measureFps(page);
    console.log(`  info - ${fps.toFixed(1)} fps in headless software rendering`);

    // --- Movement + collision -------------------------------------------------
    section("Movement & collision: Common Area -> Marcus");
    // Player starts at (1,0), center of the Common Area. Marcus sits at
    // (3,3), inside the same room, so a direct diagonal hold is safe.
    await walkTo(page, 3, 3);
    check(await waitForNearby(page, "Marcus"), "reached Marcus in the Common Area");

    section("Dialogue: Marcus, first meeting (talkCount 1) — secret should NOT be offered yet");
    await interact(page);
    check(await isDialogueOpen(page), "dialogue panel opens for Marcus");
    check((await speakerText(page)).includes("Marcus Reyn"), "speaker line names Marcus Reyn");
    let marcusChoices = await choiceLabels(page);
    check(
      !marcusChoices.some((c) => c.includes("coded comm")),
      "Marcus's Secret is NOT offered on the first conversation (talkCount gate)"
    );
    await clickChoice(page, "Ask about the ship");
    check((await lineText(page)).length > 0, "Marcus has a ship-topic line");
    await clickChoice(page, "Ask about their past");
    check((await lineText(page)).length > 0, "Marcus has a backstory line");
    await clickChoice(page, "Ask what they think of you");
    check((await lineText(page)).length > 0, "Marcus has a player-topic line");
    section("Crew cross-reference: Marcus about Dessa");
    marcusChoices = await choiceLabels(page);
    check(marcusChoices.some((c) => c.includes("Ask about Dessa Okafor")), "Marcus's menu offers asking about Dessa");
    await clickChoice(page, "Ask about Dessa Okafor");
    const marcusAboutDessa = await lineText(page);
    check(marcusAboutDessa.length > 0, `Marcus's cross-reference about Dessa: "${marcusAboutDessa}"`);
    await clickChoice(page, "End conversation");
    check(!(await isDialogueOpen(page)), "dialogue closes on exit");

    section("Collision check: wall blocks off-corridor crossing");
    // From Marcus's spot (~3,3), the Cockpit is west, but the only gap in
    // the Common Area's west wall is the Fwd Corridor at z in [-1, 1].
    // Holding pure west (A) from z=3 should NOT reach the Cockpit/Kaia —
    // if it does, wall collision has regressed.
    await clamp(page, "KeyA");
    const leakedThroughWall = await waitForNearby(page, "Kaia", 500);
    check(!leakedThroughWall, "west wall blocks a straight run at z=3 (no wall clip into Cockpit)");

    section("Movement & collision: -> Dessa");
    // Get back to a known-safe point (center of Common Area) first, then
    // to Dessa (1, -3), still inside the Common Area rect.
    await walkTo(page, 1, -3);
    check(await waitForNearby(page, "Dessa"), "reached Dessa in the Common Area");

    section("Movement & collision: -> Kaia (through Fwd Corridor)");
    // Wall-clamp navigation (see helpers above) rather than dead-reckoning
    // from an assumed position — robust regardless of exactly where the
    // last diagonal moves left the player inside the Common Area.
    await goCommonToKaia(page);
    check(await waitForNearby(page, "Kaia"), "reached Kaia in the Cockpit via the Fwd Corridor");

    section("Movement & collision: -> Corwin (through Aft Corridor)");
    await goCockpitToSpineX(page, 12); // Cockpit -> Corwin, straight along the z=0 spine
    check(await waitForNearby(page, "Corwin"), "reached Corwin in the Engine Room via the Aft Corridor");

    section("Movement & collision: -> Amara (through Cargo Corridor)");
    await goEngineToAmara(page);
    check(await waitForNearby(page, "Amara"), "reached Amara in the Cargo Bay via the Cargo Corridor");

    check(consoleErrors.length === 0, `still zero console errors after full traversal (got ${consoleErrors.length})`);

    // --- Talk to every crew member once -----------------------------------
    section("Dialogue: talk to all 5 crew (basic + flavor)");

    // Amara first, since we're standing next to her.
    await interact(page);
    check(await isDialogueOpen(page), "dialogue panel opens for Amara");
    check((await speakerText(page)).includes("Amara Voss"), "speaker line names Amara Voss");
    await clickChoice(page, "Ask about the ship");
    check((await lineText(page)).length > 0, "Amara has a ship-topic line");
    await clickChoice(page, "Ask about their past");
    check((await lineText(page)).length > 0, "Amara has a backstory line");
    await clickChoice(page, "Ask what they think of you");
    check((await lineText(page)).length > 0, "Amara has a player-topic line");
    await clickChoice(page, "Ask what they're up to");
    check((await lineText(page)).length > 0, "Amara has an idle-flavor line");
    await clickChoice(page, "End conversation");
    check(!(await isDialogueOpen(page)), "dialogue closes on exit");

    // Walk back to Corwin, talk + cross-reference.
    await goCargoToSpineX(page, 12);
    check(await waitForNearby(page, "Corwin"), "back at Corwin");
    await interact(page);
    check((await speakerText(page)).includes("Corwin Talus"), "speaker line names Corwin Talus");
    await clickChoice(page, "Ask about the ship");
    section("Crew cross-reference: Corwin about Dessa");
    let choices = await choiceLabels(page);
    check(choices.some((c) => c.includes("Ask about Dessa Okafor")), "Corwin's menu offers asking about Dessa");
    await clickChoice(page, "Ask about Dessa Okafor");
    const corwinAboutDessa = await lineText(page);
    check(corwinAboutDessa.length > 0, `Corwin's cross-reference about Dessa returns a line: "${corwinAboutDessa}"`);

    section("Relationship choice #1: Corwin");
    choices = await choiceLabels(page);
    const corwinChoicePrompt = choices.find((c) => c.includes("venting, again"));
    check(!!corwinChoicePrompt, "Corwin's relationship-choice prompt is offered");
    await clickChoice(page, "venting, again");
    await clickChoice(page, "You're right to keep her honest about it");
    const corwinChoiceResponse = await lineText(page);
    check(
      corwinChoiceResponse.includes("Good. Somebody besides me"),
      `Corwin's positive relationship choice fires its response line: "${corwinChoiceResponse}"`
    );
    // Re-ask a mood-bucketed topic in the same conversation and confirm it
    // now draws from the warm pool (relationship went 0 -> +1).
    await clickChoice(page, "Ask what they think of you");
    const corwinWarmLine = await lineText(page);
    const corwinWarmPool = [
      "You've been alright. I don't say that to just anybody who walks through here.",
      "You're good in a pinch. I noticed. I notice things like that.",
      "You've earned some trust. Don't waste it running Compact errands without asking me first.",
    ];
    check(
      corwinWarmPool.includes(corwinWarmLine),
      `Corwin's player-topic line now comes from the warm pool: "${corwinWarmLine}"`
    );
    await clickChoice(page, "End conversation");

    // Trigger the Supply Run decision (Corwin's own).
    await interact(page);
    section("Decision: The Supply Run (Corwin)");
    choices = await choiceLabels(page);
    check(
      choices.some((c) => c.includes("Coolant lines are failing")),
      "Supply Run decision is offered from Corwin"
    );
    await clickChoice(page, "Coolant lines are failing");
    choices = await choiceLabels(page);
    check(choices.length === 3, "Supply Run offers all 3 options");
    await clickChoice(page, "Detour to a Drift outpost");
    const supplyRunResponse = await lineText(page);
    check(
      supplyRunResponse.includes("claps you on the shoulder"),
      `Supply Run (Drift outpost) response fires: "${supplyRunResponse}"`
    );
    choices = await choiceLabels(page);
    check(
      !choices.some((c) => c.includes("Coolant lines are failing")),
      "Supply Run decision is locked out immediately after resolving"
    );
    await clickChoice(page, "End conversation");

    // Walk to Kaia, talk + relationship choice #2? (No — spec wants 2
    // *different* crew relationship choices; we already did Corwin. Do
    // Amara for #2, and use Kaia purely for basic dialogue + decision
    // reactions, matching the crew's actual designed content.)
    section("Movement: -> Kaia");
    await goEngineToSpineX(page, -10);
    check(await waitForNearby(page, "Kaia"), "reached Kaia again");
    await interact(page);
    check((await speakerText(page)).includes("Kaia Brenn"), "speaker line names Kaia Brenn");
    await clickChoice(page, "Ask about the ship");
    check((await lineText(page)).length > 0, "Kaia has a ship-topic line");
    await clickChoice(page, "Ask about their past");
    check((await lineText(page)).length > 0, "Kaia has a backstory line");
    section("Crew cross-reference: Kaia about Marcus");
    choices = await choiceLabels(page);
    check(choices.some((c) => c.includes("Ask about Marcus Reyn")), "Kaia's menu offers asking about Marcus");
    await clickChoice(page, "Ask about Marcus Reyn");
    const kaiaAboutMarcus = await lineText(page);
    check(kaiaAboutMarcus.length > 0, `Kaia's cross-reference about Marcus: "${kaiaAboutMarcus}"`);
    await clickChoice(page, "End conversation");

    // Walk to Dessa: talk, cross-reference, relationship choice, contract decision.
    section("Movement: -> Dessa");
    await goCockpitToSpineX(page, 1);
    await spineToDessa(page);
    check(await waitForNearby(page, "Dessa"), "reached Dessa again");
    await interact(page);
    check((await speakerText(page)).includes("Dessa Okafor"), "speaker line names Dessa Okafor");
    await clickChoice(page, "Ask about the ship");
    check((await lineText(page)).length > 0, "Dessa has a ship-topic line");
    await clickChoice(page, "Ask about their past");
    check((await lineText(page)).length > 0, "Dessa has a backstory line");

    section("Relationship choice #2: Dessa");
    choices = await choiceLabels(page);
    check(choices.some((c) => c.includes("debt she still owes")), "Dessa's relationship-choice prompt is offered");
    await clickChoice(page, "debt she still owes");
    await clickChoice(page, "Whatever keeps the ship flying");
    const dessaChoiceResponse = await lineText(page);
    check(
      dessaChoiceResponse.includes("Exactly right"),
      `Dessa's positive relationship choice fires its response: "${dessaChoiceResponse}"`
    );

    section("Decision 1/3: The Contract (Dessa)");
    choices = await choiceLabels(page);
    check(choices.some((c) => c.includes("job on the board")), "Contract decision is offered from Dessa");
    await clickChoice(page, "job on the board");
    choices = await choiceLabels(page);
    check(choices.length === 3, "Contract decision offers all 3 options");
    await clickChoice(page, "Take the Compact contract");
    const contractResponse = await lineText(page);
    check(
      contractResponse.includes("Money in the account"),
      `Contract (Compact) response fires: "${contractResponse}"`
    );
    choices = await choiceLabels(page);
    check(!choices.some((c) => c.includes("job on the board")), "Contract decision locks out immediately after resolving");

    // Confirm mood shift: relationship = +1 (choice) +1 (compact effect on
    // dessa) = +2 => warm. Re-check a mood-bucketed line in this same
    // conversation, then close and reopen to check the returning greeting.
    await clickChoice(page, "Ask what they think of you");
    const dessaWarmLine = await lineText(page);
    const dessaWarmPlayerPool = [
      "You've pulled your weight. That counts for a lot on a ship this small.",
      "I was wrong to size you up as dead weight. Don't let it go to your head.",
      "You're alright. Don't tell the others I said that.",
    ];
    check(
      dessaWarmPlayerPool.includes(dessaWarmLine),
      `Dessa's player-topic line now comes from the warm pool: "${dessaWarmLine}"`
    );
    await clickChoice(page, "End conversation");

    await interact(page);
    const dessaReturningGreeting = await lineText(page);
    const dessaWarmGreetings = [
      "Hey. Pull up a crate, there's coffee if Corwin hasn't hoarded it.",
      "Good timing. I could use a face that isn't scowling at me for once.",
      "You're becoming a fixture around here. Could be worse company.",
    ];
    check(
      dessaWarmGreetings.includes(dessaReturningGreeting),
      `Dessa's returning greeting reflects the warm mood shift: "${dessaReturningGreeting}"`
    );
    await clickChoice(page, "End conversation");

    // --- Marcus: talk twice (gate), relationship choice, secret decision ---
    section("Movement: -> Marcus");
    // Currently at Dessa (1, -3) in the Common Area; Marcus is at (3, 3),
    // both reachable with a couple of straight moves inside the same room.
    await walkTo(page, 3, 3);
    check(await waitForNearby(page, "Marcus"), "reached Marcus again");

    await interact(page); // 2nd conversation with Marcus overall -> talkCount hits 2, gate opens
    check((await speakerText(page)).includes("Marcus Reyn"), "speaker line names Marcus Reyn");
    choices = await choiceLabels(page);
    const secretOfferedEarly = choices.some((c) => c.includes("coded comm"));
    check(secretOfferedEarly, "Marcus's Secret is offered once talkCount >= 2 (gate respected)");
    await clickChoice(page, "Ask about the ship");
    check((await lineText(page)).length > 0, "Marcus has a ship-topic line");

    section("Relationship choice #3 (bonus): Marcus");
    await clickChoice(page, "unexplained absences");
    await clickChoice(page, "I trust you");
    const marcusChoiceResponse = await lineText(page);
    check(
      marcusChoiceResponse.includes("loosens"),
      `Marcus's positive relationship choice fires its response: "${marcusChoiceResponse}"`
    );

    section("Decision 2/3: Marcus's Secret");
    choices = await choiceLabels(page);
    check(choices.some((c) => c.includes("coded comm")), "Marcus's Secret decision is still offered");
    await clickChoice(page, "coded comm");
    choices = await choiceLabels(page);
    check(choices.length === 3, "Marcus's Secret offers all 3 options");
    await clickChoice(page, "Whatever that was, it stays between us");
    const secretResponse = await lineText(page);
    check(
      secretResponse.includes("unlocks, just a fraction"),
      `Marcus's Secret (cover) response fires: "${secretResponse}"`
    );
    choices = await choiceLabels(page);
    check(!choices.some((c) => c.includes("coded comm")), "Marcus's Secret decision locks out immediately after resolving");
    await clickChoice(page, "End conversation");

    // --- Cross-crew reactions to decisions ---------------------------------
    section("Decision 3/3 was already made (Supply Run, via Corwin); confirm reactions");

    // Corwin should now be able to react to Marcus's Secret (cover) and to
    // the Contract (compact), in addition to his own Supply Run decision
    // being fully resolved.
    section("Movement: -> Corwin (check decision reactions)");
    await goCommonToCorwin(page);
    check(await waitForNearby(page, "Corwin"), "back at Corwin for reaction check");
    await interact(page);
    choices = await choiceLabels(page);
    check(
      choices.some((c) => c.includes("Marcus situation")),
      "Corwin's menu now offers reacting to the Marcus situation"
    );
    check(
      choices.some((c) => c.includes("contract the Captain took")),
      "Corwin's menu now offers reacting to the Contract"
    );
    await clickChoice(page, "Marcus situation");
    const corwinOnMarcus = await lineText(page);
    check(
      corwinOnMarcus.includes("covering for a guy"),
      `Corwin reacts to Marcus's Secret (cover) outcome: "${corwinOnMarcus}"`
    );
    await clickChoice(page, "contract the Captain took");
    const corwinOnContract = await lineText(page);
    check(
      corwinOnContract.includes("Compact money"),
      `Corwin reacts to the Contract (compact) outcome: "${corwinOnContract}"`
    );
    await clickChoice(page, "End conversation");

    // Dessa should be able to react to the Marcus situation and the Supply
    // Run call — two different crew members reacting to decisions.
    section("Movement: -> Dessa (check decision reactions)");
    await goEngineToSpineX(page, 1);
    await spineToDessa(page);
    check(await waitForNearby(page, "Dessa"), "back at Dessa for reaction check");
    await interact(page);
    choices = await choiceLabels(page);
    check(
      choices.some((c) => c.includes("Marcus situation")),
      "Dessa's menu now offers reacting to the Marcus situation"
    );
    check(
      choices.some((c) => c.includes("supply run call")),
      "Dessa's menu now offers reacting to the Supply Run"
    );
    await clickChoice(page, "Marcus situation");
    const dessaOnMarcus = await lineText(page);
    check(
      dessaOnMarcus.includes("kept that from me"),
      `Dessa reacts to Marcus's Secret (cover) outcome: "${dessaOnMarcus}"`
    );
    await clickChoice(page, "supply run call");
    const dessaOnSupplyRun = await lineText(page);
    check(
      dessaOnSupplyRun.includes("coming out of this month's margin"),
      `Dessa reacts to the Supply Run (Drift outpost) outcome: "${dessaOnSupplyRun}"`
    );
    await clickChoice(page, "End conversation");

    // Amara: confirm her relationship choice + a reaction, rounding out
    // "2 crew relationship choices" with a 3rd for good measure, and a 3rd
    // reacting crew member.
    section("Movement: -> Amara + relationship choice + reactions");
    await goCommonToAmara(page);
    check(await waitForNearby(page, "Amara"), "back at Amara");
    await interact(page);
    choices = await choiceLabels(page);
    check(choices.some((c) => c.includes("sell the surplus painkillers")), "Amara's relationship-choice prompt is offered");
    await clickChoice(page, "sell the surplus painkillers");
    await clickChoice(page, "Give them to Ceres Station");
    const amaraChoiceResponse = await lineText(page);
    check(
      amaraChoiceResponse.includes("Thank you. I mean that"),
      `Amara's positive relationship choice fires its response: "${amaraChoiceResponse}"`
    );
    choices = await choiceLabels(page);
    check(choices.some((c) => c.includes("contract the Captain took")), "Amara's menu offers reacting to the Contract");
    await clickChoice(page, "contract the Captain took");
    const amaraOnContract = await lineText(page);
    check(amaraOnContract.includes("Compact pays reliably"), `Amara reacts to the Contract (compact): "${amaraOnContract}"`);
    await clickChoice(page, "End conversation");

    // --- Visual record: one framed shot per room ---------------------------
    // Same wall-clamp navigation as everything above, so these also act as
    // a final traversal of all four rooms and every corridor.
    section("Screenshots: one per room");
    fs.mkdirSync(SHOT_DIR, { recursive: true });

    // Standing at Amara (0, -12) already — dead centre of the Cargo Bay.
    await shoot(page, "ls_cargo_v2.png");

    await goCargoToSpineX(page, 1);
    await walk(page, "KeyS", 1.5); // centres the Common Area in frame
    await shoot(page, "ls_common_v2.png");

    await clampToCommonNE(page);
    await walk(page, "KeyW", 0.5); // lined up with the Fwd Corridor
    await walk(page, "KeyA", -10.6);
    await walk(page, "KeyS", 1.5); // backs off so the nav table clears the frame edge
    await shoot(page, "ls_cockpit_v2.png");

    await goCockpitToSpineX(page, 11.2);
    await walk(page, "KeyS", 1.0);
    await shoot(page, "ls_engine_v2.png");

    await goEngineToSpineX(page, 0);
    await goCommonToQuarters(page);
    check(
      (await playerPos(page)).z > 9,
      "walked from the Engine Room through to the Crew Quarters"
    );
    await shoot(page, "ls_quarters_v2.png");

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
