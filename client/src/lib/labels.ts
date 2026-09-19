import { DIRECTION_LABELS, ROLE_LEVELS } from "./roles";
import type { Difficulty, ResponseStyle, SetupOptions } from "./types";

/** Fallback option lists used until /api/meta/options responds (or if it never does). */
export const DEFAULT_OPTIONS: SetupOptions = {
  roleLevels: Object.values(ROLE_LEVELS),
  directions: DIRECTION_LABELS,
  scenarios: [{ id: "hard_feedback", title: "Delivering hard feedback" }],
  responseStyles: [
    { id: "defensive", label: "Defensive", description: "Takes feedback personally, challenges observations, protects ego, pushes back firmly." },
    { id: "deflecting", label: "Deflecting", description: "Shifts blame to circumstances, team capacity, or unclear expectations while staying calm." },
    { id: "emotional", label: "Emotional", description: "Visibly affected. May go quiet or show frustration; you must manage the message and the person." },
    { id: "agreeable", label: "Agreeable", description: "Says all the right things without real depth or accountability, trying to end the discomfort." },
  ],
  difficulties: [
    { id: "moderate", label: "Moderate", description: "Some resistance, workable, allows progress." },
    { id: "challenging", label: "Challenging", description: "Real pushback. You must earn each step." },
    { id: "realistic", label: "Realistic", description: "Fully realistic. May include denial, emotional reactivity, or flipping accountability back on you." },
  ],
};

export function styleLabel(options: SetupOptions, id: ResponseStyle): string {
  return options.responseStyles.find((s) => s.id === id)?.label ?? id;
}
export function difficultyLabel(options: SetupOptions, id: Difficulty): string {
  return options.difficulties.find((d) => d.id === id)?.label ?? id;
}
