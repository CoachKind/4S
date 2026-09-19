import { createServer } from "node:http";
import { createApp } from "./app.js";
import { config } from "./config.js";
import { getStore } from "./services/store.js";
import { attachVoiceRelay } from "./voice/relay.js";

const app = createApp();
const server = createServer(app);
attachVoiceRelay(server);

server.listen(config.port, () => {
  console.log(`4S server listening on http://localhost:${config.port}`);
  console.log(`  store: ${getStore().kind}`);
  console.log(`  models: simulation=${config.models.simulation} extraction=${config.models.extraction} debrief=${config.models.debrief} eqPrep=${config.models.eqPrep}`);
  console.log(`  voice: ${config.mockAi ? "mock relay" : config.voice.openaiApiKey ? `${config.voice.model} / ${config.voice.voice}` : "not configured (OPENAI_API_KEY missing)"}`);
  if (config.mockAi) {
    console.warn("  MOCK_AI=1: serving canned AI responses. Do not use in production.");
  } else if (!config.anthropicApiKey) {
    console.warn("  WARNING: ANTHROPIC_API_KEY is not set. Extraction, simulation, and debrief calls will fail.");
  }
});
