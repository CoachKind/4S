/**
 * Role Dynamic System.
 *
 * Three organizational levels. The user picks their own level and the level of
 * the person they are speaking with; the direction of the conversation is
 * derived, never chosen. Everything downstream (persona, check-in, banner,
 * debrief) reads the direction rather than assuming who is senior.
 */

export type RoleLevel = 1 | 2 | 3;
export type ConversationDirection = "downward" | "upward" | "lateral";

export interface RoleRef {
  level: RoleLevel;
  label: string;
}

export interface RoleLevelDefinition {
  level: RoleLevel;
  /** Full label, used in selectors and stored on the session. */
  label: string;
  /** Short label for sentences ("You're a Senior Leader speaking with a Manager"). */
  short: string;
  /** Selector description. */
  description: string;
  /** How a person at this level tends to show up, for the persona builder. */
  persona: string;
}

export const ROLE_LEVELS: Record<RoleLevel, RoleLevelDefinition> = {
  1: {
    level: 1,
    label: "Senior Leader / Executive",
    short: "Senior Leader",
    description: "Carries organizational authority. Used to being deferred to.",
    persona:
      "You are experienced and you carry organizational authority. You are used to being deferred to and less accustomed to being challenged or receiving direct feedback. You are confident and decisive, and you are often unaware of how your weight lands on the people around you.",
  },
  2: {
    level: 2,
    label: "Manager",
    short: "Manager",
    description: "Mid-level. Leads a team or other managers. Caught between leadership and their people.",
    persona:
      "You are a mid-level manager. You lead a team or other managers, and you are caught between executing leadership's direction and supporting your people. You are most comfortable in downward conversations. Upward conversations feel risky to you. Lateral conversations can feel territorial.",
  },
  3: {
    level: 3,
    label: "Lead / Individual Contributor",
    short: "Individual Contributor",
    description: "Early in the leadership journey or no formal direct reports. Less institutional authority.",
    persona:
      "You are early in your leadership journey or have no formal direct reports. You may lead a small team or project informally. You have less institutional authority, and you are more likely to feel unseen, unheard, or unsure of your standing.",
  },
};

export function isRoleLevel(v: unknown): v is RoleLevel {
  return v === 1 || v === 2 || v === 3;
}

export function roleRef(level: RoleLevel): RoleRef {
  return { level, label: ROLE_LEVELS[level].label };
}

/** Lower number = more senior. User below simulated = upward. */
export function conversationDirection(userLevel: RoleLevel, simulatedLevel: RoleLevel): ConversationDirection {
  if (userLevel < simulatedLevel) return "downward";
  if (userLevel > simulatedLevel) return "upward";
  return "lateral";
}

export const DIRECTION_LABELS: Record<ConversationDirection, string> = {
  downward: "Downward conversation — you're speaking with someone you lead",
  upward: "Upward conversation — you're speaking with someone senior to you",
  lateral: "Lateral conversation — you're speaking with a peer",
};

/** The exact sentence the debrief opens with. */
export const DIRECTION_DEBRIEF_SENTENCE: Record<ConversationDirection, string> = {
  upward: "This was an upward conversation — one of the hardest dynamics to navigate well.",
  downward: "This was a downward conversation — here's how the power dynamic showed up.",
  lateral: "This was a lateral conversation — peer dynamics carry their own complexity.",
};

export function article(word: string): "a" | "an" {
  return /^[aeiou]/i.test(word) ? "an" : "a";
}

/** Context banner sentence, e.g. "You're a Senior Leader speaking with a Manager on your team." */
export function dynamicSentence(userLevel: RoleLevel, simulatedLevel: RoleLevel): string {
  const u = ROLE_LEVELS[userLevel].short;
  const s = ROLE_LEVELS[simulatedLevel].short;
  const direction = conversationDirection(userLevel, simulatedLevel);
  if (direction === "downward") return `You're ${article(u)} ${u} speaking with ${article(s)} ${s} on your team.`;
  if (direction === "upward") return `You're ${article(u)} ${u} speaking with ${article(s)} ${s}.`;
  return `You're ${article(u)} ${u} speaking with a peer ${s}.`;
}

/**
 * How to refer to the simulated person from the user's point of view, in
 * lower case, for titles and copy. Downward: what they are to you. Upward:
 * "your manager" for the next level up, "a senior leader" for two levels up.
 * Lateral: "a peer".
 */
export function simulatedTerm(userLevel: RoleLevel, simulatedLevel: RoleLevel): string {
  const direction = conversationDirection(userLevel, simulatedLevel);
  if (direction === "lateral") return "a peer";
  if (direction === "upward") {
    if (simulatedLevel === 1 && userLevel === 3) return "a senior leader";
    return simulatedLevel === 1 ? "the senior leader you report to" : "your manager";
  }
  if (simulatedLevel === 2) return "a manager on your team";
  return "a team member you lead";
}

/**
 * How the simulated person refers to the user, in lower case, from inside the
 * persona prompt. Direction is from the user's perspective.
 */
export function userTermForPersona(userLevel: RoleLevel, simulatedLevel: RoleLevel): string {
  const direction = conversationDirection(userLevel, simulatedLevel);
  if (direction === "downward") return "your leader";
  if (direction === "lateral") return "your peer";
  const u = ROLE_LEVELS[userLevel].short.toLowerCase();
  return `the ${u} who reports up to you`;
}
