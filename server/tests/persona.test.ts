import assert from "node:assert/strict";
import { test } from "node:test";
import { buildSimulationSystemPrompt } from "../src/prompts/persona.ts";
import { buildDebriefUserPrompt, DEBRIEF_SYSTEM_PROMPT } from "../src/prompts/debrief.ts";
import { EXTRACTION_SYSTEM_PROMPT } from "../src/prompts/extraction.ts";
import { DIFFICULTIES, RESPONSE_STYLES, SCENARIOS } from "../src/prompts/scenarios.ts";
import { cleanSpokenText, toMessageParams } from "../src/services/simulation.ts";
import { SessionSetupSchema, type Assessment, type SessionSetup } from "../src/types.ts";

const managerAssessment: Assessment = {
  name: "Marcus Bell",
  disc: {
    natural: { D: 82, I: 35, S: 28, C: 71 },
    adapted: { D: 70, I: 40, S: 35, C: 65 },
    wheel_position: "Conducting Analyzer (Natural)",
  },
  driving_forces: {
    primary: [
      { name: "Commanding", score: 78, descriptor: "Driven by status and control." },
      { name: "Instinctive", score: 66, descriptor: "Relies on past experience." },
      { name: "Intentional", score: 60, descriptor: "Assists others for a purpose." },
      { name: "Objective", score: 58, descriptor: "Functional and practical." },
    ],
    situational: [{ name: "Structured", score: 45, descriptor: "Some need for order." }],
    indifferent: [
      { name: "Resourceful", score: 12, descriptor: "Not driven by ROI." },
      { name: "Harmonious", score: 20, descriptor: "Indifferent to balance." },
    ],
  },
  competencies: {
    top_5: ["Decision Making", "Goal Orientation", "Leadership", "Planning and Organizing", "Resiliency"],
    bottom_5: ["Self-Awareness", "Conflict Management", "Personal Accountability", "Empathy", "Diplomacy"],
  },
  behavioral_flags: {
    under_pressure: ["Becomes blunt and impatient.", "Takes charge without consulting."],
    communication_do: ["Be brief and to the point.", "Provide facts and figures."],
    communication_dont: ["Don't ramble or waste time.", "Don't be vague about expectations."],
    areas_for_improvement: ["May overstep authority.", "Can be dismissive of others' feelings."],
  },
};

const baseSetup: SessionSetup = SessionSetupSchema.parse({
  managerName: "Marcus",
  scenario: "hard_feedback",
  situationContext: "Marcus has been missing weekly check-ins and two of his direct reports came to me separately.",
  responseStyle: "defensive",
  difficulty: "challenging",
});

test("system prompt without assessment uses the archetype", () => {
  const prompt = buildSimulationSystemPrompt(baseSetup);
  assert.match(prompt, /BEHAVIORAL ARCHETYPE/);
  assert.match(prompt, /DEFENSIVE/);
  assert.match(prompt, /CHALLENGING/);
  assert.match(prompt, /missing weekly check-ins/);
  assert.match(prompt, /You are Marcus/);
  assert.doesNotMatch(prompt, /BEHAVIORAL PROFILE FOR/);
});

test("system prompt with manager assessment is built from the profile", () => {
  const prompt = buildSimulationSystemPrompt({ ...baseSetup, managerAssessment });
  assert.match(prompt, /BEHAVIORAL PROFILE FOR MARCUS/);
  assert.match(prompt, /High D:/);
  assert.match(prompt, /High C:/);
  assert.match(prompt, /Low S:/);
  assert.match(prompt, /High Commanding/);
  assert.match(prompt, /High Instinctive/);
  assert.match(prompt, /Low Resourceful/);
  assert.doesNotMatch(prompt, /High Harmonious/);
  assert.match(prompt, /Low self-awareness/);
  assert.match(prompt, /Low conflict management/);
  assert.match(prompt, /Low personal accountability/);
  assert.match(prompt, /Don't ramble or waste time/);
  assert.match(prompt, /EMOTIONAL TONE LAYER/);
  assert.doesNotMatch(prompt, /BEHAVIORAL ARCHETYPE/);
});

test("assessment materially changes the prompt", () => {
  const without = buildSimulationSystemPrompt(baseSetup);
  const withA = buildSimulationSystemPrompt({ ...baseSetup, managerAssessment });
  assert.notEqual(without, withA);
  assert.ok(withA.length > without.length + 500);
});

test("every style and difficulty renders and never says the forbidden word", () => {
  for (const responseStyle of Object.keys(RESPONSE_STYLES) as SessionSetup["responseStyle"][]) {
    for (const difficulty of Object.keys(DIFFICULTIES) as SessionSetup["difficulty"][]) {
      for (const managerAssessmentOrNull of [null, managerAssessment]) {
        const prompt = buildSimulationSystemPrompt({
          ...baseSetup,
          responseStyle,
          difficulty,
          managerAssessment: managerAssessmentOrNull,
        });
        assert.doesNotMatch(prompt, /subordinate/i);
        assert.match(prompt, /never break character/);
        assert.match(prompt, /never acknowledge that this is a simulation/);
      }
    }
  }
});

test("debrief prompt personalizes when the leader assessment is present", () => {
  const generic = buildDebriefUserPrompt(baseSetup, []);
  assert.match(generic, /LEADER'S PROFILE: not provided/);
  assert.match(generic, /ended the session before saying anything/);

  const personal = buildDebriefUserPrompt(
    { ...baseSetup, leaderAssessment: { ...managerAssessment, name: "Carlos" }, managerAssessment },
    [
      { id: "1", role: "leader", content: "Marcus, I want to talk about the check-ins.", createdAt: "" },
      { id: "2", role: "manager", content: "Which check-ins?", createdAt: "" },
    ],
  );
  assert.match(personal, /LEADER'S TRIMETRIX DNA PROFILE/);
  assert.match(personal, /MARCUS'S TRIMETRIX DNA PROFILE/);
  assert.match(personal, /BOTH PROFILES ARE LOADED/);
  assert.match(personal, /LEADER: Marcus, I want to talk about the check-ins\./);
  assert.match(personal, /MARCUS: Which check-ins\?/);
});

test("no prompt anywhere uses the forbidden word, and GAME language is exact", () => {
  const everything = [
    DEBRIEF_SYSTEM_PROMPT,
    EXTRACTION_SYSTEM_PROMPT,
    ...Object.values(SCENARIOS).map((s) => s.title + s.leaderGoal + s.managerFraming),
    ...Object.values(RESPONSE_STYLES).map((s) => s.prompt + s.description),
    ...Object.values(DIFFICULTIES).map((d) => d.prompt + d.description),
  ].join("\n");
  assert.doesNotMatch(everything, /subordinate/i);
  assert.match(DEBRIEF_SYSTEM_PROMPT, /Genuine, Actionable, Meaningful, Engaging/);
});

test("transcript maps leader to user and manager to assistant", () => {
  const params = toMessageParams([
    { id: "1", role: "leader", content: "Hi", createdAt: "" },
    { id: "2", role: "manager", content: "Hey", createdAt: "" },
  ]);
  assert.deepEqual(params, [
    { role: "user", content: "Hi" },
    { role: "assistant", content: "Hey" },
  ]);
});

test("cleanSpokenText strips labels, quotes, and stage directions", () => {
  assert.equal(cleanSpokenText('Marcus: "I don\'t think that\'s fair."'), "I don't think that's fair.");
  assert.equal(cleanSpokenText("*sighs* Fine. [pauses] What do you want me to say?"), "Fine. What do you want me to say?");
  assert.equal(cleanSpokenText("  Okay.  "), "Okay.");
});

test("setup schema defaults optional fields", () => {
  const parsed = SessionSetupSchema.parse({
    managerName: "  Priya ",
    scenario: "hard_feedback",
    responseStyle: "agreeable",
    difficulty: "moderate",
  });
  assert.equal(parsed.managerName, "Priya");
  assert.equal(parsed.situationContext, "");
  assert.equal(parsed.leaderAssessment, null);
  assert.equal(parsed.managerAssessment, null);
});
