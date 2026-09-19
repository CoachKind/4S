// Mirrors server/src/roles.ts. Kept in sync by hand.
import type { ConversationDirection, RoleLevel } from "./types";

export const ROLE_LEVELS: Record<RoleLevel, { level: RoleLevel; label: string; short: string; description: string }> = {
  1: { level: 1, label: "Senior Leader / Executive", short: "Senior Leader", description: "Carries organizational authority. Used to being deferred to." },
  2: { level: 2, label: "Manager", short: "Manager", description: "Mid-level. Leads a team or other managers. Caught between leadership and their people." },
  3: { level: 3, label: "Lead / Individual Contributor", short: "Individual Contributor", description: "Early in the leadership journey or no formal direct reports. Less institutional authority." },
};

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

export const CHECKIN_SUBTITLES: Record<ConversationDirection, string> = {
  downward: "The way you feel about this conversation affects how you show up in it. Take a moment to check in with yourself before you start.",
  upward: "Speaking up to someone senior takes courage. How you feel going in matters. Take a moment to check in with yourself before you start.",
  lateral: "Peer conversations can be surprisingly hard. Take a moment before you start.",
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

/** How to refer to the simulated person from the user's point of view, in lower case. */
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
