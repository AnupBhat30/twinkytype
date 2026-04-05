import { detectLanguageFamily } from "@/lib/syntax";

const INDENT = "    ";
const AUTO_PAIRS: Record<string, string> = {
  "(": ")",
  "[": "]",
  "{": "}",
  '"': '"',
  "'": "'",
};

export interface PrintableInsertion {
  text: string;
  expected: string;
  caretAdvance?: number;
}

export function buildEnterInsertion(params: {
  typed: string;
  expected: string;
  cursor: number;
  language: string;
}): string {
  const expectedIndent = getExpectedIndentAfterNewline(params.expected, params.cursor);
  if (expectedIndent !== null) {
    return `\n${expectedIndent}`;
  }

  const inferredIndent = inferIndent(params.typed, params.language);
  return `\n${inferredIndent}`;
}

export function buildTabInsertion(params: { typed: string; expected: string; cursor: number }): string {
  const expected = params.expected;
  if (expected[params.cursor] === "\t") {
    return "\t";
  }

  let expectedSpaces = "";
  let lookahead = params.cursor;
  while (expected[lookahead] === " " && expectedSpaces.length < 8) {
    expectedSpaces += " ";
    lookahead += 1;
  }

  if (expectedSpaces.length > 0) {
    return expectedSpaces;
  }

  const line = currentLine(params.typed);
  const column = visualColumn(line);
  const remainder = column % 4;
  return " ".repeat(remainder === 0 ? 4 : 4 - remainder);
}

export function buildPrintableInsertion(params: {
  typed: string;
  expected: string;
  cursor: number;
  key: string;
}): PrintableInsertion {
  const close = AUTO_PAIRS[params.key];
  const charAtCursor = params.typed[params.cursor] ?? "";
  const expectedLine = expectedLineFromCursor(params.expected, params.cursor);

  if (isClosingChar(params.key) && charAtCursor === params.key) {
    return { text: "", expected: params.key, caretAdvance: 1 };
  }

  if (close && shouldAutoPair(params.key, close, params.expected, params.cursor, expectedLine)) {
    return {
      text: `${params.key}${close}`,
      expected: params.expected.slice(params.cursor, params.cursor + 2),
      caretAdvance: 1,
    };
  }

  return {
    text: params.key,
    expected: params.expected.slice(params.cursor, params.cursor + params.key.length),
  };
}

function getExpectedIndentAfterNewline(expected: string, cursor: number): string | null {
  if (expected[cursor] !== "\n") {
    return null;
  }

  let index = cursor + 1;
  let indent = "";
  while (index < expected.length) {
    const char = expected[index];
    if (char !== " " && char !== "\t") {
      break;
    }
    indent += char;
    index += 1;
  }

  return indent;
}

function inferIndent(typed: string, language: string): string {
  const line = currentLine(typed);
  const baseIndent = line.match(/^[ \t]*/)?.[0] ?? "";
  const trimmed = line.trim();
  const family = detectLanguageFamily(language);

  if (!trimmed.length) {
    return baseIndent;
  }

  if (family === "python") {
    if (trimmed.endsWith(":")) {
      return baseIndent + INDENT;
    }

    if (/^(return|pass|break|continue|raise)\b/.test(trimmed) && baseIndent.length >= INDENT.length) {
      return baseIndent.slice(0, baseIndent.length - INDENT.length);
    }

    return baseIndent;
  }

  if (trimmed.endsWith("{") || trimmed.endsWith("(") || trimmed.endsWith("[")) {
    return baseIndent + INDENT;
  }

  if (/^[\]\)}]/.test(trimmed) && baseIndent.length >= INDENT.length) {
    return baseIndent.slice(0, baseIndent.length - INDENT.length);
  }

  return baseIndent;
}

function isClosingChar(char: string): boolean {
  return char === ")" || char === "]" || char === "}" || char === '"' || char === "'";
}

function shouldAutoPair(
  open: string,
  close: string,
  expected: string,
  cursor: number,
  expectedLine: string
): boolean {
  if (expected[cursor] !== open) {
    return false;
  }

  if (open === '"' || open === "'") {
    return expectedLine.indexOf(close, 1) !== -1;
  }

  return expectedLine.includes(close);
}

function expectedLineFromCursor(expected: string, cursor: number): string {
  const nextNewline = expected.indexOf("\n", cursor);
  return nextNewline === -1 ? expected.slice(cursor) : expected.slice(cursor, nextNewline);
}

function currentLine(text: string): string {
  const lastNewline = text.lastIndexOf("\n");
  return lastNewline === -1 ? text : text.slice(lastNewline + 1);
}

function visualColumn(line: string): number {
  let column = 0;
  for (const char of line) {
    if (char === "\t") {
      const remainder = column % 4;
      column += remainder === 0 ? 4 : 4 - remainder;
    } else {
      column += 1;
    }
  }

  return column;
}
