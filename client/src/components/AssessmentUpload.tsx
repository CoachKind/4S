import { useRef, useState, type DragEvent } from "react";
import type { Assessment, AssessmentSlot } from "../lib/types";
import { Button, Spinner, Tag } from "./ui";

interface Props {
  slot: AssessmentSlot;
  assessment: Assessment | null;
  busy: boolean;
  error: string | null;
  canSwap: boolean;
  onFile: (file: File) => void;
  onReview: () => void;
  onRemove: () => void;
  onSwap: () => void;
}

const COPY: Record<AssessmentSlot, { title: string; unlocks: string }> = {
  leader: {
    title: "Leader Assessment",
    unlocks: "Your own TriMetrix DNA report. Unlocks a debrief personalized to your behavioral profile.",
  },
  manager: {
    title: "Manager Assessment",
    unlocks: "The manager's TriMetrix DNA report. Unlocks a simulation built from their real behavioral data.",
  },
};

export function AssessmentUpload({ slot, assessment, busy, error, canSwap, onFile, onReview, onRemove, onSwap }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const copy = COPY[slot];

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) onFile(file);
  }

  return (
    <div
      className={`rounded-xl border p-4 transition-colors ${
        dragging ? "border-brand bg-brand/5" : assessment ? "border-brand/40 bg-surface-2" : "border-dashed border-surface-3 bg-surface-1"
      }`}
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
    >
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="text-sm font-semibold text-ink">{copy.title}</span>
        <Tag tone={assessment ? "brand" : "muted"}>{assessment ? "Loaded" : "Optional"}</Tag>
      </div>
      <p className="mb-3 text-xs leading-relaxed text-muted">{copy.unlocks}</p>

      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,.pdf"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onFile(file);
          e.target.value = "";
        }}
      />

      {busy ? (
        <div className="flex items-center gap-2 text-sm text-muted">
          <Spinner /> Reading the report…
        </div>
      ) : assessment ? (
        <div className="space-y-3">
          <div className="text-sm">
            <span className="text-ink">{assessment.name || "Unnamed"}</span>
            <span className="text-muted"> · Natural DISC {assessment.disc.natural.D}/{assessment.disc.natural.I}/{assessment.disc.natural.S}/{assessment.disc.natural.C}</span>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" className="px-3 py-1.5 text-xs" onClick={onReview}>
              Review data
            </Button>
            {canSwap && (
              <Button variant="ghost" className="px-3 py-1.5 text-xs" onClick={onSwap}>
                Use as {slot === "leader" ? "Manager" : "Leader"} instead
              </Button>
            )}
            <Button variant="ghost" className="px-3 py-1.5 text-xs" onClick={onRemove}>
              Remove
            </Button>
          </div>
        </div>
      ) : (
        <Button variant="secondary" className="w-full" onClick={() => inputRef.current?.click()}>
          Upload TriMetrix DNA PDF
        </Button>
      )}

      {error && <p className="mt-2 text-xs text-danger">{error}</p>}
    </div>
  );
}
