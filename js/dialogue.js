// Context-aware dialogue selection engine. Pure logic, no DOM/THREE, so it
// can be unit tested directly (see test/dialogue.test.mjs). Combines a
// smaller hand-authored fragment bank (js/dialogue-data.js) with mood
// (relationship), current activity, and recent-line history so repeated
// conversations don't feel like a fixed script.
//
// One conversation state object (from createDialogueState()) is kept for
// the whole game session and passed into every call here; it holds one
// entry per crew member: relationship (-1/0/+1, biases mood), talkCount,
// hasMet, recentLines (short rolling history to dodge immediate repeats),
// and whether their one relationship-affecting choice has been resolved.

const RECENT_HISTORY = 5;
const ACTIVITY_CYCLE = ["working", "idle", "walking"];
const ACTIVITY_PERIOD_MS = 15000;

export function createDialogueState() {
  return {};
}

function ensureMemberState(state, memberId) {
  if (!state[memberId]) {
    state[memberId] = {
      relationship: 0,
      talkCount: 0,
      hasMet: false,
      recentLines: [],
      choiceResolved: false,
    };
  }
  return state[memberId];
}

// Mood buckets the relationship value into which fragment pool to draw
// from. Kept as three buckets (cool/neutral/warm) rather than a
// continuous scale because the content bank is hand-authored per bucket.
export function getMood(relationship) {
  if (relationship > 0) return "warm";
  if (relationship < 0) return "cool";
  return "neutral";
}

function hashString(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

// Deterministic activity state per crew member, staggered by name so all
// 5 crew don't flip state in lockstep. This stands in for real NPC
// scheduling: crew stay in their fixed room (see dialogue-data.js `room`)
// but what they're "doing" there cycles over time, which is enough to
// make idle flavor and the interact prompt feel alive without adding
// NPC pathing.
export function getActivity(memberId, now = Date.now()) {
  const offset = hashString(memberId) % ACTIVITY_CYCLE.length;
  const idx = (Math.floor(now / ACTIVITY_PERIOD_MS) + offset) % ACTIVITY_CYCLE.length;
  return ACTIVITY_CYCLE[idx];
}

function remember(memberState, line) {
  memberState.recentLines.push(line);
  if (memberState.recentLines.length > RECENT_HISTORY) memberState.recentLines.shift();
}

// Picks a line from `pool`, preferring ones not said recently to this
// crew member. Falls back in stages so small pools + long conversations
// never stall: first try lines outside the whole recent-history window,
// then just exclude the single most recent line (guaranteeing no
// back-to-back repeat whenever the pool has more than one line), then
// give up and reuse the full pool (only possible for a 1-line pool).
export function pickLine(pool, memberState, rng = Math.random) {
  let options = pool.filter((line) => !memberState.recentLines.includes(line));
  if (options.length === 0) {
    const last = memberState.recentLines[memberState.recentLines.length - 1];
    options = pool.filter((line) => line !== last);
  }
  if (options.length === 0) options = pool;
  const line = options[Math.floor(rng() * options.length)];
  remember(memberState, line);
  return line;
}

function buildChoices(dialogueData, memberId, memberState) {
  const bank = dialogueData[memberId];
  const choices = [
    { id: "topic:ship", label: "Ask about the ship" },
    { id: "topic:backstory", label: "Ask about their past" },
    { id: "topic:player", label: "Ask what they think of you" },
    { id: "topic:idle", label: "Ask what they're up to" },
  ];
  for (const otherId of Object.keys(dialogueData)) {
    if (otherId === memberId) continue;
    choices.push({ id: `topic:about_${otherId}`, label: `Ask about ${dialogueData[otherId].name}` });
  }
  if (!memberState.choiceResolved && bank.relationshipChoice) {
    choices.push({ id: "choice:relationship", label: bank.relationshipChoice.prompt });
  }
  choices.push({ id: "exit", label: "End conversation" });
  return choices;
}

// Opens a conversation: first-meeting or returning greeting (mood-biased),
// plus the current topic menu. Marks the crew member as met and bumps
// their talk count.
export function startConversation(dialogueData, memberId, state, now = Date.now(), rng = Math.random) {
  const bank = dialogueData[memberId];
  const memberState = ensureMemberState(state, memberId);
  const mood = getMood(memberState.relationship);

  const line = memberState.hasMet
    ? pickLine(bank.greetingReturning[mood], memberState, rng)
    : pickLine(bank.greetingFirstMeeting, memberState, rng);

  memberState.hasMet = true;
  memberState.talkCount += 1;

  return {
    line,
    mood,
    room: bank.room,
    activity: getActivity(memberId, now),
    talkCount: memberState.talkCount,
    choices: buildChoices(dialogueData, memberId, memberState),
  };
}

// Handles picking a topic (or exiting). Relationship-choice topics don't
// resolve here — they return their options for the caller (UI) to present
// separately via resolveRelationshipChoice.
export function selectTopic(dialogueData, memberId, state, choiceId, now = Date.now(), rng = Math.random) {
  const bank = dialogueData[memberId];
  const memberState = ensureMemberState(state, memberId);

  if (choiceId === "exit") {
    return { done: true, line: null, choices: [] };
  }

  if (choiceId === "choice:relationship") {
    return {
      done: false,
      isRelationshipChoice: true,
      prompt: bank.relationshipChoice.prompt,
      options: bank.relationshipChoice.options,
    };
  }

  if (choiceId === "topic:idle") {
    const activity = getActivity(memberId, now);
    const line = pickLine(bank.idle[activity], memberState, rng);
    return { done: false, line, activity, choices: buildChoices(dialogueData, memberId, memberState) };
  }

  if (choiceId.startsWith("topic:about_")) {
    const otherId = choiceId.slice("topic:about_".length);
    const mood = getMood(memberState.relationship);
    const line = pickLine(bank.topics[`about_${otherId}`][mood], memberState, rng);
    return { done: false, line, mood, choices: buildChoices(dialogueData, memberId, memberState) };
  }

  if (choiceId.startsWith("topic:")) {
    const topic = choiceId.slice("topic:".length);
    const mood = getMood(memberState.relationship);
    const line = pickLine(bank.topics[topic][mood], memberState, rng);
    return { done: false, line, mood, choices: buildChoices(dialogueData, memberId, memberState) };
  }

  throw new Error(`Unknown dialogue choice: ${choiceId}`);
}

// Applies a relationship-affecting choice: shifts relationship by the
// option's delta, marks the crew member's one-time choice resolved, and
// returns their in-character reaction line.
export function resolveRelationshipChoice(dialogueData, memberId, state, optionId) {
  const bank = dialogueData[memberId];
  const memberState = ensureMemberState(state, memberId);
  const option = bank.relationshipChoice.options.find((o) => o.id === optionId);
  if (!option) throw new Error(`Unknown relationship option: ${optionId}`);

  memberState.relationship += option.delta;
  memberState.choiceResolved = true;

  return {
    done: false,
    line: option.response,
    relationship: memberState.relationship,
    mood: getMood(memberState.relationship),
    choices: buildChoices(dialogueData, memberId, memberState),
  };
}
