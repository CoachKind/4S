import type { ScenarioId } from "../lib/types";

/** Small line icons, one per scenario, drawn in the current text color. */
export function ScenarioIcon({ id, className = "h-5 w-5" }: { id: ScenarioId; className?: string }) {
  const common = {
    className,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.75,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };
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
