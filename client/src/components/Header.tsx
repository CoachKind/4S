import type { ReactNode } from "react";
import { Wordmark } from "./ui";

export function Header({ right }: { right?: ReactNode }) {
  return (
    <header className="border-b border-surface-3 bg-base/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3">
        <div className="flex items-baseline gap-4">
          <Wordmark compact />
          <span className="hidden text-sm text-muted sm:inline">Safely Simulate Stressful Situations</span>
        </div>
        {right}
      </div>
    </header>
  );
}
