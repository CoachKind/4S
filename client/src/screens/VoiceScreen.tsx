import { useCallback, useEffect, useRef, useState } from "react";
import { Header } from "../components/Header";
import { Button, ErrorNote, Spinner, Tag } from "../components/ui";
import { api, ApiError } from "../lib/api";
import { difficultyLabel, styleLabel } from "../lib/labels";
import { dynamicSentence } from "../lib/roles";
import type { Session, SetupOptions, TranscriptMessage } from "../lib/types";
import { VoiceClient, type VoiceState } from "../lib/voiceClient";

interface Props {
  session: Session;
  options: SetupOptions;
  onDebriefed: (session: Session) => void;
  /** The escape hatch: continue the same session by typing. */
  onSwitchToText: (session: Session) => void;
  /** Microphone denied: back to setup with text mode pre-selected. */
  onMicDenied: () => void;
}

type MicStatus = "asking" | "granted" | "denied";

function Bubble({ message, otherName }: { message: TranscriptMessage; otherName: string }) {
  const isUser = message.role === "user";
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div className={`max-w-[85%] sm:max-w-[70%] ${isUser ? "text-right" : "text-left"}`}>
        <div className={`mb-1 text-[11px] font-medium uppercase tracking-wider ${isUser ? "text-brand" : "text-muted"}`}>
          {isUser ? "You" : otherName}
        </div>
        <div
          className={`whitespace-pre-wrap rounded-2xl px-4 py-3 text-left text-[15px] leading-relaxed ${
            isUser ? "rounded-tr-md bg-brand text-base" : "rounded-tl-md bg-surface-2 text-ink"
          }`}
        >
          {message.content}
        </div>
      </div>
    </div>
  );
}

function stateLabel(state: VoiceState, name: string): string {
  switch (state) {
    case "idle":
      return "Tap to start";
    case "connecting":
      return "Connecting…";
    case "listening":
      return "Listening…";
    case "processing":
      return `${name} is thinking…`;
    case "speaking":
      return `${name} is speaking…`;
  }
}

function VoiceCircle({ state, onTap }: { state: VoiceState; onTap: () => void }) {
  const isIdle = state === "idle";
  const ring = state === "listening" ? "voice-ring" : state === "speaking" ? "voice-ring voice-ring--soft" : null;
  const face =
    state === "listening"
      ? "bg-brand text-base"
      : state === "speaking"
        ? "bg-surface-3 text-ink"
        : state === "processing" || state === "connecting"
          ? "bg-surface-2 text-muted"
          : "bg-surface-2 text-muted hover:bg-surface-3";
  return (
    <div className="relative h-44 w-44">
      {ring && (
        <>
          <span className={ring} />
          <span className={ring} />
          <span className={ring} />
        </>
      )}
      <button
        type="button"
        onClick={isIdle ? onTap : undefined}
        aria-label={isIdle ? "Start the voice conversation" : undefined}
        aria-live="polite"
        className={`relative flex h-44 w-44 items-center justify-center rounded-full border border-surface-3 shadow-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/70 ${face} ${
          isIdle ? "cursor-pointer" : "cursor-default"
        }`}
      >
        {state === "processing" || state === "connecting" ? (
          <span className="h-8 w-8 animate-spin rounded-full border-2 border-dim border-t-muted" aria-hidden />
        ) : (
          <svg
            viewBox="0 0 24 24"
            className="h-12 w-12"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.6}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <rect x="9" y="3" width="6" height="11" rx="3" />
            <path d="M5 11a7 7 0 0 0 14 0" />
            <path d="M12 18v3" />
          </svg>
        )}
      </button>
    </div>
  );
}

export function VoiceScreen({ session, options, onDebriefed, onSwitchToText, onMicDenied }: Props) {
  const { setup } = session;
  const otherName = setup.simulatedName;
  // Decided once, up front: a browser with no getUserMedia can never grant the microphone.
  const [mic, setMic] = useState<MicStatus>(() => (typeof navigator.mediaDevices?.getUserMedia === "function" ? "asking" : "denied"));
  const [state, setState] = useState<VoiceState>("idle");
  const [transcript, setTranscript] = useState<TranscriptMessage[]>(session.transcript);
  const [error, setError] = useState<string | null>(null);
  const [ending, setEnding] = useState(false);
  const [switching, setSwitching] = useState(false);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const streamRef = useRef<MediaStream | null>(null);
  const clientRef = useRef<VoiceClient | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  // Ask for the microphone as soon as the screen loads.
  useEffect(() => {
    let cancelled = false;
    if (typeof navigator.mediaDevices?.getUserMedia !== "function") return;
    navigator.mediaDevices
      .getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true }, video: false })
      .then((stream) => {
        if (cancelled) {
          for (const t of stream.getTracks()) t.stop();
          return;
        }
        streamRef.current = stream;
        setMic("granted");
      })
      .catch(() => {
        if (!cancelled) setMic("denied");
      });
    return () => {
      cancelled = true;
      void clientRef.current?.stop();
      for (const t of streamRef.current?.getTracks() ?? []) t.stop();
    };
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [transcript.length]);

  const start = useCallback(async () => {
    const stream = streamRef.current;
    if (!stream || clientRef.current) return;
    setError(null);
    const client = new VoiceClient(session.id, stream, {
      onState: setState,
      onTranscript: setTranscript,
      onError: (message) => setError(message),
      onClosed: () => {
        clientRef.current = null;
      },
    });
    clientRef.current = client;
    try {
      await client.start();
    } catch (err) {
      clientRef.current = null;
      setState("idle");
      setError(err instanceof Error ? err.message : "Could not start voice mode.");
    }
  }, [session.id]);

  const busy = ending || switching;
  const active = state !== "idle";

  async function endAndDebrief() {
    if (busy) return;
    if (transcript.length === 0 && !confirmEnd) {
      setConfirmEnd(true);
      return;
    }
    setError(null);
    setEnding(true);
    try {
      await clientRef.current?.stop();
      clientRef.current = null;
      const debriefed = await api.debrief(session.id);
      onDebriefed(debriefed);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not generate the debrief.");
      setEnding(false);
    }
  }

  async function switchToText() {
    if (busy) return;
    setSwitching(true);
    setError(null);
    try {
      await clientRef.current?.stop();
      clientRef.current = null;
      const updated = await api.setMode(session.id, "text");
      onSwitchToText(updated);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not switch to text mode.");
      setSwitching(false);
    }
  }

  const loaded = [setup.userAssessment && "Your", setup.simulatedAssessment && "Their"].filter(Boolean) as string[];

  return (
    <div className="flex h-screen flex-col bg-base">
      <Header
        right={
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={switchToText}
              disabled={busy}
              className="text-xs text-muted underline-offset-4 hover:text-ink hover:underline disabled:opacity-50"
            >
              {switching ? "Switching…" : "Switch to text mode"}
            </button>
            <Button variant="secondary" onClick={endAndDebrief} disabled={busy}>
              {ending ? (
                <>
                  <Spinner /> Writing your debrief…
                </>
              ) : (
                "End and Debrief"
              )}
            </Button>
          </div>
        }
      />

      <div className="border-b border-surface-3 bg-surface-1">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <div className="text-sm text-ink">
              <span className="font-semibold">{dynamicSentence(setup.userRole.level, setup.simulatedRole.level)}</span>
              <span className="text-muted">
                {" "}
                · {setup.scenario.title} · {otherName}
              </span>
            </div>
            {setup.situationContext && (
              <p className="mt-0.5 truncate text-xs text-muted" title={setup.situationContext}>
                {setup.situationContext}
              </p>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <Tag tone="brand">Voice</Tag>
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

      <main className="flex flex-1 flex-col overflow-hidden">
        {mic === "denied" ? (
          <div className="mx-auto flex max-w-md flex-1 flex-col items-center justify-center gap-4 px-5 text-center">
            <p className="font-serif text-2xl text-ink">Microphone access is needed for voice mode.</p>
            <p className="text-sm text-muted">Please allow access in your browser settings, or switch to text mode.</p>
            <Button onClick={onMicDenied}>Switch to text mode</Button>
          </div>
        ) : (
          <>
            <div className="flex flex-col items-center gap-4 px-5 pb-4 pt-8">
              <VoiceCircle state={state} onTap={start} />
              <p className={`text-sm font-medium ${state === "listening" ? "text-brand" : "text-muted"}`} aria-live="polite">
                {mic === "asking" ? "Waiting for microphone permission…" : stateLabel(state, otherName)}
              </p>
              {!active && mic === "granted" && (
                <p className="max-w-md text-center text-xs text-dim">
                  Just speak naturally. {otherName} will hear when you start and stop. The circle shows whose turn it is.
                </p>
              )}
              {error && (
                <div className="w-full max-w-xl">
                  <ErrorNote>{error}</ErrorNote>
                </div>
              )}
              {confirmEnd && (
                <div className="flex w-full max-w-xl flex-wrap items-center justify-between gap-3 rounded-lg border border-brand/40 bg-brand/5 px-3.5 py-2.5 text-sm">
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
            </div>

            <div className="flex-1 overflow-y-auto border-t border-surface-3">
              <div className="mx-auto max-w-4xl space-y-5 px-5 py-6">
                {transcript.length === 0 && <p className="text-center text-xs text-dim">The transcript will appear here as you talk.</p>}
                {transcript.map((m) => (
                  <Bubble key={m.id} message={m} otherName={otherName} />
                ))}
                <div ref={endRef} />
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
