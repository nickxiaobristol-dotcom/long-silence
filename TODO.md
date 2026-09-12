# TODO

Checked sequence — confirm each stage with Nick before starting the next.

1. [x] Set up a new repo/project structure separate from the joinery
   project.
2. [x] Build the ship layout (a few low-poly rooms/areas, navigable in
   Three.js).
3. [x] Add the 5 crew members as characters the player can approach and
   talk to. Invent full names, backstories, and dialogue voice for each.
4. [x] Build a basic dialogue system (branching lines, at least one
   relationship-affecting choice per crew member).
5. [x] Wire in 2-3 decision points with visible consequences.
6. [x] Test the full loop end to end in the browser before calling it done.

Currently the ship layout, the 5 crew, and the dialogue system are all in.
Ship layout: five rooms (Cockpit, Common Area, Engine Room, Cargo Bay and
the Crew Quarters) connected by corridors, with wall geometry and doorway
gaps defined in `js/ship.js`. The player moves with WASD/arrow keys via
`js/player.js` (follow camera, circle-vs-rect collision against
room/corridor footprints). Crew: 5 low-poly capsule markers placed around
the ship in `js/crew.js` — one each in the Cockpit, Engine Room and Cargo
Bay, two in the Common Area.

The Crew Quarters came after v1 (see the entry at the bottom of this
file): it holds a berth per crew member but nobody is stationed there, so
crew positions and the dialogue system are untouched by it.

Dialogue: `js/dialogue-data.js` holds a hand-authored content bank per
crew member (~70 fragments each, ~350 total) — greetings, topic reactions
(ship/backstory/player), an "ask about" bank for each of the other 4 crew
consistent with CREW.md's faction relationships, idle flavor by activity,
and one relationship-affecting choice. `js/dialogue.js` is the
context-aware selection engine: it picks lines by relationship mood
(cool/neutral/warm, shifted -1/0/+1 by each crew member's choice), by a
deterministic per-crew activity cycle (working/idle/walking, standing in
for a location+task state), and avoids repeating recently-said lines, so
replayed conversations don't feel scripted. `js/main.js` wires this into
the dialogue panel in `index.html` as real branching UI: topic choices,
crew cross-references, the relationship choice, and an exit option.
Covered by `test/dialogue.test.mjs` (content-bank completeness, mood
selection, activity determinism, no-immediate-repeat, relationship
shifts). Verified headlessly in Playwright: walked to two different crew
members, held a full topic conversation, triggered a relationship choice
and confirmed it changed a later line's mood, crew cross-reference lines
work, zero console errors.

Step 5 adds 3 ship/story-level decisions on top of that engine (bigger
than the per-crew relationship choices from step 4): "the contract"
(Dessa, Common Area — pick a Compact/Ridgeline/Drift job, shifts Dessa,
Corwin, Amara and/or Kaia depending on the pick), "Marcus's secret"
(Marcus, Common Area, gated behind having talked to him twice — resolves
the mid-game tension CREW.md flags around his unexplained comms; cover
for him, report him to the Captain, or confront him, each shifting
Marcus, Dessa and Corwin differently), and "the supply run" (Corwin,
Engine Room — a coolant shortage forces a call between a Compact depot, a
Drift outpost, or a risky Ridgeline-lane shortcut, touching up to four
crew at once). All three are implemented as data (`decision` +
`decisionReactions` fields in `js/dialogue-data.js`) read by a small
generic extension to the engine in `js/dialogue.js`: each decision is
offered once, locks itself out for the rest of the session once resolved
(state lives in a reserved `state.__decisions` key alongside the existing
per-crew relationship state), and any other crew member with a matching
`decisionReactions` entry gets a new dialogue option to react to it by
name in a later conversation. Covered by `test/decisions.test.mjs` (each
path sets the right decision state, applies cross-crew relationship
effects, locked-out options stay locked, gating works). Verified
headlessly in Playwright end to end: triggered the contract decision
through Dessa, picked the Drift option, confirmed it's locked out
afterward, then walked to Corwin in a separate conversation and confirmed
his dialogue now references that specific outcome — zero console errors.

Step 6 closes out v1: `npm test` passes clean (35/35 — crew, ship
collision, dialogue engine, decisions). On top of that, a single
continuous headless Playwright session (`test/playthrough.mjs`, run
manually — Playwright isn't a project dependency, it drives a real
Chromium instance) played the whole designed loop end to end rather than
re-checking isolated features: booted with zero console errors, walked
WASD through all four rooms and every corridor doorway, including a
deliberate negative check that the Common Area's west wall still blocks a
straight run outside the Fwd Corridor's gap (collision hasn't regressed);
talked to all 5 crew for basic dialogue and flavor; asked 3 different
cross-crew "ask about" questions; triggered 4 relationship-affecting
choices (Corwin, Dessa, Marcus, Amara) and confirmed each one's mood
shift shows up in a later line and in the returning greeting; triggered
all 3 decisions (the Contract, Marcus's Secret, the Supply Run), each
locking itself out immediately after being chosen; and confirmed 3
different crew members (Corwin, Dessa, Amara) react by name to decisions
made in someone else's conversation. Zero console or page errors across
the whole session — the only browser console output at all was a benign
headless-GPU "GPU stall due to ReadPixels" driver warning, not an
application issue. No bugs turned up in this pass; the ship exploration,
5-crew reactive dialogue, and 3-decision consequence system all hold
together as one coherent loop. The Long Silence v1 is a complete, tested
prototype of the designed vertical slice.

## Post-v1: Crew Quarters

Berthing, added after the v1 slice closed. `js/ship.js` gains a fifth room
(Crew Quarters, x -4..4, z 9..15) and a fourth corridor (Quarters Corridor,
x -1..1, z 4..10) running north out of the Common Area, deliberately
mirroring the Cargo Bay and its corridor to the south so the hub reads as a
cross. The Common Area's north wall was split to open a 2m hatch at
x in [-1, 1], which meant moving what used to sit on it: the crew lockers
now stand as two pairs flanking the hatch, the mess bench tucks further
under its table, and the string lights skip their bulbs over the opening.

The room holds one berth per crew member — two down each side wall, the
captain's across the aft end — built from a new `berth()` prop in
`js/props.js` in the same merged-geometry style as everything else. Each
one carries its occupant's marker color on the blanket, name plate and a
stripe along the canopy (the stripe lies flat because this camera looks
down, so a vertical accent reads edge-on at best), plus personal props
drawn from CREW.md: Kaia's helmet and squared-away kit, Corwin's open
toolroll and Drift banner, Amara's plant and med kit, Dessa's bottle and
ship's registration plate, and Marcus's near-shut curtain over a locked
case and nothing else. The south wall takes the wash station and duty
board, since it's the wall that faces back toward the camera.

No crew member is placed in the room: every position in `js/crew.js` is
where the dialogue and decision systems expect to find them, and none of
that logic was touched. The quarters are explorable space only.

Verified: `npm test` 43/43 (a new collision test covers the Quarters
Corridor sweep and the north wall either side of the hatch), and
`test/playthrough.mjs` still plays the whole loop clean — all 5 crew,
all relationship choices, all 3 decisions, cross-crew reactions, zero
console errors — with a Crew Quarters visit added to its per-room
screenshot pass.
