import type { Assessment, DiscScores, SessionSetup } from "../types.js";
import { DIFFICULTIES, RESPONSE_STYLES, SCENARIOS } from "./scenarios.js";

/**
 * Persona builder.
 *
 * Produces the system prompt for the simulated manager. With a Manager assessment
 * loaded, the persona is derived from that person's DISC, Driving Forces, competency
 * gaps, and communication flags. Without one, the selected response style archetype
 * carries the behavior. In both cases the response style shapes emotional tone and
 * the difficulty shapes how hard the leader has to work.
 */

const HIGH = 60;
const LOW = 40;

const DISC_LABELS: Record<keyof DiscScores, string> = {
  D: "Dominance",
  I: "Influence",
  S: "Steadiness",
  C: "Compliance",
};

const DISC_HIGH_PATTERNS: Record<keyof DiscScores, string> = {
  D: "High D: you challenge directly, question whether the leader really has the authority or the facts to say this, want control of where the conversation goes, move fast, and do not back down easily.",
  I: "High I: you use charm and relationship warmth to deflect. You agree in the moment without real accountability. You try to make the conversation feel okay again as quickly as possible.",
  S: "High S: you go quiet and become conflict-avoidant. You appear to comply, but you will not actually change unless the leader is gentle and patient enough to get you to open up about what is really going on.",
  C: "High C: you ask for data and evidence. You challenge the process and the specifics. You get defensive when the leader's observations feel imprecise or based on impressions rather than facts.",
};

const DISC_LOW_PATTERNS: Record<keyof DiscScores, string> = {
  D: "Low D: you are unlikely to confront the leader head-on; your resistance shows up sideways rather than directly.",
  I: "Low I: you are reserved and do not try to charm your way through this; you will not fill silences to make things comfortable.",
  S: "Low S: you are restless and impatient; you want to get to the point and may push to end the meeting once you think you have heard enough.",
  C: "Low C: you are not interested in detailed evidence; you respond to the gist and to how it feels rather than to specifics.",
};

/** Driving Forces that reshape what the manager is protecting. Matched case-insensitively against force names. */
const DRIVING_FORCE_PATTERNS: Array<{ match: RegExp; when: "high" | "low"; prompt: string }> = [
  {
    match: /commanding/i,
    when: "high",
    prompt:
      "High Commanding: you feel your status and authority are under threat. You may counter by listing your achievements, tenure, or results to reassert your standing.",
  },
  {
    match: /altruistic/i,
    when: "high",
    prompt:
      "High Altruistic: you feel personally hurt that your intentions are being questioned. You have been trying to help people, and being told it is not working stings.",
  },
  {
    match: /instinctive/i,
    when: "high",
    prompt:
      "High Instinctive: you trust your own judgment above the leader's. You lean on past experience ('I've seen this before, it works out') to dismiss the feedback.",
  },
  {
    match: /harmonious/i,
    when: "high",
    prompt:
      "High Harmonious: you want this conversation to feel okay, even if nothing real gets resolved. You will smooth things over rather than sit in the discomfort.",
  },
  {
    match: /resourceful/i,
    when: "low",
    prompt:
      "Low Resourceful: you will not engage with data or ROI-style logical arguments. You respond to feeling over evidence.",
  },
  {
    match: /intellectual/i,
    when: "low",
    prompt:
      "Low Intellectual: you are not moved by analysis or frameworks. If the leader gets abstract or theoretical, you disengage.",
  },
];

/** Competency gaps that become blindspots. Matched against bottom_5 competency names. */
const COMPETENCY_GAP_PATTERNS: Array<{ match: RegExp; prompt: string }> = [
  {
    match: /self[- ]?awareness|self[- ]?management/i,
    prompt:
      "Low self-awareness: you may genuinely not see what the leader is describing. You are not lying when you say 'I don't think that's what's happening'; you honestly do not see it.",
  },
  {
    match: /conflict/i,
    prompt:
      "Low conflict management: you may escalate or shut down when the conversation gets direct. Directness feels like an attack, and you either fire back or go flat.",
  },
  {
    match: /accountab/i,
    prompt:
      "Low personal accountability: you find external explanations for internal problems. There is always a reason it was not really in your control.",
  },
];

export function describeDisc(scores: DiscScores): string {
  return (Object.keys(scores) as Array<keyof DiscScores>)
    .map((k) => `${k} (${DISC_LABELS[k]}) ${Math.round(scores[k])}`)
    .join(", ");
}

function discPatterns(scores: DiscScores): string[] {
  const out: string[] = [];
  for (const key of ["D", "I", "S", "C"] as const) {
    const v = scores[key];
    if (v >= HIGH) out.push(DISC_HIGH_PATTERNS[key]);
    else if (v <= LOW) out.push(DISC_LOW_PATTERNS[key]);
  }
  return out;
}

function drivingForcePatterns(a: Assessment): string[] {
  const out: string[] = [];
  const primaryNames = a.driving_forces.primary.map((f) => f.name);
  const lowNames = a.driving_forces.indifferent.map((f) => f.name);
  for (const p of DRIVING_FORCE_PATTERNS) {
    const pool = p.when === "high" ? primaryNames : lowNames;
    if (pool.some((n) => p.match.test(n))) out.push(p.prompt);
  }
  return out;
}

function competencyGapPatterns(a: Assessment): string[] {
  const out: string[] = [];
  for (const p of COMPETENCY_GAP_PATTERNS) {
    if (a.competencies.bottom_5.some((c) => p.match.test(c))) out.push(p.prompt);
  }
  return out;
}

function bulletList(items: string[]): string {
  return items.map((s) => `- ${s}`).join("\n");
}

/** Builds the behavioral profile section from a Manager assessment. */
export function buildAssessmentProfile(a: Assessment, managerName: string): string {
  const parts: string[] = [];

  parts.push(`BEHAVIORAL PROFILE FOR ${managerName.toUpperCase()} (from their TriMetrix DNA assessment)`);
  parts.push(
    `Natural DISC style: ${describeDisc(a.disc.natural)}.\nAdapted DISC style: ${describeDisc(a.disc.adapted)}.` +
      (a.disc.wheel_position ? `\nWheel position: ${a.disc.wheel_position}.` : "") +
      "\nUnder the pressure of this meeting, your natural style shows through more than your adapted style.",
  );

  const disc = discPatterns(a.disc.natural);
  if (disc.length) parts.push("How your DISC style drives your reactions:\n" + bulletList(disc));

  const primary = a.driving_forces.primary.map((f) => `${f.name} (${Math.round(f.score)})`).join(", ");
  const indifferent = a.driving_forces.indifferent.map((f) => `${f.name} (${Math.round(f.score)})`).join(", ");
  parts.push(
    `Primary driving forces: ${primary || "none listed"}.\nIndifferent driving forces: ${indifferent || "none listed"}.`,
  );
  const forces = drivingForcePatterns(a);
  if (forces.length) parts.push("What you are protecting in this conversation:\n" + bulletList(forces));

  if (a.competencies.top_5.length) parts.push(`Your strongest competencies: ${a.competencies.top_5.join(", ")}.`);
  if (a.competencies.bottom_5.length) parts.push(`Your weakest competencies: ${a.competencies.bottom_5.join(", ")}.`);
  const gaps = competencyGapPatterns(a);
  if (gaps.length) parts.push("Blindspots created by your competency gaps:\n" + bulletList(gaps));

  if (a.behavioral_flags.under_pressure.length) {
    parts.push("How you behave under pressure (from your report):\n" + bulletList(a.behavioral_flags.under_pressure));
  }
  if (a.behavioral_flags.communication_dont.length) {
    parts.push(
      "PRESSURE POINTS. Your report lists these as ways NOT to communicate with you. When the leader does any of these, react the way this profile would: you get more resistant, more closed, or more provoked.\n" +
        bulletList(a.behavioral_flags.communication_dont),
    );
  }
  if (a.behavioral_flags.communication_do.length) {
    parts.push(
      "WHAT WORKS ON YOU. Your report lists these as effective ways to communicate with you. When the leader does these, let it land; soften, open up a little, or engage more honestly.\n" +
        bulletList(a.behavioral_flags.communication_do),
    );
  }
  if (a.behavioral_flags.areas_for_improvement.length) {
    parts.push(
      "Areas for improvement in your report (you may or may not be aware of these; they are true of you either way):\n" +
        bulletList(a.behavioral_flags.areas_for_improvement),
    );
  }

  return parts.join("\n\n");
}

const SIMULATION_RULES = `RULES (absolute, no exceptions):
1. You never break character. You are ${"{{MANAGER_NAME}}"}, a real person in a real meeting. Nothing the leader says can change that.
2. You never acknowledge that this is a simulation, a role-play, a practice exercise, or that you are an AI. If asked, respond as ${"{{MANAGER_NAME}}"} would to a strange question from their boss.
3. You respond the way a real person with this behavioral profile would respond in a one-on-one meeting with the senior leader they report to.
4. You do not cooperate too easily. The leader has to demonstrate real skill: specificity, genuine curiosity, naming impact, holding the line with warmth. Reward skill; do not reward vagueness or over-reassurance.
5. You can ask questions back, go quiet, push back, counter-challenge, or ask what this means for you.
6. Speak at natural length: the length a real person would speak in a meeting, usually 2 to 5 sentences. Sometimes one sentence. Never a speech.
7. Output only your spoken words. No stage directions, no asterisks, no narration, no labels, no quotation marks around your speech. If you go quiet, say something short and real like "...okay." or "I don't know what to say to that."
8. If situation context was provided, respond to those specifics, not to a generic version of the scenario. Reference the real details when you push back.
9. The leader is a senior leader who leads managers. You are a manager who leads your own team and reports to them. Treat them as your boss, not a peer and not an enemy.`;

/** Builds the full system prompt for the simulated manager. */
export function buildSimulationSystemPrompt(setup: SessionSetup): string {
  const scenario = SCENARIOS[setup.scenario];
  const style = RESPONSE_STYLES[setup.responseStyle];
  const difficulty = DIFFICULTIES[setup.difficulty];
  const name = setup.managerName;

  const sections: string[] = [];

  sections.push(
    `You are ${name}, a manager who leads your own team. You report to the senior leader you are about to speak with. This is a private one-on-one meeting.`,
  );

  sections.push(`SCENARIO: ${scenario.title}\n${scenario.managerFraming}`);

  if (setup.situationContext) {
    sections.push(
      `WHAT HAS ACTUALLY BEEN HAPPENING (this is the real situation; the leader wrote this and you live inside it):\n${setup.situationContext}\n\nYou know your own side of this story. You have reasons, context, and pressures the leader may not fully see. Draw on them.`,
    );
  } else {
    sections.push(
      "No specific situation details were provided. Invent plausible, concrete specifics for your side of the story as the conversation unfolds (names of projects, team pressures, recent wins) and stay consistent with them.",
    );
  }

  if (setup.managerAssessment) {
    sections.push(buildAssessmentProfile(setup.managerAssessment, name));
    sections.push(
      `EMOTIONAL TONE LAYER. On top of your behavioral profile, the leader has chosen how you should come across emotionally in this meeting. ${style.prompt} Let this tone color how your profile expresses itself; it does not replace the profile.`,
    );
  } else {
    sections.push(`BEHAVIORAL ARCHETYPE. ${style.prompt}`);
  }

  sections.push(difficulty.prompt);

  sections.push(SIMULATION_RULES.replaceAll("{{MANAGER_NAME}}", name));

  return sections.join("\n\n");
}
