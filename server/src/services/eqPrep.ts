import { config } from "../config.js";
import { getAnthropic } from "../lib/anthropic.js";
import { HttpError } from "../lib/errors.js";
import { EQ_PREP_SYSTEM_PROMPT } from "../prompts/eqPrep.js";

/**
 * PRIVACY: this service handles the leader's emotional check-in. The input is
 * used for exactly one in-memory model call. It is never persisted, never
 * attached to a session, never logged, and never passed to the debrief. Do not
 * add logging, caching, analytics, or storage here.
 */

const MOCK_PREP =
  "What you are feeling is information, not a verdict on how this will go. Let it tell you what you care about here, and then set it down so it does not do the talking for you. Go in curious, name what you have actually seen, and let silence do some of the work. You do not need every answer today. You need one honest exchange.";

/** Streams the EQ prep as text chunks. Throws HttpError if the model declines. */
export async function* streamEqPrep(feeling: string): AsyncGenerator<string, void, void> {
  if (config.mockAi) {
    for (const word of MOCK_PREP.split(" ")) {
      yield word + " ";
      await new Promise((r) => setTimeout(r, 20));
    }
    return;
  }

  const client = getAnthropic();
  const stream = client.messages.stream({
    model: config.models.eqPrep,
    max_tokens: 1024,
    system: EQ_PREP_SYSTEM_PROMPT,
    messages: [{ role: "user", content: feeling }],
  });

  for await (const event of stream) {
    if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
      yield event.delta.text;
    }
  }

  const final = await stream.finalMessage();
  if (final.stop_reason === "refusal") {
    throw new HttpError(502, "The prep could not be generated for that. Try saying it a different way.");
  }
}
