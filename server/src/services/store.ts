import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { config } from "../config.js";
import type { Session } from "../types.js";

export interface SessionStore {
  readonly kind: "memory" | "supabase";
  create(session: Session): Promise<Session>;
  get(id: string): Promise<Session | null>;
  update(session: Session): Promise<Session>;
}

/** In-memory store. Used when Supabase is not configured. Sessions vanish on restart. */
class MemorySessionStore implements SessionStore {
  readonly kind = "memory" as const;
  private sessions = new Map<string, Session>();

  async create(session: Session): Promise<Session> {
    this.sessions.set(session.id, structuredClone(session));
    return session;
  }
  async get(id: string): Promise<Session | null> {
    const s = this.sessions.get(id);
    return s ? structuredClone(s) : null;
  }
  async update(session: Session): Promise<Session> {
    this.sessions.set(session.id, structuredClone(session));
    return session;
  }
}

interface SessionRow {
  id: string;
  status: Session["status"];
  mode: Session["mode"] | null;
  setup: Session["setup"];
  transcript: Session["transcript"];
  debrief: Session["debrief"];
  created_at: string;
  updated_at: string;
}

function toRow(s: Session): SessionRow {
  return {
    id: s.id,
    status: s.status,
    mode: s.mode,
    setup: s.setup,
    transcript: s.transcript,
    debrief: s.debrief,
    created_at: s.createdAt,
    updated_at: s.updatedAt,
  };
}

function fromRow(r: SessionRow): Session {
  return {
    id: r.id,
    status: r.status,
    mode: r.mode ?? "text",
    setup: r.setup,
    transcript: r.transcript ?? [],
    debrief: r.debrief ?? null,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

/** Supabase-backed store. Schema lives in supabase/migrations. */
class SupabaseSessionStore implements SessionStore {
  readonly kind = "supabase" as const;
  private client: SupabaseClient;

  constructor(url: string, serviceRoleKey: string) {
    this.client = createClient(url, serviceRoleKey, { auth: { persistSession: false } });
  }

  async create(session: Session): Promise<Session> {
    const { error } = await this.client.from("sessions").insert(toRow(session));
    if (error) throw new Error(`Supabase insert failed: ${error.message}`);
    return session;
  }

  async get(id: string): Promise<Session | null> {
    const { data, error } = await this.client.from("sessions").select("*").eq("id", id).maybeSingle();
    if (error) throw new Error(`Supabase select failed: ${error.message}`);
    return data ? fromRow(data as SessionRow) : null;
  }

  async update(session: Session): Promise<Session> {
    const { error } = await this.client.from("sessions").update(toRow(session)).eq("id", session.id);
    if (error) throw new Error(`Supabase update failed: ${error.message}`);
    return session;
  }
}

let store: SessionStore | null = null;

export function getStore(): SessionStore {
  if (!store) {
    const { url, serviceRoleKey } = config.supabase;
    store = url && serviceRoleKey ? new SupabaseSessionStore(url, serviceRoleKey) : new MemorySessionStore();
  }
  return store;
}
