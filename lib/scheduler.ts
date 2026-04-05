import { isCardDue } from "@/lib/sm2";
import type { PracticeMode, ProgressMap, Question, QueueItem, RepeatConfig } from "@/lib/types";

interface BuildSessionConfig {
  count: number;
  mixPatterns: boolean;
}

export function buildReviewSession(
  allQuestions: Question[],
  progress: ProgressMap,
  config: BuildSessionConfig
): QueueItem[] {
  const due = allQuestions.filter((question) => {
    const card = progress[question.id];
    return card ? isCardDue(card) : false;
  });

  const unseen = allQuestions.filter((question) => !progress[question.id]);
  const selected = [...due, ...unseen].slice(0, config.count);
  const queue = config.mixPatterns ? interleaveByPattern(selected) : selected;

  return queue.map((question, index) => ({
    question,
    mode: index % 2 === 0 ? "blank" : "fill-blank",
    round: 1,
  }));
}

export function buildRepeatSession(
  question: Question,
  config: RepeatConfig = { repeats: 4, includeTimedRound: true }
): QueueItem[] {
  const items: QueueItem[] = [];
  const total = Math.max(1, config.repeats);

  for (let round = 1; round <= total; round += 1) {
    items.push({
      question,
      mode: chooseMode(round, total, config.includeTimedRound),
      round,
    });
  }

  return items;
}

function chooseMode(round: number, total: number, includeTimedRound: boolean): PracticeMode {
  if (round === 1) {
    return "ghost";
  }

  if (round === 2) {
    return "fill-blank";
  }

  if (includeTimedRound && round === total && total >= 4) {
    return "timed";
  }

  return "blank";
}

function interleaveByPattern(questions: Question[]): Question[] {
  const buckets = new Map<string, Question[]>();

  questions.forEach((question) => {
    const key = question.pattern[0] ?? "misc";
    if (!buckets.has(key)) {
      buckets.set(key, []);
    }
    buckets.get(key)!.push(question);
  });

  const keys = [...buckets.keys()].sort();
  const output: Question[] = [];

  while (keys.some((key) => (buckets.get(key)?.length ?? 0) > 0)) {
    keys.forEach((key) => {
      const next = buckets.get(key)?.shift();
      if (next) {
        output.push(next);
      }
    });
  }

  return output;
}
