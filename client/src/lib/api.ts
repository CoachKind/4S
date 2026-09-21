import type { Assessment, Session, SessionMode, SessionSetupInput, SetupOptions, TranscriptMessage } from "./types";

const BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, "") ?? "";

export class ApiError extends Error {
  status: number;
  details?: unknown;
  constructor(status: number, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${BASE}/api${path}`, init);
  } catch {
    throw new ApiError(0, "Could not reach the 4S server. Is it running?");
  }
  const text = await res.text();
  let body: unknown;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = null;
  }
  if (!res.ok) {
    const message =
      body && typeof body === "object" && "error" in body && typeof (body as { error: unknown }).error === "string"
        ? (body as { error: string }).error
        : `Request failed (${res.status}).`;
    const details = body && typeof body === "object" && "details" in body ? (body as { details: unknown }).details : undefined;
    throw new ApiError(res.status, message, details);
  }
  return body as T;
}

function json(method: string, payload?: unknown): RequestInit {
  return {
    method,
    headers: { "Content-Type": "application/json" },
    body: payload === undefined ? undefined : JSON.stringify(payload),
  };
}

export const api = {
  options: () => request<SetupOptions>("/meta/options"),

  extractAssessment: async (file: File): Promise<Assessment> => {
    const form = new FormData();
    form.append("file", file);
    const { assessment } = await request<{ assessment: Assessment }>("/assessments/extract", {
      method: "POST",
      body: form,
    });
    return assessment;
  },

  createSession: async (setup: SessionSetupInput): Promise<Session> => {
    const { session } = await request<{ session: Session }>("/sessions", json("POST", setup));
    return session;
  },

  getSession: async (id: string): Promise<Session> => {
    const { session } = await request<{ session: Session }>(`/sessions/${id}`);
    return session;
  },

  sendMessage: (id: string, content: string) =>
    request<{ user: TranscriptMessage; simulated: TranscriptMessage }>(`/sessions/${id}/messages`, json("POST", { content })),

  setMode: async (id: string, mode: SessionMode): Promise<Session> => {
    const { session } = await request<{ session: Session }>(`/sessions/${id}/mode`, json("POST", { mode }));
    return session;
  },

  /** WebSocket URL for the voice relay. Same host as the API, ws(s) scheme. */
  voiceUrl: (id: string): string => {
    const base = BASE || window.location.origin;
    const url = new URL(`/voice/${encodeURIComponent(id)}/connect`, base);
    url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
    return url.toString();
  },

  debrief: async (id: string): Promise<Session> => {
    const { session } = await request<{ session: Session }>(`/sessions/${id}/debrief`, json("POST"));
    return session;
  },
};

/**
 * Emotional Check-In.
 *
 * PRIVACY: `feeling` is sent once to /api/eq-prep and nowhere else. It is not
 * stored anywhere on the client (no localStorage, sessionStorage, IndexedDB)
 * and the server does not persist or log it. The prep streams back as plain
 * text; `onChunk` receives each piece so the screen can render it as it arrives.
 */
export async function streamEqPrep(feeling: string, onChunk: (text: string) => void, signal?: AbortSignal): Promise<void> {
  let res: Response;
  try {
    res = await fetch(`${BASE}/api/eq-prep`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ feeling }),
      signal,
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") return;
    throw new ApiError(0, "Could not reach the 4S server. Is it running?");
  }
  if (!res.ok) {
    let message = "The prep could not be generated. Please try again.";
    try {
      const body = (await res.json()) as { error?: string };
      if (body?.error) message = body.error;
    } catch {
      // ignore
    }
    throw new ApiError(res.status, message);
  }
  if (!res.body) throw new ApiError(502, "The server sent an empty response.");

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  const ERROR_MARK = "\u0000ERROR:";
  let buffer = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    // Hold back a partial error marker so it never renders; emit the rest.
    const markIdx = buffer.indexOf(ERROR_MARK);
    if (markIdx !== -1) {
      const status = Number(buffer.slice(markIdx + ERROR_MARK.length).trim()) || 502;
      const clean = buffer.slice(0, markIdx).replace(/\n$/, "");
      if (clean) onChunk(clean);
      throw new ApiError(status, "The prep could not be generated. Try saying it a different way.");
    }
    const safeLen = buffer.lastIndexOf("\u0000") === -1 ? buffer.length : buffer.lastIndexOf("\u0000");
    if (safeLen > 0) {
      onChunk(buffer.slice(0, safeLen));
      buffer = buffer.slice(safeLen);
    }
  }
  if (buffer) {
    const nul = buffer.indexOf("\u0000");
    onChunk(nul === -1 ? buffer : buffer.slice(0, nul));
  }
}
