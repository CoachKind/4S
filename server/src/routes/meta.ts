import { Router } from "express";
import { DIFFICULTIES, RESPONSE_STYLES, SCENARIOS } from "../prompts/scenarios.js";
import { getStore } from "../services/store.js";
import { config } from "../config.js";

export const metaRouter = Router();

metaRouter.get("/health", (_req, res) => {
  res.json({
    ok: true,
    hasApiKey: Boolean(config.anthropicApiKey),
    store: getStore().kind,
    mockAi: config.mockAi,
    models: config.models,
  });
});

/** GET /api/meta/options — the setup screen's option lists, so labels live in one place. */
metaRouter.get("/meta/options", (_req, res) => {
  res.json({
    scenarios: Object.values(SCENARIOS).map((s) => ({ id: s.id, title: s.title })),
    responseStyles: Object.entries(RESPONSE_STYLES).map(([id, s]) => ({ id, label: s.label, description: s.description })),
    difficulties: Object.entries(DIFFICULTIES).map(([id, d]) => ({ id, label: d.label, description: d.description })),
  });
});
