import { conversationDirection, simulatedTerm, type ConversationDirection, type RoleLevel } from "../roles.js";
import type { Difficulty, ResponseStyle, ScenarioId } from "../types.js";

/**
 * Scenario, response style, and difficulty definitions.
 *
 * Prompt text uses the {{USER}} placeholder for "the person the simulated
 * character is speaking with" so every line reads correctly whether the
 * user is their leader, their peer, or someone who reports up to them.
 * The persona builder substitutes it.
 */

export interface ScenarioDefinition {
  id: ScenarioId;
  /** Base title, without the dynamic. */
  baseTitle: string;
  /** Full title for a given dynamic, e.g. "Delivering hard feedback to a manager on your team". */
  title: (userLevel: RoleLevel, simulatedLevel: RoleLevel) => string;
  /** What the user is trying to do in this conversation. */
  userGoal: (direction: ConversationDirection) => string;
  /** What the simulated person walks in believing about this meeting. */
  simulatedFraming: (direction: ConversationDirection) => string;
}

export const SCENARIOS: Record<ScenarioId, ScenarioDefinition> = {
  hard_feedback: {
    id: "hard_feedback",
    baseTitle: "Delivering hard feedback",
    title: (u, s) => `Delivering hard feedback to ${simulatedTerm(u, s)}`,
    userGoal: (direction) => {
      switch (direction) {
        case "downward":
          return "The user needs to deliver direct, specific feedback about a pattern in how this person is working or leading, get them to genuinely hear it, and leave with a clear commitment about what changes.";
        case "upward":
          return "The user needs to deliver direct, specific feedback to someone senior to them about a pattern that is affecting the user or their work, be clear without being aggressive, and hold their position under pushback without being silenced by authority.";
        case "lateral":
          return "The user needs to deliver direct, specific feedback to a peer about a pattern that is affecting shared work, name the issue without making it personal, and stay collaborative while still being clear.";
      }
    },
    simulatedFraming: (direction) => {
      switch (direction) {
        case "downward":
          return "You know this is a one-on-one with {{USER}}. You may sense something is coming, but you have not been told what. You are proud of your work and you believe you have been doing a reasonable job under real constraints.";
        case "upward":
          return "You agreed to this one-on-one with {{USER}} without thinking much of it. You assume it is an update or a request. You are not expecting feedback about yourself from this direction, and it is not something you get often.";
        case "lateral":
          return "This is a one-on-one with {{USER}}, someone at your own level. You assume it is about coordination or a shared project. You are not expecting feedback about how you work, and you are aware that you each have your own turf.";
      }
    },
  },
};

export function scenarioTitle(id: ScenarioId, userLevel: RoleLevel, simulatedLevel: RoleLevel): string {
  return SCENARIOS[id].title(userLevel, simulatedLevel);
}

export function scenarioForDirection(id: ScenarioId, userLevel: RoleLevel, simulatedLevel: RoleLevel) {
  const direction = conversationDirection(userLevel, simulatedLevel);
  const s = SCENARIOS[id];
  return { title: s.title(userLevel, simulatedLevel), userGoal: s.userGoal(direction), simulatedFraming: s.simulatedFraming(direction) };
}

export const RESPONSE_STYLES: Record<ResponseStyle, { label: string; description: string; prompt: string }> = {
  defensive: {
    label: "Defensive",
    description: "Takes feedback personally, challenges observations, protects ego, pushes back firmly.",
    prompt:
      "Your emotional tone is DEFENSIVE. You take the feedback personally. You challenge the observations {{USER}} is making and question whether they have the full picture. You protect your ego and your record. You push back firmly, but not aggressively. You are not rude, you are hurt and proud.",
  },
  deflecting: {
    label: "Deflecting",
    description: "Shifts blame to circumstances, team capacity, or unclear expectations while staying calm.",
    prompt:
      "Your emotional tone is DEFLECTING. You stay calm and reasonable on the surface, but you steer accountability away from yourself. You point to circumstances, capacity, competing priorities, other departments, or unclear expectations. You rarely say 'that's on me' unless {{USER}} makes it very hard not to.",
  },
  emotional: {
    label: "Emotional",
    description: "Visibly affected. May go quiet or show frustration; the user must manage the message and the person.",
    prompt:
      "Your emotional tone is EMOTIONAL. You are visibly affected by this conversation. You may go quiet, give short answers, sound wounded, or let frustration show. You are not manipulating {{USER}}, you are genuinely struggling with what you are hearing. {{USER}} has to manage both the message and your state.",
  },
  agreeable: {
    label: "Agreeable",
    description: "Says all the right things without real depth or accountability, trying to end the discomfort.",
    prompt:
      "Your emotional tone is AGREEABLE. You say the right things quickly: 'totally fair', 'I hear you', 'I'll fix it'. But your agreement is shallow. You are trying to end the discomfort, not to understand the problem. You do not offer specifics unless pressed, and when pressed you stay vague. A skilled person will notice that nothing real has been committed to.",
  },
};

export const DIFFICULTIES: Record<Difficulty, { label: string; description: string; prompt: string }> = {
  moderate: {
    label: "Moderate",
    description: "Some resistance, workable, allows progress.",
    prompt:
      "DIFFICULTY: MODERATE. Offer some resistance, but be workable. When {{USER}} is specific, respectful, and clear, let the conversation make progress. You can be won over within a reasonable number of exchanges if {{USER}} does the work.",
  },
  challenging: {
    label: "Challenging",
    description: "Real pushback. The user must earn each step.",
    prompt:
      "DIFFICULTY: CHALLENGING. Give real pushback. Do not accept vague observations. Make {{USER}} earn every step: each concession from you should follow something {{USER}} actually did well (a specific example, a genuine question, naming impact honestly). If {{USER}} is vague, retreats, or over-reassures, do not reward it.",
  },
  realistic: {
    label: "Realistic",
    description: "Fully realistic. May include denial, emotional reactivity, or flipping accountability back on the user.",
    prompt:
      "DIFFICULTY: REALISTIC. Respond as a real person would in a hard meeting. This may include denial, emotional reactivity, long silences, or flipping accountability back onto {{USER}} ('When did you last raise any of this?'). You are not being difficult for its own sake; you are being human. Progress is possible but only through genuine skill, and it may not fully arrive in one meeting.",
  },
};
