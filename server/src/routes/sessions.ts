import { Router } from "express";
import { z } from "zod";
import { HttpError } from "../lib/errors.js";
import { createSession, debriefSession, getSession, sendLeaderMessage } from "../services/sessions.js";
import { SessionSetupSchema } from "../types.js";

export const sessionsRouter = Router();

const MessageBodySchema = z.object({
  content: z.string().trim().min(1, "Say something first.").max(4000),
});

/** POST /api/sessions — create a session from confirmed setup (assessments optional). */
sessionsRouter.post("/", async (req, res, next) => {
  try {
    const parsed = SessionSetupSchema.safeParse(req.body);
    if (!parsed.success) throw new HttpError(400, "Invalid setup.", z.treeifyError(parsed.error));
    const session = await createSession(parsed.data);
    res.status(201).json({ session });
  } catch (err) {
    next(err);
  }
});

/** GET /api/sessions/:id */
sessionsRouter.get("/:id", async (req, res, next) => {
  try {
    const session = await getSession(String(req.params.id));
    res.json({ session });
  } catch (err) {
    next(err);
  }
});

/** POST /api/sessions/:id/messages — the user speaks; returns the simulated person's reply. */
sessionsRouter.post("/:id/messages", async (req, res, next) => {
  try {
    const parsed = MessageBodySchema.safeParse(req.body);
    if (!parsed.success) throw new HttpError(400, "Invalid message.", z.treeifyError(parsed.error));
    const result = await sendLeaderMessage(String(req.params.id), parsed.data.content);
    res.json({ user: result.user, simulated: result.simulated, status: result.session.status });
  } catch (err) {
    next(err);
  }
});

/** POST /api/sessions/:id/debrief — end the conversation and generate the debrief. */
sessionsRouter.post("/:id/debrief", async (req, res, next) => {
  try {
    const session = await debriefSession(String(req.params.id));
    res.json({ session });
  } catch (err) {
    next(err);
  }
});
