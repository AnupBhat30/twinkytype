"use client";

import { useMemo, useState } from "react";

interface HintSystemProps {
  hints: string[];
}

export default function HintSystem({ hints }: HintSystemProps) {
  const [revealed, setRevealed] = useState(0);
  const visibleHints = useMemo(() => hints.slice(0, revealed), [hints, revealed]);

  if (!hints.length) {
    return null;
  }

  return (
    <section className="panel compact">
      <div className="row space-between">
        <h2>Hints</h2>
        <button
          type="button"
          className="button secondary"
          onClick={() => setRevealed((count) => Math.min(hints.length, count + 1))}
          disabled={revealed >= hints.length}
        >
          Reveal hint
        </button>
      </div>
      {visibleHints.length > 0 ? (
        <ol className="hint-list">
          {visibleHints.map((hint, index) => (
            <li key={`${hint}-${index}`}>{hint}</li>
          ))}
        </ol>
      ) : (
        <p className="muted">No hints revealed yet.</p>
      )}
    </section>
  );
}
