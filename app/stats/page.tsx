"use client";

import Link from "next/link";
import { useMemo } from "react";
import { getAllQuestions } from "@/lib/questions";
import { useCustomStore } from "@/store/customStore";
import { useSessionStore } from "@/store/sessionStore";

function dateKey(ms: number): string {
  return new Date(ms).toISOString().split("T")[0];
}

export default function StatsPage() {
  const questions = getAllQuestions();
  const snippets = useCustomStore((state) => state.snippets);
  const cards = useSessionStore((state) => state.cards);
  const events = useSessionStore((state) => state.sessionHistory);
  const dueCount = useSessionStore((state) => state.getDueToday().length);

  const summary = useMemo(() => {
    const cardList = Object.values(cards);
    const avgEase = cardList.length
      ? cardList.reduce((acc, card) => acc + card.easeFactor, 0) / cardList.length
      : 0;

    const activeDates = new Set(events.map((event) => dateKey(event.completedAt)));
    const sortedDates = [...activeDates].sort();

    let streak = 0;
    let cursor = new Date();

    while (true) {
      const key = cursor.toISOString().split("T")[0];
      if (!activeDates.has(key)) {
        break;
      }
      streak += 1;
      cursor.setDate(cursor.getDate() - 1);
    }

    const questionMap = new Map(questions.map((question) => [question.id, question]));
    const patternTotals = new Map<string, { easeSum: number; count: number }>();

    cardList.forEach((card) => {
      const question =
        questionMap.get(card.questionId) ??
        (card.questionId.startsWith("custom-") && snippets[card.questionId.replace("custom-", "")]
          ? { pattern: ["custom"] }
          : null);
      if (!question) {
        return;
      }

      question.pattern.forEach((pattern) => {
        const prev = patternTotals.get(pattern) ?? { easeSum: 0, count: 0 };
        patternTotals.set(pattern, {
          easeSum: prev.easeSum + card.easeFactor,
          count: prev.count + 1,
        });
      });
    });

    const weakPatterns = [...patternTotals.entries()]
      .map(([pattern, value]) => ({
        pattern,
        ease: value.easeSum / value.count,
      }))
      .sort((a, b) => a.ease - b.ease)
      .slice(0, 5);

    return {
      cards: cardList.length,
      events: events.length,
      dueCount,
      avgEase,
      streak,
      weakPatterns,
      activeDays: sortedDates.length,
    };
  }, [cards, dueCount, events, questions, snippets]);

  return (
    <main className="stack">
      <section className="panel">
        <h1 className="page-title">Stats</h1>
        <p className="muted">Progress from repeated rounds and SM-2 ratings.</p>
        <div className="row">
          <Link href="/" className="button secondary">
            Back home
          </Link>
        </div>
      </section>

      <section className="panel">
        <div className="results-grid">
          <div>
            <p className="muted label">cards</p>
            <p>{summary.cards}</p>
          </div>
          <div>
            <p className="muted label">due today</p>
            <p>{summary.dueCount}</p>
          </div>
          <div>
            <p className="muted label">avg ease</p>
            <p>{summary.avgEase.toFixed(2)}</p>
          </div>
          <div>
            <p className="muted label">streak days</p>
            <p>{summary.streak}</p>
          </div>
        </div>
      </section>

      <section className="panel">
        <h2>Weak pattern heatmap</h2>
        {summary.weakPatterns.length === 0 ? (
          <p className="muted">No rated cards yet.</p>
        ) : (
          <div className="cards-grid">
            {summary.weakPatterns.map((item) => (
              <article className="card" key={item.pattern}>
                <h3>{item.pattern}</h3>
                <p className="muted">Average ease: {item.ease.toFixed(2)}</p>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
