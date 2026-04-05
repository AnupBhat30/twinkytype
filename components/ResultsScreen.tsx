"use client";

import type { SessionStats } from "@/lib/types";

const QUALITY_LABELS = ["Blackout", "Wrong", "Hard", "OK", "Good", "Easy"];

interface ResultsScreenProps {
  stats: SessionStats;
  onRate: (quality: number) => void;
  onRetry: () => void;
  onNext: () => void;
}

function failureLabel(type: SessionStats["insights"]["failureType"]): string {
  switch (type) {
    case "clean":
      return "Clean execution";
    case "syntax":
      return "Syntax drift";
    case "indentation":
      return "Indentation drift";
    default:
      return "Algorithm recall drift";
  }
}

export default function ResultsScreen({ stats, onRate, onRetry, onNext }: ResultsScreenProps) {
  return (
    <section className="panel results">
      <div className="results-primary">
        <p className="muted label">lpm</p>
        <p className="big-number">{stats.lpm}</p>
      </div>

      <div className="results-grid">
        <div>
          <p className="muted label">accuracy</p>
          <p>{stats.accuracy}%</p>
        </div>
        <div>
          <p className="muted label">wpm</p>
          <p>{stats.wpm}</p>
        </div>
        <div>
          <p className="muted label">raw</p>
          <p>{stats.rawWpm}</p>
        </div>
        <div>
          <p className="muted label">consistency</p>
          <p>{stats.consistency}%</p>
        </div>
      </div>

      <div className="results-insights">
        <p className="muted tiny">Longest hesitation: {Math.round(stats.insights.maxHesitationMs / 100) / 10}s</p>
        <p className="muted tiny">Hesitation point: {stats.insights.hesitationLine ? `line ${stats.insights.hesitationLine}` : "n/a"}</p>
        <p className="muted tiny">Most mistyped token: {stats.insights.mostMistypedToken ?? "none"}</p>
        <p className="muted tiny">Break line: {stats.insights.breakLine ? `line ${stats.insights.breakLine}` : "none"}</p>
        <p className="muted tiny">Failure type: {failureLabel(stats.insights.failureType)}</p>
      </div>

      <p className="muted">
        {stats.charStats.correct}/{stats.charStats.incorrect}/{stats.charStats.extra}/
        {stats.charStats.missed} (correct/incorrect/extra/missed)
      </p>

      <div>
        <p className="muted label">How well did you recall this?</p>
        <div className="quality-row">
          {QUALITY_LABELS.map((label, index) => (
            <button className="button quality" key={label} onClick={() => onRate(index)} type="button">
              {index} - {label}
            </button>
          ))}
        </div>
      </div>

      <div className="row">
        <button className="button secondary" onClick={onRetry} type="button">
          Retry round
        </button>
        <button className="button" onClick={onNext} type="button">
          Next round
        </button>
      </div>
    </section>
  );
}
