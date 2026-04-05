export type CharState = "pending" | "correct" | "incorrect" | "extra" | "missed";

export interface CharResult {
  expected: string;
  typed: string | null;
  state: CharState;
}

export interface DiffResult {
  chars: CharResult[];
  correctCount: number;
  incorrectCount: number;
  extraCount: number;
  missedCount: number;
  correctLines: number;
}

export function normalizeCode(code: string): string {
  return code
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => line.trimEnd())
    .join("\n")
    .trim();
}

export function diffCode(expected: string, typed: string): DiffResult {
  const chars: CharResult[] = [];
  let correctCount = 0;
  let incorrectCount = 0;
  let extraCount = 0;
  let missedCount = 0;

  const maxLen = Math.max(expected.length, typed.length);

  for (let i = 0; i < maxLen; i += 1) {
    const exp = expected[i] ?? null;
    const typ = typed[i] ?? null;

    if (exp === null && typ !== null) {
      chars.push({ expected: "", typed: typ, state: "extra" });
      extraCount += 1;
      continue;
    }

    if (exp !== null && typ === null) {
      chars.push({ expected: exp, typed: null, state: "pending" });
      missedCount += 1;
      continue;
    }

    if (exp === typ) {
      chars.push({ expected: exp ?? "", typed: typ, state: "correct" });
      correctCount += 1;
      continue;
    }

    chars.push({ expected: exp ?? "", typed: typ, state: "incorrect" });
    incorrectCount += 1;
  }

  const expectedLines = expected.split("\n");
  let offset = 0;
  let correctLines = 0;

  expectedLines.forEach((line, lineIndex) => {
    const lineChars = chars.slice(offset, offset + line.length);
    if (lineChars.length > 0 && lineChars.every((item) => item.state === "correct")) {
      correctLines += 1;
    }

    offset += line.length;
    if (lineIndex < expectedLines.length - 1) {
      offset += 1;
    }
  });

  return {
    chars,
    correctCount,
    incorrectCount,
    extraCount,
    missedCount,
    correctLines,
  };
}
