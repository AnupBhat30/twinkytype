"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useMemo, useState } from "react";
import { measureTextLayout, useObservedWidth } from "@/lib/pretext";
import { tokenizeLine, type TokenKind } from "@/lib/syntax";
import { useCustomStore } from "@/store/customStore";

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

export default function CustomSnippetForm() {
  const router = useRouter();
  const addSnippet = useCustomStore((state) => state.addSnippet);
  const snippets = useCustomStore((state) => state.snippets);

  const [title, setTitle] = useState("Custom Drill");
  const [language, setLanguage] = useState("python");
  const [repeats, setRepeats] = useState(4);
  const [includeTimedRound, setIncludeTimedRound] = useState(true);
  const [code, setCode] = useState("def solve(self, nums):\n    pass");
  const [error, setError] = useState("");
  const [scrollTop, setScrollTop] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);

  const recent = useMemo(() => Object.values(snippets).slice(0, 5), [snippets]);
  const codeField = useObservedWidth<HTMLTextAreaElement>();
  const codeHeight = useMemo(() => {
    if (!codeField.width) {
      return 180;
    }

    return Math.max(
      180,
      measureTextLayout({
        text: code,
        width: codeField.width,
        font: '16px "JetBrains Mono"',
        lineHeight: 24,
        whiteSpace: "pre-wrap",
        minLines: 10,
        extraHeight: 20,
      }).height
    );
  }, [code, codeField.width]);
  const highlightedLines = useMemo(() => {
    const lines = code.length ? code.split("\n") : [""];
    return lines.map((line) => tokenizeLine(line, language));
  }, [code, language]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!code.trim()) {
      setError("Paste code before starting practice.");
      return;
    }

    setError("");
    const id = addSnippet({ title, language, code });
    router.push(
      `/practice/custom/${id}?repeats=${Math.max(1, Math.min(12, repeats))}&timed=${includeTimedRound ? "1" : "0"}`
    );
  };

  return (
    <section className="panel">
      <h2>Paste Any Code</h2>
      <p className="muted">Bring any snippet, then run repeat rounds the same way as Blind 75 questions.</p>

      <form className="stack" onSubmit={handleSubmit}>
        <div className="cards-grid">
          <label className="stack">
            <span className="muted label">Title</span>
            <input className="input" value={title} onChange={(event) => setTitle(event.target.value)} />
          </label>

          <label className="stack">
            <span className="muted label">Language</span>
            <input className="input" value={language} onChange={(event) => setLanguage(event.target.value)} />
          </label>

          <label className="stack">
            <span className="muted label">Repeats</span>
            <input
              className="input"
              type="number"
              min={1}
              max={12}
              value={repeats}
              onChange={(event) => setRepeats(Number(event.target.value) || 4)}
            />
          </label>
        </div>

        <label className="stack">
          <span className="muted label">Code to practice</span>
          <div className="code-input-shell" style={{ height: `${codeHeight}px` }}>
            <pre
              aria-hidden
              className="code-input-highlight"
              style={{ transform: `translate(${-scrollLeft}px, ${-scrollTop}px)` }}
            >
              {highlightedLines.map((tokens, index) => (
                <div className="code-input-line" key={`custom-code-line-${index}`}>
                  {tokens.length ? (
                    tokens.map((token, tokenIndex) => (
                      <span className={tokenClass(token.kind)} key={`custom-code-token-${index}-${tokenIndex}`}>
                        {token.value}
                      </span>
                    ))
                  ) : (
                    <span className="tok-plain">{"\u00A0"}</span>
                  )}
                </div>
              ))}
            </pre>
            <textarea
              className="input textarea code-input-textarea"
              ref={codeField.ref}
              value={code}
              onChange={(event) => setCode(event.target.value)}
              onScroll={(event) => {
                setScrollTop(event.currentTarget.scrollTop);
                setScrollLeft(event.currentTarget.scrollLeft);
              }}
              spellCheck={false}
              rows={10}
              style={{ height: `${codeHeight}px` }}
            />
          </div>
        </label>

        <label className="row">
          <input
            type="checkbox"
            checked={includeTimedRound}
            onChange={(event) => setIncludeTimedRound(event.target.checked)}
          />
          <span className="muted">Include timed final round</span>
        </label>

        {error ? <p className="muted">{error}</p> : null}

        <div className="row">
          <button className="button" type="submit">
            Start custom practice
          </button>
        </div>
      </form>

      {recent.length > 0 ? (
        <div className="stack">
          <h3>Recent snippets</h3>
          <div className="cards-grid">
            {recent.map((snippet) => (
              <article className="card" key={snippet.id}>
                <h3>{snippet.title}</h3>
                <p className="muted">{snippet.language}</p>
                <Link className="button secondary" href={`/practice/custom/${snippet.id}?repeats=4&timed=1`}>
                  Practice again
                </Link>
              </article>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}
