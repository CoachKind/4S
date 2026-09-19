import { api } from "./api";
import { PcmPlayer, SAMPLE_RATE, startCapture, type CaptureHandle } from "./audio";
import type { TranscriptMessage } from "./types";

/**
 * Voice client: owns the relay WebSocket, microphone capture, and playback,
 * and turns Realtime events into a small state machine for the screen.
 */

export type VoiceState = "idle" | "connecting" | "listening" | "processing" | "speaking";

export interface VoiceEvents {
  onState: (state: VoiceState) => void;
  onTranscript: (transcript: TranscriptMessage[]) => void;
  onError: (message: string) => void;
  onClosed: () => void;
}

type RelayEvent = { type: string; [key: string]: unknown };

export class VoiceClient {
  private ws: WebSocket | null = null;
  private ctx: AudioContext | null = null;
  private capture: CaptureHandle | null = null;
  private player: PcmPlayer | null = null;
  private state: VoiceState = "idle";
  private events: VoiceEvents;
  private sessionId: string;
  private stream: MediaStream;
  private responseActive = false;
  private stopped = false;

  constructor(sessionId: string, stream: MediaStream, events: VoiceEvents) {
    this.sessionId = sessionId;
    this.stream = stream;
    this.events = events;
  }

  private setState(next: VoiceState) {
    if (this.state === next) return;
    this.state = next;
    this.events.onState(next);
  }

  /** Connects to the relay and starts streaming the microphone. Must be called from a user gesture. */
  async start(): Promise<void> {
    this.setState("connecting");
    this.ctx = new AudioContext({ sampleRate: SAMPLE_RATE });
    await this.ctx.resume();
    this.player = new PcmPlayer(this.ctx, () => {
      if (this.state === "speaking" && !this.responseActive) this.setState("listening");
    });

    const ws = new WebSocket(api.voiceUrl(this.sessionId));
    this.ws = ws;

    await new Promise<void>((resolve, reject) => {
      ws.onopen = () => resolve();
      ws.onerror = () => reject(new Error("Could not reach the voice relay."));
      ws.onclose = (e) => reject(new Error(e.code === 1006 ? "Voice mode is not available right now." : e.reason || "Voice connection closed."));
    });

    ws.onerror = null;
    ws.onmessage = (e) => this.handle(JSON.parse(String(e.data)) as RelayEvent);
    ws.onclose = () => {
      if (!this.stopped) {
        this.teardownAudio();
        this.setState("idle");
        this.events.onClosed();
      }
    };

    this.capture = await startCapture(this.ctx, this.stream, (b64) => {
      if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: "input_audio_buffer.append", audio: b64 }));
    });
    this.setState("listening");
  }

  private handle(event: RelayEvent) {
    switch (event.type) {
      case "relay.ready":
        if (Array.isArray(event.transcript)) this.events.onTranscript(event.transcript as TranscriptMessage[]);
        return;
      case "relay.transcript":
        if (Array.isArray(event.transcript)) this.events.onTranscript(event.transcript as TranscriptMessage[]);
        return;
      case "relay.error":
        this.events.onError(String(event.message ?? "Voice connection lost."));
        return;
      case "input_audio_buffer.speech_started":
        // The user is talking, possibly over the reply: stop playback immediately.
        this.player?.clear();
        this.responseActive = false;
        this.setState("listening");
        return;
      case "input_audio_buffer.speech_stopped":
        this.setState("processing");
        return;
      case "response.created":
        this.responseActive = true;
        if (this.state !== "speaking") this.setState("processing");
        return;
      case "response.audio.delta":
      case "response.output_audio.delta":
        if (typeof event.delta === "string") {
          this.player?.enqueue(event.delta);
          this.setState("speaking");
        }
        return;
      case "response.done":
      case "response.cancelled":
        this.responseActive = false;
        if (!this.player?.playing) this.setState("listening");
        return;
      default:
        return;
    }
  }

  private teardownAudio() {
    this.capture?.stop();
    this.capture = null;
    this.player?.clear();
    this.player = null;
    void this.ctx?.close().catch(() => undefined);
    this.ctx = null;
  }

  /** Ends the voice session. Resolves once the relay has closed (and so has saved the transcript). */
  stop(): Promise<void> {
    if (this.stopped) return Promise.resolve();
    this.stopped = true;
    this.teardownAudio();
    const ws = this.ws;
    this.ws = null;
    this.setState("idle");
    if (!ws || ws.readyState === WebSocket.CLOSED) return Promise.resolve();
    return new Promise<void>((resolve) => {
      const done = () => resolve();
      ws.addEventListener("close", done, { once: true });
      window.setTimeout(done, 1500);
      try {
        ws.close(1000, "user ended");
      } catch {
        resolve();
      }
    });
  }
}
