"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useParams, useSearchParams } from "next/navigation";
import PracticeClient from "@/app/practice/[slug]/PracticeClient";
import type { Question } from "@/lib/types";
import { useCustomStore } from "@/store/customStore";

export default function CustomPracticePage() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();

  const snippetId = params.id;
  const snippet = useCustomStore((state) => state.snippets[snippetId]);

  const repeats = clampInt(searchParams.get("repeats"), 4, 1, 12);
  const includeTimedRound = searchParams.get("timed") !== "0";

  const question = useMemo<Question | null>(() => {
    if (!snippet) {
      return null;
    }

    return {
      id: `custom-${snippet.id}`,
      slug: `custom-${snippet.id}`,
      title: snippet.title,
      difficulty: "easy",
      pattern: ["custom"],
      blind75: false,
      neetcode150: false,
      problem: "Practice this pasted snippet from memory until it feels automatic.",
      constraints: ["User-provided snippet"],
      hints: [
        "Focus on structure first, then exact syntax.",
        "Rate honestly after each round so spacing works.",
      ],
      solutions: [
        {
          language: snippet.language,
          label: "Custom snippet",
          code: snippet.code,
          explanation: "Pasted by user",
        },
      ],
    };
  }, [snippet]);

  if (!question) {
    return (
      <main className="stack">
        <section className="panel">
          <h1 className="page-title">Snippet not found</h1>
          <p className="muted">This custom snippet is missing. Create a new one from home.</p>
          <Link className="button" href="/">
            Back home
          </Link>
        </section>
      </main>
    );
  }

  return <PracticeClient question={question} repeats={repeats} includeTimedRound={includeTimedRound} />;
}

function clampInt(value: string | null, fallback: number, min: number, max: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.min(max, Math.max(min, Math.round(parsed)));
}
