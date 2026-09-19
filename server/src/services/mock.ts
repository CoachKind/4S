import { DIRECTION_DEBRIEF_SENTENCE } from "../roles.js";
import type { Assessment, Debrief, SessionSetup, TranscriptMessage } from "../types.js";

/**
 * Dev-only canned responses, enabled with MOCK_AI=1. Lets the full UI flow run
 * without an Anthropic API key. Never enable in production.
 */

export const MOCK_ASSESSMENT: Assessment = {
  name: "Sample Person",
  disc: {
    natural: { D: 72, I: 41, S: 33, C: 64 },
    adapted: { D: 61, I: 48, S: 40, C: 58 },
    wheel_position: "Conducting Analyzer (Natural)",
  },
  driving_forces: {
    primary: [
      { name: "Commanding", score: 74, descriptor: "Driven by status, recognition and control over personal freedom." },
      { name: "Instinctive", score: 66, descriptor: "Driven by utilizing past experience, intuition and seeking specific knowledge when necessary." },
      { name: "Objective", score: 62, descriptor: "Driven by the functionality and objectivity of their surroundings." },
      { name: "Intentional", score: 55, descriptor: "Driven to assist others for a specific purpose." },
    ],
    situational: [
      { name: "Structured", score: 50, descriptor: "Driven by traditional approaches, proven methods and a defined system." },
      { name: "Resourceful", score: 47, descriptor: "Driven by practical results, maximizing efficiency and returns." },
    ],
    indifferent: [
      { name: "Harmonious", score: 22, descriptor: "Driven by the experience, subjective viewpoints and balance in their surroundings." },
      { name: "Receptive", score: 18, descriptor: "Driven by new ideas, methods and opportunities that fall outside a defined system." },
    ],
  },
  competencies: {
    top_5: ["Decision Making", "Goal Orientation", "Leadership", "Planning and Organizing", "Resiliency"],
    bottom_5: ["Self-Awareness", "Conflict Management", "Personal Accountability", "Empathetic Outlook", "Diplomacy and Tact"],
  },
  behavioral_flags: {
    under_pressure: ["Becomes blunt and impatient.", "Takes charge without consulting others.", "Pushes for a quick decision."],
    communication_do: ["Be brief and to the point.", "Provide facts and figures.", "Present options with probabilities of success."],
    communication_dont: ["Don't ramble or waste time.", "Don't be vague about expectations.", "Don't try to build a personal rapport before getting to the point."],
    areas_for_improvement: ["May overstep authority.", "Can be dismissive of others' feelings.", "Sets standards too high for the team."],
  },
};

const MOCK_REPLIES = [
  "Okay. I had a feeling this was coming. Which check-ins are we talking about, specifically?",
  "I hear you, but I'd push back a bit on that. The last month has been brutal on capacity and I made a call to protect delivery. If that landed wrong with the team, that's something I'd want to hear from them directly.",
  "...Fine. So what does this actually mean for me? Are we talking about a warning, or is this a conversation?",
  "Look, I'm not going to pretend that's easy to hear. But if you're telling me the check-ins are non-negotiable, then they're non-negotiable. What I need from you is some cover on the roadmap so I'm not choosing between the two.",
  "Alright. I can commit to the weekly check-ins starting Monday. I'd like to revisit this in a month so we're both looking at the same picture.",
];

export function mockSimulatedReply(_setup: SessionSetup, transcript: TranscriptMessage[]): string {
  const turn = transcript.filter((m) => m.role === "user").length - 1;
  return MOCK_REPLIES[Math.min(Math.max(turn, 0), MOCK_REPLIES.length - 1)];
}

export function mockDebrief(setup: SessionSetup, transcript: TranscriptMessage[]): Debrief {
  const name = setup.simulatedName;
  const first = transcript.find((m) => m.role === "user")?.content ?? "";
  const opener = first ? `You opened with "${first.slice(0, 80)}${first.length > 80 ? "…" : ""}", which named the topic without hedging.` : `You ended before saying anything, so there is little to assess yet.`;
  return {
    what_landed: `${DIRECTION_DEBRIEF_SENTENCE[setup.conversationDirection]} ${opener} When ${name} asked what this meant for them, you stayed with the substance instead of retreating to reassurance. That kept the conversation about the pattern, not about ${name}'s feelings about the conversation.`,
    what_to_sharpen: setup.userAssessment
      ? `Your profile suggests you move quickly to solutions. That showed up when ${name} raised capacity: you answered the objection rather than asking what was underneath it. With ${name}'s high D, the faster you argue, the harder they push. Slow down and ask one more question before you respond.`
      : `When ${name} raised capacity, you answered the objection rather than exploring it. One more genuine question there would have surfaced what ${name} was actually protecting, and given you something concrete to work with.`,
    coaching_moment: `Name the pattern once, clearly, then stop talking. ${name} needs a beat of silence to actually hear it. The silence is doing the work, not your next sentence.`,
    game_check: {
      genuine: `You were direct about the problem and did not soften it into something ${name} could miss.`,
      actionable: `The conversation ended with a concrete commitment to weekly check-ins, though the review date came from ${name}, not you.`,
      meaningful: `You connected the pattern to the two direct reports, which made the stakes real rather than procedural.`,
      engaging: `You asked questions early, but by the middle it drifted toward you explaining and ${name} defending.`,
    },
  };
}
