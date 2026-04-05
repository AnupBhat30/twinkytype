"use client";

import Link from "next/link";
import { useMemo } from "react";
import type { ReactNode } from "react";
import type { LldEntry, LldFile } from "@/lib/lld";
import { tokenizeLine, type TokenKind } from "@/lib/syntax";

type FileKind = "main" | "demo" | "support" | "doc";

interface ParsedReadmeSection {
  id: string;
  title: string;
  lines: string[];
}

interface RenderableFile extends LldFile {
  language: string;
  kind: FileKind;
  lineCount: number;
  dependencies: string[];
  dependentCount: number;
  studyStep: number;
}

interface LldStudyClientProps {
  entry: LldEntry;
}

function basename(path: string): string {
  const parts = path.split("/");
  return parts[parts.length - 1] ?? path;
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .trim();
}

function stripInlineMarkdown(value: string): string {
  return value
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/\*(.*?)\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\[(.*?)\]\(.*?\)/g, "$1")
    .trim();
}

function countLines(content: string): number {
  if (!content) {
    return 0;
  }
  return content.split("\n").length;
}

function moduleNameFromPath(path: string): string {
  const file = basename(path).toLowerCase();
  if (!file.includes(".")) {
    return file;
  }
  return file.slice(0, file.lastIndexOf("."));
}

function parsePythonImports(content: string): string[] {
  const modules = new Set<string>();
  const lines = content.split("\n");

  lines.forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      return;
    }

    const fromMatch = trimmed.match(/^from\s+([a-zA-Z_][\w\.]*)\s+import\s+/);
    if (fromMatch?.[1]) {
      const candidate = fromMatch[1].split(".")[0]?.trim().toLowerCase();
      if (candidate) {
        modules.add(candidate);
      }
      return;
    }

    const importMatch = trimmed.match(/^import\s+(.+)$/);
    if (importMatch?.[1]) {
      importMatch[1]
        .split(",")
        .map((chunk) => chunk.trim())
        .map((chunk) => chunk.split(/\s+as\s+/i)[0]?.trim())
        .map((chunk) => chunk.split(".")[0]?.trim().toLowerCase())
        .filter(Boolean)
        .forEach((candidate) => modules.add(candidate));
    }
  });

  return [...modules];
}

function formatStep(step: number): string {
  if (step <= 0) {
    return "--";
  }
  return String(step).padStart(2, "0");
}

function stepRange(files: RenderableFile[]): string {
  if (!files.length) {
    return "--";
  }
  const steps = files.map((file) => file.studyStep).filter((value) => value > 0);
  if (!steps.length) {
    return "--";
  }
  const min = Math.min(...steps);
  const max = Math.max(...steps);
  if (min === max) {
    return formatStep(min);
  }
  return `${formatStep(min)}-${formatStep(max)}`;
}

function tokenClass(kind: TokenKind): string {
  switch (kind) {
    case "keyword":
      return "tok-keyword";
    case "string":
      return "tok-string";
    case "number":
      return "tok-number";
    case "comment":
      return "tok-comment";
    case "operator":
      return "tok-operator";
    case "punctuation":
      return "tok-punctuation";
    case "type":
      return "tok-type";
    case "identifier":
      return "tok-identifier";
    default:
      return "tok-plain";
  }
}

function detectLanguageFromPath(path: string, fallback: string): string {
  const ext = path.split(".").pop()?.toLowerCase() ?? "";

  switch (ext) {
    case "py":
      return "python";
    case "js":
    case "jsx":
    case "ts":
    case "tsx":
      return "typescript";
    case "go":
      return "go";
    case "rs":
      return "rust";
    case "cpp":
    case "cc":
    case "hpp":
    case "java":
    case "c":
    case "h":
      return "cpp";
    case "md":
    case "txt":
      return "text";
    default:
      return fallback || "text";
  }
}

function parseReadmeSections(readme: string): ParsedReadmeSection[] {
  if (!readme.trim()) {
    return [];
  }

  const sections: ParsedReadmeSection[] = [];
  let current: ParsedReadmeSection | null = null;

  const pushCurrent = () => {
    if (!current) {
      return;
    }
    const hasContent = current.lines.some((line) => line.trim().length > 0);
    if (hasContent) {
      sections.push(current);
    }
  };

  readme.split("\n").forEach((rawLine) => {
    const line = rawLine.replace(/\r$/, "");
    const trimmed = line.trim();

    if (/^#\s+/.test(trimmed)) {
      return;
    }

    if (/^##\s+/.test(trimmed)) {
      pushCurrent();
      const title = stripInlineMarkdown(trimmed.replace(/^##\s+/, ""));
      current = {
        id: `readme-${slugify(title) || sections.length + 1}`,
        title: title || "Section",
        lines: [],
      };
      return;
    }

    if (!current) {
      current = {
        id: "readme-overview",
        title: "Overview",
        lines: [],
      };
    }

    current.lines.push(line);
  });

  pushCurrent();

  return sections;
}

function buildDependencyAwareOrder(
  files: RenderableFile[],
  mainIndex: Map<string, number>,
  demoIndex: Map<string, number>
): string[] {
  const byPath = new Map(files.map((file) => [file.path, file]));

  const orderWithinBucket = (left: string, right: string) => {
    const a = byPath.get(left);
    const b = byPath.get(right);
    if (!a || !b) {
      return left.localeCompare(right);
    }

    const aName = basename(a.path).toLowerCase();
    const bName = basename(b.path).toLowerCase();
    const aPriority = a.kind === "support" ? 0 : a.kind === "main" ? 1 : 2;
    const bPriority = b.kind === "support" ? 0 : b.kind === "main" ? 1 : 2;

    if (aPriority !== bPriority) {
      return aPriority - bPriority;
    }

    if (a.kind === "main" && b.kind === "main") {
      const aMain = mainIndex.get(aName) ?? Number.MAX_SAFE_INTEGER;
      const bMain = mainIndex.get(bName) ?? Number.MAX_SAFE_INTEGER;
      if (aMain !== bMain) {
        return aMain - bMain;
      }
    }

    if (a.kind === "demo" && b.kind === "demo") {
      const aDemo = demoIndex.get(aName) ?? Number.MAX_SAFE_INTEGER;
      const bDemo = demoIndex.get(bName) ?? Number.MAX_SAFE_INTEGER;
      if (aDemo !== bDemo) {
        return aDemo - bDemo;
      }
    }

    if (a.dependentCount !== b.dependentCount) {
      return b.dependentCount - a.dependentCount;
    }

    return a.path.localeCompare(b.path);
  };

  const processBucket = (subset: RenderableFile[]) => {
    const set = new Set(subset.map((file) => file.path));
    const indegree = new Map<string, number>();
    const graph = new Map<string, string[]>();

    subset.forEach((file) => {
      indegree.set(file.path, 0);
      graph.set(file.path, []);
    });

    subset.forEach((file) => {
      file.dependencies.forEach((depPath) => {
        if (!set.has(depPath)) {
          return;
        }
        graph.get(depPath)?.push(file.path);
        indegree.set(file.path, (indegree.get(file.path) ?? 0) + 1);
      });
    });

    const queue = [...subset.map((file) => file.path).filter((path) => (indegree.get(path) ?? 0) === 0)].sort(
      orderWithinBucket
    );
    const ordered: string[] = [];

    while (queue.length) {
      const path = queue.shift();
      if (!path) {
        break;
      }

      ordered.push(path);
      const nexts = graph.get(path) ?? [];
      nexts.forEach((nextPath) => {
        const nextDegree = (indegree.get(nextPath) ?? 0) - 1;
        indegree.set(nextPath, nextDegree);
        if (nextDegree === 0) {
          queue.push(nextPath);
          queue.sort(orderWithinBucket);
        }
      });
    }

    if (ordered.length < subset.length) {
      const leftovers = subset
        .map((file) => file.path)
        .filter((path) => !ordered.includes(path))
        .sort(orderWithinBucket);
      ordered.push(...leftovers);
    }

    return ordered;
  };

  const core = files.filter((file) => file.kind !== "demo" && file.kind !== "doc");
  const demos = files.filter((file) => file.kind === "demo");
  const docs = files.filter((file) => file.kind === "doc").map((file) => file.path).sort(orderWithinBucket);

  return [...processBucket(core), ...processBucket(demos), ...docs];
}

function groupFiles(entry: LldEntry): RenderableFile[] {
  const sourceLanguage = entry.source?.language ?? "python";
  const mainSet = new Set((entry.main_files ?? []).map((name) => name.toLowerCase()));
  const demoSet = new Set((entry.demo_files ?? []).map((name) => name.toLowerCase()));
  const mainIndex = new Map((entry.main_files ?? []).map((name, index) => [name.toLowerCase(), index]));
  const demoIndex = new Map((entry.demo_files ?? []).map((name, index) => [name.toLowerCase(), index]));

  const seedFiles = (entry.files?.python ?? []).map((file) => {
    const fileName = basename(file.path).toLowerCase();
    const kind: FileKind = mainSet.has(fileName) ? "main" : demoSet.has(fileName) ? "demo" : "support";
    return {
      ...file,
      kind,
      lineCount: countLines(file.content),
      language: detectLanguageFromPath(file.path, sourceLanguage),
      dependencies: [] as string[],
      dependentCount: 0,
      studyStep: 0,
    };
  });

  const docs = (entry.files?.other_docs ?? []).map((file) => ({
    ...file,
    kind: "doc" as const,
    lineCount: countLines(file.content),
    language: detectLanguageFromPath(file.path, "text"),
    dependencies: [] as string[],
    dependentCount: 0,
    studyStep: 0,
  }));

  const modulePathMap = new Map(seedFiles.map((file) => [moduleNameFromPath(file.path), file.path]));
  const dependentCountByPath = new Map<string, number>();

  const withDependencies = seedFiles.map((file) => {
    const localImports = file.language.includes("python") ? parsePythonImports(file.content) : [];
    const dependencies = localImports
      .map((module) => modulePathMap.get(module))
      .filter((candidate): candidate is string => Boolean(candidate && candidate !== file.path));

    const uniqueDependencies = [...new Set(dependencies)].sort((a, b) => a.localeCompare(b));
    uniqueDependencies.forEach((depPath) => {
      dependentCountByPath.set(depPath, (dependentCountByPath.get(depPath) ?? 0) + 1);
    });

    return {
      ...file,
      dependencies: uniqueDependencies,
    };
  });

  const filesWithDependents = withDependencies.map((file) => ({
    ...file,
    dependentCount: dependentCountByPath.get(file.path) ?? 0,
  }));

  const orderedPaths = buildDependencyAwareOrder(filesWithDependents, mainIndex, demoIndex);
  const orderMap = new Map(orderedPaths.map((path, index) => [path, index]));

  const orderedPython = [...filesWithDependents]
    .sort((a, b) => (orderMap.get(a.path) ?? Number.MAX_SAFE_INTEGER) - (orderMap.get(b.path) ?? Number.MAX_SAFE_INTEGER))
    .map((file, index) => ({
      ...file,
      studyStep: index + 1,
    }));

  const orderedDocs = docs.map((file, index) => ({
    ...file,
    studyStep: orderedPython.length + index + 1,
  }));

  return [...orderedPython, ...orderedDocs];
}

function humanFileKind(kind: FileKind): string {
  switch (kind) {
    case "main":
      return "main";
    case "demo":
      return "demo";
    case "support":
      return "support";
    default:
      return "doc";
  }
}

function renderReadmeLines(lines: string[], keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let index = 0;
  let block = 0;

  while (index < lines.length) {
    const line = lines[index].trim();

    if (!line) {
      index += 1;
      continue;
    }

    if (/^###\s+/.test(line)) {
      const heading = stripInlineMarkdown(line.replace(/^###\s+/, ""));
      nodes.push(
        <h3 key={`${keyPrefix}-h3-${block}`} className="lld-subheading">
          {heading}
        </h3>
      );
      block += 1;
      index += 1;
      continue;
    }

    if (/^\d+\.\s+/.test(line)) {
      const items: string[] = [];
      while (index < lines.length && /^\d+\.\s+/.test(lines[index].trim())) {
        items.push(stripInlineMarkdown(lines[index].trim().replace(/^\d+\.\s+/, "")));
        index += 1;
      }
      nodes.push(
        <ol key={`${keyPrefix}-ol-${block}`} className="lld-list lld-list-ordered">
          {items.map((item, itemIndex) => (
            <li key={`${keyPrefix}-ol-${block}-${itemIndex}`}>
              <span className="lld-list-marker">{itemIndex + 1}.</span>
              <span>{item}</span>
            </li>
          ))}
        </ol>
      );
      block += 1;
      continue;
    }

    if (/^[-*]\s+/.test(line)) {
      const items: string[] = [];
      while (index < lines.length && /^[-*]\s+/.test(lines[index].trim())) {
        items.push(stripInlineMarkdown(lines[index].trim().replace(/^[-*]\s+/, "")));
        index += 1;
      }
      nodes.push(
        <ul key={`${keyPrefix}-ul-${block}`} className="lld-list lld-list-unordered">
          {items.map((item, itemIndex) => (
            <li key={`${keyPrefix}-ul-${block}-${itemIndex}`}>
              <span className="lld-list-marker">•</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      );
      block += 1;
      continue;
    }

    const paragraphLines: string[] = [];
    while (index < lines.length) {
      const candidate = lines[index].trim();
      if (
        !candidate ||
        /^###\s+/.test(candidate) ||
        /^\d+\.\s+/.test(candidate) ||
        /^[-*]\s+/.test(candidate)
      ) {
        break;
      }
      paragraphLines.push(stripInlineMarkdown(candidate));
      index += 1;
    }

    if (paragraphLines.length) {
      nodes.push(
        <p key={`${keyPrefix}-p-${block}`} className="lld-paragraph">
          {paragraphLines.join(" ")}
        </p>
      );
      block += 1;
      continue;
    }

    index += 1;
  }

  return nodes;
}

function HighlightedCodeBlock({ content, language }: { content: string; language: string }) {
  const lines = useMemo(() => (content ? content.split("\n") : []), [content]);
  const tokenizedLines = useMemo(() => lines.map((line) => tokenizeLine(line, language)), [language, lines]);

  if (!lines.length) {
    return (
      <div className="lld-code-block">
        <p className="muted">No code content available.</p>
      </div>
    );
  }

  return (
    <div className="lld-code-block">
      {tokenizedLines.map((tokens, lineIndex) => (
        <div className="lld-code-line" key={`${language}-${lineIndex}`}>
          <span className="lld-line-no">{lineIndex + 1}</span>
          <span className="lld-line-content">
            {tokens.length === 0 ? <span className="tok-plain">{"\u00A0"}</span> : null}
            {tokens.map((token, tokenIndex) => (
              <span className={tokenClass(token.kind)} key={`${lineIndex}-${tokenIndex}-${token.value}`}>
                {token.value}
              </span>
            ))}
          </span>
        </div>
      ))}
    </div>
  );
}

export default function LldStudyClient({ entry }: LldStudyClientProps) {
  const allFiles = useMemo(() => groupFiles(entry), [entry]);
  const readmeSections = useMemo(() => parseReadmeSections(entry.readme ?? ""), [entry.readme]);
  const fileNameByPath = useMemo(
    () => new Map(allFiles.map((file) => [file.path, basename(file.path)])),
    [allFiles]
  );

  const grouped = useMemo(
    () => ({
      main: allFiles.filter((file) => file.kind === "main"),
      demo: allFiles.filter((file) => file.kind === "demo"),
      support: allFiles.filter((file) => file.kind === "support"),
      doc: allFiles.filter((file) => file.kind === "doc"),
    }),
    [allFiles]
  );

  const fileStats = useMemo(() => {
    const codeFiles = allFiles.filter((file) => file.kind !== "doc");
    const totalLines = codeFiles.reduce((sum, file) => sum + file.lineCount, 0);
    const deepReadMinutes = Math.max(8, Math.round(totalLines / 36));

    const foundation = allFiles.filter(
      (file) => file.kind !== "doc" && file.kind !== "demo" && file.dependencies.length === 0
    );
    const coreFlow = allFiles.filter(
      (file) => file.kind !== "doc" && file.kind !== "demo" && file.dependencies.length > 0
    );
    const demos = allFiles.filter((file) => file.kind === "demo");
    const docs = allFiles.filter((file) => file.kind === "doc");

    const arc = [
      {
        id: "foundation",
        title: "Foundation",
        subtitle: "Core entities and reusable contracts",
        tone: "calm",
        files: foundation,
      },
      {
        id: "composition",
        title: "Composition",
        subtitle: "Coordinators and control flow",
        tone: "focus",
        files: coreFlow,
      },
      {
        id: "execution",
        title: "Execution",
        subtitle: "Demo and run-path validation",
        tone: "accent",
        files: demos,
      },
    ];

    if (docs.length) {
      arc.push({
        id: "documentation",
        title: "Reference",
        subtitle: "Supporting docs and notes",
        tone: "muted",
        files: docs,
      });
    }

    return {
      totalLines,
      deepReadMinutes,
      arc,
    };
  }, [allFiles]);

  const jsonSnapshot = useMemo(
    () => ({
      id: entry.id,
      slug: entry.slug,
      title: entry.title,
      category: entry.category ?? "low-level-design",
      source: entry.source ?? {},
      summary: entry.summary ?? "",
      tags: entry.tags ?? [],
      files: {
        python: (entry.files?.python ?? []).map((file) => ({
          name: file.name,
          path: file.path,
          lines: countLines(file.content),
        })),
        other_docs: (entry.files?.other_docs ?? []).map((file) => ({
          name: file.name,
          path: file.path,
          lines: countLines(file.content),
        })),
      },
      main_files: entry.main_files ?? [],
      demo_files: entry.demo_files ?? [],
      combined_view_lines: countLines(entry.combined_view ?? ""),
    }),
    [entry]
  );

  const toc = useMemo(() => {
    const items = [
      { id: "source-json", label: "Source JSON" },
      { id: "design-overview", label: "Design Overview" },
      { id: "study-arc", label: "Study Arc" },
      { id: "file-structure", label: "File Structure" },
      { id: "code-walkthrough", label: "Code Walkthrough" },
    ];

    readmeSections.forEach((section) => {
      items.push({ id: section.id, label: section.title });
    });

    if ((entry.combined_view ?? "").trim()) {
      items.push({ id: "combined-view", label: "Combined View" });
    }

    return items;
  }, [entry.combined_view, readmeSections]);

  const language = entry.source?.language ?? "python";

  return (
    <main className="stack lld-study-page">
      <section className="panel lld-hero lld-section">
        <div className="row space-between">
          <h1 className="page-title">{entry.title}</h1>
          <Link href="/lld" className="button secondary">
            Back to catalog
          </Link>
        </div>
        <p className="muted">{entry.summary || "No summary available."}</p>
        <div className="chip-row">
          <span className="chip">{entry.category ?? "low-level-design"}</span>
          <span className="chip">{allFiles.length} files</span>
          <span className="chip">{fileStats.totalLines} lines</span>
          <span className="chip">~{fileStats.deepReadMinutes} min deep read</span>
          {(entry.tags ?? []).map((tag) => (
            <span className="chip" key={tag}>
              {tag}
            </span>
          ))}
        </div>
      </section>

      <section className="panel stack lld-section lld-toc-panel">
        <p className="label">On this page</p>
        <div className="chip-row lld-toc-chip-row">
          {toc.map((item) => (
            <a className="chip action" key={item.id} href={`#${item.id}`}>
              {item.label}
            </a>
          ))}
        </div>
      </section>

      <section className="panel stack lld-section" id="source-json">
        <h2>Source JSON Snapshot</h2>
        <p className="muted tiny">
          Parsed view of this record. The full code is rendered in the walkthrough sections below.
        </p>
        <pre className="lld-json-block">{JSON.stringify(jsonSnapshot, null, 2)}</pre>
      </section>

      <section className="panel stack lld-section" id="design-overview">
        <h2>Design Overview</h2>
        <div className="lld-meta-grid">
          <div className="lld-meta-item">
            <span className="label">ID</span>
            <span>{entry.id}</span>
          </div>
          <div className="lld-meta-item">
            <span className="label">Slug</span>
            <span>{entry.slug}</span>
          </div>
          <div className="lld-meta-item">
            <span className="label">Repository</span>
            <span>{entry.source?.repo ?? "unknown"}</span>
          </div>
          <div className="lld-meta-item">
            <span className="label">Base Path</span>
            <span>{entry.source?.base_path ?? "n/a"}</span>
          </div>
          <div className="lld-meta-item">
            <span className="label">Language</span>
            <span>{language}</span>
          </div>
          <div className="lld-meta-item">
            <span className="label">Main / Demo</span>
            <span>
              {(entry.main_files ?? []).length} / {(entry.demo_files ?? []).length}
            </span>
          </div>
        </div>
      </section>

      <section className="panel stack lld-section" id="study-arc">
        <h2>Study Arc</h2>
        <p className="muted tiny">
          Follow this sequence for cognitive load control: model first, orchestration second, execution last.
        </p>
        <div className="lld-arc-grid">
          {fileStats.arc.map((stage) => (
            <article className={`lld-arc-card tone-${stage.tone}`} key={stage.id}>
              <p className="label">{stage.title}</p>
              <p className="lld-arc-subtitle">{stage.subtitle}</p>
              <p className="lld-arc-meta">
                {stage.files.length} files · steps {stepRange(stage.files)}
              </p>
            </article>
          ))}
        </div>
      </section>

      {readmeSections.map((section) => (
        <section className="panel stack lld-section" id={section.id} key={section.id}>
          <h2>{section.title}</h2>
          <div className="lld-prose">{renderReadmeLines(section.lines, section.id)}</div>
        </section>
      ))}

      <section className="panel stack lld-section" id="file-structure">
        <h2>File Structure</h2>
        <p className="muted tiny">
          Ordered by dependency flow for study: foundational files first, then orchestrators, demo files last.
        </p>
        <div className="lld-file-grid">
          {(["main", "demo", "support", "doc"] as FileKind[]).map((kind) => {
            const items = grouped[kind];
            if (!items.length) {
              return null;
            }

            return (
              <article className="lld-file-group-card" key={kind}>
                <p className="label">
                  {humanFileKind(kind)} ({items.length})
                </p>
                <div className="lld-file-group-list">
                  {items.map((file) => (
                    <div
                      className={`lld-file-entry ${file.studyStep === 1 ? "entry" : ""} ${
                        file.kind === "demo" ? "demo" : ""
                      }`}
                      key={`map-${file.path}`}
                    >
                      <p>{basename(file.path)}</p>
                      <p className="muted tiny">
                        Step {formatStep(file.studyStep)} · {file.path} · {file.lineCount} lines
                      </p>
                      <p className="muted tiny lld-file-entry-meta">
                        {file.studyStep === 1 ? "Start here · " : ""}
                        Imports {file.dependencies.length} · Used by {file.dependentCount}
                      </p>
                      {file.dependencies.length ? (
                        <p className="muted tiny lld-file-connection">
                          depends on:{" "}
                          {file.dependencies.map((depPath) => fileNameByPath.get(depPath) ?? basename(depPath)).join(", ")}
                        </p>
                      ) : null}
                    </div>
                  ))}
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section className="stack lld-section-stack" id="code-walkthrough">
        <h2>Code Walkthrough</h2>
        {allFiles.length ? (
          allFiles.map((file) => (
            <article
              className={`panel lld-code-section lld-section ${file.studyStep === 1 ? "entry" : ""} ${
                file.kind === "demo" ? "demo" : ""
              }`}
              key={file.path}
              id={`file-${slugify(file.path)}`}
            >
              <div className="row space-between">
                <h3>{basename(file.path)}</h3>
                <span className="chip">step {formatStep(file.studyStep)} · {humanFileKind(file.kind)}</span>
              </div>
              <p className="muted tiny">
                {file.path} · {file.lineCount} lines
              </p>
              <p className="muted tiny lld-code-connection">
                {file.dependencies.length
                  ? `Depends on: ${file.dependencies
                      .map((depPath) => fileNameByPath.get(depPath) ?? basename(depPath))
                      .join(", ")}`
                  : "Depends on: none (foundation file)"}
              </p>
              <HighlightedCodeBlock content={file.content} language={file.language} />
            </article>
          ))
        ) : (
          <section className="panel lld-section">
            <p className="muted">No files available for this entry.</p>
          </section>
        )}
      </section>

      {(entry.combined_view ?? "").trim() ? (
        <section className="panel stack lld-section" id="combined-view">
          <h2>Combined View</h2>
          <p className="muted tiny">
            Unified dump from the source JSON. Useful for fast scan or copy.
          </p>
          <HighlightedCodeBlock content={entry.combined_view ?? ""} language="text" />
        </section>
      ) : null}
    </main>
  );
}
