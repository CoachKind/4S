import type { SessionSetup } from "../types.js";
import { buildSimulationSystemPrompt } from "./persona.js";

/** Appended to the persona prompt when it is used as the Realtime session's instructions. */
export const VOICE_ADDITION =
  "You are in a spoken conversation. Keep your responses concise and natural, the way a real person speaks in a meeting, not the way they write. Avoid long monologues. Pause naturally. React to the emotional tone of what you hear, not just the words.";

/** The persona prompt, unchanged, plus the spoken-conversation addition. */
export function buildVoiceInstructions(setup: SessionSetup): string {
  return `${buildSimulationSystemPrompt(setup)}\n\n${VOICE_ADDITION}`;
}
