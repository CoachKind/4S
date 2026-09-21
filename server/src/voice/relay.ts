import type { IncomingMessage, Server as HttpServer } from "node:http";
import type { Duplex } from "node:stream";
import { WebSocketServer, WebSocket } from "ws";
import { config } from "../config.js";
import { buildVoiceInstructions } from "../prompts/voice.js";
import { replaceTranscript } from "../services/sessions.js";
import { getStore } from "../services/store.js";
import type { Session } from "../types.js";
import { MockRealtimeUpstream } from "./mockRealtime.js";
import { OpenAiRealtimeUpstream } from "./openaiRealtime.js";
import { SEED_PREFIX, TranscriptAccumulator } from "./transcript.js";
import type { RealtimeEvent, RealtimeUpstream } from "./upstream.js";

/**
 * Voice relay: browser <-> server <-> OpenAI Realtime.
 *
 * GET /voice/:sessionId/connect upgrades to a WebSocket. The server holds the
 * OpenAI connection and the API key; the browser only ever talks to us. The
 * browser sends Realtime-format events (audio appends), we forward the
 * allowed ones upstream, and we forward every upstream event back down, plus
 * our own "relay.*" events for readiness, transcript turns, and errors.
 */

const VOICE_PATH = /^\/voice\/([^/]+)\/connect$/;

/** Event types the browser may send upstream. Everything else (session.update above all) is dropped. */
const BROWSER_ALLOWED = new Set([
  "input_audio_buffer.append",
  "input_audio_buffer.commit",
  "input_audio_buffer.clear",
  "response.cancel",
  "conversation.item.truncate",
]);

/** Largest browser frame we accept: ~1s of pcm16 audio in base64 plus JSON overhead. */
const MAX_BROWSER_FRAME = 128 * 1024;

function rejectUpgrade(socket: Duplex, status: number, text: string) {
  socket.write(`HTTP/1.1 ${status} ${text}\r\nConnection: close\r\nContent-Length: 0\r\n\r\n`);
  socket.destroy();
}

function originAllowed(req: IncomingMessage): boolean {
  const origin = req.headers.origin;
  if (!origin) return true;
  return config.corsOrigins.includes(origin);
}

/** Audio format on both directions: 24kHz mono PCM16. */
const PCM_RATE = 24_000;

/**
 * The GA Realtime session configuration sent on connect: audio in and out,
 * input transcription, server-side voice activity detection, and the persona
 * prompt (plus the spoken-conversation addition) as instructions.
 */
export function buildSessionUpdate(setup: Session["setup"], voice: string = config.voice.voice): RealtimeEvent {
  return {
    type: "session.update",
    session: {
      type: "realtime",
      output_modalities: ["audio"],
      instructions: buildVoiceInstructions(setup),
      audio: {
        input: {
          format: { type: "audio/pcm", rate: PCM_RATE },
          transcription: { model: config.voice.transcriptionModel },
          turn_detection: { type: "server_vad" },
        },
        output: {
          format: { type: "audio/pcm", rate: PCM_RATE },
          voice,
        },
      },
    },
  };
}

/** A prior transcript turn as a GA conversation item, so the model has the history. */
export function buildSeedItem(message: Session["transcript"][number], index: number): RealtimeEvent {
  const isUser = message.role === "user";
  return {
    type: "conversation.item.create",
    item: {
      id: `${SEED_PREFIX}${index}`,
      type: "message",
      role: isUser ? "user" : "assistant",
      content: [{ type: isUser ? "input_text" : "output_text", text: message.content }],
    },
  };
}

/** The fields of an upstream error worth logging. Never the whole event: it can echo request content. */
function describeUpstreamError(error: unknown): { type?: string; code?: string; param?: string; message?: string } {
  const e = (error ?? {}) as Record<string, unknown>;
  return {
    type: typeof e.type === "string" ? e.type : undefined,
    code: typeof e.code === "string" ? e.code : undefined,
    param: typeof e.param === "string" ? e.param : undefined,
    message: typeof e.message === "string" ? e.message : undefined,
  };
}

export function createUpstream(): RealtimeUpstream {
  if (config.mockAi) return new MockRealtimeUpstream();
  return new OpenAiRealtimeUpstream();
}

export function attachVoiceRelay(server: HttpServer): WebSocketServer {
  const wss = new WebSocketServer({ noServer: true, maxPayload: MAX_BROWSER_FRAME });

  server.on("upgrade", (req, socket, head) => {
    const url = new URL(req.url ?? "/", "http://localhost");
    const match = url.pathname.match(VOICE_PATH);
    if (!match) {
      rejectUpgrade(socket, 404, "Not Found");
      return;
    }
    if (!originAllowed(req)) {
      rejectUpgrade(socket, 403, "Forbidden");
      return;
    }
    if (!config.mockAi && !config.voice.openaiApiKey) {
      rejectUpgrade(socket, 503, "Voice Not Configured");
      return;
    }
    const sessionId = decodeURIComponent(match[1]);
    void getStore()
      .get(sessionId)
      .then((session) => {
        if (!session) {
          rejectUpgrade(socket, 404, "Session Not Found");
          return;
        }
        if (session.status !== "active") {
          rejectUpgrade(socket, 409, "Session Debriefed");
          return;
        }
        wss.handleUpgrade(req, socket, head, (ws) => runRelay(ws, session));
      })
      .catch((err) => {
        console.error("voice: session lookup failed", err instanceof Error ? err.message : err);
        rejectUpgrade(socket, 500, "Internal Server Error");
      });
  });

  return wss;
}

function sendJson(ws: WebSocket, event: RealtimeEvent) {
  if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(event));
}

export function runRelay(browser: WebSocket, session: Session): void {
  const name = session.setup.simulatedName;
  const transcript = new TranscriptAccumulator(session.transcript);
  let upstream: RealtimeUpstream;
  let closed = false;
  let readySent = false;
  let saving: Promise<unknown> = Promise.resolve();

  const persist = () => {
    const messages = transcript.messages();
    saving = saving
      .then(() => replaceTranscript(session.id, messages))
      .catch((err) => {
        console.error("voice: transcript save failed", err instanceof Error ? err.message : err);
      });
    return saving;
  };

  const shutdown = async (code: number, reason: string) => {
    if (closed) return;
    closed = true;
    try {
      upstream?.close();
    } catch {
      // already closed
    }
    await persist();
    if (browser.readyState === WebSocket.OPEN || browser.readyState === WebSocket.CONNECTING) browser.close(code, reason);
  };

  try {
    upstream = createUpstream();
  } catch (err) {
    sendJson(browser, { type: "relay.error", message: "Voice mode is not configured on the server." });
    console.error("voice: upstream unavailable", err instanceof Error ? err.message : err);
    browser.close(1011, "voice not configured");
    return;
  }

  upstream.on("open", () => {
    upstream.send(buildSessionUpdate(session.setup));
    // Carry any existing turns (a text conversation switched to voice, or a reconnect) into the model's context.
    session.transcript.forEach((m, i) => upstream.send(buildSeedItem(m, i)));
    readySent = true;
    sendJson(browser, { type: "relay.ready", name, transcript: transcript.messages() });
  });

  upstream.on("message", (event: RealtimeEvent) => {
    const completed = transcript.handle(event);
    if (completed) {
      sendJson(browser, { type: "relay.transcript", message: completed, transcript: transcript.messages() });
      void persist();
    }
    if (event.type === "error") {
      // Always surfaced to the screen, so a rejected session configuration is
      // never silent. Before relay.ready it means voice could not start at all.
      const detail = describeUpstreamError(event.error);
      console.error("voice: upstream error", JSON.stringify(detail));
      const reason = detail.message ?? "The voice service reported an error.";
      const message = readySent
        ? `${name} couldn't respond. ${reason}`
        : `Voice mode couldn't start. ${reason} Try again, or switch to text mode.`;
      sendJson(browser, { type: "relay.error", message, code: detail.code ?? null, fatal: !readySent });
      return;
    }
    sendJson(browser, event);
  });

  upstream.on("error", (err: Error) => {
    console.error("voice: upstream connection error", err.message);
    sendJson(browser, { type: "relay.error", message: `${name} lost connection. Try ending and starting a new conversation.` });
    void shutdown(1011, "upstream error");
  });

  upstream.on("close", () => {
    if (closed) return;
    sendJson(browser, { type: "relay.error", message: `${name} lost connection. Try ending and starting a new conversation.` });
    void shutdown(1011, "upstream closed");
  });

  browser.on("message", (data) => {
    let event: RealtimeEvent;
    try {
      event = JSON.parse(data.toString()) as RealtimeEvent;
    } catch {
      return;
    }
    if (!event || typeof event.type !== "string" || !BROWSER_ALLOWED.has(event.type)) return;
    upstream.send(event);
  });

  browser.on("close", () => {
    void shutdown(1000, "browser closed");
  });

  browser.on("error", (err) => {
    console.error("voice: browser socket error", err.message);
    void shutdown(1011, "browser error");
  });
}
