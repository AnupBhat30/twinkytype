"use client";

import Link from "next/link";
import { useMemo } from "react";
import { getAllQuestions } from "@/lib/questions";
import type { Question, SM2Card } from "@/lib/types";
import { useCustomStore } from "@/store/customStore";
import { useSessionStore } from "@/store/sessionStore";

interface DueEntry {
  question: Question;
  href: string;
  card: SM2Card;
}

export default function ReviewPage() {
  const questions = getAllQuestions();
  const cards = useSessionStore((state) => state.cards);
  const dueIds = useSessionStore((state) => state.getDueToday());
  const snippets = useCustomStore((state) => state.snippets);

  const dueQuestions = useMemo(() => {
    const map = new Map(questions.map((question) => [question.id, question]));
    const snippetMap = new Map(Object.values(snippets).map((snippet) => [snippet.id, snippet]));

    return dueIds
      .map((id) => {
        let question = map.get(id);
        let href = question ? `/practice/${question.slug}?repeats=4&timed=1` : "";
        if (!question && id.startsWith("custom-")) {
          const snippetId = id.replace("custom-", "");
          const snippet = snippetMap.get(snippetId);
          if (snippet) {
            question = {
              id,
              slug: `custom-${snippet.id}`,
              title: snippet.title,
              difficulty: "easy",
              pattern: ["custom"],
              blind75: false,
              neetcode150: false,
              problem: "Custom pasted snippet",
              constraints: [],
              hints: [],
              solutions: [
                {
                  language: snippet.language,
                  label: "Custom snippet",
                  code: snippet.code,
                  explanation: "Pasted by user",
                },
              ],
            } satisfies Question;
            href = `/practice/custom/${snippet.id}?repeats=4&timed=1`;
          }
        }

        const card = cards[id];
        if (!question || !card) {
          return null;
        }
        return { question, card, href };
      })
      .filter((entry): entry is DueEntry => entry !== null);
  }, [cards, dueIds, questions, snippets]);

  return (
    <main className="stack">
      <section className="panel">
        <h1 className="page-title">Review Queue</h1>
        <p className="muted">Due today: {dueQuestions.length}</p>
        <div className="row">
          <Link href="/" className="button secondary">
            Back home
          </Link>
        </div>
      </section>

      {dueQuestions.length === 0 ? (
        <section className="panel">
          <p className="muted">Nothing due right now. Start a repeat session and rate rounds to populate SM-2.</p>
        </section>
      ) : (
        <section className="cards-grid">
          {dueQuestions.map(({ question, card, href }) => (
            <article className="card" key={question.id}>
              <h3>{question.title}</h3>
              <p className="muted">Next review: {card.nextReview}</p>
              <p className="muted">Ease: {card.easeFactor.toFixed(2)} | Reps: {card.repetitions}</p>
              <Link className="button" href={href}>
                Practice now
              </Link>
            </article>
          ))}
        </section>
      )}
    </main>
  );
}
