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

## Post-v1: Movement & interaction pass

Four features layered on top of the static v1 slice, none of which touch
dialogue content, decision logic, or collision: walking animation,
autonomous NPC wandering, object interaction, and dialogue speech bubbles.

**Walking animation** (`js/character.js`): `buildHumanoid` now builds each
leg/arm as a hip/shoulder pivot Group with the limb mesh hung underneath,
so a rotation swings it like a real pendulum instead of about its own
middle. `stepWalkCycle(group, dt, moving)` phase-accumulates a sine per
frame to swing legs in opposing phase (arms opposite the legs, at 80% the
swing) while `moving` is true, and snaps straight back to the neutral pose
the instant it goes false. `js/player.js` and the per-frame crew sync in
`js/main.js` both call it off the same shared rig, so the player and all 5
crew animate identically.

**Autonomous NPC movement** (`js/crew-behavior.js`, new): each crew member
steps between 2-3 hand-placed waypoints inside their own room (Corwin
between the reactor and his workbench, Amara circuits the Cargo Bay, etc.),
pausing 2.5-5.5s at each stop, with `isWalkable` checked every step as a
second guard against ever wandering into a doorway. `js/crew.js` now sets
a live `curX`/`curZ`/`facing` per member at module load (kept separate
from the fixed spawn `x`/`z`, which decorations.js and existing tests
still key off), and `findNearbyCrew` was switched to check the live
position — the "Press E to talk" range check now tracks a crew member
wherever they've wandered to, not just their spawn point. Opening a
conversation calls `setTalking`, which freezes that member and turns them
to face the player until the conversation ends.

**Object interaction** (`js/interactables.js`, new): decorations.js's
props are deliberately merged into static per-room buckets that can't be
moved/recolored/hidden afterward, so interactables live as their own small
live objects instead, the same way crew/player already sit on top of the
static ship. Four interactables: sit in the Cockpit's pilot seat or a
Common Area mess stool (bends the sitter's rig into a seated pose, freezes
player movement until standing back up), power up the Engine Room's
diagnostic console (a new indicator light swaps color), and open a
standalone footlocker in the Cargo Bay (lid rotates open on a hinge). A
new `#action-prompt` element mirrors the existing "Press E to talk" prompt
pattern for "Press F to ...".

**Dialogue speech bubbles** (`js/main.js`, `css/style.css`): a small
"…" bubble is projected from the speaking crew member's live head position
(3D-to-screen via `Vector3.project(camera)`, recomputed every frame) to an
absolutely-positioned `#speech-bubble` div, shown for as long as the
dialogue panel is open. Purely decorative on top of the existing dialogue
UI — carries no text of its own and never touches dialogue state.

Covered by three new test files (`test/crew-behavior.test.mjs`,
`test/interactables.test.mjs`, plus new cases in `test/crew.test.mjs`
asserting `findNearbyCrew` uses live position, not spawn position) —
`npm test` is 55/55. Verified headlessly end-to-end in
`test/feature-pass-verify.mjs` (Playwright, run manually, not a project
dependency): confirmed leg rotation swings in opposing phase while moving
and resets to exactly 0 at idle, confirmed a crew member displaces >1m
from spawn autonomously and "Press E to talk" still finds them there,
confirmed sitting in the pilot's seat flips `player.sitting` and bends the
rig, and confirmed the speech bubble appears/disappears with the dialogue
panel — zero console or page errors throughout.

## Post-v1: Furniture collision and a richer NPC activity repertoire

Two fixes/features layered on the movement & interaction pass above,
neither touching dialogue, decision logic, or existing wall/corridor
collision.

**Furniture collision** (`js/ship.js`): only room/corridor boundaries ever
blocked movement, so the player and wandering crew walked straight through
the reactor, consoles, tables, crate stacks, lockers and berths
decorations.js places. `PROP_COLLIDERS` is a hand-matched set of
rects/circles approximating the footprint of every prop substantial
enough that a person couldn't walk through it, checked from `isWalkable` —
the single choke point `js/player.js` and `js/crew-behavior.js` already
called every frame, so both pick up furniture collision without either
caller changing. Seats are deliberately excluded (sitting/sleeping means
occupying the chair's/berth's own footprint on purpose). Three of the
existing crew wander waypoints sat inside a prop's new footprint and were
nudged to nearby clear floor.

**Richer NPC activity repertoire** (`js/crew-behavior.js`, `js/character.js`):
extends the wander-only waypoint system into an ordered per-crew list of
"stops" that mix walking with stationary activities — sitting (Kaia in the
pilot's seat, Dessa and Marcus at the mess table), sitting and
reading/taking notes (Corwin at his workbench, Amara checking cargo
inventory), leaning over a console (Corwin at the reactor), a repeated
wipe-motion cleaning pass (Amara in the Cargo Bay), and sleep (Dessa
commutes through the Quarters Corridor via a hand-authored waypoint chain
to her own Crew Quarters berth, lying down for several seconds before
walking back). A rare, purely cosmetic stumble-and-recover can interrupt
any wander segment. All of it reuses `character.js`'s existing
cheap-primitive-rotation rig: a forward tilt for leaning, raised arms
holding a small prop mesh for reading, one arm swinging for cleaning, and
a 90-degree tip for lying down. `js/main.js` reads the new `pose` field
`updateCrewBehavior` sets on each crew member (alongside the existing
curX/curZ/facing/walking) to pick the right pose function each frame.

Covered by new cases in `test/crew-behavior.test.mjs` (an activity pose
gets exercised over time, Dessa completes a full sleep-and-wake cycle
snapping onto and off her berth's collision footprint by design, a forced
stumble never moves anyone) plus new furniture-collision cases in
`test/ship.test.mjs` (a prop blocks its own center, the reactor/a cockpit
console/the mess table each block a straight walk-in, no prop covers a
doorway, every crew/player spawn stays clear) — `npm test` is 64/64.
Verified headlessly in `test/collision-behavior-verify.mjs` (Playwright,
run manually, not a project dependency): confirmed the player is
physically stopped walking straight at both the reactor and the Common
Area mess table, caught a crew member mid-activity (sitting) in a
screenshot, confirmed "Press E to talk" still opens dialogue on a crew
member mid-activity, and ran an extended session (observing an actual
stumble along the way) with zero console or page errors throughout.

## Post-v1: Touch controls for phone browsers

Input was 100% keyboard+mouse even though `index.html` already shipped a
mobile viewport meta tag. `js/touch-controls.js` (new) feature-detects
touch (`"ontouchstart" in window || navigator.maxTouchPoints > 0`) and, only
then, injects an on-screen virtual joystick + interact button for ship
exploration and a throttle + heading joystick for flight mode, swapping
between the two by watching `#flight-hud`'s existing `hidden` attribute
(the same flag `main.js`'s enterFlightMode/exitFlightMode already flip) via
a `MutationObserver`. Styling lives in `css/touch-controls.css`, linked
from `index.html` alongside the existing stylesheet.

Rather than reaching into `player.js`/`flight.js` state directly, every
control dispatches synthetic `KeyboardEvent`s with the same `code` values
a physical key press uses (`KeyW`/`KeyA`/`KeyS`/`KeyD` for movement,
`ArrowLeft`/`ArrowRight`/`ArrowUp`/`ArrowDown` for heading, `KeyE`/`KeyF`
for interact), so the existing `window.addEventListener("keydown"/"keyup",
...)` listeners in both files populate their own `pressed` Sets exactly as
a real keyboard would — this file never touches their internal state, and
keyboard/mouse input keeps working completely unchanged alongside it (both
can drive the game at the same time). The interact button reads whichever
of `#action-prompt`/`#interact-prompt` is currently shown to decide between
KeyF and KeyE, matching whatever the player could physically press. Dialogue
advance needed no new code: `#dialogue-choices` `<li>` entries already only
have `click` listeners, and a tap on a real touch device fires a
synthetic `click` for free.

One deliberate deviation from a literal "mouse-look" touch control: a grep
across every non-vendor file in `js/` turned up no mouse/pointer-drag
camera-look listener anywhere — the ship-exploration camera is a fixed
follow-cam (`player.js`'s `_syncCamera`) and flight heading comes from
discrete keys, not a drag gesture. There was nothing to mirror, so no
touch "look" zone was invented; touch only adds movement + the contextual
interact tap, matching what the game's mouse input actually does today
(nothing, for camera control).

`npm test` is unaffected at 85/85 (touch input is DOM/UI, no new unit
tests). Verified headlessly in `test/touch-controls-verify.mjs`
(Playwright, run manually, not a project dependency) with a real touch
emulation context (`hasTouch: true, isMobile: true`, 390x844 @3x): the
on-screen joystick actually moves the player (confirmed via position and
by reaching Dessa's live position and getting the "Press E to talk"
prompt), tapping the interact button opens her dialogue, tapping a
dialogue choice advances/closes the conversation exactly like a click, and
— after using the keyboard to reach and sit in the pilot's seat, proving
keyboard input still works inside a touch-enabled context — the touch
throttle and heading sticks measurably move `flight.throttle` and
`flight.state.yaw`. A second, plain desktop-viewport context (no touch
emulation) confirmed `#touch-controls` never gets injected there and that
keyboard movement/interact and mouse dialogue clicks are completely
unaffected. Zero console or page errors across both passes.
