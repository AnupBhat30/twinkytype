import { NextResponse } from "next/server";
import { createNewCard, sm2Update } from "@/lib/sm2";
import type { SM2Card } from "@/lib/types";

interface ScheduleRequest {
  questionId: string;
  quality: number;
  timeMs: number;
  card?: SM2Card;
}

export async function POST(request: Request) {
  const body = (await request.json()) as Partial<ScheduleRequest>;

  if (!body.questionId || typeof body.quality !== "number" || typeof body.timeMs !== "number") {
    return NextResponse.json({ ok: false, error: "questionId, quality, and timeMs are required" }, { status: 400 });
  }

  const sourceCard = body.card ?? createNewCard(body.questionId);
  const updated = sm2Update(sourceCard, body.quality, body.timeMs);

  return NextResponse.json({ ok: true, card: updated });
}
