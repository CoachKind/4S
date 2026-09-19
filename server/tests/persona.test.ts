import assert from "node:assert/strict";
import { test } from "node:test";
import { buildRoleDynamicSection, buildSimulationSystemPrompt } from "../src/prompts/persona.ts";
import { buildDebriefSystemPrompt, buildDebriefUserPrompt } from "../src/prompts/debrief.ts";
import { EXTRACTION_SYSTEM_PROMPT } from "../src/prompts/extraction.ts";
import { DIFFICULTIES, RESPONSE_STYLES, SCENARIOS, scenarioTitle } from "../src/prompts/scenarios.ts";
import { conversationDirection, DIRECTION_DEBRIEF_SENTENCE, dynamicSentence, ROLE_LEVELS, type RoleLevel } from "../src/roles.ts";
import { cleanSpokenText, toMessageParams } from "../src/services/simulation.ts";
import { SessionSetupSchema, type Assessment, type SessionSetup } from "../src/types.ts";

const simulatedAssessment: Assessment = {
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

const LEVELS: RoleLevel[] = [1, 2, 3];

function setupFor(userLevel: RoleLevel, simulatedLevel: RoleLevel, extra: Record<string, unknown> = {}): SessionSetup {
  return SessionSetupSchema.parse({
    userRole: { level: userLevel },
    simulatedRole: { level: simulatedLevel },
    simulatedName: "Marcus",
    scenario: "hard_feedback",
    situationContext: "Marcus has been missing weekly check-ins and two people came to me separately.",
    responseStyle: "defensive",
    difficulty: "challenging",
    ...extra,
  });
}

const baseSetup = setupFor(1, 2);

test("direction is derived from the two levels", () => {
  assert.equal(conversationDirection(1, 2), "downward");
  assert.equal(conversationDirection(1, 3), "downward");
  assert.equal(conversationDirection(2, 3), "downward");
  assert.equal(conversationDirection(3, 1), "upward");
  assert.equal(conversationDirection(3, 2), "upward");
  assert.equal(conversationDirection(2, 1), "upward");
  assert.equal(conversationDirection(2, 2), "lateral");
  assert.equal(conversationDirection(1, 1), "lateral");
});

test("setup schema fills role labels and direction, and ignores a client-sent direction", () => {
  const s = SessionSetupSchema.parse({
    userRole: { level: 3, label: "whatever" },
    simulatedRole: { level: 1 },
    simulatedName: "Dana",
    scenario: "hard_feedback",
    responseStyle: "agreeable",
    difficulty: "moderate",
    conversationDirection: "downward",
  });
  assert.equal(s.userRole.label, "Lead / Individual Contributor");
  assert.equal(s.simulatedRole.label, "Senior Leader / Executive");
  assert.equal(s.conversationDirection, "upward");
  assert.equal(s.situationContext, "");
  assert.equal(s.userAssessment, null);
  assert.equal(s.simulatedAssessment, null);
});

test("setup schema rejects an invalid level", () => {
  const r = SessionSetupSchema.safeParse({
    userRole: { level: 4 },
    simulatedRole: { level: 1 },
    simulatedName: "Dana",
    scenario: "hard_feedback",
    responseStyle: "agreeable",
    difficulty: "moderate",
  });
  assert.equal(r.success, false);
});

test("context banner sentences match the spec examples", () => {
  assert.equal(dynamicSentence(1, 2), "You're a Senior Leader speaking with a Manager on your team.");
  assert.equal(dynamicSentence(3, 1), "You're an Individual Contributor speaking with a Senior Leader.");
  assert.equal(dynamicSentence(2, 2), "You're a Manager speaking with a peer Manager.");
});

test("scenario title reflects the dynamic", () => {
  assert.equal(scenarioTitle("hard_feedback", 1, 2), "Delivering hard feedback to a manager on your team");
  assert.equal(scenarioTitle("hard_feedback", 2, 3), "Delivering hard feedback to a team member you lead");
  assert.equal(scenarioTitle("hard_feedback", 3, 2), "Delivering hard feedback to your manager");
  assert.equal(scenarioTitle("hard_feedback", 3, 1), "Delivering hard feedback to a senior leader");
  assert.equal(scenarioTitle("hard_feedback", 2, 2), "Delivering hard feedback to a peer");
});

test("system prompt without assessment uses the archetype and the role dynamic", () => {
  const prompt = buildSimulationSystemPrompt(baseSetup);
  assert.match(prompt, /BEHAVIORAL ARCHETYPE/);
  assert.match(prompt, /DEFENSIVE/);
  assert.match(prompt, /CHALLENGING/);
  assert.match(prompt, /missing weekly check-ins/);
  assert.match(prompt, /You are Marcus, a Manager/);
  assert.match(prompt, /Your leader leads you/);
  assert.doesNotMatch(prompt, /BEHAVIORAL PROFILE FOR/);
  assert.doesNotMatch(prompt, /\{\{/);
});

test("system prompt with an assessment is built from the profile", () => {
  const prompt = buildSimulationSystemPrompt({ ...baseSetup, simulatedAssessment });
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
  const withA = buildSimulationSystemPrompt({ ...baseSetup, simulatedAssessment });
  assert.notEqual(without, withA);
  assert.ok(withA.length > without.length + 500);
});

test("role dynamic section changes with level and direction", () => {
  const seniorHearingUpward = buildRoleDynamicSection(1, 3);
  assert.match(seniorHearingUpward, /patronizing/);
  assert.match(seniorHearingUpward, /reports up to you/);
  const seniorPeer = buildRoleDynamicSection(1, 1);
  assert.match(seniorPeer, /peer executive/);
  assert.match(buildRoleDynamicSection(2, 1), /deferential/);
  assert.match(buildRoleDynamicSection(2, 2), /territorial/);
  assert.match(buildRoleDynamicSection(2, 3), /condescension/);
  assert.match(buildRoleDynamicSection(3, 1), /intimidating/);
  assert.match(buildRoleDynamicSection(3, 2), /less institutional confidence/);
  assert.doesNotMatch(buildRoleDynamicSection(3, 2), /intimidating/);
  assert.match(buildRoleDynamicSection(3, 3), /peer at your own level/);
});

test("every dynamic, style, and difficulty renders with no placeholders and no forbidden word", () => {
  for (const userLevel of LEVELS) {
    for (const simulatedLevel of LEVELS) {
      for (const responseStyle of Object.keys(RESPONSE_STYLES) as SessionSetup["responseStyle"][]) {
        for (const difficulty of Object.keys(DIFFICULTIES) as SessionSetup["difficulty"][]) {
          for (const a of [null, simulatedAssessment]) {
            const setup = setupFor(userLevel, simulatedLevel, { responseStyle, difficulty, simulatedAssessment: a });
            const prompt = buildSimulationSystemPrompt(setup);
            assert.doesNotMatch(prompt, /subordinate/i);
            assert.doesNotMatch(prompt, /\{\{/, `unfilled placeholder for ${userLevel}->${simulatedLevel}`);
            assert.match(prompt, /never break character/);
            assert.match(prompt, /never acknowledge that this is a simulation/);
            assert.match(prompt, /WHO YOU ARE IN THIS ORGANIZATION/);
            // A user-term never starts a sentence in lower case.
            assert.doesNotMatch(prompt, /[.!?] (the|your) (senior leader|manager|individual contributor|leader|peer)/);
          }
        }
      }
    }
  }
});

test("the persona never treats the user as the senior one in upward conversations", () => {
  const prompt = buildSimulationSystemPrompt(setupFor(3, 1));
  assert.match(prompt, /You are Marcus, a Senior Leader \/ Executive/);
  assert.match(prompt, /the individual contributor who reports up to you/);
  assert.match(prompt, /reports up to you. You outrank them/);
  assert.doesNotMatch(prompt, /your leader/i);
  assert.doesNotMatch(prompt, /Treat them as your boss/);
});

test("debrief prompts are direction-aware and carry the exact dynamic sentence", () => {
  for (const [u, s] of [[1, 2], [3, 1], [2, 2]] as Array<[RoleLevel, RoleLevel]>) {
    const setup = setupFor(u, s);
    const system = buildDebriefSystemPrompt(setup);
    assert.match(system, new RegExp(`"${DIRECTION_DEBRIEF_SENTENCE[setup.conversationDirection].replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"`));
    assert.match(system, new RegExp(setup.conversationDirection.toUpperCase()));
    assert.match(system, /Genuine, Actionable, Meaningful, Engaging/);
    assert.doesNotMatch(system, /subordinate/i);
  }
  assert.match(buildDebriefSystemPrompt(setupFor(3, 1)), /let authority silence them/);
  assert.match(buildDebriefSystemPrompt(setupFor(2, 2)), /as a peer rather than with hierarchy/);
  assert.match(buildDebriefSystemPrompt(setupFor(1, 3)), /direct without being harsh/);
});

test("debrief user prompt personalizes when the user's assessment is present", () => {
  const generic = buildDebriefUserPrompt(baseSetup, []);
  assert.match(generic, /THE USER'S PROFILE: not provided/);
  assert.match(generic, /ended the session before saying anything/);
  assert.match(generic, /ROLE DYNAMIC: the user is a Senior Leader \/ Executive\. Marcus is a Manager\. Direction: downward\./);

  const personal = buildDebriefUserPrompt(
    { ...baseSetup, userAssessment: { ...simulatedAssessment, name: "Carlos" }, simulatedAssessment },
    [
      { id: "1", role: "user", content: "Marcus, I want to talk about the check-ins.", createdAt: "" },
      { id: "2", role: "simulated", content: "Which check-ins?", createdAt: "" },
    ],
  );
  assert.match(personal, /THE USER'S TRIMETRIX DNA PROFILE/);
  assert.match(personal, /MARCUS'S TRIMETRIX DNA PROFILE/);
  assert.match(personal, /BOTH PROFILES ARE LOADED/);
  assert.match(personal, /USER: Marcus, I want to talk about the check-ins\./);
  assert.match(personal, /MARCUS: Which check-ins\?/);
});

test("no prompt text anywhere uses the forbidden word", () => {
  const everything = [
    EXTRACTION_SYSTEM_PROMPT,
    ...Object.values(SCENARIOS).flatMap((s) =>
      (["downward", "upward", "lateral"] as const).flatMap((d) => [s.userGoal(d), s.simulatedFraming(d)]),
    ),
    ...Object.values(RESPONSE_STYLES).map((s) => s.prompt + s.description),
    ...Object.values(DIFFICULTIES).map((d) => d.prompt + d.description),
    ...Object.values(ROLE_LEVELS).map((r) => r.persona + r.description + r.label),
  ].join("\n");
  assert.doesNotMatch(everything, /subordinate/i);
});

test("transcript maps user to user and simulated to assistant", () => {
  const params = toMessageParams([
    { id: "1", role: "user", content: "Hi", createdAt: "" },
    { id: "2", role: "simulated", content: "Hey", createdAt: "" },
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
