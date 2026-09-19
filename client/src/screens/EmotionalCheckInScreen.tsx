import { useEffect, useRef, useState } from "react";
import { Header } from "../components/Header";
import { Button, ErrorNote, Spinner } from "../components/ui";
import { ApiError, streamEqPrep } from "../lib/api";
import { CHECKIN_SUBTITLES } from "../lib/roles";
import type { ConversationDirection } from "../lib/types";

/**
 * Emotional Check-In. Sits between Setup and Simulation.
 *
 * PRIVACY: everything the leader writes here, and the prep that comes back,
 * lives only in this component's state. It is never written to browser
 * storage, never attached to the session, never sent to the debrief, and is
 * cleared before this screen hands off to the simulation.
 */

interface Props {
  /** Name of the person the user is about to speak with. */
  otherName: string;
  direction: ConversationDirection;
  onContinue: () => void;
}

const PRIVACY_LINE = "What you write here is used only to prepare you. It is never saved or stored.";

export function EmotionalCheckInScreen({ otherName, direction, onContinue }: Props) {
  const [feeling, setFeeling] = useState("");
  const [prep, setPrep] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [askSkip, setAskSkip] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const prepRef = useRef<HTMLDivElement>(null);

  // Never leave a request running after the screen is gone.
  useEffect(() => () => abortRef.current?.abort(), []);

  useEffect(() => {
    if (prep !== null && !generating) prepRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [prep, generating]);

  const hasWritten = feeling.trim().length > 0;
  const hasPrep = prep !== null && !generating;

  async function prepare() {
    if (!hasWritten || generating) return;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setError(null);
    setAskSkip(false);
    setGenerating(true);
    setPrep("");
    try {
      await streamEqPrep(feeling.trim(), (chunk) => setPrep((p) => (p ?? "") + chunk), controller.signal);
    } catch (err) {
      if (controller.signal.aborted) return;
      setPrep(null);
      setError(err instanceof ApiError ? err.message : "The prep could not be generated. Please try again.");
    } finally {
      if (!controller.signal.aborted) setGenerating(false);
    }
  }

  /** Clear everything, then move on. Nothing from this screen travels forward. */
  function leave() {
    abortRef.current?.abort();
    setFeeling("");
    setPrep(null);
    setError(null);
    setAskSkip(false);
    onContinue();
  }

  /** Clicking past without a prep asks once; "Skip anyway" then leaves with nothing generated. */
  function handleStartClick() {
    setAskSkip(true);
  }

  return (
    <div className="min-h-screen bg-base">
      <Header />
      <main className="mx-auto max-w-2xl px-5 py-12 sm:py-16">
        <p className="mb-3 text-xs font-medium uppercase tracking-[0.18em] text-brand">Before the conversation with {otherName}</p>
        <h1 className="font-serif text-4xl leading-tight text-ink sm:text-5xl">Before you go in</h1>
        <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-muted">{CHECKIN_SUBTITLES[direction]}</p>

        <div className="mt-10">
          <label htmlFor="feeling" className="block text-[15px] font-semibold text-ink">
            In a sentence or two, how does this conversation — or this person — make you feel going in?
          </label>
          <textarea
            id="feeling"
            className="mt-3 w-full resize-none rounded-xl border border-surface-3 bg-surface-2 px-4 py-3 text-[15px] leading-relaxed text-ink placeholder:text-dim focus:border-brand/60 focus:outline-none focus:ring-2 focus:ring-brand/30"
            rows={Math.min(6, Math.max(3, feeling.split("\n").length + Math.floor(feeling.length / 90)))}
            value={feeling}
            onChange={(e) => {
              setFeeling(e.target.value);
              if (askSkip) setAskSkip(false);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                void prepare();
              }
            }}
            placeholder="e.g. They always seem to have an excuse and it exhausts me. Or — I'm nervous they'll shut down and I won't know what to do with that."
            autoComplete="off"
            spellCheck
            disabled={generating}
            autoFocus
          />
          <p className="mt-2 text-xs text-muted">{PRIVACY_LINE}</p>
        </div>

        {error && (
          <div className="mt-4">
            <ErrorNote>{error}</ErrorNote>
          </div>
        )}

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <Button onClick={prepare} disabled={!hasWritten || generating}>
            {generating ? (
              <>
                <Spinner /> Preparing…
              </>
            ) : prep !== null ? (
              "Prepare me again"
            ) : (
              "Prepare me"
            )}
          </Button>
          {!hasPrep && !generating && (
            <Button variant="ghost" onClick={handleStartClick}>
              Continue without preparing
            </Button>
          )}
        </div>

        {askSkip && (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-brand/40 bg-brand/5 px-4 py-3 text-sm">
            <span className="text-ink">Skip the check-in? Knowing your headspace helps us prepare you better.</span>
            <div className="flex gap-2">
              <Button variant="secondary" className="px-3 py-1.5 text-xs" onClick={() => setAskSkip(false)}>
                Go back
              </Button>
              <Button variant="ghost" className="px-3 py-1.5 text-xs" onClick={leave}>
                Skip anyway
              </Button>
            </div>
          </div>
        )}

        {prep !== null && (
          <div ref={prepRef} className="mt-10 rounded-r-xl border-l-4 border-brand bg-surface-2 px-6 py-5" aria-live="polite">
            <h2 className="mb-3 font-serif text-2xl text-ink">Your prep</h2>
            <p className="whitespace-pre-wrap text-[16px] leading-relaxed text-ink">
              {prep}
              {generating && <span className="ml-0.5 inline-block h-4 w-0.5 animate-pulse bg-brand align-middle" aria-hidden />}
            </p>
          </div>
        )}

        {hasPrep && (
          <div className="mt-8 flex flex-col items-start gap-2">
            <Button onClick={leave} className="px-6 py-3 text-base">
              Start the simulation
            </Button>
            <p className="text-xs text-dim">Read it once more if you need to. {otherName} will be there when you're ready.</p>
          </div>
        )}
      </main>
    </div>
  );
}
