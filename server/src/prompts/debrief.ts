import type { Assessment, SessionSetup, TranscriptMessage } from "../types.js";
import { describeDisc } from "./persona.js";
import { DIFFICULTIES, RESPONSE_STYLES, SCENARIOS } from "./scenarios.js";

export const DEBRIEF_SYSTEM_PROMPT = `You are a senior executive coach at Coach Kind writing a debrief for a senior leader who has just finished a practice conversation with a simulated manager on their team. The leader leads managers; the person they spoke with is a manager who leads their own team and reports to the leader.

Your debrief has four sections. Write each as short, plain-language paragraphs.

WHAT LANDED: Specific moments where the leader showed effective leadership. Concrete, not generic. Quote or closely paraphrase what the leader actually said and explain why it worked.

WHAT TO SHARPEN: One or two things that could have been clearer, more direct, or more effective. Anchor each to a specific moment. If a Leader assessment profile is provided, connect the gap to their behavioral profile in the way a coach who knows their TriMetrix results would: for example, "Your high I showed up here: you moved to reassurance before the feedback had fully landed." If no Leader profile is provided, give general coaching feedback with no profile-specific language. If a Manager profile is provided, use it to explain why certain moments played out the way they did.

THE COACHING MOMENT: The single most important thing to carry into the next real conversation of this kind. One focused insight, not a list.

GAME CHECK: Score the conversation on the GAME framework, a Coach Kind original. One honest sentence per dimension. The dimension names are exactly: Genuine, Actionable, Meaningful, Engaging.
- Genuine: was the leader honest and direct, or did they soften the message into something the manager could miss?
- Actionable: did the conversation produce something the manager can actually do differently?
- Meaningful: did the leader connect the feedback to why it matters, for the team, for the manager, for the business?
- Engaging: did the leader make it a two-way conversation, drawing the manager out rather than delivering a monologue?

Hard constraints:
- The whole debrief is under 350 words in total across all four sections.
- No bullet points anywhere. No numbered lists. No headings inside the text; the section fields are the headings.
- Short paragraphs. Plain language. Warm, serious, and honest; this is a coaching instrument, not a report card.
- Reference actual moments from the conversation. Never give generic advice that could apply to any conversation.
- Address the leader as "you". Refer to the manager by name.
- Refer to the person the leader spoke with only as a manager or by name. Never use a term that frames them as ranked beneath the leader.
- If the conversation was very short or the leader ended early, say so honestly and coach on what that reveals.
- If the leader never actually delivered the feedback, do not pretend they did.`;

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

export function formatTranscript(transcript: TranscriptMessage[], managerName: string): string {
  if (transcript.length === 0) return "(The leader ended the session before saying anything.)";
  return transcript
    .map((m) => `${m.role === "leader" ? "LEADER" : managerName.toUpperCase()}: ${m.content}`)
    .join("\n\n");
}

export function buildDebriefUserPrompt(setup: SessionSetup, transcript: TranscriptMessage[]): string {
  const scenario = SCENARIOS[setup.scenario];
  const parts: string[] = [];

  parts.push(`SCENARIO: ${scenario.title}`);
  parts.push(`MANAGER'S NAME: ${setup.managerName}`);
  parts.push(`RESPONSE STYLE THE LEADER CHOSE FOR ${setup.managerName}: ${RESPONSE_STYLES[setup.responseStyle].label}`);
  parts.push(`DIFFICULTY: ${DIFFICULTIES[setup.difficulty].label}`);
  parts.push(
    `SITUATION CONTEXT THE LEADER PROVIDED:\n${setup.situationContext || "(none provided)"}`,
  );

  if (setup.leaderAssessment) {
    parts.push(
      "LEADER'S TRIMETRIX DNA PROFILE (personalize What to Sharpen and The Coaching Moment to this):\n" +
        assessmentSummary("Leader", setup.leaderAssessment),
    );
  } else {
    parts.push("LEADER'S PROFILE: not provided. Give general coaching feedback without profile-specific language.");
  }

  if (setup.managerAssessment) {
    parts.push(
      `${setup.managerName.toUpperCase()}'S TRIMETRIX DNA PROFILE (the simulation was built from this; use it to explain why moments played out as they did):\n` +
        assessmentSummary("Manager", setup.managerAssessment),
    );
  } else {
    parts.push(
      `${setup.managerName.toUpperCase()}'S PROFILE: not provided. The simulation used the ${RESPONSE_STYLES[setup.responseStyle].label} archetype.`,
    );
  }

  if (setup.leaderAssessment && setup.managerAssessment) {
    parts.push(
      "BOTH PROFILES ARE LOADED. In What to Sharpen and The Coaching Moment, explain the dynamic between the two profiles: where they naturally clash, where the leader's style may have worked against them with this particular manager, and what to do differently given who they both are.",
    );
  }

  parts.push(`TRANSCRIPT:\n${formatTranscript(transcript, setup.managerName)}`);

  parts.push("Write the debrief now.");

  return parts.join("\n\n");
}
