import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

// Mock mode must be set before the app is imported (config reads env at import).
process.env.MOCK_AI = "1";

const { createApp } = await import("../src/app.ts");
const { EQ_PREP_SYSTEM_PROMPT } = await import("../src/prompts/eqPrep.ts");
const { buildDebriefSystemPrompt, buildDebriefUserPrompt } = await import("../src/prompts/debrief.ts");
const { SessionSetupSchema } = await import("../src/types.ts");

/** Assembled from fragments so the repo-wide forbidden-word guard can scan this file. */
const FORBIDDEN = new RegExp(["sub", "ordinate"].join(""), "i");

async function withServer<T>(fn: (base: string) => Promise<T>): Promise<T> {
  const app = createApp();
  const server = await new Promise<import("node:http").Server>((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });
  const addr = server.address();
  const port = typeof addr === "object" && addr ? addr.port : 0;
  try {
    return await fn(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise((r) => server.close(r));
  }
}

test("eq-prep system prompt matches the spec and never uses the forbidden word", () => {
  assert.match(EQ_PREP_SYSTEM_PROMPT, /You are a Coach Kind leadership coach/);
  assert.match(EQ_PREP_SYSTEM_PROMPT, /Keep it under 80 words/);
  assert.doesNotMatch(EQ_PREP_SYSTEM_PROMPT, FORBIDDEN);
});

test("POST /api/eq-prep streams a prep as plain text and is not cached", async () => {
  await withServer(async (base) => {
    const res = await fetch(`${base}/api/eq-prep`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ feeling: "They always have an excuse and it exhausts me." }),
    });
    assert.equal(res.status, 200);
    assert.match(res.headers.get("content-type") ?? "", /text\/plain/);
    assert.equal(res.headers.get("cache-control"), "no-store");
    const text = await res.text();
    assert.ok(text.split(/\s+/).length >= 20, "prep should be several sentences");
    assert.ok(!text.includes("\u0000ERROR"), "stream must not carry an error marker");
  });
});

test("POST /api/eq-prep rejects empty input without echoing anything back", async () => {
  await withServer(async (base) => {
    const res = await fetch(`${base}/api/eq-prep`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ feeling: "   " }),
    });
    assert.equal(res.status, 400);
    const body = (await res.json()) as { error: string; details?: unknown };
    assert.equal(body.details, undefined);
  });
});

test("the session object and stores have no place for emotional check-in data", () => {
  const setup = SessionSetupSchema.parse({
    userRole: { level: 1 },
    simulatedRole: { level: 2 },
    simulatedName: "Marcus",
    scenario: "hard_feedback",
    responseStyle: "defensive",
    difficulty: "moderate",
    feeling: "I dread this",
    eqPrep: "should be dropped",
  } as Record<string, unknown>);
  assert.ok(!("feeling" in setup));
  assert.ok(!("eqPrep" in setup));
});

test("the debrief prompt has no channel for emotional check-in content", () => {
  const setup = SessionSetupSchema.parse({
    userRole: { level: 1 },
    simulatedRole: { level: 2 },
    simulatedName: "Marcus",
    scenario: "hard_feedback",
    responseStyle: "defensive",
    difficulty: "moderate",
  });
  const prompt = buildDebriefUserPrompt(setup, []);
  for (const forbidden of [/check-?in/i, /how you feel/i, /emotional prep/i, /eq prep/i]) {
    assert.doesNotMatch(prompt, forbidden);
    assert.doesNotMatch(buildDebriefSystemPrompt(setup), forbidden);
  }
});

test("no server source references the emotional input outside the eq-prep files", () => {
  const root = join(import.meta.dirname, "..", "src");
  const files: string[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name);
      if (statSync(p).isDirectory()) walk(p);
      else if (p.endsWith(".ts")) files.push(p);
    }
  };
  walk(root);
  const allowed = new Set(["prompts/eqPrep.ts", "services/eqPrep.ts", "routes/eqPrep.ts"]);
  for (const f of files) {
    const rel = f.slice(root.length + 1);
    if (allowed.has(rel)) continue;
    const src = readFileSync(f, "utf8");
    // Matches the identifier (property access, destructuring, keys, assignment), not the English word in prose.
    assert.doesNotMatch(src, /\.feeling\b|\{\s*feeling\b|\bfeeling\s*[:=}]/, `${rel} must not handle the emotional input`);
    assert.doesNotMatch(src, /\beqPrep\s*:(?!\s*env\()/, `${rel} must not store the EQ prep`);
  }
});
