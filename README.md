# The Long Silence

An original narrative sci-fi game, browser-based, Three.js. Not based on any
existing franchise or IP — the setting below is this project's actual canon.
Do not borrow character names, ship names, or lore from any existing sci-fi
show or book series.

v1 is a small vertical slice, not a full game: one ship, five crew, a
branching dialogue system, and 2-3 decisions with visible consequences.

## Setting & tone

Gritty, politically tense solar system: scarcity, moral grey areas,
factional friction. Three factions:

- **The Compact** — Earth-based governing power, bureaucratic, resource-rich,
  distant from the hardship it causes.
- **The Ridgeline Authority** — Mars-analog militarized colonial state,
  disciplined, proud, increasingly independent-minded.
- **The Drift** — loosely organized Belt/outer-system coalition of miners,
  haulers, and station-dwellers; politically fractious, chronically
  under-resourced.

## Ship

**The Long Silence** — a scrappy, working tramp freighter/salvage vessel.
Low-poly/stylised visual design; prioritise speed of building over fidelity.

## Crew

- **Captain** — pragmatic, morally compromised, holds the crew together
  through stubbornness.
- **Engineer** — Drift-loyalist, deeply values the ship and the outer-system
  cause, wary of the Captain's compromises.
- **Pilot** — ex-Ridgeline Authority defector, disciplined, still adjusting
  to life outside a chain of command.
- **Medic/Quartermaster** — Compact-born refugee, quietly political, the
  moral conscience of the crew.
- **Security** — enforcer with a hidden past, loyalty currently uncertain, a
  source of mid-game tension.

Full names, backstories, and dialogue voice for each are in
[CREW.md](CREW.md) (written in step 3), consistent with the faction
leanings above.

## Core loop (first slice only)

Light management + dialogue: the player makes small decisions/tasks aboard
ship that affect relationships with crew and unlock story beats. Not a full
simulation — a small, working vertical slice that proves the loop (a
decision → a visible relationship/story consequence → the player sees it
reflected next time they interact with that crew member).

## Scope for this first version

One ship (a few connected rooms/areas the player can move between), the 5
crew members above, a basic branching dialogue system, and 2-3 meaningful
decision points that visibly affect at least one relationship or unlock a
story beat.

## Running it

No build step. Plain HTML/CSS/JS with three.js vendored as a static file:

```bash
npm run serve
# or: python3 -m http.server 8421
```

Then open `http://localhost:8421/`.

**On WSL2**: WSL2 forwards `localhost` automatically, so
`http://localhost:8421/` from a normal Windows browser should reach the
server running inside WSL.

## Process

Working as a checked sequence — confirm each stage with Nick before moving
to the next. See TODO.md for status.
