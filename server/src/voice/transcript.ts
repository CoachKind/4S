import type { TranscriptMessage } from "../types.js";
import type { RealtimeEvent } from "./upstream.js";

/**
 * Builds the transcript from Realtime events, in conversation order.
 *
 * Items are placed when the service creates them (conversation.item.created),
 * and their text arrives later: the user's speech transcription can complete
 * after the assistant has already started replying, so ordering by arrival
 * would interleave turns wrongly. Ordering by item creation keeps user and
 * simulated turns in the order they were spoken.
 */

interface PendingItem {
  id: string;
  role: TranscriptMessage["role"];
  content: string;
  createdAt: string;
}

/** Items seeded from a prior transcript use this prefix and are not re-recorded. */
export const SEED_PREFIX = "seed_";

export class TranscriptAccumulator {
  private prior: TranscriptMessage[];
  private items: PendingItem[] = [];

  constructor(prior: TranscriptMessage[] = []) {
    this.prior = [...prior];
  }

  private find(id: string): PendingItem | undefined {
    return this.items.find((i) => i.id === id);
  }

  private ensure(id: string, role: TranscriptMessage["role"]): PendingItem {
    let item = this.find(id);
    if (!item) {
      item = { id, role, content: "", createdAt: new Date().toISOString() };
      this.items.push(item);
    }
    return item;
  }

  /**
   * Feeds one event. Returns the transcript message when a turn's text is
   * final, otherwise null.
   */
  handle(event: RealtimeEvent): TranscriptMessage | null {
    switch (event.type) {
      case "conversation.item.created": {
        const item = event.item as { id?: string; type?: string; role?: string } | undefined;
        if (!item?.id || item.type !== "message" || item.id.startsWith(SEED_PREFIX)) return null;
        if (item.role === "user") this.ensure(item.id, "user");
        else if (item.role === "assistant") this.ensure(item.id, "simulated");
        return null;
      }
      case "conversation.item.input_audio_transcription.completed": {
        const id = String(event.item_id ?? "");
        if (!id || id.startsWith(SEED_PREFIX)) return null;
        const item = this.ensure(id, "user");
        item.content = String(event.transcript ?? "").trim();
        return item.content ? this.toMessage(item) : null;
      }
      case "response.audio_transcript.done":
      case "response.output_audio_transcript.done": {
        const id = String(event.item_id ?? "");
        if (!id) return null;
        const item = this.ensure(id, "simulated");
        item.content = String(event.transcript ?? "").trim();
        return item.content ? this.toMessage(item) : null;
      }
      default:
        return null;
    }
  }

  private toMessage(item: PendingItem): TranscriptMessage {
    return { id: item.id, role: item.role, content: item.content, createdAt: item.createdAt };
  }

  /** Prior transcript followed by every completed turn from this connection, in order. */
  messages(): TranscriptMessage[] {
    return [...this.prior, ...this.items.filter((i) => i.content).map((i) => this.toMessage(i))];
  }
}
