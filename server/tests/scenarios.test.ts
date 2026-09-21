import assert from "node:assert/strict";
import { test } from "node:test";
import { buildSimulationSystemPrompt } from "../src/prompts/persona.ts";
import { buildDebriefSystemPrompt, buildDebriefUserPrompt } from "../src/prompts/debrief.ts";
import { RESPONSE_STYLES, SCENARIO_IDS, SCENARIOS, scenarioTitle } from "../src/prompts/scenarios.ts";
import type { RoleLevel } from "../src/roles.ts";
import { SessionSetupSchema, type ResponseStyle, type ScenarioId, type SessionSetup } from "../src/types.ts";

/** Assembled from fragments so the repo-wide forbidden-word guard can scan this file. */
const FORBIDDEN = new RegExp(["sub", "ordinate"].join(""), "i");

const LEVELS: RoleLevel[] = [1, 2, 3];
const STYLES = Object.keys(RESPONSE_STYLES) as ResponseStyle[];

function setupFor(
  scenario: ScenarioId,
  userLevel: RoleLevel,
  simulatedLevel: RoleLevel,
  responseStyle: ResponseStyle = "defensive",
): SessionSetup {
  return SessionSetupSchema.parse({
    userRole: { level: userLevel },
    simulatedRole: { level: simulatedLevel },
    simulatedName: "Priya",
    scenario,
    responseStyle,
    difficulty: "moderate",
  });
}

test("all four scenarios exist with card copy", () => {
  assert.deepEqual(SCENARIO_IDS, ["hard_feedback", "accountability", "reengagement", "low_motivation"]);
  for (const s of Object.values(SCENARIOS)) {
    assert.ok(s.label.length > 0);
    assert.ok(s.description.length > 0);
    assert.ok(s.placeholder.startsWith("e.g."));
  }
  assert.equal(SCENARIOS.accountability.label, "Accountability Conversation");
  assert.equal(SCENARIOS.reengagement.label, "Re-engagement Conversation");
  assert.equal(SCENARIOS.low_motivation.label, "Low Motivation Conversation");
});

test("the session carries the full scenario object, from an id or an { id }", () => {
  const a = setupFor("accountability", 1, 2);
  assert.deepEqual(a.scenario, {
    id: "accountability",
    label: "Accountability Conversation",
    description: SCENARIOS.accountability.description,
    title: "Following up on a missed commitment with a manager on your team",
  });
  const b = SessionSetupSchema.parse({
    userRole: { level: 3 },
    simulatedRole: { level: 1 },
    simulatedName: "Dana",
    scenario: { id: "low_motivation" },
    responseStyle: "agreeable",
    difficulty: "moderate",
  });
  assert.equal(b.scenario.id, "low_motivation");
  assert.equal(b.scenario.title, "Telling a senior leader you're running on empty");
  assert.equal(SessionSetupSchema.safeParse({ ...b, scenario: "nope" }).success, false);
});

test("hard feedback is unchanged", () => {
  assert.equal(scenarioTitle("hard_feedback", 1, 2), "Delivering hard feedback to a manager on your team");
  assert.equal(SCENARIOS.hard_feedback.simulatedBehavior("downward", "defensive"), "");
  const prompt = buildSimulationSystemPrompt(setupFor("hard_feedback", 1, 2));
  assert.doesNotMatch(prompt, /HOW YOU BEHAVE IN THIS CONVERSATION/);
});

test("titles reflect direction for the new scenarios", () => {
  assert.equal(scenarioTitle("reengagement", 1, 2), "Re-engaging a manager on your team");
  assert.equal(scenarioTitle("reengagement", 3, 2), "Telling your manager you've pulled back");
  assert.equal(scenarioTitle("reengagement", 2, 2), "Checking in on a peer who's pulled back");
  assert.equal(scenarioTitle("low_motivation", 2, 3), "Addressing low motivation with a team member you lead");
  assert.equal(scenarioTitle("low_motivation", 3, 3), "Naming a peer's disengagement");
  assert.equal(scenarioTitle("accountability", 2, 2), "Following up on a missed commitment with a peer");
});

test("accountability behavior follows style and direction", () => {
  const down = buildSimulationSystemPrompt(setupFor("accountability", 1, 2, "agreeable"));
  assert.match(down, /HOW YOU BEHAVE IN THIS CONVERSATION\. You have an excuse ready/);
  assert.match(down, /over-commit again in the moment/);
  assert.doesNotMatch(down, /let's not dwell/);
  const up = buildSimulationSystemPrompt(setupFor("accountability", 3, 1, "defensive"));
  assert.match(up, /let's not dwell on what didn't happen/);
  assert.match(up, /challenge whether the deadline was realistic/);
  const lateral = buildSimulationSystemPrompt(setupFor("accountability", 2, 2, "deflecting"));
  assert.match(lateral, /called out rather than supported/);
  assert.match(lateral, /point to external factors/);
});

test("re-engagement behavior hides the real reason and flips in upward conversations", () => {
  const down = buildSimulationSystemPrompt(setupFor("reengagement", 1, 3, "emotional"));
  assert.match(down, /'I'm fine' or 'just been busy'/);
  assert.match(down, /eventually open up/);
  const up = buildSimulationSystemPrompt(setupFor("reengagement", 3, 1, "defensive"));
  assert.match(up, /not felt connected to the direction/);
  assert.doesNotMatch(up, /'I'm fine'/);
  const lateral = buildSimulationSystemPrompt(setupFor("reengagement", 3, 3, "agreeable"));
  assert.match(lateral, /less formal and more personal/);
});

test("low motivation behavior is surprised downward and vulnerable upward", () => {
  const down = buildSimulationSystemPrompt(setupFor("low_motivation", 2, 3, "defensive"));
  assert.match(down, /surprised the conversation is happening/);
  assert.match(down, /effort over output/);
  const up = buildSimulationSystemPrompt(setupFor("low_motivation", 2, 1, "deflecting"));
  assert.match(up, /running on empty/);
  assert.match(up, /straight to solutions/);
  const lateral = buildSimulationSystemPrompt(setupFor("low_motivation", 2, 2, "emotional"));
  assert.match(lateral, /not officially their lane/);
});

test("every scenario, dynamic, and style renders with no placeholders and no forbidden word", () => {
  for (const scenario of SCENARIO_IDS) {
    for (const u of LEVELS) {
      for (const s of LEVELS) {
        for (const style of STYLES) {
          const setup = setupFor(scenario, u, s, style);
          const prompt = buildSimulationSystemPrompt(setup);
          assert.doesNotMatch(prompt, /\{\{/, `${scenario} ${u}->${s} ${style}`);
          assert.doesNotMatch(prompt, FORBIDDEN);
          assert.match(prompt, new RegExp(`SCENARIO: ${setup.scenario.title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`));
          const system = buildDebriefSystemPrompt(setup);
          assert.match(system, new RegExp(`SCENARIO LENS \\(${SCENARIOS[scenario].label}\\)`));
          assert.match(system, new RegExp(SCENARIOS[scenario].debriefLens.slice(0, 30).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
          assert.doesNotMatch(system, FORBIDDEN);
          const user = buildDebriefUserPrompt(setup, []);
          assert.match(user, /WHAT THE USER WAS TRYING TO DO/);
          assert.doesNotMatch(user, FORBIDDEN);
        }
      }
    }
  }
});
