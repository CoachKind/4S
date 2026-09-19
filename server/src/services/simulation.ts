import type { Anthropic } from "../lib/anthropic.js";
import { config } from "../config.js";
import { getAnthropic } from "../lib/anthropic.js";
import { HttpError } from "../lib/errors.js";
import { buildSimulationSystemPrompt } from "../prompts/persona.js";
import type { SessionSetup, TranscriptMessage } from "../types.js";
import { mockManagerReply } from "./mock.js";

/** Leader messages are user turns; manager messages are assistant turns. */
export function toMessageParams(transcript: TranscriptMessage[]): Anthropic.MessageParam[] {
  return transcript.map((m) => ({
    role: m.role === "leader" ? "user" : "assistant",
    content: m.content,
  }));
}

/** Strips any accidental stage directions or wrapping quotes the model might add. */
export function cleanSpokenText(text: string): string {
  let t = text.trim();
  // Remove a leading speaker label like "Marcus:".
  t = t.replace(/^[A-Z][\w .'-]{0,40}:\s+/, "");
  // Remove wrapping quotation marks.
  if ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("“") && t.endsWith("”"))) {
    t = t.slice(1, -1).trim();
  }
  // Remove bracketed or asterisked stage directions.
  t = t.replace(/\*[^*\n]{1,80}\*/g, "").replace(/\[[^\]\n]{1,80}\]/g, "");
  return t.replace(/[ \t]{2,}/g, " ").trim();
}

/** Generates the simulated manager's next reply given the full transcript so far. */
export async function generateManagerReply(setup: SessionSetup, transcript: TranscriptMessage[]): Promise<string> {
  if (config.mockAi) return mockManagerReply(setup, transcript);
  const client = getAnthropic();
  const system = buildSimulationSystemPrompt(setup);
  const messages = toMessageParams(transcript);

  if (messages.length === 0 || messages[0].role !== "user") {
    throw new HttpError(400, "The leader opens the conversation.");
  }

  const response = await client.messages.create({
    model: config.models.simulation,
    max_tokens: 1024,
    system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
    messages,
  });

  if (response.stop_reason === "refusal") {
    throw new HttpError(502, "The simulation could not respond to that message. Try rephrasing.");
  }

  const text = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n");

  const cleaned = cleanSpokenText(text);
  if (!cleaned) throw new HttpError(502, "The simulation returned an empty reply.");
  return cleaned;
}
