import type { ReactNode } from "react";

export function Header({ right }: { right?: ReactNode }) {
  return (
    <header className="border-b border-surface-3 bg-base/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3">
            <img src="/Coach_Kind__LLC_Logo_copy-removebg-preview.png" alt="Coach Kind" className="h-9 w-auto" />
            <span className="font-serif text-2xl leading-none text-brand">4S</span>
          </div>
          <span className="hidden text-sm text-muted sm:inline">Safely Simulate Stressful Situations</span>
        </div>
        {right}
      </div>
    </header>
  );
}
