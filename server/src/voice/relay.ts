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
  let saving: Promise<unknown> = Promise.resolve();

  const persist = () => {
    const messages = transcript.messages();
    saving = saving.then(() => replaceTranscript(session.id, messages)).catch((err) => {
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
    upstream.send({
      type: "session.update",
      session: {
        modalities: ["text", "audio"],
        instructions: buildVoiceInstructions(session.setup),
        voice: config.voice.voice,
        input_audio_format: "pcm16",
        output_audio_format: "pcm16",
        input_audio_transcription: { model: "whisper-1" },
        turn_detection: { type: "server_vad" },
      },
    });
    // Carry any existing turns (a text conversation switched to voice, or a reconnect) into the model's context.
    session.transcript.forEach((m, i) => {
      upstream.send({
        type: "conversation.item.create",
        item: {
          id: `${SEED_PREFIX}${i}`,
          type: "message",
          role: m.role === "user" ? "user" : "assistant",
          content: [m.role === "user" ? { type: "input_text", text: m.content } : { type: "text", text: m.content }],
        },
      });
    });
    sendJson(browser, { type: "relay.ready", name, transcript: transcript.messages() });
  });

  upstream.on("message", (event: RealtimeEvent) => {
    const completed = transcript.handle(event);
    if (completed) {
      sendJson(browser, { type: "relay.transcript", message: completed, transcript: transcript.messages() });
      void persist();
    }
    if (event.type === "error") {
      // Audio format or protocol errors are logged server-side; only connection loss is surfaced.
      console.error("voice: upstream error event", JSON.stringify(event.error ?? event));
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
