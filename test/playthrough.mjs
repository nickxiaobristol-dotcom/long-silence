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
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

// Playwright isn't a devDependency of this zero-build project; reuse the
// package (and its already-downloaded chromium binary) cached on this
// machine from prior npx usage instead of adding a new install. Node's ESM
// resolver ignores NODE_PATH, so require() by absolute path via
// createRequire instead of a bare `import "playwright"`.
const require = createRequire(import.meta.url);
const { chromium } = require("/home/nickx/.npm/_npx/705bc6b22212b352/node_modules/playwright");

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const PORT = 8421;
const BASE_URL = `http://localhost:${PORT}/`;

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

// Hold one or two movement keys down for `ms` milliseconds (real time —
// the game's movement loop runs off requestAnimationFrame/performance.now,
// same as a real player holding keys).
async function hold(page, keys, ms) {
  for (const k of keys) await page.keyboard.down(k);
  await waitMs(ms);
  for (const k of keys) await page.keyboard.up(k);
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

// --- Robust cross-room navigation -------------------------------------------
// The game exposes no debug position readout, so long cross-room hops are
// driven by wall-clamping rather than dead-reckoning from an assumed start
// position: holding one direction for CLAMP_MS (well beyond any room's
// extent) deterministically pins the player against that solid wall no
// matter where it started, since it only ever needs walls that are fully
// solid across the whole room (see js/ship.js WALL_SEGMENTS — each room has
// exactly one doorway gap, and every other wall is solid edge-to-edge).
// From a clamped corner, a precisely-timed hold reaches the next target.
const MPS = 4.2; // must match SPEED in js/player.js
function ms(meters) {
  return Math.round((meters / MPS) * 1000);
}
const CLAMP_MS = 3000; // >12.6m of travel — more than any room's extent

// Common Area, from anywhere inside it -> deterministic corner (4.6, 4.6).
async function clampToCommonNE(page) {
  await hold(page, ["KeyS"], CLAMP_MS); // clamp z = 4.6 (north wall, solid full width)
  await hold(page, ["KeyD"], CLAMP_MS); // clamp x = 4.6 (east wall, solid above the corridor gap)
}

async function goCommonToKaia(page) {
  await clampToCommonNE(page);
  await hold(page, ["KeyW"], ms(4.6)); // z: 4.6 -> 0
  await hold(page, ["KeyA"], ms(14.6) + 50); // x: 4.6 -> -10, through the Fwd Corridor
}

async function goCommonToCorwin(page) {
  await clampToCommonNE(page);
  await hold(page, ["KeyW"], ms(4.6)); // z: 4.6 -> 0
  await hold(page, ["KeyD"], ms(7.4) + 50); // x: 4.6 -> 12, through the Aft Corridor
}

async function goCommonToAmara(page) {
  await clampToCommonNE(page);
  await hold(page, ["KeyA"], ms(4.6)); // x: 4.6 -> 0
  await hold(page, ["KeyW"], ms(16.6) + 50); // z: 4.6 -> -12, through the Cargo Corridor
}

// Cockpit, from anywhere inside it -> spine (targetX, 0).
async function goCockpitToSpineX(page, targetX) {
  await hold(page, ["KeyA"], CLAMP_MS); // clamp x = -13.6 (west wall, solid full height)
  await hold(page, ["KeyS"], CLAMP_MS); // clamp z = 3.6 (north wall, solid full width)
  await hold(page, ["KeyW"], ms(3.6)); // z -> 0
  const dx = targetX - -13.6;
  await hold(page, [dx >= 0 ? "KeyD" : "KeyA"], ms(Math.abs(dx)) + 50);
}

// Engine Room, from anywhere inside it -> spine (targetX, 0).
async function goEngineToSpineX(page, targetX) {
  await hold(page, ["KeyD"], CLAMP_MS); // clamp x = 15.6 (east wall, solid full height)
  await hold(page, ["KeyS"], CLAMP_MS); // clamp z = 3.6 (north wall, solid full width)
  await hold(page, ["KeyW"], ms(3.6)); // z -> 0
  const dx = targetX - 15.6;
  await hold(page, [dx >= 0 ? "KeyD" : "KeyA"], ms(Math.abs(dx)) + 50);
}

// Cargo Bay, from anywhere inside it -> spine (targetX, 0), via Common Area.
async function goCargoToSpineX(page, targetX) {
  await hold(page, ["KeyW"], CLAMP_MS); // clamp z = -14.6 (south wall, solid full width)
  await hold(page, ["KeyD"], CLAMP_MS); // clamp x = 4.6 (east wall, solid full height)
  await hold(page, ["KeyA"], ms(4.6)); // x -> 0
  await hold(page, ["KeyS"], ms(14.6) + 50); // z: -14.6 -> 0, through the Cargo Corridor
  if (targetX !== 0) {
    await hold(page, [targetX > 0 ? "KeyD" : "KeyA"], ms(Math.abs(targetX)) + 50);
  }
}

async function goEngineToAmara(page) {
  await goEngineToSpineX(page, 0);
  await hold(page, ["KeyW"], ms(12) + 50); // z: 0 -> -12
}

async function spineToDessa(page) {
  await hold(page, ["KeyW"], ms(3) + 20); // z: 0 -> -3
}

async function spineToMarcus(page) {
  await hold(page, ["KeyS"], ms(3) + 20); // z: 0 -> 3
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

    // --- Movement + collision -------------------------------------------------
    section("Movement & collision: Common Area -> Marcus");
    // Player starts at (1,0), center of the Common Area. Marcus sits at
    // (3,3), inside the same room, so a direct diagonal hold is safe.
    await hold(page, ["KeyD", "KeyS"], 950);
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
    await hold(page, ["KeyA"], 3000);
    const leakedThroughWall = await waitForNearby(page, "Kaia", 500);
    check(!leakedThroughWall, "west wall blocks a straight run at z=3 (no wall clip into Cockpit)");

    section("Movement & collision: -> Dessa");
    // Get back to a known-safe point (center of Common Area) first, then
    // to Dessa (1, -3), still inside the Common Area rect.
    await hold(page, ["KeyD"], 1000); // back toward the room's middle
    await hold(page, ["KeyW"], 1600); // north to Dessa's z
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
    await hold(page, ["KeyD"], ms(2) + 20);
    await hold(page, ["KeyS"], ms(6) + 20);
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
