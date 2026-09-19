import cors from "cors";
import express, { type NextFunction, type Request, type Response } from "express";
import Anthropic from "@anthropic-ai/sdk";
import multer from "multer";
import { config } from "./config.js";
import { HttpError } from "./lib/errors.js";
import { assessmentsRouter } from "./routes/assessments.js";
import { eqPrepRouter } from "./routes/eqPrep.js";
import { metaRouter } from "./routes/meta.js";
import { sessionsRouter } from "./routes/sessions.js";

export function createApp() {
  const app = express();

  app.use(
    cors({
      origin: (origin, cb) => {
        // Allow same-origin / server-to-server requests (no Origin header) and configured origins.
        if (!origin || config.corsOrigins.includes(origin)) return cb(null, true);
        cb(new HttpError(403, `Origin ${origin} is not allowed.`));
      },
    }),
  );
  app.use(express.json({ limit: "2mb" }));

  app.use("/api", metaRouter);
  app.use("/api/assessments", assessmentsRouter);
  app.use("/api/sessions", sessionsRouter);
  // PRIVACY: /api/eq-prep carries sensitive emotional input. If request logging
  // is ever added to this app, it must exclude this route's body entirely.
  app.use("/api/eq-prep", eqPrepRouter);

  app.use((_req, res) => {
    res.status(404).json({ error: "Not found." });
  });

  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof HttpError) {
      res.status(err.status).json({ error: err.message, details: err.details });
      return;
    }
    if (err instanceof multer.MulterError) {
      const message = err.code === "LIMIT_FILE_SIZE" ? "That PDF is too large (limit 20MB)." : err.message;
      res.status(400).json({ error: message });
      return;
    }
    if (err instanceof Anthropic.AuthenticationError) {
      res.status(500).json({ error: "The server's Anthropic API key was rejected." });
      return;
    }
    if (err instanceof Anthropic.RateLimitError) {
      res.status(429).json({ error: "The AI service is rate limited right now. Try again in a moment." });
      return;
    }
    if (err instanceof Anthropic.APIError) {
      console.error("Anthropic API error", err.status, err.message);
      res.status(502).json({ error: "The AI service returned an error. Please try again." });
      return;
    }
    console.error(err);
    const message = err instanceof Error ? err.message : "Unexpected server error.";
    res.status(500).json({ error: message });
  });

  return app;
}
