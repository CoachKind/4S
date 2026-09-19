# 4S — Safely Simulate Stressful Situations

An AI-powered leadership training tool by **Coach Kind**. People practice difficult workplace conversations with a simulated colleague, in any direction (downward, upward, or lateral), then receive a personalized debrief.

The loop: **set up the scenario → check in with yourself → have the conversation → get the debrief.**

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
- [x] Emotional Check-In screen between setup and simulation, with a streamed EQ prep and strict no-storage privacy
- [x] Role Dynamic System: three organizational levels, derived conversation direction, and direction-aware persona, check-in, banner, and debrief
- [x] Four scenarios (Hard Feedback, Accountability, Re-engagement, Low Motivation) with a card selector, scenario-specific behavior, and a scenario debrief lens
- [x] Voice mode: real-time spoken conversation through a server-side relay to the OpenAI Realtime API, sharing setup, check-in, persona, and debrief with text mode

Remaining from Phases 2–4: session history, shareable debrief, coach dashboard.

## Stack

| Layer | Choice |
|---|---|
| Frontend | React 19, Vite, Tailwind CSS v4, TypeScript |
| Backend | Node 20+, Express 5, TypeScript |
| AI | Anthropic Claude API via `@anthropic-ai/sdk`. `claude-sonnet-5` for extraction and simulation, `claude-opus-5` for the debrief |
| Voice | OpenAI Realtime API over a raw WebSocket (`ws`), relayed by the server. `gpt-4o-realtime-preview`, voice `alloy` by default |
| PDF parsing | Claude document input (base64 PDF) with structured JSON output |
| Storage | Supabase (`sessions` table) when configured, otherwise in-memory |
| Hosting | Vercel (client), Railway (server) |

API keys live only on the server.

## Repository layout

```
client/            Vite + React app
  src/screens/     SetupScreen, AssessmentReviewScreen, EmotionalCheckInScreen, SimulationScreen, VoiceScreen, DebriefScreen
  src/components/  UI primitives, Header, AssessmentUpload
  src/lib/         API client, types, labels, roles and scenarios (mirrors of the server), audio (capture/playback), voiceClient
server/            Express API
  src/roles.ts     Role levels, conversation direction, and dynamic sentences
  src/prompts/     persona.ts (persona builder), debrief.ts, extraction.ts, eqPrep.ts, scenarios.ts
  src/services/    extraction, simulation, debrief, eqPrep, sessions, store (memory / Supabase), mock
  src/routes/      /api/assessments, /api/sessions, /api/eq-prep, /api/health, /api/meta/options
  src/voice/       WebSocket relay (relay.ts), OpenAI and mock upstreams, transcript accumulator
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

`MOCK_AI` is for development only. Any PDF returns a sample assessment, the simulated person replies from a fixed script, and voice mode runs against a mock relay that plays scripted turns after it hears about a second of audio.

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
| `SIMULATION_MODEL`, `EXTRACTION_MODEL`, `DEBRIEF_MODEL`, `EQ_PREP_MODEL` | no | Defaults: `claude-sonnet-5`, `claude-sonnet-5`, `claude-opus-5`, `claude-opus-5` |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | no | Both set → sessions persist to Supabase. Otherwise in-memory |
| `CORS_ORIGINS` | no | Comma-separated browser origins. Default `http://localhost:5173` |
| `OPENAI_API_KEY` | for voice | Server only. Without it, voice connections are refused with 503 and text mode keeps working |
| `OPENAI_VOICE` | no | Default `alloy` |
| `OPENAI_REALTIME_MODEL`, `OPENAI_REALTIME_URL` | no | Defaults `gpt-4o-realtime-preview`, `wss://api.openai.com/v1/realtime` |
| `MOCK_AI` | no | `1` enables canned AI responses and the mock voice relay (dev only) |
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
| `POST` | `/api/eq-prep` | `{ feeling }` → streamed plain-text EQ prep. Stateless; see Privacy below |
| `POST` | `/api/sessions/:id/mode` | `{ mode: "text" \| "voice" }` → switches an active session; the transcript carries over |
| `WS` | `/voice/:id/connect` | Voice relay. Rejects with 404 (no session), 409 (debriefed), 403 (origin), 503 (no key) before upgrading |

## Role Dynamic System

The setup screen asks two questions before anything else: *You are a…* and *You are speaking with a…*, each one of three levels.

| Level | Label | Short |
|---|---|---|
| 1 | Senior Leader / Executive | Senior Leader |
| 2 | Manager | Manager |
| 3 | Lead / Individual Contributor | Individual Contributor |

The direction is derived, never chosen: a lower level number than the other person is **downward**, a higher number is **upward**, the same number is **lateral**. The session stores `userRole`, `simulatedRole` (each `{ level, label }`) and `conversationDirection` inside `setup`. The server fills in labels and direction itself and ignores any client-sent values for them.

Direction changes the product end to end:

- **Setup.** A direction line appears once both roles are chosen, with a note for upward conversations. The scenario title adapts ("…to a manager on your team", "…to your manager", "…to a peer").
- **Persona.** `buildRoleDynamicSection` adds who the simulated person is at their level and how they experience this direction (a senior leader hearing upward feedback gets subtly patronizing; a manager hearing it from a report gets condescending; an individual contributor hearing it from an executive gets intimidated, and so on). Every prompt line that refers to the user uses a `{{USER}}` placeholder filled from the dynamic, so nothing assumes the user is senior.
- **Emotional Check-In.** The subtitle changes by direction.
- **Simulation banner.** "You're a Senior Leader speaking with a Manager on your team." / "You're an Individual Contributor speaking with a Senior Leader." / "You're a Manager speaking with a peer Manager."
- **Debrief.** The system prompt carries a direction-specific coaching focus, and What Landed opens with the exact sentence for the direction ("This was an upward conversation — one of the hardest dynamics to navigate well.").

Field names are role-neutral: `simulatedName`, `userAssessment`, `simulatedAssessment`, and transcript roles `user` / `simulated`.

## Scenarios

Four scenarios, each available across every role dynamic. They are defined in one place, `server/src/prompts/scenarios.ts`, and each carries:

- card copy (label, one-line description, situation-context placeholder)
- a direction-aware title (for example "Re-engaging a manager on your team" downward, "Telling your manager you've pulled back" upward, "Checking in on a peer who's pulled back" lateral)
- what the user is trying to do, per direction
- what the simulated person walks in believing, per direction
- how the simulated person behaves, per direction and response style (the persona's "HOW YOU BEHAVE IN THIS CONVERSATION" block)
- a debrief lens, injected into the debrief system prompt as "SCENARIO LENS"

| Scenario | Downward | Upward | Lateral |
|---|---|---|---|
| Hard Feedback | Unchanged from Phase 1 | The senior person is not used to feedback from this direction | Peers with their own turf |
| Accountability | Excuse ready, pivots to now, hides the pattern | Dismissive: "let's not dwell on what didn't happen" | Feels called out, gets territorial |
| Re-engagement | "I'm fine", real reason surfaces only with safety | The user is the one who has pulled back; the senior reacts by style | Less formal, more personal |
| Low Motivation | Surprised it is visible; real cause underneath | The user is running on empty; the senior supports, solves, or dismisses | Delicate; not officially their lane |

The session stores the scenario as an object: `{ id, label, description, title }`, with `title` already rendered for the dynamic. Clients send just the id.

## How assessments shape the output

**Persona builder** (`server/src/prompts/persona.ts`). With the simulated person's assessment:

- Natural DISC scores of 60+ trigger the High D / I / S / C reaction patterns; 40 or below trigger the low-score patterns.
- Primary Driving Forces matching Commanding, Altruistic, Instinctive, or Harmonious add "what they are protecting". Resourceful or Intellectual in the Indifferent group adds the "responds to feeling over evidence" pattern.
- Bottom-5 competencies matching self-awareness, conflict management, or personal accountability add blindspots.
- "Ways NOT to communicate" become explicit pressure points; "Ways to communicate" become what softens them.
- The selected response style is layered on top as emotional tone. Without an assessment for the simulated person, the response style is the archetype.

**Debrief** (`server/src/prompts/debrief.ts`). The user's profile personalizes What to Sharpen and The Coaching Moment. The simulated person's profile explains why moments played out as they did. With both, the prompt asks for the dynamic between the two profiles.

Assessment data is confirmed by the user before it is used. Prompts never contain the word the spec forbids; a test enforces this.

## Voice mode

Text mode is for rehearsing what to say; voice mode is for rehearsing how to say it. The setup screen has a Practice mode toggle (Text by default). Voice sessions share the setup, the Emotional Check-In, the persona, and the debrief with text mode. Only the conversation screen and the server relay are different.

**Relay.** The browser opens a WebSocket to `/voice/:sessionId/connect`; the server opens one to the OpenAI Realtime API and relays between them. The OpenAI key never reaches the browser. On connect the server sends `session.update` with the persona prompt plus a spoken-conversation addition as `instructions`, the configured voice, pcm16 in and out, Whisper input transcription, and server-side voice activity detection. Any prior transcript is seeded into the model's context so a switch or reconnect keeps continuity. The browser may only send audio buffer events, cancel, and truncate; it can never change the session configuration.

**Transcript.** Turns are placed when the service creates conversation items and filled in when `conversation.item.input_audio_transcription.completed` (user) and `response.audio_transcript.done` (simulated) arrive, so order follows speech even when the user's transcription lands after the reply starts. Each completed turn is pushed to the browser as `relay.transcript` and saved to the session; the transcript is saved again when the connection closes. The debrief reads it exactly as it reads a text transcript, and adds one line to its system prompt asking the coach to consider delivery.

**Browser.** The screen asks for the microphone on load. Tap the circle once to connect; after that it is a state indicator (listening in Coach Kind yellow with expanding rings, thinking with a dark spinner, speaking with slow white rings), not push-to-talk. Audio is captured by an AudioWorklet at 24kHz mono PCM16 and played back by scheduling PCM chunks; when the user starts talking over a reply, playback stops immediately. "Switch to text mode" in the header ends the voice connection, saves what exists, and opens the text screen with the history loaded. A denied microphone shows a message and a button back to setup with Text pre-selected.

## Emotional Check-In and privacy

Between setup and the simulation, the leader is asked how the conversation or the person makes them feel going in, and gets a short EQ prep back. This is a private moment of preparation, not a data point, and the code enforces that at every layer:

- **Server.** `POST /api/eq-prep` takes the text, makes one streaming model call, and returns the prep. It has no session id, touches no store, and returns validation errors without details so the input is never echoed. There is no request-body logging in the app; a comment on the route and in `app.ts` requires any future logging to exclude it.
- **Session and debrief.** The session schema has no field for the check-in, so the API drops it if sent, and the debrief prompt is built only from the setup and transcript. Tests in `server/tests/eqPrep.test.ts` check both, and scan the rest of the server source for any handling of the input.
- **Client.** The text and the prep live only in the check-in component's state. Nothing is written to `localStorage`, `sessionStorage`, or IndexedDB. State is cleared and any in-flight request aborted before the screen hands off to the simulation.
- **UI.** The line "What you write here is used only to prepare you. It is never saved or stored." is always visible under the field.

The field is optional. Moving on without a prep asks once ("Skip the check-in?") and then proceeds with nothing generated.

## Deployment

**Server on Railway.** Point Railway at the repo with root directory `server` (`server/railway.json` sets build and start commands and the health check). Set `ANTHROPIC_API_KEY`, `CORS_ORIGINS` (your Vercel URL), and optionally the Supabase variables.

**Client on Vercel.** Root directory `client`, framework Vite. Set `VITE_API_BASE_URL` to the Railway URL. `client/vercel.json` adds the SPA rewrite.

**Supabase.** Run `supabase/migrations/0001_sessions.sql`, then set the two Supabase variables on the server.

## Product decisions made during the build

The build prompt asked for clarifying questions before application code. This was built autonomously, so the following calls were made and are easy to change:

1. **The user opens the conversation.** They asked for the time; the simulated person does not speak first. The empty state says "Marcus has just sat down."
2. **DISC thresholds** are 60+ for high and 40 or below for low, on the natural style. Adapted scores are shown to the model but natural drives the reaction pattern under pressure.
3. **Interchangeable slots** are implemented as a "This is mine / This is theirs" swap on each loaded slot, plus per-slot upload, review, and remove.
4. **Ending with no messages** asks for confirmation once, then produces an honest debrief about ending early.
5. **Sessions are anonymous.** There is no auth until Phase 4. The Supabase table has RLS enabled with no policies, so only the service role key (server) can read it.
6. **Session creation happens at the end of setup**, before the check-in. The check-in screen only gates entry to the simulation; it never reads or writes the session.
7. **Same level is allowed and means lateral.** The role brief both forbade choosing the same level and defined lateral as the same level with a "peer Manager" example; lateral won, so no same-level validation error exists.
8. **Debrief structure is enforced with structured output** (a JSON schema with the four sections), so the UI never has to parse prose. Length and "no bullets" are prompt constraints.
