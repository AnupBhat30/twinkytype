import { NextResponse } from "next/server";
import type { ProgressMap } from "@/lib/types";

interface ProgressPayload {
  progress: ProgressMap;
}

export async function POST(request: Request) {
  const body = (await request.json()) as Partial<ProgressPayload>;

  return NextResponse.json({
    ok: true,
    progressCount: Object.keys(body.progress ?? {}).length,
    note: "Local-first mode: keep canonical progress in browser localStorage.",
  });
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    progress: {},
    note: "No server-side persistence configured.",
  });
}
