import { useState, type FormEvent } from "react";
import { AssessmentUpload } from "../components/AssessmentUpload";
import { Header } from "../components/Header";
import { Button, Card, ErrorNote, inputClass, Label, Spinner, Wordmark } from "../components/ui";
import { api, ApiError } from "../lib/api";
import { conversationDirection, DIRECTION_LABELS, ROLE_LEVELS, scenarioTitle, simulatedTerm } from "../lib/roles";
import type { Assessment, AssessmentSlot, Difficulty, ResponseStyle, RoleLevel, ScenarioId, SessionSetupInput, SetupOptions } from "../lib/types";
import { AssessmentReviewScreen } from "./AssessmentReviewScreen";

interface Props {
  options: SetupOptions;
  starting: boolean;
  startError: string | null;
  onStart: (setup: SessionSetupInput) => void;
}

interface SlotState {
  assessment: Assessment | null;
  busy: boolean;
  error: string | null;
}

const emptySlot = (): SlotState => ({ assessment: null, busy: false, error: null });

const UPWARD_NOTE = "You're practicing an upward conversation. These require a different approach — the simulation will reflect that.";

function RoleSelector({
  name,
  label,
  value,
  options,
  onChange,
}: {
  name: string;
  label: string;
  value: RoleLevel | null;
  options: SetupOptions["roleLevels"];
  onChange: (level: RoleLevel) => void;
}) {
  return (
    <div>
      <Label>{label}</Label>
      <div className="space-y-2">
        {options.map((r) => (
          <label
            key={r.level}
            className={`block cursor-pointer rounded-lg border px-3.5 py-3 transition-colors ${
              value === r.level ? "border-brand/60 bg-brand/5" : "border-surface-3 bg-surface-2 hover:border-surface-3/80"
            }`}
          >
            <div className="flex items-center gap-3">
              <input type="radio" name={name} className="accent-brand" checked={value === r.level} onChange={() => onChange(r.level)} />
              <span className="text-sm font-semibold text-ink">{r.label}</span>
              <span className="ml-auto whitespace-nowrap text-[11px] uppercase tracking-wider text-dim">Level {r.level}</span>
            </div>
            <p className="mt-1 pl-6 text-xs leading-relaxed text-muted">{r.description}</p>
          </label>
        ))}
      </div>
    </div>
  );
}

export function SetupScreen({ options, starting, startError, onStart }: Props) {
  const [userLevel, setUserLevel] = useState<RoleLevel | null>(null);
  const [simulatedLevel, setSimulatedLevel] = useState<RoleLevel | null>(null);
  const [simulatedName, setSimulatedName] = useState("");
  const [scenario, setScenario] = useState<ScenarioId>(options.scenarios[0]?.id ?? "hard_feedback");
  const [situationContext, setSituationContext] = useState("");
  const [responseStyle, setResponseStyle] = useState<ResponseStyle>("defensive");
  const [difficulty, setDifficulty] = useState<Difficulty>("moderate");
  const [slots, setSlots] = useState<Record<AssessmentSlot, SlotState>>({ user: emptySlot(), simulated: emptySlot() });
  const [reviewing, setReviewing] = useState<{ slot: AssessmentSlot; assessment: Assessment; fresh: boolean } | null>(null);

  const direction = userLevel && simulatedLevel ? conversationDirection(userLevel, simulatedLevel) : null;
  const otherTerm = userLevel && simulatedLevel ? simulatedTerm(userLevel, simulatedLevel) : "the person you're speaking with";
  const otherShort = simulatedLevel ? ROLE_LEVELS[simulatedLevel].label : null;

  function patchSlot(slot: AssessmentSlot, patch: Partial<SlotState>) {
    setSlots((s) => ({ ...s, [slot]: { ...s[slot], ...patch } }));
  }

  async function handleFile(slot: AssessmentSlot, file: File) {
    patchSlot(slot, { busy: true, error: null });
    try {
      const assessment = await api.extractAssessment(file);
      patchSlot(slot, { busy: false });
      setReviewing({ slot, assessment, fresh: true });
    } catch (err) {
      patchSlot(slot, { busy: false, error: err instanceof ApiError ? err.message : "Could not read that PDF." });
    }
  }

  function swap() {
    setSlots((s) => ({ user: { ...s.simulated }, simulated: { ...s.user } }));
  }

  const canSubmit =
    userLevel !== null && simulatedLevel !== null && simulatedName.trim().length > 0 && !starting && !slots.user.busy && !slots.simulated.busy;

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!canSubmit || userLevel === null || simulatedLevel === null) return;
    onStart({
      userRole: { level: userLevel },
      simulatedRole: { level: simulatedLevel },
      simulatedName: simulatedName.trim(),
      scenario,
      situationContext: situationContext.trim(),
      responseStyle,
      difficulty,
      userAssessment: slots.user.assessment,
      simulatedAssessment: slots.simulated.assessment,
    });
  }

  if (reviewing) {
    return (
      <AssessmentReviewScreen
        slot={reviewing.slot}
        assessment={reviewing.assessment}
        onConfirm={(assessment) => {
          patchSlot(reviewing.slot, { assessment, error: null });
          setReviewing(null);
        }}
        onCancel={() => {
          if (reviewing.fresh) patchSlot(reviewing.slot, { assessment: null });
          setReviewing(null);
        }}
      />
    );
  }

  const nameLabel = otherShort ? `${otherShort}'s name` : "Their name";

  return (
    <div className="min-h-screen bg-base">
      <Header />
      <main className="mx-auto max-w-5xl px-5 py-10">
        <div className="mb-10 grid gap-8 md:grid-cols-[auto_1fr] md:items-end">
          <Wordmark />
          <div>
            <h1 className="font-serif text-3xl leading-tight text-ink sm:text-4xl">Safely Simulate Stressful Situations</h1>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted">
              Practice a difficult conversation before it happens for real. Set the scene, have the conversation, and get a
              debrief on what landed and what to sharpen.
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="grid gap-6 lg:grid-cols-[1fr_360px]">
          <div className="space-y-6">
            <Card className="p-5">
              <h2 className="mb-1 font-serif text-xl text-ink">Who's in the room</h2>
              <p className="mb-5 text-xs text-muted">Conversations run in every direction. Tell us where you each sit so the simulation reflects the real dynamic.</p>

              <div className="grid gap-6 md:grid-cols-2">
                <RoleSelector name="userLevel" label="You are a…" value={userLevel} options={options.roleLevels} onChange={setUserLevel} />
                <RoleSelector name="simulatedLevel" label="You are speaking with a…" value={simulatedLevel} options={options.roleLevels} onChange={setSimulatedLevel} />
              </div>

              {direction && (
                <div className="mt-5 rounded-lg border border-brand/40 bg-brand/5 px-3.5 py-3" aria-live="polite">
                  <p className="text-sm font-semibold text-ink">{options.directions[direction] ?? DIRECTION_LABELS[direction]}</p>
                  {direction === "upward" && <p className="mt-1 text-xs text-muted">{UPWARD_NOTE}</p>}
                </div>
              )}
            </Card>

            <Card className="p-5">
              <h2 className="mb-1 font-serif text-xl text-ink">The conversation</h2>
              <p className="mb-5 text-xs text-muted">
                {userLevel && simulatedLevel
                  ? `You're speaking with ${otherTerm}.`
                  : "Choose the two roles above to set up your conversation dynamic."}
              </p>

              <div className="space-y-5">
                <div>
                  <Label>{nameLabel}</Label>
                  <input
                    className={inputClass}
                    value={simulatedName}
                    onChange={(e) => setSimulatedName(e.target.value)}
                    placeholder="e.g. Marcus"
                    maxLength={80}
                    required
                  />
                </div>

                <div>
                  <Label>Scenario</Label>
                  <div className="space-y-2">
                    {options.scenarios.map((s) => (
                      <label
                        key={s.id}
                        className={`flex cursor-pointer items-center gap-3 rounded-lg border px-3.5 py-3 text-sm transition-colors ${
                          scenario === s.id ? "border-brand/60 bg-brand/5 text-ink" : "border-surface-3 bg-surface-2 text-muted hover:text-ink"
                        }`}
                      >
                        <input type="radio" name="scenario" className="accent-brand" checked={scenario === s.id} onChange={() => setScenario(s.id)} />
                        {userLevel && simulatedLevel ? scenarioTitle(s.id, userLevel, simulatedLevel) : s.title}
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <Label hint="Optional but encouraged">Situation context</Label>
                  <textarea
                    className={`${inputClass} min-h-32 resize-y`}
                    value={situationContext}
                    onChange={(e) => setSituationContext(e.target.value)}
                    maxLength={4000}
                    placeholder="Marcus has been missing weekly check-ins and two of his direct reports have come to me separately in the last month. I've hinted at this before but never named it directly."
                  />
                  <p className="mt-1.5 text-xs text-muted">What's been happening? Have you addressed this before? What's at stake? The more specific you are, the more realistic the simulation.</p>
                </div>
              </div>
            </Card>

            <Card className="p-5">
              <h2 className="mb-1 font-serif text-xl text-ink">How {simulatedName.trim() || "they"} will show up</h2>
              <p className="mb-5 text-xs text-muted">Response style shapes emotional tone, with or without an assessment. Difficulty shapes how hard you have to work.</p>

              <div className="grid gap-6 md:grid-cols-2">
                <div>
                  <Label>Response style</Label>
                  <div className="space-y-2">
                    {options.responseStyles.map((s) => (
                      <label
                        key={s.id}
                        className={`block cursor-pointer rounded-lg border px-3.5 py-3 transition-colors ${
                          responseStyle === s.id ? "border-brand/60 bg-brand/5" : "border-surface-3 bg-surface-2 hover:border-surface-3/80"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <input type="radio" name="style" className="accent-brand" checked={responseStyle === s.id} onChange={() => setResponseStyle(s.id)} />
                          <span className="text-sm font-semibold text-ink">{s.label}</span>
                        </div>
                        <p className="mt-1 pl-6 text-xs leading-relaxed text-muted">{s.description}</p>
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <Label>Difficulty</Label>
                  <div className="space-y-2">
                    {options.difficulties.map((d) => (
                      <label
                        key={d.id}
                        className={`block cursor-pointer rounded-lg border px-3.5 py-3 transition-colors ${
                          difficulty === d.id ? "border-brand/60 bg-brand/5" : "border-surface-3 bg-surface-2 hover:border-surface-3/80"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <input type="radio" name="difficulty" className="accent-brand" checked={difficulty === d.id} onChange={() => setDifficulty(d.id)} />
                          <span className="text-sm font-semibold text-ink">{d.label}</span>
                        </div>
                        <p className="mt-1 pl-6 text-xs leading-relaxed text-muted">{d.description}</p>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            </Card>
          </div>

          <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start">
            <Card className="p-5">
              <h2 className="mb-1 font-serif text-xl text-ink">Assessments</h2>
              <p className="mb-4 text-xs leading-relaxed text-muted">
                Uploading assessments builds a behaviorally accurate simulation based on real data. Without them, the simulation uses the style you select. Both are optional, and you choose which report is yours and which is theirs.
              </p>
              <div className="space-y-3">
                {(["user", "simulated"] as const).map((slot) => (
                  <AssessmentUpload
                    key={slot}
                    slot={slot}
                    otherTerm={otherTerm}
                    assessment={slots[slot].assessment}
                    busy={slots[slot].busy}
                    error={slots[slot].error}
                    canSwap={!slots.user.busy && !slots.simulated.busy}
                    onFile={(file) => handleFile(slot, file)}
                    onReview={() => {
                      const a = slots[slot].assessment;
                      if (a) setReviewing({ slot, assessment: a, fresh: false });
                    }}
                    onRemove={() => patchSlot(slot, { assessment: null, error: null })}
                    onSwap={swap}
                  />
                ))}
              </div>
            </Card>

            <ErrorNote>{startError}</ErrorNote>

            <Button type="submit" className="w-full py-3 text-base" disabled={!canSubmit}>
              {starting ? (
                <>
                  <Spinner /> Setting the scene…
                </>
              ) : (
                "Start the conversation"
              )}
            </Button>
            <p className="text-center text-xs text-dim">
              {userLevel === null || simulatedLevel === null
                ? "Choose both roles and a name to begin."
                : "You open the conversation. End it whenever you're ready for the debrief."}
            </p>
          </aside>
        </form>
      </main>
    </div>
  );
}
