import type { SM2Card } from "@/lib/types";

function todayDate(now = new Date()): string {
  return now.toISOString().split("T")[0];
}

function addDays(dateIso: string, days: number): string {
  const date = new Date(`${dateIso}T00:00:00`);
  date.setDate(date.getDate() + days);
  return date.toISOString().split("T")[0];
}

export function createNewCard(questionId: string, now = new Date()): SM2Card {
  const today = todayDate(now);

  return {
    questionId,
    interval: 1,
    repetitions: 0,
    easeFactor: 2.5,
    nextReview: today,
    history: [],
  };
}

export function sm2Update(card: SM2Card, quality: number, timeMs: number, now = new Date()): SM2Card {
  const today = todayDate(now);
  const newHistory = [...card.history, { date: today, quality, timeMs }];

  if (quality < 3) {
    return {
      ...card,
      interval: 1,
      repetitions: 0,
      nextReview: addDays(today, 1),
      history: newHistory,
    };
  }

  const newEaseFactor = Math.max(
    1.3,
    card.easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02))
  );

  let newInterval = 1;
  if (card.repetitions === 1) {
    newInterval = 6;
  } else if (card.repetitions >= 2) {
    newInterval = Math.round(card.interval * newEaseFactor);
  }

  return {
    ...card,
    interval: newInterval,
    repetitions: card.repetitions + 1,
    easeFactor: newEaseFactor,
    nextReview: addDays(today, newInterval),
    history: newHistory,
  };
}

export function isCardDue(card: SM2Card, now = new Date()): boolean {
  return card.nextReview <= todayDate(now);
}

export function datePlusDays(days: number, now = new Date()): string {
  return addDays(todayDate(now), days);
}
