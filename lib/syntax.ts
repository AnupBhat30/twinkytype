export type LanguageFamily = "python" | "javascript" | "cpp" | "go" | "rust" | "text";

export type TokenKind =
  | "plain"
  | "keyword"
  | "string"
  | "number"
  | "comment"
  | "operator"
  | "punctuation"
  | "identifier"
  | "type";

export interface Token {
  value: string;
  kind: TokenKind;
}

const KEYWORDS: Record<Exclude<LanguageFamily, "text">, Set<string>> = {
  python: new Set([
    "and",
    "as",
    "assert",
    "async",
    "await",
    "break",
    "class",
    "continue",
    "def",
    "del",
    "elif",
    "else",
    "except",
    "False",
    "finally",
    "for",
    "from",
    "global",
    "if",
    "import",
    "in",
    "is",
    "lambda",
    "None",
    "nonlocal",
    "not",
    "or",
    "pass",
    "raise",
    "return",
    "True",
    "try",
    "while",
    "with",
    "yield",
  ]),
  javascript: new Set([
    "as",
    "async",
    "await",
    "break",
    "case",
    "catch",
    "class",
    "const",
    "continue",
    "default",
    "delete",
    "do",
    "else",
    "enum",
    "export",
    "extends",
    "false",
    "finally",
    "for",
    "from",
    "function",
    "if",
    "import",
    "in",
    "instanceof",
    "interface",
    "let",
    "new",
    "null",
    "of",
    "return",
    "switch",
    "this",
    "throw",
    "true",
    "try",
    "type",
    "undefined",
    "var",
    "void",
    "while",
  ]),
  cpp: new Set([
    "auto",
    "bool",
    "break",
    "case",
    "catch",
    "char",
    "class",
    "const",
    "continue",
    "default",
    "delete",
    "do",
    "double",
    "else",
    "enum",
    "explicit",
    "extern",
    "false",
    "float",
    "for",
    "friend",
    "if",
    "inline",
    "int",
    "long",
    "namespace",
    "new",
    "nullptr",
    "private",
    "protected",
    "public",
    "return",
    "short",
    "signed",
    "sizeof",
    "static",
    "struct",
    "switch",
    "template",
    "this",
    "throw",
    "true",
    "try",
    "typedef",
    "typename",
    "union",
    "unsigned",
    "using",
    "virtual",
    "void",
    "while",
  ]),
  go: new Set([
    "break",
    "case",
    "chan",
    "const",
    "continue",
    "default",
    "defer",
    "else",
    "fallthrough",
    "false",
    "for",
    "func",
    "go",
    "goto",
    "if",
    "import",
    "interface",
    "map",
    "package",
    "range",
    "return",
    "select",
    "struct",
    "switch",
    "true",
    "type",
    "var",
  ]),
  rust: new Set([
    "as",
    "async",
    "await",
    "break",
    "const",
    "continue",
    "crate",
    "else",
    "enum",
    "false",
    "fn",
    "for",
    "if",
    "impl",
    "in",
    "let",
    "loop",
    "match",
    "mod",
    "move",
    "mut",
    "pub",
    "ref",
    "return",
    "self",
    "Self",
    "static",
    "struct",
    "super",
    "trait",
    "true",
    "type",
    "unsafe",
    "use",
    "where",
    "while",
  ]),
};

const OPERATOR_CHARS = "+-*/%=!<>:&|^~?";
const PUNCTUATION_CHARS = "(){}[]:;,.@";

export function detectLanguageFamily(language: string): LanguageFamily {
  const normalized = language.trim().toLowerCase();

  if (normalized.includes("python") || normalized === "py") {
    return "python";
  }
  if (
    normalized.includes("javascript") ||
    normalized.includes("typescript") ||
    normalized === "js" ||
    normalized === "ts"
  ) {
    return "javascript";
  }
  if (
    normalized.includes("c++") ||
    normalized === "cpp" ||
    normalized.includes("java") ||
    normalized === "c"
  ) {
    return "cpp";
  }
  if (normalized === "go" || normalized.includes("golang")) {
    return "go";
  }
  if (normalized.includes("rust") || normalized === "rs") {
    return "rust";
  }

  return "text";
}

export function tokenizeLine(line: string, language: string): Token[] {
  const family = detectLanguageFamily(language);
  if (!line.length) {
    return [];
  }

  const tokens: Token[] = [];
  const keywords = family === "text" ? new Set<string>() : KEYWORDS[family];
  let index = 0;

  while (index < line.length) {
    const char = line[index];
    const next = line[index + 1] ?? "";

    if (isWhitespace(char)) {
      const start = index;
      while (index < line.length && isWhitespace(line[index])) {
        index += 1;
      }
      tokens.push({ value: line.slice(start, index), kind: "plain" });
      continue;
    }

    if (family === "python" && char === "#") {
      tokens.push({ value: line.slice(index), kind: "comment" });
      break;
    }

    if (char === "/" && next === "/") {
      tokens.push({ value: line.slice(index), kind: "comment" });
      break;
    }

    if (char === "/" && next === "*") {
      const end = line.indexOf("*/", index + 2);
      const stop = end === -1 ? line.length : end + 2;
      tokens.push({ value: line.slice(index, stop), kind: "comment" });
      index = stop;
      continue;
    }

    if (
      family === "python" &&
      ((char === "'" && line.slice(index, index + 3) === "'''") ||
        (char === '"' && line.slice(index, index + 3) === '"""'))
    ) {
      const delimiter = line.slice(index, index + 3);
      const end = line.indexOf(delimiter, index + 3);
      const stop = end === -1 ? line.length : end + 3;
      tokens.push({ value: line.slice(index, stop), kind: "string" });
      index = stop;
      continue;
    }

    if (char === "'" || char === '"' || (family === "javascript" && char === "`")) {
      const quote = char;
      const start = index;
      index += 1;
      while (index < line.length) {
        if (line[index] === "\\") {
          index += 2;
          continue;
        }
        if (line[index] === quote) {
          index += 1;
          break;
        }
        index += 1;
      }
      tokens.push({ value: line.slice(start, index), kind: "string" });
      continue;
    }

    if (isDigit(char)) {
      const start = index;
      index += 1;
      while (index < line.length && /[\dA-Fa-f_xobXOB\.]/.test(line[index])) {
        index += 1;
      }
      tokens.push({ value: line.slice(start, index), kind: "number" });
      continue;
    }

    if (isIdentifierStart(char)) {
      const start = index;
      index += 1;
      while (index < line.length && isIdentifierPart(line[index])) {
        index += 1;
      }
      const word = line.slice(start, index);
      if (keywords.has(word)) {
        tokens.push({ value: word, kind: "keyword" });
      } else if (/^[A-Z][A-Za-z0-9_]*$/.test(word)) {
        tokens.push({ value: word, kind: "type" });
      } else {
        tokens.push({ value: word, kind: "identifier" });
      }
      continue;
    }

    if (OPERATOR_CHARS.includes(char)) {
      const start = index;
      index += 1;
      while (index < line.length && OPERATOR_CHARS.includes(line[index])) {
        index += 1;
      }
      tokens.push({ value: line.slice(start, index), kind: "operator" });
      continue;
    }

    if (PUNCTUATION_CHARS.includes(char)) {
      tokens.push({ value: char, kind: "punctuation" });
      index += 1;
      continue;
    }

    tokens.push({ value: char, kind: "plain" });
    index += 1;
  }

  return tokens;
}

function isWhitespace(char: string): boolean {
  return char === " " || char === "\t";
}

function isDigit(char: string): boolean {
  return char >= "0" && char <= "9";
}

function isIdentifierStart(char: string): boolean {
  return (char >= "a" && char <= "z") || (char >= "A" && char <= "Z") || char === "_";
}

function isIdentifierPart(char: string): boolean {
  return isIdentifierStart(char) || isDigit(char);
}
