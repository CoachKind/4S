import { createApp } from "./app.js";
import { config } from "./config.js";
import { getStore } from "./services/store.js";

const app = createApp();

app.listen(config.port, () => {
  console.log(`4S server listening on http://localhost:${config.port}`);
  console.log(`  store: ${getStore().kind}`);
  console.log(`  models: simulation=${config.models.simulation} extraction=${config.models.extraction} debrief=${config.models.debrief}`);
  if (config.mockAi) {
    console.warn("  MOCK_AI=1: serving canned AI responses. Do not use in production.");
  } else if (!config.anthropicApiKey) {
    console.warn("  WARNING: ANTHROPIC_API_KEY is not set. Extraction, simulation, and debrief calls will fail.");
  }
});
