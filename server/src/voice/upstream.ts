import type { EventEmitter } from "node:events";

/** A JSON event in the OpenAI Realtime wire format. */
export type RealtimeEvent = { type: string; [key: string]: unknown };

/**
 * The relay's view of the Realtime service. Emits:
 *   "open"            connection ready for session.update
 *   "message" (event) a parsed RealtimeEvent from the service
 *   "error" (Error)
 *   "close" (code, reason)
 */
export interface RealtimeUpstream extends EventEmitter {
  send(event: RealtimeEvent): void;
  close(): void;
}
