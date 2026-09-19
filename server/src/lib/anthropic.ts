import Anthropic from "@anthropic-ai/sdk";
import { config } from "../config.js";

let client: Anthropic | null = null;

/** Lazily construct the Anthropic client so the server can boot (and serve health checks) without a key. */
export function getAnthropic(): Anthropic {
  if (!client) {
    if (!config.anthropicApiKey) {
      throw new Error("ANTHROPIC_API_KEY is not set on the server.");
    }
    client = new Anthropic({ apiKey: config.anthropicApiKey });
  }
  return client;
}

export { Anthropic };
