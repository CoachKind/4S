// Mirrors the card copy and dynamic titles in server/src/prompts/scenarios.ts. Kept in sync by hand.
import { conversationDirection, simulatedTerm } from "./roles";
import type { RoleLevel, ScenarioId, SetupOptions } from "./types";

export const SCENARIO_CARDS: SetupOptions["scenarios"] = [
  {
    id: "hard_feedback",
    label: "Hard Feedback",
    description: "Something needs to be said and it won't be easy to hear. You need to say it clearly and have it land.",
    placeholder:
      "e.g. Marcus has been missing weekly check-ins and two of his direct reports have come to me separately in the last month. I've hinted at this before but never named it directly.",
    title: "Delivering hard feedback",
  },
  {
    id: "accountability",
    label: "Accountability Conversation",
    description: "They committed to something and didn't follow through. This is the follow-up — and it's not the first time.",
    placeholder:
      "e.g. They said the report would be done by Friday. It wasn't, and they haven't mentioned it. This has happened before with deadlines they set themselves.",
    title: "Following up on a missed commitment",
  },
  {
    id: "reengagement",
    label: "Re-engagement Conversation",
    description: "Something changed. They've pulled back, gone quiet, or stopped bringing the energy they used to. You need to get to the root of it.",
    placeholder:
      "e.g. For the last month she's been doing the minimum. She used to be one of my most engaged people. She hasn't said anything is wrong but something clearly is.",
    title: "Getting to the root of disengagement",
  },
  {
    id: "low_motivation",
    label: "Low Motivation Conversation",
    description: "The output is down and the effort is visible to the team. You need to name it without humiliating them.",
    placeholder:
      "e.g. His numbers have dropped for two straight months and his team has noticed. He's capable — this isn't a skill issue. Something is off and it's starting to affect the people around him.",
    title: "Addressing low motivation and low output",
  },
];

export function scenarioTitle(id: ScenarioId, userLevel: RoleLevel, simulatedLevel: RoleLevel): string {
  const term = simulatedTerm(userLevel, simulatedLevel);
  const d = conversationDirection(userLevel, simulatedLevel);
  switch (id) {
    case "hard_feedback":
      return `Delivering hard feedback to ${term}`;
    case "accountability":
      return `Following up on a missed commitment with ${term}`;
    case "reengagement":
      if (d === "upward") return `Telling ${term} you've pulled back`;
      if (d === "lateral") return "Checking in on a peer who's pulled back";
      return `Re-engaging ${term}`;
    case "low_motivation":
      if (d === "upward") return `Telling ${term} you're running on empty`;
      if (d === "lateral") return "Naming a peer's disengagement";
      return `Addressing low motivation with ${term}`;
  }
}

/** Small line icons, one per scenario, drawn in the current text color. */
export function ScenarioIcon({ id, className = "h-5 w-5" }: { id: ScenarioId; className?: string }) {
  const common = { className, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.75, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };
  switch (id) {
    case "hard_feedback":
      // Speech bubble with an emphasis mark.
      return (
        <svg {...common}>
          <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5v8a2.5 2.5 0 0 1-2.5 2.5H10l-4.5 4v-4A2.5 2.5 0 0 1 4 13.5z" />
          <path d="M12 7v4" />
          <path d="M12 13.5h.01" />
        </svg>
      );
    case "accountability":
      // Checkbox with a return arrow: the follow-up.
      return (
        <svg {...common}>
          <rect x="4" y="4" width="16" height="16" rx="3" />
          <path d="M8 12l2.5 2.5L16 9" />
        </svg>
      );
    case "reengagement":
      // Two people, one slightly apart.
      return (
        <svg {...common}>
          <circle cx="9" cy="8" r="3" />
          <path d="M3.5 19a5.5 5.5 0 0 1 11 0" />
          <circle cx="17.5" cy="9.5" r="2.25" />
          <path d="M15.5 19a4.5 4.5 0 0 1 5-4.4" />
        </svg>
      );
    case "low_motivation":
      // Trend line dipping.
      return (
        <svg {...common}>
          <path d="M4 6l5 6 3-3 8 8" />
          <path d="M20 12v5h-5" />
        </svg>
      );
  }
}
