export type Difficulty = "easy" | "medium" | "hard";
export type PracticeMode = "ghost" | "fill-blank" | "blank" | "timed";

export interface Solution {
  language: string;
  label: string;
  code: string;
  explanation: string;
}

export interface Question {
  id: string;
  slug: string;
  title: string;
  difficulty: Difficulty;
  pattern: string[];
  blind75: boolean;
  neetcode150: boolean;
  problem: string;
  constraints: string[];
  hints: string[];
  solutions: Solution[];
}

export interface RatingHistoryEntry {
  date: string;
  quality: number;
  timeMs: number;
}

export interface SM2Card {
  questionId: string;
  interval: number;
  repetitions: number;
  easeFactor: number;
  nextReview: string;
  history: RatingHistoryEntry[];
}

export type ProgressMap = Record<string, SM2Card>;

export interface QueueItem {
  question: Question;
  mode: PracticeMode;
  round: number;
}

export interface RepeatConfig {
  repeats: number;
  includeTimedRound: boolean;
}

export interface KeystrokeEvent {
  timestamp: number;
  correct: boolean;
}

export interface SessionStats {
  wpm: number;
  rawWpm: number;
  lpm: number;
  accuracy: number;
  consistency: number;
  charStats: {
    correct: number;
    incorrect: number;
    extra: number;
    missed: number;
  };
  wpmHistory: { second: number; wpm: number; raw: number }[];
  insights: {
    progress: number;
    maxHesitationMs: number;
    hesitationLine: number | null;
    mostMistypedToken: string | null;
    failureType: "clean" | "syntax" | "indentation" | "algorithmic";
    breakLine: number | null;
  };
}

export interface SessionEvent {
  questionId: string;
  mode: PracticeMode;
  startedAt: number;
  completedAt: number;
  durationMs: number;
  quality: number;
  stats: SessionStats;
}

export interface CustomSnippet {
  id: string;
  title: string;
  language: string;
  code: string;
  createdAt: number;
}
