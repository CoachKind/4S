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
