// Dialogue engine + content bank sanity checks, run headlessly with
// `node --test` (dialogue.js and dialogue-data.js are pure data/logic,
// no WebGL/DOM needed).
import { test } from "node:test";
import assert from "node:assert/strict";
import { CREW_DIALOGUE } from "../js/dialogue-data.js";
import { CREW } from "../js/crew.js";
import {
  createDialogueState,
  getMood,
  getActivity,
  pickLine,
  startConversation,
  selectTopic,
  resolveRelationshipChoice,
} from "../js/dialogue.js";

const CREW_IDS = Object.keys(CREW_DIALOGUE);

test("every crew member in crew.js has a matching dialogue bank", () => {
  for (const member of CREW) {
    assert.ok(CREW_DIALOGUE[member.id], `missing dialogue bank for ${member.id}`);
    assert.equal(CREW_DIALOGUE[member.id].name, member.name);
  }
  assert.equal(CREW_IDS.length, CREW.length);
});

test("every crew member has a full content bank: greetings, topics, idle, relationship choice", () => {
  for (const id of CREW_IDS) {
    const bank = CREW_DIALOGUE[id];
    assert.ok(bank.greetingFirstMeeting.length >= 2);
    for (const mood of ["neutral", "warm", "cool"]) {
      assert.ok(bank.greetingReturning[mood].length >= 2, `${id} greetingReturning.${mood}`);
      assert.ok(bank.topics.ship[mood].length >= 2, `${id} topics.ship.${mood}`);
      assert.ok(bank.topics.player[mood].length >= 2, `${id} topics.player.${mood}`);
      assert.ok(bank.topics.backstory[mood].length >= 2, `${id} topics.backstory.${mood}`);
    }
    for (const activity of ["working", "idle", "walking"]) {
      assert.ok(bank.idle[activity].length >= 2, `${id} idle.${activity}`);
    }
    assert.ok(bank.relationshipChoice.prompt.length > 0);
    assert.equal(bank.relationshipChoice.options.length, 2);
    const deltas = bank.relationshipChoice.options.map((o) => o.delta).sort();
    assert.deepEqual(deltas, [-1, 1]);
  }
});

test("every crew member has an 'about' bank for each of the other 4 crew", () => {
  for (const id of CREW_IDS) {
    const others = CREW_IDS.filter((otherId) => otherId !== id);
    assert.equal(others.length, 4);
    for (const otherId of others) {
      const key = `about_${otherId}`;
      assert.ok(CREW_DIALOGUE[id].topics[key], `${id} is missing ${key}`);
      for (const mood of ["neutral", "warm", "cool"]) {
        assert.ok(CREW_DIALOGUE[id].topics[key][mood].length >= 1, `${id}.${key}.${mood}`);
      }
    }
  }
});

test("getMood buckets relationship value into cool/neutral/warm", () => {
  assert.equal(getMood(0), "neutral");
  assert.equal(getMood(1), "warm");
  assert.equal(getMood(2), "warm");
  assert.equal(getMood(-1), "cool");
});

test("getActivity returns a valid, deterministic state for a given time", () => {
  const now = 1_000_000;
  const first = getActivity("dessa", now);
  const second = getActivity("dessa", now);
  assert.equal(first, second);
  assert.ok(["working", "idle", "walking"].includes(first));
});

test("getActivity staggers crew so they don't all share the same state", () => {
  const now = 1_000_000;
  const states = CREW_IDS.map((id) => getActivity(id, now));
  assert.ok(new Set(states).size > 1, "expected crew activity to vary at a fixed instant");
});

test("pickLine avoids repeating the immediately preceding line when the pool allows it", () => {
  const pool = ["a", "b", "c"];
  const memberState = { relationship: 0, talkCount: 0, hasMet: false, recentLines: [], choiceResolved: false };
  let previous = null;
  for (let i = 0; i < 30; i++) {
    const line = pickLine(pool, memberState);
    if (previous !== null) {
      assert.notEqual(line, previous, "picked the same line twice in a row from a pool of 3");
    }
    previous = line;
  }
});

test("pickLine falls back to the full pool once everything has been said recently", () => {
  const pool = ["only-one"];
  const memberState = { relationship: 0, talkCount: 0, hasMet: false, recentLines: [], choiceResolved: false };
  for (let i = 0; i < 5; i++) {
    assert.equal(pickLine(pool, memberState), "only-one");
  }
});

test("startConversation gives the first-meeting greeting on the first visit, a returning greeting after", () => {
  const state = createDialogueState();
  const first = startConversation(CREW_DIALOGUE, "corwin", state, 0, () => 0);
  assert.ok(CREW_DIALOGUE.corwin.greetingFirstMeeting.includes(first.line));

  const second = startConversation(CREW_DIALOGUE, "corwin", state, 0, () => 0);
  assert.ok(CREW_DIALOGUE.corwin.greetingReturning.neutral.includes(second.line));
});

test("startConversation reports the crew member's room and a valid activity", () => {
  const state = createDialogueState();
  const result = startConversation(CREW_DIALOGUE, "amara", state, 500000, () => 0);
  assert.equal(result.room, "Cargo Bay");
  assert.ok(["working", "idle", "walking"].includes(result.activity));
});

test("topic selection draws from the mood-appropriate pool", () => {
  const state = createDialogueState();
  state.kaia = { relationship: 1, talkCount: 1, hasMet: true, recentLines: [], choiceResolved: false };
  const result = selectTopic(CREW_DIALOGUE, "kaia", state, "topic:ship", 0, () => 0);
  assert.ok(CREW_DIALOGUE.kaia.topics.ship.warm.includes(result.line));

  state.kaia.relationship = -1;
  const coolResult = selectTopic(CREW_DIALOGUE, "kaia", state, "topic:ship", 0, () => 0);
  assert.ok(CREW_DIALOGUE.kaia.topics.ship.cool.includes(coolResult.line));
});

test("asking one crew member about another draws from that pair's cross-reference bank", () => {
  const state = createDialogueState();
  const result = selectTopic(CREW_DIALOGUE, "corwin", state, "topic:about_dessa", 0, () => 0);
  assert.ok(CREW_DIALOGUE.corwin.topics.about_dessa.neutral.includes(result.line));
});

test("idle topic reflects the crew member's current activity", () => {
  const state = createDialogueState();
  const now = 0;
  const activity = getActivity("marcus", now);
  const result = selectTopic(CREW_DIALOGUE, "marcus", state, "topic:idle", now, () => 0);
  assert.ok(CREW_DIALOGUE.marcus.idle[activity].includes(result.line));
});

test("relationship choice appears only once, shifts relationship, and biases future mood", () => {
  const state = createDialogueState();
  startConversation(CREW_DIALOGUE, "amara", state, 0, () => 0);

  let choices = selectTopic(CREW_DIALOGUE, "amara", state, "topic:ship", 0, () => 0).choices;
  assert.ok(choices.some((c) => c.id === "choice:relationship"));

  const result = resolveRelationshipChoice(CREW_DIALOGUE, "amara", state, "give");
  assert.equal(result.relationship, 1);
  assert.equal(result.mood, "warm");
  assert.equal(CREW_DIALOGUE.amara.relationshipChoice.options.find((o) => o.id === "give").response, result.line);

  assert.ok(!result.choices.some((c) => c.id === "choice:relationship"), "relationship choice should not reappear once resolved");

  const shipLine = selectTopic(CREW_DIALOGUE, "amara", state, "topic:ship", 0, () => 0);
  assert.ok(CREW_DIALOGUE.amara.topics.ship.warm.includes(shipLine.line));
});

test("the negative relationship option cools future mood instead", () => {
  const state = createDialogueState();
  startConversation(CREW_DIALOGUE, "marcus", state, 0, () => 0);
  const result = resolveRelationshipChoice(CREW_DIALOGUE, "marcus", state, "press");
  assert.equal(result.relationship, -1);
  assert.equal(result.mood, "cool");
});

test("exit ends the conversation with no further choices", () => {
  const state = createDialogueState();
  startConversation(CREW_DIALOGUE, "dessa", state, 0, () => 0);
  const result = selectTopic(CREW_DIALOGUE, "dessa", state, "exit", 0, () => 0);
  assert.equal(result.done, true);
  assert.equal(result.line, null);
  assert.deepEqual(result.choices, []);
});
