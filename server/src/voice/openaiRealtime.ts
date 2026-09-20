import { EventEmitter } from "node:events";
import WebSocket from "ws";
import { config } from "../config.js";
import type { RealtimeEvent, RealtimeUpstream } from "./upstream.js";

/**
 * Raw WebSocket to the OpenAI Realtime API. The API key lives here, on the
 * server, and never reaches the browser.
 */
export class OpenAiRealtimeUpstream extends EventEmitter implements RealtimeUpstream {
  private ws: WebSocket;

  constructor() {
    super();
    const key = config.voice.openaiApiKey;
    if (!key) throw new Error("OPENAI_API_KEY is not set on the server.");
    const url = `${config.voice.url}?model=${encodeURIComponent(config.voice.model)}`;
    // GA Realtime API: bearer auth only. The beta-era "OpenAI-Beta: realtime=v1" header is no longer used.
    this.ws = new WebSocket(url, {
      headers: {
        Authorization: `Bearer ${key}`,
      },
    });
    this.ws.on("open", () => this.emit("open"));
    this.ws.on("message", (data) => {
      try {
        this.emit("message", JSON.parse(data.toString()) as RealtimeEvent);
      } catch {
        // Audio format or framing errors: log server-side, never surface to the user.
        console.error("voice: unparseable upstream frame");
      }
    });
    this.ws.on("error", (err) => this.emit("error", err));
    this.ws.on("close", (code, reason) => this.emit("close", code, reason.toString()));
  }

  send(event: RealtimeEvent): void {
    if (this.ws.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(event));
  }

  close(): void {
    if (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING) this.ws.close(1000, "session ended");
  }
}
