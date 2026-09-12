# TODO

Checked sequence — confirm each stage with Nick before starting the next.

1. [x] Set up a new repo/project structure separate from the joinery
   project.
2. [x] Build the ship layout (a few low-poly rooms/areas, navigable in
   Three.js).
3. [ ] Add the 5 crew members as characters the player can approach and
   talk to. Invent full names, backstories, and dialogue voice for each.
4. [ ] Build a basic dialogue system (branching lines, at least one
   relationship-affecting choice per crew member).
5. [ ] Wire in 2-3 decision points with visible consequences.
6. [ ] Test the full loop end to end in the browser before calling it done.

Currently the ship layout is built: four rooms (Cockpit, Common Area,
Engine Room, Cargo Bay) connected by corridors, with wall geometry and
doorway gaps defined in `js/ship.js`. The player moves with WASD/arrow
keys via `js/player.js` (follow camera, circle-vs-rect collision against
room/corridor footprints). Verified rendering and movement in a headless
browser with no console errors. Crew members are step 3.
