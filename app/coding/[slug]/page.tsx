import { notFound } from "next/navigation";
import CodingPracticeClient from "./CodingPracticeClient";
import { getCodingQuestionBySlug } from "@/lib/coding-interview";

interface CodingPracticePageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ repeats?: string; timed?: string }>;
}

export default async function CodingPracticePage({
  params,
  searchParams,
}: CodingPracticePageProps) {
  const resolvedParams = await params;
  const resolvedSearchParams = await searchParams;

  const question = getCodingQuestionBySlug(resolvedParams.slug);
  if (!question) {
    return notFound();
  }

  const repeats = clampInt(resolvedSearchParams.repeats, 4, 1, 12);
  const includeTimedRound = resolvedSearchParams.timed !== "0";

  return (
    <CodingPracticeClient
      question={question}
      repeats={repeats}
      includeTimedRound={includeTimedRound}
    />
  );
}

function clampInt(
  value: string | undefined,
  fallback: number,
  min: number,
  max: number,
): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.min(max, Math.max(min, Math.round(parsed)));
}
