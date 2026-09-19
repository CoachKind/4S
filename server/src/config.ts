import "dotenv/config";

function env(name: string, fallback?: string): string | undefined {
  const value = process.env[name];
  if (value === undefined || value === "") return fallback;
  return value;
}

export const config = {
  port: Number(env("PORT", "3001")),
  anthropicApiKey: env("ANTHROPIC_API_KEY"),
  models: {
    simulation: env("SIMULATION_MODEL", "claude-sonnet-5")!,
    extraction: env("EXTRACTION_MODEL", "claude-sonnet-5")!,
    debrief: env("DEBRIEF_MODEL", "claude-opus-5")!,
    eqPrep: env("EQ_PREP_MODEL", "claude-opus-5")!,
  },
  supabase: {
    url: env("SUPABASE_URL"),
    serviceRoleKey: env("SUPABASE_SERVICE_ROLE_KEY"),
  },
  corsOrigins: (env("CORS_ORIGINS", "http://localhost:5173") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),
  /** Max PDF upload size in bytes. Claude accepts 32MB requests; keep headroom for base64 growth. */
  maxPdfBytes: 20 * 1024 * 1024,
  /** Dev only: canned AI responses so the UI flow can run without an API key. */
  mockAi: env("MOCK_AI") === "1",
};
