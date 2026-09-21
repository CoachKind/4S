import { EventEmitter } from "node:events";
import { newId } from "../lib/ids.js";
import type { RealtimeEvent, RealtimeUpstream } from "./upstream.js";

/**
 * Dev-only stand-in for the OpenAI Realtime API, used when MOCK_AI=1.
 *
 * It never hears anything. After enough audio has been appended (or on an
 * explicit commit) it plays one scripted turn: a canned "transcription" of
 * the user, then a canned spoken reply as silent PCM plus its transcript,
 * using the GA Realtime event names. An input_audio_buffer.clear makes it
 * emit a synthetic error event, so error forwarding can be exercised in tests.
 */

const SAMPLE_RATE = 24_000;
/** ~1.2s of pcm16 mono at 24kHz, measured in base64 characters. */
const TURN_THRESHOLD_B64 = Math.ceil((SAMPLE_RATE * 2 * 1.2) / 3) * 4;

const USER_LINES = [
  "I wanted to talk about what's been happening over the last few weeks.",
  "I hear that, and I still need us to be clear about what changes.",
  "What would make it possible for you to keep to it this time?",
  "Okay. Let's agree on a date and I'll check in with you before then.",
];

const REPLIES = [
  "Okay. I had a feeling this was coming. What specifically are we talking about?",
  "I'd push back a little on that. The last month has been rough on capacity, and I made a call to protect delivery.",
  "...Honestly? Fewer surprises. If the priorities are going to move, I need to hear it from you first.",
  "Fine. Monday works. I'd like to revisit this in a month so we're both looking at the same picture.",
];

function silence(seconds: number): string {
  return Buffer.alloc(Math.round(SAMPLE_RATE * 2 * seconds)).toString("base64");
}

export class MockRealtimeUpstream extends EventEmitter implements RealtimeUpstream {
  private pending = 0;
  private busy = false;
  private turn = 0;
  private closed = false;
  private timers: NodeJS.Timeout[] = [];

  constructor() {
    super();
    this.later(() => {
      this.emit("open");
      this.emit("message", { type: "session.created", session: { id: `mock_${newId()}` } });
    }, 10);
  }

  private later(fn: () => void, ms: number) {
    const t = setTimeout(() => {
      if (!this.closed) fn();
    }, ms);
    this.timers.push(t);
  }

  send(event: RealtimeEvent): void {
    if (this.closed) return;
    switch (event.type) {
      case "session.update":
        this.emit("message", { type: "session.updated", session: event.session });
        return;
      case "input_audio_buffer.append": {
        const audio = typeof event.audio === "string" ? event.audio : "";
        this.pending += audio.length;
        if (this.pending >= TURN_THRESHOLD_B64) this.runTurn();
        return;
      }
      case "input_audio_buffer.commit":
        this.runTurn();
        return;
      case "input_audio_buffer.clear":
        this.emit("message", {
          type: "error",
          error: { type: "invalid_request_error", code: "mock_error", message: "Synthetic error from the mock relay." },
        });
        return;
      case "conversation.item.create": {
        const item = (event.item ?? {}) as { id?: string; role?: string };
        const created = { id: item.id ?? newId(), type: "message", role: item.role ?? "user" };
        this.emit("message", { type: "conversation.item.added", item: created });
        this.emit("message", { type: "conversation.item.done", item: created });
        return;
      }
      default:
        return;
    }
  }

  private runTurn() {
    if (this.busy) return;
    this.busy = true;
    this.pending = 0;
    const i = Math.min(this.turn, REPLIES.length - 1);
    this.turn += 1;
    const userItem = `item_u_${newId().slice(0, 8)}`;
    const assistantItem = `item_a_${newId().slice(0, 8)}`;
    const responseId = `resp_${newId().slice(0, 8)}`;

    const steps: Array<[number, RealtimeEvent]> = [
      [0, { type: "input_audio_buffer.speech_started", item_id: userItem }],
      [400, { type: "input_audio_buffer.speech_stopped", item_id: userItem }],
      [420, { type: "input_audio_buffer.committed", item_id: userItem }],
      [440, { type: "conversation.item.added", item: { id: userItem, type: "message", role: "user" } }],
      [900, { type: "conversation.item.input_audio_transcription.completed", item_id: userItem, transcript: USER_LINES[i] }],
      [950, { type: "response.created", response: { id: responseId } }],
      [1000, { type: "conversation.item.added", item: { id: assistantItem, type: "message", role: "assistant" } }],
      [1100, { type: "response.output_audio.delta", response_id: responseId, item_id: assistantItem, delta: silence(0.4) }],
      [1300, { type: "response.output_audio.delta", response_id: responseId, item_id: assistantItem, delta: silence(0.4) }],
      [1500, { type: "response.output_audio_transcript.done", response_id: responseId, item_id: assistantItem, transcript: REPLIES[i] }],
      [1520, { type: "response.output_audio.done", response_id: responseId, item_id: assistantItem }],
      [1560, { type: "conversation.item.done", item: { id: assistantItem, type: "message", role: "assistant" } }],
      [1600, { type: "response.done", response: { id: responseId, status: "completed" } }],
    ];
    for (const [ms, ev] of steps) this.later(() => this.emit("message", ev), ms);
    this.later(() => {
      this.busy = false;
    }, 1700);
  }

  close(): void {
    if (this.closed) return;
    this.closed = true;
    for (const t of this.timers) clearTimeout(t);
    this.emit("close", 1000, "closed");
  }
}
