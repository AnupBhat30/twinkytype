import type { KeystrokeEvent, SessionStats } from "@/lib/types";

export function calculateWpm(correctChars: number, elapsedMs: number): number {
  if (elapsedMs <= 0) {
    return 0;
  }

  const minutes = elapsedMs / 1000 / 60;
  return Math.round(correctChars / 5 / minutes);
}

export function calculateLpm(correctLines: number, elapsedMs: number): number {
  if (elapsedMs <= 0) {
    return 0;
  }

  const minutes = elapsedMs / 1000 / 60;
  return Math.round(correctLines / minutes);
}

export function calculateAccuracy(correct: number, total: number): number {
  if (total === 0) {
    return 100;
  }

  return Math.round((correct / total) * 100 * 100) / 100;
}

export function calculateConsistency(wpmHistory: number[]): number {
  if (wpmHistory.length < 2) {
    return 100;
  }

  const mean = wpmHistory.reduce((acc, value) => acc + value, 0) / wpmHistory.length;
  if (mean === 0) {
    return 0;
  }

  const variance =
    wpmHistory.reduce((acc, value) => acc + Math.pow(value - mean, 2), 0) /
    wpmHistory.length;
  const stdDeviation = Math.sqrt(variance);
  const cv = (stdDeviation / mean) * 100;

  return Math.max(0, Math.round(100 - cv));
}

export function buildWpmHistory(
  events: KeystrokeEvent[],
  testDurationMs: number
): { second: number; wpm: number; raw: number }[] {
  const snapshots: { second: number; wpm: number; raw: number }[] = [];

  for (let t = 1000; t <= testDurationMs + 1000; t += 1000) {
    const windowEvents = events.filter((event) => event.timestamp <= t);
    const correctEvents = windowEvents.filter((event) => event.correct).length;
    const allEvents = windowEvents.length;

    snapshots.push({
      second: Math.round(t / 1000),
      wpm: calculateWpm(correctEvents, t),
      raw: calculateWpm(allEvents, t),
    });
  }

  return snapshots;
}

export function normalizeCode(code: string): string {
  return code
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => line.trimEnd())
    .join("\n")
    .trim();
}

export function computeSessionStats(params: {
  correctChars: number;
  allChars: number;
  correctLines: number;
  elapsedMs: number;
  incorrect: number;
  extra: number;
  missed: number;
  events: KeystrokeEvent[];
  expectedCode?: string;
  typedCode?: string;
}): SessionStats {
  const wpmHistory = buildWpmHistory(params.events, params.elapsedMs);
  const expected = params.expectedCode ?? "";
  const typed = params.typedCode ?? "";

  const hesitation = computeHesitation(params.events, expected);
  const breakLine = findBreakLine(expected, typed);
  const mostMistypedToken = findMostMistypedToken(expected, typed);
  const failureType = inferFailureType({
    accuracy: calculateAccuracy(params.correctChars, params.allChars),
    expected,
    typed,
    incorrect: params.incorrect,
    missed: params.missed,
  });

  return {
    wpm: calculateWpm(params.correctChars, params.elapsedMs),
    rawWpm: calculateWpm(params.allChars, params.elapsedMs),
    lpm: calculateLpm(params.correctLines, params.elapsedMs),
    accuracy: calculateAccuracy(params.correctChars, params.allChars),
    consistency: calculateConsistency(wpmHistory.map((snapshot) => snapshot.raw)),
    charStats: {
      correct: params.correctChars,
      incorrect: params.incorrect,
      extra: params.extra,
      missed: params.missed,
    },
    wpmHistory,
    insights: {
      progress: expected.length ? Math.min(100, Math.round((typed.length / expected.length) * 100)) : 0,
      maxHesitationMs: hesitation.maxGapMs,
      hesitationLine: hesitation.line,
      mostMistypedToken,
      failureType,
      breakLine,
    },
  };
}

function computeHesitation(events: KeystrokeEvent[], expected: string): { maxGapMs: number; line: number | null } {
  if (events.length < 2) {
    return { maxGapMs: 0, line: null };
  }

  let maxGapMs = 0;
  let gapIndex = 0;

  for (let index = 1; index < events.length; index += 1) {
    const gap = events[index].timestamp - events[index - 1].timestamp;
    if (gap > maxGapMs) {
      maxGapMs = gap;
      gapIndex = index;
    }
  }

  const prefix = expected.slice(0, Math.max(0, gapIndex));
  const line = prefix.length ? prefix.split("\n").length : 1;

  return { maxGapMs, line };
}

function findBreakLine(expected: string, typed: string): number | null {
  const expectedLines = expected.split("\n");
  const typedLines = typed.split("\n");

  for (let index = 0; index < expectedLines.length; index += 1) {
    const expLine = expectedLines[index] ?? "";
    const typedLine = typedLines[index] ?? "";

    const maxLen = Math.max(expLine.length, typedLine.length, 1);
    let correct = 0;
    for (let charIndex = 0; charIndex < maxLen; charIndex += 1) {
      if ((expLine[charIndex] ?? "") === (typedLine[charIndex] ?? "")) {
        correct += 1;
      }
    }

    const score = correct / maxLen;
    if (score < 0.65 && expLine.trim().length > 0) {
      return index + 1;
    }
  }

  return null;
}

function findMostMistypedToken(expected: string, typed: string): string | null {
  if (!expected.length || !typed.length) {
    return null;
  }

  const counts = new Map<string, number>();
  const length = Math.min(expected.length, typed.length);

  for (let index = 0; index < length; index += 1) {
    if (expected[index] === typed[index]) {
      continue;
    }

    const token = extractTokenAt(expected, index);
    if (!token.trim()) {
      continue;
    }

    counts.set(token, (counts.get(token) ?? 0) + 1);
  }

  let top: string | null = null;
  let topCount = 0;

  counts.forEach((count, token) => {
    if (count > topCount) {
      top = token;
      topCount = count;
    }
  });

  return top;
}

function extractTokenAt(source: string, index: number): string {
  const char = source[index] ?? "";
  if (!char) {
    return "";
  }

  if (!/[A-Za-z0-9_]/.test(char)) {
    return char;
  }

  let left = index;
  let right = index;

  while (left > 0 && /[A-Za-z0-9_]/.test(source[left - 1] ?? "")) {
    left -= 1;
  }
  while (right < source.length - 1 && /[A-Za-z0-9_]/.test(source[right + 1] ?? "")) {
    right += 1;
  }

  return source.slice(left, right + 1);
}

function inferFailureType(params: {
  accuracy: number;
  expected: string;
  typed: string;
  incorrect: number;
  missed: number;
}): "clean" | "syntax" | "indentation" | "algorithmic" {
  if (params.accuracy >= 97 && params.incorrect + params.missed <= 2) {
    return "clean";
  }

  const expectedLines = params.expected.split("\n");
  const typedLines = params.typed.split("\n");
  let indentMismatches = 0;

  for (let index = 0; index < expectedLines.length; index += 1) {
    const expIndent = expectedLines[index]?.match(/^[ \t]*/)?.[0] ?? "";
    const typedIndent = typedLines[index]?.match(/^[ \t]*/)?.[0] ?? "";
    if (expIndent !== typedIndent && (expectedLines[index]?.trim().length ?? 0) > 0) {
      indentMismatches += 1;
    }
  }

  if (indentMismatches >= 2) {
    return "indentation";
  }

  const punctuationErrors = countMismatchType(params.expected, params.typed, /[{}()[\];:.,<>!=+\-*/%&|^]/);
  const wordErrors = countMismatchType(params.expected, params.typed, /[A-Za-z0-9_]/);

  if (punctuationErrors > wordErrors) {
    return "syntax";
  }

  return "algorithmic";
}

function countMismatchType(expected: string, typed: string, matcher: RegExp): number {
  let count = 0;
  const maxLen = Math.max(expected.length, typed.length);

  for (let index = 0; index < maxLen; index += 1) {
    const exp = expected[index] ?? "";
    const typ = typed[index] ?? "";

    if (exp === typ) {
      continue;
    }

    if (matcher.test(exp) || matcher.test(typ)) {
      count += 1;
    }
  }

  return count;
}
