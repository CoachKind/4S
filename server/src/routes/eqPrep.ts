import { Router } from "express";
import { z } from "zod";
import { HttpError } from "../lib/errors.js";
import { streamEqPrep } from "../services/eqPrep.js";

/**
 * POST /api/eq-prep
 *
 * PRIVACY: this endpoint handles sensitive user input (how the leader feels
 * about the conversation or the person). The request body MUST NOT be logged,
 * stored, attached to a session, or forwarded anywhere except the single model
 * call that generates the prep. The generated prep MUST NOT be stored either.
 * Errors from this route are reported generically so no input is echoed back
 * in logs or responses. Keep this route out of any future request logging.
 */

const BodySchema = z.object({
  feeling: z.string().trim().min(1).max(4000),
});

export const eqPrepRouter = Router();

eqPrepRouter.post("/", async (req, res, next) => {
  const parsed = BodySchema.safeParse(req.body);
  if (!parsed.success) {
    // Deliberately no validation details: never echo this input.
    next(new HttpError(400, "Write a sentence or two first."));
    return;
  }

  res.status(200);
  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  try {
    for await (const chunk of streamEqPrep(parsed.data.feeling)) {
      if (res.writableEnded || res.destroyed) return;
      res.write(chunk);
    }
    res.end();
  } catch (err) {
    // Headers are already sent, so the standard error handler can't respond.
    // Signal failure with a trailer-free marker the client understands, and
    // do not log the error object in case it carries request context.
    const status = err instanceof HttpError ? err.status : 502;
    if (!res.headersSent) {
      next(new HttpError(status, "The prep could not be generated. Please try again."));
      return;
    }
    res.write(`\n\u0000ERROR:${status}`);
    res.end();
  }
});
