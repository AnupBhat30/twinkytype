import { detectLanguageFamily } from "@/lib/syntax";

export interface CommentReferenceLine {
  line: number;
  text: string;
}

export interface PracticeCodeResult {
  code: string;
  skippedLineComments: number;
  commentLines: CommentReferenceLine[];
}

export function buildPracticeCode(source: string, language: string): PracticeCodeResult {
  const family = detectLanguageFamily(language);

  if (family === "text") {
    return { code: source, skippedLineComments: 0, commentLines: [] };
  }

  if (family === "python") {
    return stripPythonComments(source);
  }

  return stripCLikeComments(source);
}

function stripPythonComments(source: string): PracticeCodeResult {
  const out: string[] = [];
  const commentLines: CommentReferenceLine[] = [];
  let skippedLineComments = 0;

  const lines = source.split("\n");
  lines.forEach((line, index) => {
    const lineNo = index + 1;
    const trimmed = line.trimStart();

    if (trimmed.startsWith("#")) {
      skippedLineComments += 1;
      commentLines.push({ line: lineNo, text: trimmed });
      return;
    }

    const stripped = stripInlineHashComment(line);
    if (stripped.comment) {
      commentLines.push({ line: lineNo, text: stripped.comment.trim() });
    }

    out.push(stripped.code.trimEnd());
  });

  return {
    code: trimEdgeBlankLines(out.join("\n")),
    skippedLineComments,
    commentLines,
  };
}

function stripInlineHashComment(line: string): { code: string; comment: string | null } {
  let inSingle = false;
  let inDouble = false;
  let escaped = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];

    if (escaped) {
      escaped = false;
      continue;
    }

    if (char === "\\") {
      escaped = true;
      continue;
    }

    if (char === "'" && !inDouble) {
      inSingle = !inSingle;
      continue;
    }

    if (char === '"' && !inSingle) {
      inDouble = !inDouble;
      continue;
    }

    if (char === "#" && !inSingle && !inDouble) {
      return {
        code: line.slice(0, i),
        comment: line.slice(i),
      };
    }
  }

  return { code: line, comment: null };
}

function stripCLikeComments(source: string): PracticeCodeResult {
  const lines = source.split("\n");
  const out: string[] = [];
  const commentLines: CommentReferenceLine[] = [];

  let skippedLineComments = 0;
  let inBlockComment = false;

  lines.forEach((originalLine, index) => {
    const lineNo = index + 1;
    let i = 0;
    let result = "";

    let inSingle = false;
    let inDouble = false;
    let inTemplate = false;
    let escaped = false;

    while (i < originalLine.length) {
      const char = originalLine[i];
      const next = originalLine[i + 1] ?? "";

      if (inBlockComment) {
        if (char === "*" && next === "/") {
          inBlockComment = false;
          i += 2;
          continue;
        }

        i += 1;
        continue;
      }

      if (escaped) {
        result += char;
        escaped = false;
        i += 1;
        continue;
      }

      if (char === "\\" && (inSingle || inDouble || inTemplate)) {
        result += char;
        escaped = true;
        i += 1;
        continue;
      }

      if (!inDouble && !inTemplate && char === "'" && !inSingle) {
        inSingle = true;
        result += char;
        i += 1;
        continue;
      }
      if (!inDouble && !inTemplate && char === "'" && inSingle) {
        inSingle = false;
        result += char;
        i += 1;
        continue;
      }

      if (!inSingle && !inTemplate && char === '"' && !inDouble) {
        inDouble = true;
        result += char;
        i += 1;
        continue;
      }
      if (!inSingle && !inTemplate && char === '"' && inDouble) {
        inDouble = false;
        result += char;
        i += 1;
        continue;
      }

      if (!inSingle && !inDouble && char === "`") {
        inTemplate = !inTemplate;
        result += char;
        i += 1;
        continue;
      }

      if (!inSingle && !inDouble && !inTemplate && char === "/" && next === "/") {
        const comment = originalLine.slice(i).trim();
        if (comment) {
          commentLines.push({ line: lineNo, text: comment });
        }
        if (originalLine.trimStart().startsWith("//") || result.trim().length === 0) {
          skippedLineComments += 1;
        }
        break;
      }

      if (!inSingle && !inDouble && !inTemplate && char === "/" && next === "*") {
        const maybeComment = originalLine.slice(i).trim();
        if (result.trim().length === 0 && maybeComment) {
          commentLines.push({ line: lineNo, text: maybeComment });
        }
        inBlockComment = true;
        i += 2;
        continue;
      }

      result += char;
      i += 1;
    }

    const trimmedOriginal = originalLine.trim();
    if (
      result.trim().length === 0 &&
      (trimmedOriginal.startsWith("//") ||
        trimmedOriginal.startsWith("/*") ||
        trimmedOriginal === "*/" ||
        trimmedOriginal.startsWith("*"))
    ) {
      skippedLineComments += 1;
      if (!commentLines.some((entry) => entry.line === lineNo)) {
        commentLines.push({ line: lineNo, text: trimmedOriginal });
      }
      return;
    }

    out.push(result.trimEnd());
  });

  return {
    code: trimEdgeBlankLines(out.join("\n")),
    skippedLineComments,
    commentLines,
  };
}

function trimEdgeBlankLines(source: string): string {
  const lines = source.split("\n");

  while (lines.length && lines[0].trim().length === 0) {
    lines.shift();
  }

  while (lines.length && lines[lines.length - 1].trim().length === 0) {
    lines.pop();
  }

  return lines.join("\n");
}
