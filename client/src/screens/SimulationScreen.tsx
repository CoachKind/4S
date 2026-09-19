import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { Header } from "../components/Header";
import { Button, ErrorNote, Spinner, Tag } from "../components/ui";
import { api, ApiError } from "../lib/api";
import { difficultyLabel, styleLabel } from "../lib/labels";
import { dynamicSentence, scenarioTitle } from "../lib/roles";
import type { Session, SetupOptions, TranscriptMessage } from "../lib/types";

interface Props {
  session: Session;
  options: SetupOptions;
  onDebriefed: (session: Session) => void;
}

function Bubble({ message, otherName }: { message: TranscriptMessage; otherName: string }) {
  const isLeader = message.role === "user";
  return (
    <div className={`flex ${isLeader ? "justify-end" : "justify-start"}`}>
      <div className={`max-w-[85%] sm:max-w-[70%] ${isLeader ? "text-right" : "text-left"}`}>
        <div className={`mb-1 text-[11px] font-medium uppercase tracking-wider ${isLeader ? "text-brand" : "text-muted"}`}>
          {isLeader ? "You" : otherName}
        </div>
        <div
          className={`whitespace-pre-wrap rounded-2xl px-4 py-3 text-left text-[15px] leading-relaxed ${
            isLeader ? "rounded-tr-md bg-brand text-base" : "rounded-tl-md bg-surface-2 text-ink"
          }`}
        >
          {message.content}
        </div>
      </div>
    </div>
  );
}

function Thinking({ otherName }: { otherName: string }) {
  return (
    <div className="flex justify-start">
      <div>
        <div className="mb-1 text-[11px] font-medium uppercase tracking-wider text-muted">{otherName}</div>
        <div className="inline-flex items-center gap-1.5 rounded-2xl rounded-tl-md bg-surface-2 px-4 py-3.5" aria-label={`${otherName} is thinking`}>
          <span className="typing-dot h-2 w-2 rounded-full bg-muted" />
          <span className="typing-dot h-2 w-2 rounded-full bg-muted" />
          <span className="typing-dot h-2 w-2 rounded-full bg-muted" />
        </div>
      </div>
    </div>
  );
}

export function SimulationScreen({ session, options, onDebriefed }: Props) {
  const { setup } = session;
  const otherName = setup.simulatedName;
  const [transcript, setTranscript] = useState<TranscriptMessage[]>(session.transcript);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [ending, setEnding] = useState(false);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const busy = sending || ending;
  const leaderTurn = !busy;

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [transcript.length, sending]);

  useEffect(() => {
    if (!busy) inputRef.current?.focus();
  }, [busy]);

  async function send() {
    const content = draft.trim();
    if (!content || busy) return;
    setError(null);
    setSending(true);
    setDraft("");
    const optimistic: TranscriptMessage = { id: `local-${Date.now()}`, role: "user", content, createdAt: new Date().toISOString() };
    setTranscript((t) => [...t, optimistic]);
    try {
      const { user, simulated } = await api.sendMessage(session.id, content);
      setTranscript((t) => [...t.filter((m) => m.id !== optimistic.id), user, simulated]);
    } catch (err) {
      setTranscript((t) => t.filter((m) => m.id !== optimistic.id));
      setDraft(content);
      setError(err instanceof ApiError ? err.message : "Something went wrong sending that.");
    } finally {
      setSending(false);
    }
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    void send();
  }

  function handleKey(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void send();
    }
  }

  async function endAndDebrief() {
    if (busy) return;
    if (transcript.length === 0 && !confirmEnd) {
      setConfirmEnd(true);
      return;
    }
    setError(null);
    setEnding(true);
    try {
      const debriefed = await api.debrief(session.id);
      onDebriefed(debriefed);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not generate the debrief.");
      setEnding(false);
    }
  }

  const loaded = [setup.userAssessment && "Your", setup.simulatedAssessment && "Their"].filter(Boolean) as string[];

  return (
    <div className="flex h-screen flex-col bg-base">
      <Header
        right={
          <Button variant="secondary" onClick={endAndDebrief} disabled={busy}>
            {ending ? (
              <>
                <Spinner /> Writing your debrief…
              </>
            ) : (
              "End and Debrief"
            )}
          </Button>
        }
      />

      {/* Context banner */}
      <div className="border-b border-surface-3 bg-surface-1">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <div className="text-sm text-ink">
              <span className="font-semibold">{dynamicSentence(setup.userRole.level, setup.simulatedRole.level)}</span>
              <span className="text-muted"> · {scenarioTitle(setup.scenario, setup.userRole.level, setup.simulatedRole.level)} · {otherName}</span>
            </div>
            {setup.situationContext && (
              <p className="mt-0.5 truncate text-xs text-muted" title={setup.situationContext}>
                {setup.situationContext}
              </p>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <Tag>{styleLabel(options, setup.responseStyle)}</Tag>
            <Tag>{difficultyLabel(options, setup.difficulty)}</Tag>
            {loaded.length > 0 ? (
              <Tag tone="brand">{loaded.length > 1 ? "Both assessments" : `${loaded[0]} assessment`} loaded</Tag>
            ) : (
              <Tag>No assessments · archetype mode</Tag>
            )}
          </div>
        </div>
      </div>

      {/* Conversation */}
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-4xl space-y-5 px-5 py-6">
          {transcript.length === 0 && !sending && (
            <div className="rounded-xl border border-dashed border-surface-3 p-6 text-center">
              <p className="font-serif text-xl text-ink">{otherName} has just sat down.</p>
              <p className="mt-2 text-sm text-muted">You asked for this time. Open the conversation however you would in real life.</p>
            </div>
          )}
          {transcript.map((m) => (
            <Bubble key={m.id} message={m} otherName={otherName} />
          ))}
          {sending && <Thinking otherName={otherName} />}
          <div ref={endRef} />
        </div>
      </main>

      {/* Composer */}
      <div className="border-t border-surface-3 bg-surface-1">
        <div className="mx-auto max-w-4xl px-5 py-4">
          <div className="mb-2 flex items-center justify-between">
            <span className={`text-xs font-medium ${leaderTurn ? "text-brand" : "text-muted"}`}>
              {ending ? "Ending the conversation…" : sending ? `${otherName} is responding…` : "Your turn"}
            </span>
            <span className="text-xs text-dim">Enter to send · Shift+Enter for a new line</span>
          </div>
          {error && (
            <div className="mb-3">
              <ErrorNote>{error}</ErrorNote>
            </div>
          )}
          {confirmEnd && (
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-brand/40 bg-brand/5 px-3.5 py-2.5 text-sm">
              <span className="text-ink">You haven't said anything yet. End anyway?</span>
              <div className="flex gap-2">
                <Button variant="ghost" className="px-3 py-1.5 text-xs" onClick={() => setConfirmEnd(false)}>
                  Keep going
                </Button>
                <Button variant="secondary" className="px-3 py-1.5 text-xs" onClick={endAndDebrief}>
                  End and debrief
                </Button>
              </div>
            </div>
          )}
          <form onSubmit={handleSubmit} className="flex items-end gap-3">
            <textarea
              ref={inputRef}
              className="min-h-[52px] max-h-48 flex-1 resize-y rounded-xl border border-surface-3 bg-surface-2 px-4 py-3 text-[15px] text-ink placeholder:text-dim focus:border-brand/60 focus:outline-none focus:ring-2 focus:ring-brand/30 disabled:opacity-60"
              placeholder={transcript.length === 0 ? `Open the conversation with ${otherName}…` : "Say what you would say…"}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={handleKey}
              disabled={busy}
              maxLength={4000}
              rows={2}
            />
            <Button type="submit" className="h-[52px] px-5" disabled={busy || !draft.trim()}>
              Send
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
