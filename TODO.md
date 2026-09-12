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
5. [ ] Wire in 2-3 decision points with visible consequences.
6. [ ] Test the full loop end to end in the browser before calling it done.

Currently the ship layout, the 5 crew, and the dialogue system are all in.
Ship layout: four rooms (Cockpit, Common Area, Engine Room, Cargo Bay)
connected by corridors, with wall geometry and doorway gaps defined in
`js/ship.js`. The player moves with WASD/arrow keys via `js/player.js`
(follow camera, circle-vs-rect collision against room/corridor
footprints). Crew: 5 low-poly capsule markers placed around the ship's
rooms in `js/crew.js`, one per room plus a second in the Common Area.

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
work, zero console errors. Step 5 (decision points with story
consequences) is next.
