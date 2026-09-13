// On-screen touch input for phone browsers. Feature-detects touch and, if
// present, injects a virtual joystick + interact button for ship
// exploration and a throttle + heading joystick for flight mode, switching
// between the two by watching #flight-hud's `hidden` attribute (the same
// flag main.js's enterFlightMode/exitFlightMode already toggle).
//
// Every control drives the game by dispatching synthetic KeyboardEvents
// with the same `code` values a physical key press uses, so player.js's
// and flight.js's existing `window.addEventListener("keydown"/"keyup", ...)`
// listeners populate their own `pressed` Sets exactly as they would from a
// real keyboard, and main.js's own KeyE/KeyF keydown handler fires
// unchanged. This file never reaches into player/flight/main state
// directly, so keyboard and mouse input keep working untouched alongside
// it.
//
// There is deliberately no touch "look" drag: the ship-exploration camera
// is a fixed follow-cam (js/player.js's _syncCamera) and flight mode's
// heading comes from discrete key input, not a mouse-look control — this
// project has no such input for a touch layer to mirror.

function isTouchDevice() {
  return "ontouchstart" in window || navigator.maxTouchPoints > 0;
}

function fireKey(type, code) {
  window.dispatchEvent(new KeyboardEvent(type, { code, bubbles: true }));
}

// Tracks which synthetic codes are "held" and fires keydown/keyup only on
// the transitions, mirroring how a real keyboard's keydown/keyup pairs up.
class KeyState {
  constructor() {
    this.active = new Set();
  }
  set(codes) {
    for (const code of codes) {
      if (!this.active.has(code)) fireKey("keydown", code);
    }
    for (const code of this.active) {
      if (!codes.has(code)) fireKey("keyup", code);
    }
    this.active = codes;
  }
  clear() {
    this.set(new Set());
  }
}

function makeStick(id, className) {
  const el = document.createElement("div");
  el.id = id;
  el.className = `tc-stick ${className}`;
  el.innerHTML = '<div class="tc-base"><div class="tc-nub"></div></div>';
  return el;
}

// A single-touch analog stick: reports normalized dx/dy in [-1, 1] off the
// base element's own center, moves the nub to match, and ignores extra
// touches while one is already active. `axis: "y"` clamps it to a vertical
// lever (used for the flight throttle).
function attachStick(root, { axis, deadzone = 0.25, onChange, onEnd }) {
  const base = root.querySelector(".tc-base");
  const nub = root.querySelector(".tc-nub");
  let touchId = null;
  let cx = 0;
  let cy = 0;
  let radius = 1;

  function findTouch(e) {
    for (const t of e.changedTouches) {
      if (t.identifier === touchId) return t;
    }
    return null;
  }

  function apply(clientX, clientY) {
    let dx = axis === "y" ? 0 : (clientX - cx) / radius;
    let dy = (clientY - cy) / radius;
    const len = Math.hypot(dx, dy);
    if (len > 1) {
      dx /= len;
      dy /= len;
    }
    nub.style.transform = `translate(${dx * radius * 0.5}px, ${dy * radius * 0.5}px)`;
    onChange(Math.abs(dx) < deadzone ? 0 : dx, Math.abs(dy) < deadzone ? 0 : dy);
  }

  function start(e) {
    if (touchId !== null) return;
    const touch = e.changedTouches[0];
    touchId = touch.identifier;
    const rect = base.getBoundingClientRect();
    cx = rect.left + rect.width / 2;
    cy = rect.top + rect.height / 2;
    radius = rect.width / 2;
    apply(touch.clientX, touch.clientY);
    e.preventDefault();
  }

  function move(e) {
    if (touchId === null) return;
    const touch = findTouch(e);
    if (!touch) return;
    apply(touch.clientX, touch.clientY);
    e.preventDefault();
  }

  function end(e) {
    if (touchId === null) return;
    if (e.type !== "touchcancel" && !findTouch(e)) return;
    touchId = null;
    nub.style.transform = "translate(0, 0)";
    onChange(0, 0);
    if (onEnd) onEnd();
    e.preventDefault();
  }

  base.addEventListener("touchstart", start, { passive: false });
  window.addEventListener("touchmove", move, { passive: false });
  window.addEventListener("touchend", end, { passive: false });
  window.addEventListener("touchcancel", end, { passive: false });
}

function setupMoveJoystick(root) {
  const keys = new KeyState();
  attachStick(root, {
    onChange(dx, dy) {
      const codes = new Set();
      if (dx < 0) codes.add("KeyA");
      if (dx > 0) codes.add("KeyD");
      if (dy < 0) codes.add("KeyW");
      if (dy > 0) codes.add("KeyS");
      keys.set(codes);
    },
    onEnd() {
      keys.clear();
    },
  });
}

function setupThrottle(root) {
  const keys = new KeyState();
  attachStick(root, {
    axis: "y",
    onChange(_dx, dy) {
      const codes = new Set();
      if (dy < 0) codes.add("KeyW");
      if (dy > 0) codes.add("KeyS");
      keys.set(codes);
    },
    onEnd() {
      keys.clear();
    },
  });
}

function setupHeading(root) {
  const keys = new KeyState();
  attachStick(root, {
    onChange(dx, dy) {
      const codes = new Set();
      if (dx < 0) codes.add("ArrowLeft");
      if (dx > 0) codes.add("ArrowRight");
      if (dy < 0) codes.add("ArrowUp");
      if (dy > 0) codes.add("ArrowDown");
      keys.set(codes);
    },
    onEnd() {
      keys.clear();
    },
  });
}

// Fires whichever contextual action is currently on offer: standing up /
// toggling an object (#action-prompt, KeyF) takes priority since it means
// the player is already mid-interaction, otherwise talking to nearby crew
// (#interact-prompt, KeyE). Firing KeyE with nothing nearby is a no-op —
// main.js's own handler already guards on `nearbyCrew`.
function setupInteractButton(btn, interactPrompt, actionPrompt) {
  btn.addEventListener(
    "touchstart",
    (e) => {
      e.preventDefault();
      const code = actionPrompt && !actionPrompt.hidden ? "KeyF" : "KeyE";
      fireKey("keydown", code);
      fireKey("keyup", code);
    },
    { passive: false }
  );
}

function init() {
  if (!isTouchDevice()) return;

  const interactPrompt = document.getElementById("interact-prompt");
  const actionPrompt = document.getElementById("action-prompt");
  const flightHud = document.getElementById("flight-hud");
  const hint = document.getElementById("hint");
  if (hint) hint.hidden = true;

  const wrapper = document.createElement("div");
  wrapper.id = "touch-controls";
  document.body.appendChild(wrapper);

  const moveStick = makeStick("tc-move", "tc-bottom-left");
  const interactBtn = document.createElement("div");
  interactBtn.id = "tc-interact";
  interactBtn.className = "tc-button tc-bottom-right";

  const throttleStick = makeStick("tc-throttle", "tc-bottom-left");
  const headingStick = makeStick("tc-heading", "tc-bottom-right");

  wrapper.append(moveStick, interactBtn, throttleStick, headingStick);

  setupMoveJoystick(moveStick);
  setupThrottle(throttleStick);
  setupHeading(headingStick);
  setupInteractButton(interactBtn, interactPrompt, actionPrompt);

  function syncMode() {
    const flying = !!flightHud && !flightHud.hidden;
    moveStick.style.display = flying ? "none" : "";
    // interactBtn stays visible in flight mode too: it's the only touch
    // control wired to fire KeyF, and KeyF is how the player stands up out
    // of the pilot's seat (main.js's handleInteract). Hiding it here left
    // touch users with no way to ever exit flight mode. It shifts up via
    // .tc-flying so it doesn't sit under the heading stick.
    interactBtn.classList.toggle("tc-flying", flying);
    throttleStick.style.display = flying ? "" : "none";
    headingStick.style.display = flying ? "" : "none";
  }
  syncMode();

  if (flightHud) {
    new MutationObserver(syncMode).observe(flightHud, {
      attributes: true,
      attributeFilter: ["hidden"],
    });
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
