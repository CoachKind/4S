import { useState } from "react";
import { Header } from "../components/Header";
import { Button, Card, inputClass, Label } from "../components/ui";
import type { Assessment, AssessmentSlot, DiscScores, DrivingForce } from "../lib/types";

interface Props {
  slot: AssessmentSlot;
  assessment: Assessment;
  onConfirm: (assessment: Assessment) => void;
  onCancel: () => void;
}

const DISC_KEYS: Array<keyof DiscScores> = ["D", "I", "S", "C"];

function clampScore(v: string): number {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, n));
}

/** Multi-line editor for a list of strings: one item per line. */
function ListEditor({ label, hint, value, onChange }: { label: string; hint?: string; value: string[]; onChange: (v: string[]) => void }) {
  return (
    <div>
      <Label hint={hint ?? "One per line"}>{label}</Label>
      <textarea
        className={`${inputClass} min-h-24 resize-y font-sans`}
        value={value.join("\n")}
        onChange={(e) => onChange(e.target.value.split("\n"))}
        onBlur={(e) =>
          onChange(
            e.target.value
              .split("\n")
              .map((s) => s.trim())
              .filter(Boolean),
          )
        }
      />
    </div>
  );
}

function ForceEditor({ label, value, onChange }: { label: string; value: DrivingForce[]; onChange: (v: DrivingForce[]) => void }) {
  function update(i: number, patch: Partial<DrivingForce>) {
    onChange(value.map((f, idx) => (idx === i ? { ...f, ...patch } : f)));
  }
  return (
    <div>
      <Label>{label}</Label>
      <div className="space-y-2">
        {value.length === 0 && <p className="text-xs text-dim">None extracted.</p>}
        {value.map((f, i) => (
          <div key={i} className="grid grid-cols-[1fr_72px_auto] gap-2">
            <input className={inputClass} value={f.name} placeholder="Force" onChange={(e) => update(i, { name: e.target.value })} />
            <input
              className={inputClass}
              type="number"
              min={0}
              max={100}
              value={f.score}
              onChange={(e) => update(i, { score: clampScore(e.target.value) })}
            />
            <Button
              variant="ghost"
              className="px-2 py-1 text-xs"
              onClick={() => onChange(value.filter((_, idx) => idx !== i))}
              aria-label="Remove"
            >
              ✕
            </Button>
            <input
              className={`${inputClass} col-span-3 text-xs`}
              value={f.descriptor}
              placeholder="Descriptor"
              onChange={(e) => update(i, { descriptor: e.target.value })}
            />
          </div>
        ))}
        <Button variant="ghost" className="px-2 py-1 text-xs" onClick={() => onChange([...value, { name: "", score: 50, descriptor: "" }])}>
          + Add
        </Button>
      </div>
    </div>
  );
}

export function AssessmentReviewScreen({ slot, assessment, onConfirm, onCancel }: Props) {
  const [draft, setDraft] = useState<Assessment>(() => structuredClone(assessment));

  function setDisc(kind: "natural" | "adapted", key: keyof DiscScores, v: string) {
    setDraft((d) => ({ ...d, disc: { ...d.disc, [kind]: { ...d.disc[kind], [key]: clampScore(v) } } }));
  }

  return (
    <div className="min-h-screen bg-base">
      <Header />
      <main className="mx-auto max-w-4xl px-5 py-8">
        <div className="mb-6">
          <p className="mb-1 text-xs font-medium uppercase tracking-[0.18em] text-brand">{slot === "user" ? "Your" : "Their"} assessment</p>
          <h1 className="font-serif text-3xl text-ink">Confirm what we read</h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
            This is the data extracted from the PDF. Check it against the report and correct anything that looks wrong. The simulation and
            debrief will use exactly what you confirm here.
          </p>
        </div>

        <div className="space-y-5">
          <Card className="p-5">
            <Label>Name</Label>
            <input className={inputClass} value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
          </Card>

          <Card className="p-5">
            <h2 className="mb-4 font-serif text-xl text-ink">DISC</h2>
            <div className="grid gap-5 sm:grid-cols-2">
              {(["natural", "adapted"] as const).map((kind) => (
                <div key={kind}>
                  <Label hint="0–100">{kind === "natural" ? "Natural style" : "Adapted style"}</Label>
                  <div className="grid grid-cols-4 gap-2">
                    {DISC_KEYS.map((k) => (
                      <label key={k} className="text-center">
                        <span className="mb-1 block text-xs font-semibold text-muted">{k}</span>
                        <input
                          className={`${inputClass} text-center`}
                          type="number"
                          min={0}
                          max={100}
                          value={draft.disc[kind][k]}
                          onChange={(e) => setDisc(kind, k, e.target.value)}
                        />
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4">
              <Label>Wheel position</Label>
              <input
                className={inputClass}
                value={draft.disc.wheel_position}
                onChange={(e) => setDraft({ ...draft, disc: { ...draft.disc, wheel_position: e.target.value } })}
              />
            </div>
          </Card>

          <Card className="p-5">
            <h2 className="mb-4 font-serif text-xl text-ink">Driving Forces</h2>
            <div className="grid gap-6 lg:grid-cols-3">
              <ForceEditor
                label="Primary"
                value={draft.driving_forces.primary}
                onChange={(v) => setDraft({ ...draft, driving_forces: { ...draft.driving_forces, primary: v } })}
              />
              <ForceEditor
                label="Situational"
                value={draft.driving_forces.situational}
                onChange={(v) => setDraft({ ...draft, driving_forces: { ...draft.driving_forces, situational: v } })}
              />
              <ForceEditor
                label="Indifferent"
                value={draft.driving_forces.indifferent}
                onChange={(v) => setDraft({ ...draft, driving_forces: { ...draft.driving_forces, indifferent: v } })}
              />
            </div>
          </Card>

          <Card className="p-5">
            <h2 className="mb-4 font-serif text-xl text-ink">Competencies</h2>
            <div className="grid gap-5 sm:grid-cols-2">
              <ListEditor
                label="Top 5"
                value={draft.competencies.top_5}
                onChange={(v) => setDraft({ ...draft, competencies: { ...draft.competencies, top_5: v } })}
              />
              <ListEditor
                label="Bottom 5"
                value={draft.competencies.bottom_5}
                onChange={(v) => setDraft({ ...draft, competencies: { ...draft.competencies, bottom_5: v } })}
              />
            </div>
          </Card>

          <Card className="p-5">
            <h2 className="mb-4 font-serif text-xl text-ink">Behavioral flags</h2>
            <div className="grid gap-5 sm:grid-cols-2">
              <ListEditor
                label="Under pressure"
                value={draft.behavioral_flags.under_pressure}
                onChange={(v) => setDraft({ ...draft, behavioral_flags: { ...draft.behavioral_flags, under_pressure: v } })}
              />
              <ListEditor
                label="Areas for improvement"
                value={draft.behavioral_flags.areas_for_improvement}
                onChange={(v) => setDraft({ ...draft, behavioral_flags: { ...draft.behavioral_flags, areas_for_improvement: v } })}
              />
              <ListEditor
                label="Ways to communicate"
                value={draft.behavioral_flags.communication_do}
                onChange={(v) => setDraft({ ...draft, behavioral_flags: { ...draft.behavioral_flags, communication_do: v } })}
              />
              <ListEditor
                label="Ways NOT to communicate"
                value={draft.behavioral_flags.communication_dont}
                onChange={(v) => setDraft({ ...draft, behavioral_flags: { ...draft.behavioral_flags, communication_dont: v } })}
              />
            </div>
          </Card>
        </div>

        <div className="sticky bottom-0 mt-6 flex items-center justify-between gap-3 border-t border-surface-3 bg-base/95 py-4 backdrop-blur">
          <Button variant="ghost" onClick={onCancel}>
            Discard this upload
          </Button>
          <Button
            onClick={() => {
              const clean = (arr: string[]) => arr.map((s) => s.trim()).filter(Boolean);
              const cleanForces = (arr: DrivingForce[]) => arr.filter((f) => f.name.trim());
              onConfirm({
                ...draft,
                name: draft.name.trim(),
                driving_forces: {
                  primary: cleanForces(draft.driving_forces.primary),
                  situational: cleanForces(draft.driving_forces.situational),
                  indifferent: cleanForces(draft.driving_forces.indifferent),
                },
                competencies: { top_5: clean(draft.competencies.top_5), bottom_5: clean(draft.competencies.bottom_5) },
                behavioral_flags: {
                  under_pressure: clean(draft.behavioral_flags.under_pressure),
                  communication_do: clean(draft.behavioral_flags.communication_do),
                  communication_dont: clean(draft.behavioral_flags.communication_dont),
                  areas_for_improvement: clean(draft.behavioral_flags.areas_for_improvement),
                },
              });
            }}
          >
            Confirm and use this data
          </Button>
        </div>
      </main>
    </div>
  );
}
