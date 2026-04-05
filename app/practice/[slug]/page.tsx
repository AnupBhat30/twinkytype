import { notFound } from "next/navigation";
import PracticeClient from "@/app/practice/[slug]/PracticeClient";
import { getQuestionBySlug } from "@/lib/questions";

interface PracticePageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ repeats?: string; timed?: string }>;
}

export default async function PracticePage({ params, searchParams }: PracticePageProps) {
  const resolvedParams = await params;
  const resolvedSearchParams = await searchParams;

  const question = getQuestionBySlug(resolvedParams.slug);
  if (!question) {
    return notFound();
  }

  const repeats = clampInt(resolvedSearchParams.repeats, 4, 1, 12);
  const includeTimedRound = resolvedSearchParams.timed !== "0";

  return <PracticeClient question={question} repeats={repeats} includeTimedRound={includeTimedRound} />;
}

function clampInt(value: string | undefined, fallback: number, min: number, max: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.min(max, Math.max(min, Math.round(parsed)));
}
