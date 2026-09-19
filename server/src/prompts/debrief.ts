import { DIRECTION_DEBRIEF_SENTENCE, ROLE_LEVELS, type ConversationDirection } from "../roles.js";
import type { Assessment, SessionMode, SessionSetup, TranscriptMessage } from "../types.js";
import { describeDisc } from "./persona.js";
import { DIFFICULTIES, RESPONSE_STYLES, SCENARIOS, scenarioForDirection } from "./scenarios.js";

const DIRECTION_FOCUS: Record<ConversationDirection, string> = {
  downward:
    "This was a DOWNWARD conversation: the user leads the person they spoke with. Focus on how the user communicated, whether the message landed, and whether they stayed direct without being harsh. Watch for how the power dynamic showed up: did they use their authority well, lean on it, or avoid it?",
  upward:
    "This was an UPWARD conversation: the user was speaking with someone senior to them. Focus on whether the user was clear without being aggressive, whether they advocated effectively for themselves or their work, whether they let authority silence them, and whether they held their position under pushback. Give real credit for courage, and be honest about where deference crept in.",
  lateral:
    "This was a LATERAL conversation: the user was speaking with a peer. Focus on whether the user communicated as a peer rather than with hierarchy, whether they stayed collaborative, and whether they named the issue without making it personal. Watch for turf, competitiveness, or pulling rank they do not have.",
};

export const VOICE_DEBRIEF_LINE =
  "This conversation happened in voice mode: the user spoke out loud rather than typing. In What to Sharpen, consider delivery, not just content, where the transcript gives clues: rushed responses, short answers that may indicate stress, or a pattern of long pauses before responding.";

/** The debrief system prompt is built per session so the role dynamic (and mode) frames the coaching. */
export function buildDebriefSystemPrompt(setup: SessionSetup, mode: SessionMode = "text"): string {
  const direction = setup.conversationDirection;
  const userLabel = ROLE_LEVELS[setup.userRole.level].label;
  const simulatedLabel = ROLE_LEVELS[setup.simulatedRole.level].label;

  const scenario = SCENARIOS[setup.scenario.id];

  return `You are a senior executive coach at Coach Kind writing a debrief for someone who has just finished a practice conversation with a simulated person from their organization. The user is a ${userLabel}. The person they spoke with is a ${simulatedLabel}. The scenario was: ${setup.scenario.title}.

${DIRECTION_FOCUS[direction]}

SCENARIO LENS (${scenario.label}): ${scenario.debriefLens} Let these questions shape What Landed, What to Sharpen, and The Coaching Moment.
${mode === "voice" ? `
${VOICE_DEBRIEF_LINE}
` : ""}
Your debrief has four sections. Write each as short, plain-language paragraphs.

WHAT LANDED: Begin this section with exactly this sentence, word for word: "${DIRECTION_DEBRIEF_SENTENCE[direction]}" Then give specific moments where the user handled the conversation well. Concrete, not generic. Quote or closely paraphrase what the user actually said and explain why it worked.

WHAT TO SHARPEN: One or two things that could have been clearer, more direct, or more effective. Anchor each to a specific moment. If the user's assessment profile is provided, connect the gap to their behavioral profile in the way a coach who knows their TriMetrix results would: for example, "Your high I showed up here: you moved to reassurance before the feedback had fully landed." If no profile for the user is provided, give general coaching feedback with no profile-specific language. If a profile for the other person is provided, use it to explain why certain moments played out the way they did.

THE COACHING MOMENT: The single most important thing to carry into the next real conversation of this kind. One focused insight, not a list.

GAME CHECK: Score the conversation on the GAME framework, a Coach Kind original. One honest sentence per dimension. The dimension names are exactly: Genuine, Actionable, Meaningful, Engaging.
- Genuine: was the user honest and direct, or did they soften the message into something the other person could miss?
- Actionable: did the conversation produce something the other person can actually do differently?
- Meaningful: did the user connect the feedback to why it matters, for the team, for the other person, for the business?
- Engaging: did the user make it a two-way conversation, drawing the other person out rather than delivering a monologue?

Hard constraints:
- The whole debrief is under 350 words in total across all four sections.
- No bullet points anywhere. No numbered lists. No headings inside the text; the section fields are the headings.
- Short paragraphs. Plain language. Warm, serious, and honest; this is a coaching instrument, not a report card.
- Reference actual moments from the conversation. Never give generic advice that could apply to any conversation.
- Address the user as "you". Refer to the other person by name.
- Refer to the other person by name or by their role. Never use a term that frames anyone as ranked beneath anyone else.
- Never assume the user is the senior person; use the dynamic stated above.
- If the conversation was very short or the user ended early, say so honestly and coach on what that reveals.
- If the user never actually delivered the feedback, do not pretend they did.`;
}

function assessmentSummary(label: string, a: Assessment): string {
  const lines: string[] = [];
  lines.push(`${label}: ${a.name}`);
  lines.push(`Natural DISC: ${describeDisc(a.disc.natural)}`);
  lines.push(`Adapted DISC: ${describeDisc(a.disc.adapted)}`);
  if (a.disc.wheel_position) lines.push(`Wheel position: ${a.disc.wheel_position}`);
  lines.push(
    `Primary driving forces: ${a.driving_forces.primary.map((f) => `${f.name} (${Math.round(f.score)})`).join(", ") || "none listed"}`,
  );
  lines.push(
    `Indifferent driving forces: ${a.driving_forces.indifferent.map((f) => `${f.name} (${Math.round(f.score)})`).join(", ") || "none listed"}`,
  );
  if (a.competencies.top_5.length) lines.push(`Top competencies: ${a.competencies.top_5.join(", ")}`);
  if (a.competencies.bottom_5.length) lines.push(`Lowest competencies: ${a.competencies.bottom_5.join(", ")}`);
  if (a.behavioral_flags.under_pressure.length)
    lines.push(`Under pressure: ${a.behavioral_flags.under_pressure.join("; ")}`);
  if (a.behavioral_flags.communication_do.length)
    lines.push(`Communication do: ${a.behavioral_flags.communication_do.join("; ")}`);
  if (a.behavioral_flags.communication_dont.length)
    lines.push(`Communication don't: ${a.behavioral_flags.communication_dont.join("; ")}`);
  if (a.behavioral_flags.areas_for_improvement.length)
    lines.push(`Areas for improvement: ${a.behavioral_flags.areas_for_improvement.join("; ")}`);
  return lines.join("\n");
}

export function formatTranscript(transcript: TranscriptMessage[], simulatedName: string): string {
  if (transcript.length === 0) return "(The user ended the session before saying anything.)";
  return transcript
    .map((m) => `${m.role === "user" ? "USER" : simulatedName.toUpperCase()}: ${m.content}`)
    .join("\n\n");
}

export function buildDebriefUserPrompt(setup: SessionSetup, transcript: TranscriptMessage[]): string {
  const scenario = scenarioForDirection(setup.scenario.id, setup.userRole.level, setup.simulatedRole.level, setup.responseStyle);
  const name = setup.simulatedName;
  const parts: string[] = [];

  parts.push(`SCENARIO: ${scenario.title}`);
  parts.push(`WHAT THE USER WAS TRYING TO DO: ${scenario.userGoal}`);
  parts.push(
    `ROLE DYNAMIC: the user is a ${setup.userRole.label}. ${name} is a ${setup.simulatedRole.label}. Direction: ${setup.conversationDirection}.`,
  );
  parts.push(`THE OTHER PERSON'S NAME: ${name}`);
  parts.push(`RESPONSE STYLE THE USER CHOSE FOR ${name.toUpperCase()}: ${RESPONSE_STYLES[setup.responseStyle].label}`);
  parts.push(`DIFFICULTY: ${DIFFICULTIES[setup.difficulty].label}`);
  parts.push(`SITUATION CONTEXT THE USER PROVIDED:\n${setup.situationContext || "(none provided)"}`);

  if (setup.userAssessment) {
    parts.push(
      "THE USER'S TRIMETRIX DNA PROFILE (personalize What to Sharpen and The Coaching Moment to this):\n" +
        assessmentSummary("User", setup.userAssessment),
    );
  } else {
    parts.push("THE USER'S PROFILE: not provided. Give general coaching feedback without profile-specific language.");
  }

  if (setup.simulatedAssessment) {
    parts.push(
      `${name.toUpperCase()}'S TRIMETRIX DNA PROFILE (the simulation was built from this; use it to explain why moments played out as they did):\n` +
        assessmentSummary("Other person", setup.simulatedAssessment),
    );
  } else {
    parts.push(
      `${name.toUpperCase()}'S PROFILE: not provided. The simulation used the ${RESPONSE_STYLES[setup.responseStyle].label} archetype.`,
    );
  }

  if (setup.userAssessment && setup.simulatedAssessment) {
    parts.push(
      "BOTH PROFILES ARE LOADED. In What to Sharpen and The Coaching Moment, explain the dynamic between the two profiles: where they naturally clash, where the user's style may have worked against them with this particular person, and what to do differently given who they both are.",
    );
  }

  parts.push(`TRANSCRIPT:\n${formatTranscript(transcript, name)}`);

  parts.push("Write the debrief now.");

  return parts.join("\n\n");
}
