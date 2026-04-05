"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import CodeTypingArea from "@/components/CodeTypingArea";
import ResultsScreen from "@/components/ResultsScreen";
import { measureTextStack, useObservedWidth } from "@/lib/pretext";
import { buildRepeatSession } from "@/lib/scheduler";
import type { PracticeMode, Question, SessionStats } from "@/lib/types";
import { useSessionStore } from "@/store/sessionStore";

interface PracticeClientProps {
  question: Question;
  repeats: number;
  includeTimedRound: boolean;
}

interface CompletedRound {
  stats: SessionStats;
  elapsedMs: number;
}

const FALLBACK_SOLUTION = {
  language: "python",
  label: "Placeholder",
  code: "def solve(self):\n    pass",
  explanation: "No canonical solution stored for this question yet.",
};

export default function PracticeClient({
  question,
  repeats,
  includeTimedRound,
}: PracticeClientProps) {
  const queue = useMemo(
    () => buildRepeatSession(question, { repeats, includeTimedRound }),
    [question, repeats, includeTimedRound],
  );

  const [currentIndex, setCurrentIndex] = useState(0);
  const [roundResult, setRoundResult] = useState<CompletedRound | null>(null);
  const [ratedQuality, setRatedQuality] = useState<number | null>(null);
  const [roundStartAt, setRoundStartAt] = useState(Date.now());
  const [editorNonce, setEditorNonce] = useState(0);
  const [showHints, setShowHints] = useState(false);
  const [revealedHints, setRevealedHints] = useState(0);
  const [zenMode, setZenMode] = useState(false);

  const addSessionEvent = useSessionStore((state) => state.addSessionEvent);
  const rateQuestion = useSessionStore((state) => state.rateQuestion);

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
            <Link href="/" className="button">
              Back home
            </Link>
            <Link href="/review" className="button secondary">
              Review queue
            </Link>
          </div>
        </section>
      </main>
    );
  }

  const hasStoredSolution = !!question.solutions?.some(
    (item) => typeof item?.code === "string" && item.code.trim().length > 0,
  );
  const solution =
    question.solutions?.find(
      (item) => typeof item?.code === "string" && item.code.trim().length > 0,
    ) ?? FALLBACK_SOLUTION;

  const moveToIndex = (nextIndex: number) => {
    setCurrentIndex(nextIndex);
    setRoundResult(null);
    setRatedQuality(null);
    setRoundStartAt(Date.now());
    setEditorNonce((value) => value + 1);
    setRevealedHints(0);
  };

  const persistRound = () => {
    if (!roundResult || ratedQuality === null) {
      return;
    }

    rateQuestion(question.id, ratedQuality, roundResult.elapsedMs);

    addSessionEvent({
      questionId: question.id,
      mode: current.mode,
      startedAt: roundStartAt,
      completedAt: roundStartAt + roundResult.elapsedMs,
      durationMs: roundResult.elapsedMs,
      quality: ratedQuality,
      stats: roundResult.stats,
    });
  };

  const handleNext = () => {
    if (ratedQuality === null) {
      return;
    }

    persistRound();
    moveToIndex(currentIndex + 1);
  };

  const handleRetry = () => {
    setRoundResult(null);
    setRatedQuality(null);
    setRoundStartAt(Date.now());
    setEditorNonce((value) => value + 1);
  };

  const patterns = question.pattern ?? [];
  const hints = question.hints ?? [];
  const problemText = question.problem || "Prompt missing for this entry.";
  const visibleHints = hints.slice(0, revealedHints);
  const hintShell = useObservedWidth<HTMLDivElement>();
  const reservedHintHeight = useMemo(() => {
    if (!hintShell.width || !hints.length) {
      return 0;
    }

    const hintLines = hints.map((hint, index) => `${index + 1}. ${hint}`);
    return measureTextStack({
      texts: hintLines,
      width: hintShell.width,
      font: '12px "JetBrains Mono"',
      lineHeight: 18,
      gap: 5,
      extraHeight: 20,
    }).height;
  }, [hintShell.width, hints]);
  const progressPercent = Math.round(
    ((current.round - 1) / queue.length) * 100,
  );
  const modeNarrative = modeCopy(current.mode);

  return (
    <main className={`mt-shell ${zenMode ? "zen" : ""}`}>
      <header className="mt-topbar">
        <Link href="/" className="mt-edge-link">
          TwinkyType
        </Link>

        <div className="mt-top-tags">
          <span className={`chip ${question.difficulty}`}>
            {question.difficulty}
          </span>
          <span className="chip">{solution.language}</span>
          <span className="chip">{modeNarrative.label}</span>
          <span className="chip">
            round {current.round}/{queue.length}
          </span>
          {!hasStoredSolution ? (
            <span className="chip">placeholder solution</span>
          ) : null}
          <button
            className="chip action"
            type="button"
            onClick={() => setShowHints((value) => !value)}
          >
            {showHints ? "hints on" : "hints off"}
          </button>
        </div>

        <div className="mt-utility-links">
          <Link className="mt-edge-button" href="/review">
            review
          </Link>
          <Link className="mt-edge-button" href="/stats">
            stats
          </Link>
        </div>
      </header>

      <section className="mt-center">
        <div className="mt-active-strip">
          {patterns.map((tag) => (
            <span className="chip" key={tag}>
              {tag}
            </span>
          ))}
          <button
            className="chip action"
            type="button"
            onClick={() => setZenMode((value) => !value)}
          >
            {zenMode ? "exit zen" : "zen mode"}
          </button>
          <button
            className="chip action"
            type="button"
            onClick={() =>
              setRevealedHints((value) => Math.min(hints.length, value + 1))
            }
            disabled={revealedHints >= hints.length}
          >
            reveal hint
          </button>
        </div>

        {!zenMode ? (
          <div className="mt-prompt">
            <p className="mt-title">{question.title}</p>
            <p className="muted mt-problem">{problemText}</p>
            <p className="muted tiny">{modeNarrative.coach}</p>
            {!hasStoredSolution ? (
              <p className="muted tiny">
                This card has no saved canonical code yet, so a placeholder
                function is being used.
              </p>
            ) : null}
          </div>
        ) : null}

        {showHints && !zenMode ? (
          <div
            className="mt-hints"
            ref={hintShell.ref}
            style={
              reservedHintHeight
                ? { minHeight: `${reservedHintHeight}px` }
                : undefined
            }
          >
            {visibleHints.length === 0 ? (
              <p className="muted tiny">
                Hints enabled. Use `reveal hint` in the state strip.
              </p>
            ) : (
              visibleHints.map((hint, index) => (
                <p className="muted" key={`${hint}-${index}`}>
                  {index + 1}. {hint}
                </p>
              ))
            )}
          </div>
        ) : null}

        <div className="mt-canvas">
          {!roundResult ? (
            <CodeTypingArea
              key={`${currentIndex}-${editorNonce}`}
              expectedCode={solution.code}
              language={solution.language}
              mode={current.mode}
              timedLimitSec={180}
              onComplete={({ stats, elapsedMs }) => {
                setRoundResult({ stats, elapsedMs });
              }}
            />
          ) : (
            <ResultsScreen
              stats={roundResult.stats}
              onRate={setRatedQuality}
              onRetry={handleRetry}
              onNext={handleNext}
            />
          )}
        </div>

        {roundResult && ratedQuality === null ? (
          <p className="muted">
            Pick a quality score (0-5) to unlock next round.
          </p>
        ) : null}
      </section>

      <footer className="mt-footer">
        <span>`</span>
        <span>toggle zen</span>
        <span>Ctrl/Cmd + /</span>
        <span>toggle hints</span>
        <span>Tab / Enter</span>
        <span>smart indentation</span>
        <span>{progressPercent}% session complete</span>
      </footer>
    </main>
  );
}

function modeCopy(mode: PracticeMode) {
  switch (mode) {
    case "ghost":
      return {
        label: "ghost",
        coach: "Watch structure and cadence. Let correct chars light up.",
      };
    case "fill-blank":
      return {
        label: "fill-gap",
        coach: "Use structure as scaffolding and recover hidden tokens.",
      };
    case "timed":
      return {
        label: "recall",
        coach: "No peeking. Prioritize complete recall under pressure.",
      };
    default:
      return { label: "blank", coach: "Rebuild end-to-end from memory only." };
  }
}
