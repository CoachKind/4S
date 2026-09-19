import { useState } from "react";
import { Header } from "../components/Header";
import { Button, Card, Tag } from "../components/ui";
import { difficultyLabel, scenarioTitle, styleLabel } from "../lib/labels";
import type { Debrief, Session, SetupOptions } from "../lib/types";

interface Props {
  session: Session;
  options: SetupOptions;
  onRestart: () => void;
}

function Paragraphs({ text }: { text: string }) {
  return (
    <div className="space-y-3 text-[15px] leading-relaxed text-ink">
      {text
        .split(/\n{2,}|\n/)
        .map((p) => p.trim())
        .filter(Boolean)
        .map((p, i) => (
          <p key={i}>{p}</p>
        ))}
    </div>
  );
}

function Section({ eyebrow, title, text }: { eyebrow: string; title: string; text: string }) {
  return (
    <Card className="p-6">
      <p className="mb-1 text-[11px] font-medium uppercase tracking-[0.18em] text-muted">{eyebrow}</p>
      <h2 className="mb-4 font-serif text-2xl text-ink">{title}</h2>
      <Paragraphs text={text} />
    </Card>
  );
}

const GAME: Array<{ key: keyof Debrief["game_check"]; letter: string; label: string }> = [
  { key: "genuine", letter: "G", label: "Genuine" },
  { key: "actionable", letter: "A", label: "Actionable" },
  { key: "meaningful", letter: "M", label: "Meaningful" },
  { key: "engaging", letter: "E", label: "Engaging" },
];

export function DebriefScreen({ session, options, onRestart }: Props) {
  const { setup, debrief, transcript } = session;
  const [showTranscript, setShowTranscript] = useState(false);

  if (!debrief) {
    return (
      <div className="min-h-screen bg-base">
        <Header />
        <main className="mx-auto max-w-3xl px-5 py-12 text-center text-muted">No debrief was generated for this session.</main>
      </div>
    );
  }

  const loaded = [setup.leaderAssessment && "Leader", setup.managerAssessment && "Manager"].filter(Boolean) as string[];

  return (
    <div className="min-h-screen bg-base">
      <Header
        right={
          <Button variant="secondary" onClick={onRestart}>
            Run another simulation
          </Button>
        }
      />
      <main className="mx-auto max-w-3xl px-5 py-10">
        <div className="mb-8">
          <p className="mb-2 text-xs font-medium uppercase tracking-[0.18em] text-brand">Debrief</p>
          <h1 className="font-serif text-3xl text-ink sm:text-4xl">Your conversation with {setup.managerName}</h1>
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            <Tag>{scenarioTitle(options, setup.scenario)}</Tag>
            <Tag>{styleLabel(options, setup.responseStyle)}</Tag>
            <Tag>{difficultyLabel(options, setup.difficulty)}</Tag>
            {loaded.length > 0 ? <Tag tone="brand">{loaded.join(" + ")} assessment{loaded.length > 1 ? "s" : ""} loaded</Tag> : <Tag>General coaching · no assessments</Tag>}
          </div>
        </div>

        <div className="space-y-5">
          <Section eyebrow="Section one" title="What Landed" text={debrief.what_landed} />
          <Section eyebrow="Section two" title="What to Sharpen" text={debrief.what_to_sharpen} />

          <Card className="border-brand/40 bg-gradient-to-br from-surface-1 to-surface-2 p-6">
            <p className="mb-1 text-[11px] font-medium uppercase tracking-[0.18em] text-brand">Section three</p>
            <h2 className="mb-4 font-serif text-2xl text-ink">The Coaching Moment</h2>
            <div className="border-l-2 border-brand pl-4">
              <Paragraphs text={debrief.coaching_moment} />
            </div>
          </Card>

          {/* GAME Check: visually distinct */}
          <div className="rounded-xl border border-brand bg-brand p-6 text-base">
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-base/70">Section four · Coach Kind framework</p>
            <h2 className="mb-5 font-serif text-2xl">GAME Check</h2>
            <dl className="space-y-4">
              {GAME.map((g) => (
                <div key={g.key} className="grid grid-cols-[44px_1fr] gap-3">
                  <dt className="flex h-11 w-11 items-center justify-center rounded-lg bg-base font-serif text-2xl text-brand" aria-hidden>
                    {g.letter}
                  </dt>
                  <dd>
                    <div className="text-sm font-semibold">{g.label}</div>
                    <p className="text-[15px] leading-relaxed">{debrief.game_check[g.key]}</p>
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </div>

        <div className="mt-8">
          <button
            className="text-sm text-muted underline-offset-4 hover:text-ink hover:underline"
            onClick={() => setShowTranscript((v) => !v)}
          >
            {showTranscript ? "Hide transcript" : `Show transcript (${transcript.length} messages)`}
          </button>
          {showTranscript && (
            <Card className="mt-3 divide-y divide-surface-3">
              {transcript.length === 0 && <p className="p-4 text-sm text-muted">The conversation ended before anything was said.</p>}
              {transcript.map((m) => (
                <div key={m.id} className="grid gap-1 p-4 sm:grid-cols-[120px_1fr]">
                  <div className={`text-xs font-semibold uppercase tracking-wider ${m.role === "leader" ? "text-brand" : "text-muted"}`}>
                    {m.role === "leader" ? "You" : setup.managerName}
                  </div>
                  <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink">{m.content}</p>
                </div>
              ))}
            </Card>
          )}
        </div>

        <div className="mt-10 flex flex-col items-center gap-3 border-t border-surface-3 pt-8">
          <Button onClick={onRestart} className="px-6 py-3">
            Run another simulation
          </Button>
          <p className="text-xs text-dim">Session {session.id.slice(0, 8)} · Coach Kind</p>
        </div>
      </main>
    </div>
  );
}
