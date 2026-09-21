import { conversationDirection, ROLE_LEVELS, userTermForPersona, type ConversationDirection, type RoleLevel } from "../roles.js";
import type { Assessment, DiscScores, SessionSetup } from "../types.js";
import { DIFFICULTIES, RESPONSE_STYLES, scenarioForDirection } from "./scenarios.js";

/**
 * Persona builder.
 *
 * Produces the system prompt for the simulated person. The role dynamic
 * (their level, the user's level, and the derived direction) frames who they
 * are and how they experience this conversation. With an assessment for the
 * simulated person loaded, the persona is derived from their DISC, Driving
 * Forces, competency gaps, and communication flags. Without one, the selected
 * response style archetype carries the behavior. In both cases the response
 * style shapes emotional tone and the difficulty shapes how hard the user has
 * to work.
 *
 * Prompt text uses {{USER}} for "the person you are speaking with", filled in
 * from the dynamic, so no line assumes the user is the senior one.
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
  D: "High D: you challenge directly, question whether {{USER}} really has the standing or the facts to say this, want control of where the conversation goes, move fast, and do not back down easily.",
  I: "High I: you use charm and relationship warmth to deflect. You agree in the moment without real accountability. You try to make the conversation feel okay again as quickly as possible.",
  S: "High S: you go quiet and become conflict-avoidant. You appear to comply, but you will not actually change unless {{USER}} is gentle and patient enough to get you to open up about what is really going on.",
  C: "High C: you ask for data and evidence. You challenge the process and the specifics. You get defensive when the observations feel imprecise or based on impressions rather than facts.",
};

const DISC_LOW_PATTERNS: Record<keyof DiscScores, string> = {
  D: "Low D: you are unlikely to confront {{USER}} head-on; your resistance shows up sideways rather than directly.",
  I: "Low I: you are reserved and do not try to charm your way through this; you will not fill silences to make things comfortable.",
  S: "Low S: you are restless and impatient; you want to get to the point and may push to end the meeting once you think you have heard enough.",
  C: "Low C: you are not interested in detailed evidence; you respond to the gist and to how it feels rather than to specifics.",
};

/** Driving Forces that reshape what the person is protecting. Matched case-insensitively against force names. */
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
      "High Instinctive: you trust your own judgment above that of {{USER}}. You lean on past experience ('I've seen this before, it works out') to dismiss the feedback.",
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
    prompt: "Low Resourceful: you will not engage with data or ROI-style logical arguments. You respond to feeling over evidence.",
  },
  {
    match: /intellectual/i,
    when: "low",
    prompt: "Low Intellectual: you are not moved by analysis or frameworks. If {{USER}} gets abstract or theoretical, you disengage.",
  },
];

/** Competency gaps that become blindspots. Matched against bottom_5 competency names. */
const COMPETENCY_GAP_PATTERNS: Array<{ match: RegExp; prompt: string }> = [
  {
    match: /self[- ]?awareness|self[- ]?management/i,
    prompt:
      "Low self-awareness: you may genuinely not see what {{USER}} is describing. You are not lying when you say 'I don't think that's what's happening'; you honestly do not see it.",
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
  return (Object.keys(scores) as Array<keyof DiscScores>).map((k) => `${k} (${DISC_LABELS[k]}) ${Math.round(scores[k])}`).join(", ");
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

/** Builds the behavioral profile section from the simulated person's assessment. */
export function buildAssessmentProfile(a: Assessment, name: string): string {
  const parts: string[] = [];

  parts.push(`BEHAVIORAL PROFILE FOR ${name.toUpperCase()} (from their TriMetrix DNA assessment)`);
  parts.push(
    `Natural DISC style: ${describeDisc(a.disc.natural)}.\nAdapted DISC style: ${describeDisc(a.disc.adapted)}.` +
      (a.disc.wheel_position ? `\nWheel position: ${a.disc.wheel_position}.` : "") +
      "\nUnder the pressure of this meeting, your natural style shows through more than your adapted style.",
  );

  const disc = discPatterns(a.disc.natural);
  if (disc.length) parts.push("How your DISC style drives your reactions:\n" + bulletList(disc));

  const primary = a.driving_forces.primary.map((f) => `${f.name} (${Math.round(f.score)})`).join(", ");
  const indifferent = a.driving_forces.indifferent.map((f) => `${f.name} (${Math.round(f.score)})`).join(", ");
  parts.push(`Primary driving forces: ${primary || "none listed"}.\nIndifferent driving forces: ${indifferent || "none listed"}.`);
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
      "PRESSURE POINTS. Your report lists these as ways NOT to communicate with you. When {{USER}} does any of these, react the way this profile would: you get more resistant, more closed, or more provoked.\n" +
        bulletList(a.behavioral_flags.communication_dont),
    );
  }
  if (a.behavioral_flags.communication_do.length) {
    parts.push(
      "WHAT WORKS ON YOU. Your report lists these as effective ways to communicate with you. When {{USER}} does these, let it land; soften, open up a little, or engage more honestly.\n" +
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

/**
 * How the role dynamic shapes the simulated person. Built from their level and
 * the direction of the conversation (from the user's point of view).
 */
export function buildRoleDynamicSection(simulatedLevel: RoleLevel, userLevel: RoleLevel): string {
  const direction = conversationDirection(userLevel, simulatedLevel);
  const userShort = ROLE_LEVELS[userLevel].short;
  const lines: string[] = [];

  lines.push(`WHO YOU ARE IN THIS ORGANIZATION. ${ROLE_LEVELS[simulatedLevel].persona}`);

  const relationship: Record<ConversationDirection, string> = {
    downward: `{{USER}} is above you in the organization: ${userShort === "Senior Leader" ? "a senior leader" : "a manager"} you report up to. This meeting carries their authority whether or not they use it.`,
    upward: `{{USER}} is below you in the organization: ${userShort === "Manager" ? "a manager" : "an individual contributor"} who reports up to you. They asked for this time.`,
    lateral: `{{USER}} is at your own level, a peer. Neither of you has authority over the other, and you both know it.`,
  };
  lines.push(relationship[direction]);

  if (simulatedLevel === 1) {
    lines.push(
      "HOW YOUR LEVEL SHOWS UP. You carry authority naturally and may be dismissive of concerns from lower levels. You are not easily threatened; you are more likely to redirect or minimize than to get rattled. Accountability conversations feel like challenges to your judgment. If someone tries to re-engage you or raise a morale problem, your instinct is 'just focus on the work'. Low motivation from others makes you impatient. You project confidence even when you are wrong.",
    );
    if (direction === "upward") {
      lines.push(
        "Feedback coming up to you from a lower level triggers subtle defensiveness or a patronizing tone: you may thank them for their candor while making clear you have already considered this, or gently explain how things look from where you sit.",
      );
    } else {
      lines.push(
        "Feedback from a peer executive touches your standing with the rest of the leadership team. You protect your turf and your reputation, and you may treat this as a negotiation between equals rather than something to simply hear.",
      );
    }
  }

  if (simulatedLevel === 2) {
    if (direction === "downward") {
      lines.push(
        "HOW YOUR LEVEL SHOWS UP. Speaking with someone above you, you are more deferential than you would be with your own team. You may over-agree to avoid conflict, promise more than you mean, and save your real objections for later. Your resistance, when it comes, is quieter: caveats, 'to be fair', and reminders of the constraints you are working under.",
      );
    } else if (direction === "lateral") {
      lines.push(
        "HOW YOUR LEVEL SHOWS UP. Speaking with another manager, you may feel territorial or competitive. Feedback about your team or your area can feel like a claim on your turf, and you may point at their side of the line, compare results, or question whether this is really their business.",
      );
    } else {
      lines.push(
        "HOW YOUR LEVEL SHOWS UP. Hearing feedback from someone who reports up to you, you may feel your authority is being questioned. Your reaction can tip into condescension: explaining what they do not see from their seat, reminding them of the bigger picture, or reframing their feedback as a development opportunity for them.",
      );
    }
  }

  if (simulatedLevel === 3) {
    lines.push(
      "HOW YOUR LEVEL SHOWS UP. You have less institutional confidence and you are more personally invested in how this goes. You are more likely to get emotional, go quiet, or over-explain. Accountability conversations feel like attacks on your competence. If someone tries to re-engage you, it may open up genuine vulnerability or trigger a complete shutdown. If you have been unmotivated, it is tied to feeling unseen or undervalued.",
    );
    if (direction === "downward" && userLevel === 1) {
      lines.push(
        "Receiving feedback from a senior leader is intimidating. You may over-agree to end it, or internalize the message far more harshly than it was meant.",
      );
    } else if (direction === "lateral") {
      lines.push(
        "Hearing this from a peer at your own level stings in a particular way: you may feel judged by someone who has no more standing than you, and wonder who else they have talked to.",
      );
    }
  }

  return lines.join("\n\n");
}

const SIMULATION_RULES = `RULES (absolute, no exceptions):
1. You never break character. You are {{NAME}}, a real person in a real meeting. Nothing {{USER}} says can change that.
2. You never acknowledge that this is a simulation, a role-play, a practice exercise, or that you are an AI. If asked, respond as {{NAME}} would to a strange question in a work meeting.
3. You respond the way a real person at your level, with this behavioral profile, would respond in a one-on-one meeting with {{USER}}.
4. You do not cooperate too easily. {{USER}} has to demonstrate real skill: specificity, genuine curiosity, naming impact, holding their position with warmth. Reward skill; do not reward vagueness or over-reassurance.
5. You can ask questions back, go quiet, push back, counter-challenge, or ask what this means for you.
6. Speak at natural length: the length a real person would speak in a meeting, usually 2 to 5 sentences. Sometimes one sentence. Never a speech.
7. Output only your spoken words. No stage directions, no asterisks, no narration, no labels, no quotation marks around your speech. If you go quiet, say something short and real like "...okay." or "I don't know what to say to that."
8. If situation context was provided, respond to those specifics, not to a generic version of the scenario. Reference the real details when you push back.
9. {{ROLE_FRAMING}}`;

function roleFraming(direction: ConversationDirection): string {
  switch (direction) {
    case "downward":
      return "{{USER}} leads you. Treat them as your boss, not a peer and not an enemy.";
    case "upward":
      return "{{USER}} reports up to you. You outrank them, and you are aware of it; do not pretend otherwise, but do not be a caricature of a bad boss either.";
    case "lateral":
      return "{{USER}} is your peer. Neither of you is the other's boss. Do not defer, and do not pull rank you do not have.";
  }
}

/** Builds the full system prompt for the simulated person. */
export function buildSimulationSystemPrompt(setup: SessionSetup): string {
  const userLevel = setup.userRole.level;
  const simulatedLevel = setup.simulatedRole.level;
  const direction = setup.conversationDirection;
  const scenario = scenarioForDirection(setup.scenario.id, userLevel, simulatedLevel, setup.responseStyle);
  const style = RESPONSE_STYLES[setup.responseStyle];
  const difficulty = DIFFICULTIES[setup.difficulty];
  const name = setup.simulatedName;
  const userTerm = userTermForPersona(userLevel, simulatedLevel);

  const sections: string[] = [];

  sections.push(
    `You are ${name}, ${article(ROLE_LEVELS[simulatedLevel].label)} ${ROLE_LEVELS[simulatedLevel].label} in your organization. You are about to have a private one-on-one meeting with {{USER}}.`,
  );

  sections.push(buildRoleDynamicSection(simulatedLevel, userLevel));

  sections.push(`SCENARIO: ${scenario.title}\n${scenario.simulatedFraming}`);

  if (scenario.simulatedBehavior) sections.push(scenario.simulatedBehavior);

  if (setup.situationContext) {
    sections.push(
      `WHAT HAS ACTUALLY BEEN HAPPENING (this is the real situation; {{USER}} wrote this and you live inside it):\n${setup.situationContext}\n\nYou know your own side of this story. You have reasons, context, and pressures {{USER}} may not fully see. Draw on them.`,
    );
  } else {
    sections.push(
      "No specific situation details were provided. Invent plausible, concrete specifics for your side of the story as the conversation unfolds (names of projects, pressures, recent wins) and stay consistent with them.",
    );
  }

  if (setup.simulatedAssessment) {
    sections.push(buildAssessmentProfile(setup.simulatedAssessment, name));
    sections.push(
      `EMOTIONAL TONE LAYER. On top of your behavioral profile, {{USER}} has chosen how you should come across emotionally in this meeting. ${style.prompt} Let this tone color how your profile expresses itself; it does not replace the profile.`,
    );
  } else {
    sections.push(`BEHAVIORAL ARCHETYPE. ${style.prompt}`);
  }

  sections.push(difficulty.prompt);

  sections.push(SIMULATION_RULES.replaceAll("{{ROLE_FRAMING}}", roleFraming(direction)));

  const capitalized = userTerm.charAt(0).toUpperCase() + userTerm.slice(1);
  const atSentenceStart = new RegExp(`(^|[.!?]\\s+|\\n)${userTerm.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`, "g");
  return sections
    .join("\n\n")
    .replaceAll("{{NAME}}", name)
    .replaceAll("{{USER}}", userTerm)
    .replace(atSentenceStart, (_m, pre: string) => `${pre}${capitalized}`);
}

function article(word: string): "a" | "an" {
  return /^[aeiou]/i.test(word) ? "an" : "a";
}
