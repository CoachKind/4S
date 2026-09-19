import { HttpError } from "../lib/errors.js";
import { newId } from "../lib/ids.js";
import type { Session, SessionSetup, TranscriptMessage } from "../types.js";
import { generateDebrief } from "./debrief.js";
import { generateManagerReply } from "./simulation.js";
import { getStore } from "./store.js";

/** Serialize concurrent operations on the same session so two replies can't interleave. */
const locks = new Map<string, Promise<unknown>>();
async function withSessionLock<T>(id: string, fn: () => Promise<T>): Promise<T> {
  const previous = locks.get(id) ?? Promise.resolve();
  const next = previous.catch(() => undefined).then(fn);
  locks.set(id, next);
  try {
    return await next;
  } finally {
    if (locks.get(id) === next) locks.delete(id);
  }
}

export async function createSession(setup: SessionSetup): Promise<Session> {
  const now = new Date().toISOString();
  const session: Session = {
    id: newId(),
    status: "active",
    setup,
    transcript: [],
    debrief: null,
    createdAt: now,
    updatedAt: now,
  };
  return getStore().create(session);
}

export async function getSession(id: string): Promise<Session> {
  const session = await getStore().get(id);
  if (!session) throw new HttpError(404, "Session not found.");
  return session;
}

/** Appends the user's message, generates the simulated person's reply, and persists both. */
export async function sendLeaderMessage(
  id: string,
  content: string,
): Promise<{ user: TranscriptMessage; simulated: TranscriptMessage; session: Session }> {
  return withSessionLock(id, async () => {
    const session = await getSession(id);
    if (session.status !== "active") throw new HttpError(409, "This session has already been debriefed.");

    const leader: TranscriptMessage = {
      id: newId(),
      role: "user",
      content,
      createdAt: new Date().toISOString(),
    };
    const transcript = [...session.transcript, leader];

    const reply = await generateManagerReply(session.setup, transcript);

    const manager: TranscriptMessage = {
      id: newId(),
      role: "simulated",
      content: reply,
      createdAt: new Date().toISOString(),
    };

    const updated: Session = {
      ...session,
      transcript: [...transcript, manager],
      updatedAt: manager.createdAt,
    };
    await getStore().update(updated);
    return { user: leader, simulated: manager, session: updated };
  });
}

/** Ends the conversation and generates the debrief. Idempotent once debriefed. */
export async function debriefSession(id: string): Promise<Session> {
  return withSessionLock(id, async () => {
    const session = await getSession(id);
    if (session.status === "debriefed" && session.debrief) return session;

    const debrief = await generateDebrief(session.setup, session.transcript);
    const updated: Session = {
      ...session,
      status: "debriefed",
      debrief,
      updatedAt: new Date().toISOString(),
    };
    await getStore().update(updated);
    return updated;
  });
}
