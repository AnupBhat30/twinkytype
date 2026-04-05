import type { Question } from "@/lib/types";

interface ProblemHeaderProps {
  question: Question;
  mode: string;
  round: number;
  totalRounds: number;
  language?: string;
}

export default function ProblemHeader({ question, mode, round, totalRounds, language }: ProblemHeaderProps) {
  return (
    <header className="panel">
      <div className="row space-between">
        <h1>{question.title}</h1>
        <div className="chip-row">
          <span className={`chip ${question.difficulty}`}>{question.difficulty}</span>
          {language ? <span className="chip">{language}</span> : null}
          <span className="chip">{mode}</span>
          <span className="chip">round {round}/{totalRounds}</span>
        </div>
      </div>
      <p className="muted">{question.problem}</p>
      <div className="chip-row">
        {question.pattern.map((tag) => (
          <span className="chip" key={tag}>
            {tag}
          </span>
        ))}
      </div>
    </header>
  );
}
