"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import CodeTypingArea from "@/components/CodeTypingArea";
import ResultsScreen from "@/components/ResultsScreen";
import { measureTextStack, useObservedWidth } from "@/lib/pretext";
import { buildRepeatSession } from "@/lib/scheduler";
import type { SessionStats } from "@/lib/types";
import type { CodingQuestion } from "@/lib/coding-interview";

interface CodingPracticeClientProps {
  question: CodingQuestion;
  repeats: number;
  includeTimedRound: boolean;
}

interface CompletedRound {
  stats: SessionStats;
  elapsedMs: number;
}

// Create a pseudo-question structure for the session builder
function createModeQuestion(baseQuestion: CodingQuestion) {
  return {
    ...baseQuestion,
    pattern: [baseQuestion.category],
    blind75: false,
    neetcode150: false,
    constraints: [],
    hints: [],
    solutions: [
      {
        language: "javascript",
        label: "Solution",
        code: baseQuestion.solution,
        explanation: baseQuestion.explanation,
      },
    ],
  };
}

export default function CodingPracticeClient({
  question,
  repeats,
  includeTimedRound,
}: CodingPracticeClientProps) {
  const pseudoQuestion = useMemo(
    () => createModeQuestion(question),
    [question],
  );

  const queue = useMemo(
    () =>
      buildRepeatSession(pseudoQuestion as any, { repeats, includeTimedRound }),
    [pseudoQuestion, repeats, includeTimedRound],
  );

  const [currentIndex, setCurrentIndex] = useState(0);
  const [roundResult, setRoundResult] = useState<CompletedRound | null>(null);
  const [ratedQuality, setRatedQuality] = useState<number | null>(null);
  const [roundStartAt, setRoundStartAt] = useState(Date.now());
  const [editorNonce, setEditorNonce] = useState(0);
  const [showHints, setShowHints] = useState(false);
  const [revealedHints, setRevealedHints] = useState(0);
  const [zenMode, setZenMode] = useState(false);

  const current = queue[currentIndex];

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "`") {
        event.preventDefault();
        setZenMode((value) => !value);
        return;
      }

      if (
        (event.key === "/" || event.key === "?") &&
        (event.metaKey || event.ctrlKey) &&
        !event.altKey
      ) {
        event.preventDefault();
        setShowHints((value) => !value);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  if (!current) {
    return (
      <main className="mt-shell">
        <section className="panel">
          <h1 className="page-title">Session complete</h1>
          <p className="muted">
            You finished all repeats for {question.title}.
          </p>
          <div className="row">
            <Link href="/coding" className="button">
              Back to catalog
            </Link>
            <Link href="/" className="button secondary">
              Home
            </Link>
          </div>
        </section>
      </main>
    );
  }

  const moveToIndex = (nextIndex: number) => {
    setCurrentIndex(nextIndex);
    setRoundResult(null);
    setRatedQuality(null);
    setRoundStartAt(Date.now());
    setEditorNonce((value) => value + 1);
    setRevealedHints(0);
  };

  const onRoundComplete = (result: {
    stats: SessionStats;
    elapsedMs: number;
    typedValue: string;
  }) => {
    setRoundResult({ stats: result.stats, elapsedMs: result.elapsedMs });
  };

  const handleRetry = () => {
    setRoundResult(null);
    setRatedQuality(null);
    setRoundStartAt(Date.now());
    setEditorNonce((value) => value + 1);
  };

  const handleNext = () => {
    if (ratedQuality === null) {
      return;
    }
    moveToIndex(currentIndex + 1);
  };

  return (
    <main className={`mt-shell ${zenMode ? "zen-mode" : ""}`}>
      <div
        className="row"
        style={{ justifyContent: "space-between", marginBottom: "1rem" }}
      >
        <Link href="/coding" className="button secondary">
          ← Catalog
        </Link>
        <div className="muted" style={{ textAlign: "center", flex: 1 }}>
          Round {currentIndex + 1} of {queue.length}
        </div>
        <div style={{ width: "100px" }}></div>
      </div>

      {roundResult && ratedQuality === null ? (
        <ResultsScreen
          stats={roundResult.stats}
          onRate={setRatedQuality}
          onRetry={handleRetry}
          onNext={handleNext}
        />
      ) : (
        <CodeTypingArea
          key={editorNonce}
          expectedCode={pseudoQuestion.solutions[0].code}
          language={pseudoQuestion.solutions[0].language}
          mode={current.mode}
          timedLimitSec={180}
          onComplete={onRoundComplete}
        />
      )}
    </main>
  );
}
