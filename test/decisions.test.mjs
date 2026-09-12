// Step 5: ship/story-level decision points with visible consequences.
// Covers the 3 decisions wired into the dialogue engine (contract, via
// Dessa; marcusSecret, via Marcus; supplyRun, via Corwin): each path sets
// the right decision state, applies cross-crew relationship effects, and
// stays locked out once resolved so a single playthrough can't re-pick.
import { test } from "node:test";
import assert from "node:assert/strict";
import { CREW_DIALOGUE } from "../js/dialogue-data.js";
import {
  createDialogueState,
  startConversation,
  selectTopic,
  resolveDecision,
  getDecisionOutcome,
} from "../js/dialogue.js";

test("Dessa offers the contract decision from the first conversation", () => {
  const state = createDialogueState();
  const start = startConversation(CREW_DIALOGUE, "dessa", state, 0, () => 0);
  assert.ok(start.choices.some((c) => c.id === "decision:contract"));
});

test("resolving the contract decision applies effects across multiple crew and locks itself out", () => {
  const state = createDialogueState();
  startConversation(CREW_DIALOGUE, "dessa", state, 0, () => 0);

  const opened = selectTopic(CREW_DIALOGUE, "dessa", state, "decision:contract", 0, () => 0);
  assert.equal(opened.isDecision, true);
  assert.equal(opened.decisionId, "contract");
  assert.ok(opened.options.some((o) => o.id === "drift"));

  const result = resolveDecision(CREW_DIALOGUE, "dessa", state, "contract", "drift");
  assert.equal(getDecisionOutcome(state, "contract"), "drift");
  assert.equal(state.corwin.relationship, 2);
  assert.equal(state.amara.relationship, 1);
  assert.equal(state.dessa.relationship, -1);
  assert.equal(result.line, CREW_DIALOGUE.dessa.decision.options.find((o) => o.id === "drift").response);

  // Locked out: the decision choice no longer appears for Dessa...
  const afterChoices = selectTopic(CREW_DIALOGUE, "dessa", state, "topic:ship", 0, () => 0).choices;
  assert.ok(!afterChoices.some((c) => c.id === "decision:contract"));

  // ...and re-resolving throws rather than silently re-applying effects.
  assert.throws(() => resolveDecision(CREW_DIALOGUE, "dessa", state, "contract", "compact"));
});

test("other crew members' dialogue reacts to the contract decision once it's made", () => {
  const state = createDialogueState();
  startConversation(CREW_DIALOGUE, "dessa", state, 0, () => 0);
  resolveDecision(CREW_DIALOGUE, "dessa", state, "contract", "compact");

  const corwinStart = startConversation(CREW_DIALOGUE, "corwin", state, 0, () => 0);
  assert.ok(corwinStart.choices.some((c) => c.id === "topic:reaction_contract"));

  const reaction = selectTopic(CREW_DIALOGUE, "corwin", state, "topic:reaction_contract", 0, () => 0);
  assert.equal(reaction.line, CREW_DIALOGUE.corwin.decisionReactions.contract.compact);

  const kaiaStart = startConversation(CREW_DIALOGUE, "kaia", state, 0, () => 0);
  assert.ok(kaiaStart.choices.some((c) => c.id === "topic:reaction_contract"));
  const kaiaReaction = selectTopic(CREW_DIALOGUE, "kaia", state, "topic:reaction_contract", 0, () => 0);
  assert.equal(kaiaReaction.line, CREW_DIALOGUE.kaia.decisionReactions.contract.compact);
});

test("Marcus's secret decision is gated behind talkCount and not offered on first meeting", () => {
  const state = createDialogueState();
  const first = startConversation(CREW_DIALOGUE, "marcus", state, 0, () => 0);
  assert.ok(!first.choices.some((c) => c.id === "decision:marcusSecret"));

  const second = startConversation(CREW_DIALOGUE, "marcus", state, 0, () => 0);
  assert.ok(second.choices.some((c) => c.id === "decision:marcusSecret"));
});

test("covering for Marcus raises his trust but costs Dessa and Corwin", () => {
  const state = createDialogueState();
  startConversation(CREW_DIALOGUE, "marcus", state, 0, () => 0);
  startConversation(CREW_DIALOGUE, "marcus", state, 0, () => 0);

  resolveDecision(CREW_DIALOGUE, "marcus", state, "marcusSecret", "cover");
  assert.equal(state.marcus.relationship, 2);
  assert.equal(state.dessa.relationship, -1);
  assert.equal(state.corwin.relationship, -1);
  assert.equal(getDecisionOutcome(state, "marcusSecret"), "cover");

  const dessaReaction = selectTopic(
    CREW_DIALOGUE,
    "dessa",
    state,
    "topic:reaction_marcusSecret",
    0,
    () => 0
  );
  assert.equal(dessaReaction.line, CREW_DIALOGUE.dessa.decisionReactions.marcusSecret.cover);
});

test("reporting Marcus instead drops his trust and reads as vindication to Corwin", () => {
  const state = createDialogueState();
  startConversation(CREW_DIALOGUE, "marcus", state, 0, () => 0);
  startConversation(CREW_DIALOGUE, "marcus", state, 0, () => 0);

  resolveDecision(CREW_DIALOGUE, "marcus", state, "marcusSecret", "report");
  assert.equal(state.marcus.relationship, -2);
  assert.equal(state.dessa.relationship, 1);
  assert.equal(state.corwin.relationship, 1);

  const corwinReaction = selectTopic(
    CREW_DIALOGUE,
    "corwin",
    state,
    "topic:reaction_marcusSecret",
    0,
    () => 0
  );
  assert.equal(corwinReaction.line, CREW_DIALOGUE.corwin.decisionReactions.marcusSecret.report);
});

test("the supply run decision (Corwin) touches up to four crew members at once", () => {
  const state = createDialogueState();
  startConversation(CREW_DIALOGUE, "corwin", state, 0, () => 0);
  resolveDecision(CREW_DIALOGUE, "corwin", state, "supplyRun", "shortcut");

  assert.equal(getDecisionOutcome(state, "supplyRun"), "shortcut");
  assert.equal(state.kaia.relationship, 1);
  assert.equal(state.marcus.relationship, 1);
  assert.equal(state.dessa.relationship, -1);
  assert.equal(state.corwin.relationship, -1);

  for (const id of ["dessa", "amara", "kaia", "marcus"]) {
    const reaction = selectTopic(CREW_DIALOGUE, id, state, "topic:reaction_supplyRun", 0, () => 0);
    assert.equal(reaction.line, CREW_DIALOGUE[id].decisionReactions.supplyRun.shortcut);
  }
});

test("decisions are independent: resolving one doesn't lock or affect another", () => {
  const state = createDialogueState();
  startConversation(CREW_DIALOGUE, "dessa", state, 0, () => 0);
  resolveDecision(CREW_DIALOGUE, "dessa", state, "contract", "compact");

  const corwinStart = startConversation(CREW_DIALOGUE, "corwin", state, 0, () => 0);
  assert.ok(corwinStart.choices.some((c) => c.id === "decision:supplyRun"));
  assert.equal(getDecisionOutcome(state, "supplyRun"), null);
});
