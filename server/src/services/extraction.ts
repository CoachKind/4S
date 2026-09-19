import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { config } from "../config.js";
import { getAnthropic } from "../lib/anthropic.js";
import { HttpError } from "../lib/errors.js";
import { EXTRACTION_SYSTEM_PROMPT, EXTRACTION_USER_PROMPT } from "../prompts/extraction.js";
import { AssessmentSchema, type Assessment } from "../types.js";
import { MOCK_ASSESSMENT } from "./mock.js";

/** Sends a TriMetrix DNA PDF to Claude and returns the structured assessment. */
export async function extractAssessmentFromPdf(pdf: Buffer): Promise<Assessment> {
  if (config.mockAi) return structuredClone(MOCK_ASSESSMENT);
  const client = getAnthropic();

  const response = await client.messages.parse({
    model: config.models.extraction,
    max_tokens: 16000,
    system: EXTRACTION_SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "document",
            source: {
              type: "base64",
              media_type: "application/pdf",
              data: pdf.toString("base64"),
            },
          },
          { type: "text", text: EXTRACTION_USER_PROMPT },
        ],
      },
    ],
    output_config: { format: zodOutputFormat(AssessmentSchema) },
  });

  if (response.stop_reason === "refusal") {
    throw new HttpError(422, "The model declined to read this document.");
  }
  if (!response.parsed_output) {
    throw new HttpError(502, "Could not extract structured data from this PDF. Is it a TriMetrix DNA report?");
  }
  return response.parsed_output;
}
