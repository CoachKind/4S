import { SCENARIOS } from "./prompts/scenarios.js";
import type { RoleLevel } from "./roles.js";
import type { ScenarioId, ScenarioRef } from "./types.js";

/** Builds the scenario object stored on a session for a given dynamic. */
export function scenarioRef(id: ScenarioId, userLevel: RoleLevel, simulatedLevel: RoleLevel): ScenarioRef {
  const s = SCENARIOS[id];
  return { id, label: s.label, description: s.description, title: s.title(userLevel, simulatedLevel) };
}
