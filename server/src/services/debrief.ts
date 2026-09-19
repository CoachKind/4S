import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { config } from "../config.js";
import { getAnthropic } from "../lib/anthropic.js";
import { HttpError } from "../lib/errors.js";
import { buildDebriefSystemPrompt, buildDebriefUserPrompt } from "../prompts/debrief.js";
import { DebriefSchema, type Debrief, type SessionSetup, type TranscriptMessage } from "../types.js";
import { mockDebrief } from "./mock.js";

/** Generates the four-section debrief from the transcript and any loaded assessments. */
export async function generateDebrief(setup: SessionSetup, transcript: TranscriptMessage[]): Promise<Debrief> {
  if (config.mockAi) return mockDebrief(setup, transcript);
  const client = getAnthropic();

  const response = await client.messages.parse({
    model: config.models.debrief,
    max_tokens: 16000,
    system: buildDebriefSystemPrompt(setup),
    messages: [{ role: "user", content: buildDebriefUserPrompt(setup, transcript) }],
    output_config: { format: zodOutputFormat(DebriefSchema) },
  });

  if (response.stop_reason === "refusal") {
    throw new HttpError(502, "The debrief could not be generated for this conversation.");
  }
  if (!response.parsed_output) {
    throw new HttpError(502, "The debrief came back malformed. Please try again.");
  }
  return response.parsed_output;
}
