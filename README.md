# 4S — Safely Simulate Stressful Situations

An AI-powered leadership training tool by **Coach Kind**. Leaders practice difficult conversations with a simulated manager on their team, then receive a personalized debrief.

The loop: **set up the scenario → have the conversation → get the debrief.**

TriMetrix DNA assessments are optional. Without them, the simulation runs on a behavioral archetype. With a Manager assessment, the simulated manager is built from that person's real DISC, Driving Forces, competency gaps, and communication flags. With a Leader assessment, the debrief is personalized to the leader's own profile. With both, the debrief explains the dynamic between the two profiles.

## Status

**Phase 1 (core text simulation) is complete.**

- [x] Project scaffold: React + Tailwind frontend, Express backend, env config
- [x] PDF upload component, two optional and interchangeable slots (Leader / Manager)
- [x] PDF extraction endpoint (Claude document reading → structured JSON)
- [x] Assessment confirmation screen with inline correction
- [x] Setup screen with all specified fields
- [x] Persona builder (assessment data + setup → simulation system prompt)
- [x] Text simulation interface with turn indicator, thinking state, context banner, always-visible End and Debrief
- [x] Debrief endpoint (transcript + assessments → four-section debrief)
- [x] Debrief display with a visually distinct GAME Check

Phases 2–4 (more scenarios, session history, shareable debrief, voice mode, coach dashboard) are not started.

## Stack

| Layer | Choice |
|---|---|
| Frontend | React 19, Vite, Tailwind CSS v4, TypeScript |
| Backend | Node 20+, Express 5, TypeScript |
| AI | Anthropic Claude API via `@anthropic-ai/sdk`. `claude-sonnet-5` for extraction and simulation, `claude-opus-5` for the debrief |
| PDF parsing | Claude document input (base64 PDF) with structured JSON output |
| Storage | Supabase (`sessions` table) when configured, otherwise in-memory |
| Hosting | Vercel (client), Railway (server) |

API keys live only on the server.

## Repository layout

```
client/            Vite + React app
  src/screens/     SetupScreen, AssessmentReviewScreen, SimulationScreen, DebriefScreen
  src/components/  UI primitives, Header, AssessmentUpload
  src/lib/         API client, types, labels
server/            Express API
  src/prompts/     persona.ts (persona builder), debrief.ts, extraction.ts, scenarios.ts
  src/services/    extraction, simulation, debrief, sessions, store (memory / Supabase), mock
  src/routes/      /api/assessments, /api/sessions, /api/health, /api/meta/options
  tests/           Prompt and helper tests (node:test)
supabase/          SQL migration for the sessions table
```

## Running locally

Requirements: Node 20 or newer.

```bash
npm install
cp .env.example server/.env    # then set ANTHROPIC_API_KEY
npm run dev                    # server on :3001, client on :5173 (proxies /api)
```

Open http://localhost:5173.

Without an API key you can still exercise the whole UI with canned responses:

```bash
MOCK_AI=1 npm run dev
```

`MOCK_AI` is for development only. Any PDF returns a sample assessment and the manager replies from a fixed script.

Other commands:

```bash
npm run typecheck   # both packages
npm test            # server tests
npm run build       # both packages
```

## Environment variables

See `.env.example`. The server reads `server/.env` (or the process environment).

| Variable | Required | Notes |
|---|---|---|
| `ANTHROPIC_API_KEY` | yes | Server only |
| `PORT` | no | Default 3001 |
| `SIMULATION_MODEL`, `EXTRACTION_MODEL`, `DEBRIEF_MODEL` | no | Defaults: `claude-sonnet-5`, `claude-sonnet-5`, `claude-opus-5` |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | no | Both set → sessions persist to Supabase. Otherwise in-memory |
| `CORS_ORIGINS` | no | Comma-separated browser origins. Default `http://localhost:5173` |
| `MOCK_AI` | no | `1` enables canned AI responses (dev only) |
| `VITE_API_BASE_URL` | no | Client build-time. Leave unset in dev; set to the Railway URL in production |

## API

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/health` | Liveness, store kind, model config |
| `GET` | `/api/meta/options` | Scenario, response style, and difficulty option lists |
| `POST` | `/api/assessments/extract` | multipart `file` (PDF) → `{ assessment }` |
| `POST` | `/api/sessions` | Setup JSON (with confirmed assessments) → `{ session }` |
| `GET` | `/api/sessions/:id` | Fetch a session |
| `POST` | `/api/sessions/:id/messages` | `{ content }` → `{ leader, manager }` (the manager's reply) |
| `POST` | `/api/sessions/:id/debrief` | Ends the conversation and returns the session with `debrief` |

## How assessments shape the output

**Persona builder** (`server/src/prompts/persona.ts`). With a Manager assessment:

- Natural DISC scores of 60+ trigger the High D / I / S / C reaction patterns; 40 or below trigger the low-score patterns.
- Primary Driving Forces matching Commanding, Altruistic, Instinctive, or Harmonious add "what they are protecting". Resourceful or Intellectual in the Indifferent group adds the "responds to feeling over evidence" pattern.
- Bottom-5 competencies matching self-awareness, conflict management, or personal accountability add blindspots.
- "Ways NOT to communicate" become explicit pressure points; "Ways to communicate" become what softens them.
- The selected response style is layered on top as emotional tone. Without a Manager assessment, the response style is the archetype.

**Debrief** (`server/src/prompts/debrief.ts`). The Leader profile personalizes What to Sharpen and The Coaching Moment. The Manager profile explains why moments played out as they did. With both, the prompt asks for the dynamic between the two profiles.

Assessment data is confirmed by the user before it is used. Prompts never contain the word the spec forbids; a test enforces this.

## Deployment

**Server on Railway.** Point Railway at the repo with root directory `server` (`server/railway.json` sets build and start commands and the health check). Set `ANTHROPIC_API_KEY`, `CORS_ORIGINS` (your Vercel URL), and optionally the Supabase variables.

**Client on Vercel.** Root directory `client`, framework Vite. Set `VITE_API_BASE_URL` to the Railway URL. `client/vercel.json` adds the SPA rewrite.

**Supabase.** Run `supabase/migrations/0001_sessions.sql`, then set the two Supabase variables on the server.

## Product decisions made during the build

The build prompt asked for clarifying questions before application code. This was built autonomously, so the following calls were made and are easy to change:

1. **The leader opens the conversation.** It is the leader's meeting; the manager does not speak first. The empty state says "Marcus has just sat down."
2. **DISC thresholds** are 60+ for high and 40 or below for low, on the natural style. Adapted scores are shown to the model but natural drives the reaction pattern under pressure.
3. **Interchangeable slots** are implemented as a "Use as Leader/Manager instead" swap on each loaded slot, plus per-slot upload, review, and remove.
4. **Ending with no messages** asks for confirmation once, then produces an honest debrief about ending early.
5. **Sessions are anonymous.** There is no auth until Phase 4. The Supabase table has RLS enabled with no policies, so only the service role key (server) can read it.
6. **Debrief structure is enforced with structured output** (a JSON schema with the four sections), so the UI never has to parse prose. Length and "no bullets" are prompt constraints.
