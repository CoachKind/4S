import type { Assessment, Session, SessionSetup, SetupOptions, TranscriptMessage } from "./types";

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
  let body: unknown = null;
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

  createSession: async (setup: SessionSetup): Promise<Session> => {
    const { session } = await request<{ session: Session }>("/sessions", json("POST", setup));
    return session;
  },

  getSession: async (id: string): Promise<Session> => {
    const { session } = await request<{ session: Session }>(`/sessions/${id}`);
    return session;
  },

  sendMessage: (id: string, content: string) =>
    request<{ leader: TranscriptMessage; manager: TranscriptMessage }>(
      `/sessions/${id}/messages`,
      json("POST", { content }),
    ),

  debrief: async (id: string): Promise<Session> => {
    const { session } = await request<{ session: Session }>(`/sessions/${id}/debrief`, json("POST"));
    return session;
  },
};
