"use client";

import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react";
import type { KeyboardEvent, ReactNode, RefObject } from "react";
import { diffCode, normalizeCode, type CharState } from "@/lib/diff-engine";
import {
  buildEnterInsertion,
  buildPrintableInsertion,
  buildTabInsertion,
} from "@/lib/editor-behavior";
import { initialInputState, inputReducer } from "@/lib/input-controller";
import { measureTextLayout, useObservedWidth } from "@/lib/pretext";
import { buildPracticeCode } from "@/lib/practice-code";
import { computeSessionStats } from "@/lib/stats";
import {
  detectLanguageFamily,
  type TokenKind,
  tokenizeLine,
} from "@/lib/syntax";
import type { PracticeMode, SessionStats } from "@/lib/types";
import StatsOverlay from "@/components/StatsOverlay";

interface CodeTypingAreaProps {
  expectedCode: string;
  mode: PracticeMode;
  language?: string;
  timedLimitSec?: number;
  onComplete: (result: {
    stats: SessionStats;
    elapsedMs: number;
    typedValue: string;
  }) => void;
}

const HIDDEN_MODES: PracticeMode[] = ["blank", "timed", "fill-blank"];
type RenderSurface = "normal" | "flow";

function maskEveryOtherLine(source: string): string {
  return source
    .split("\n")
    .map((line, index) => {
      if (index % 2 === 1 && line.trim().length) {
        return "____";
      }
      return line;
    })
    .join("\n");
}

function getCharClass(
  state: "pending" | "correct" | "incorrect" | "extra" | "missed",
): string {
  switch (state) {
    case "correct":
      return "char-correct";
    case "incorrect":
      return "char-incorrect";
    case "extra":
      return "char-extra";
    case "missed":
      return "char-missed";
    default:
      return "char-pending";
  }
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

function modeName(mode: PracticeMode): string {
  switch (mode) {
    case "ghost":
      return "Ghost Mode";
    case "fill-blank":
      return "Fill Gap Mode";
    case "timed":
      return "Recall Mode";
    default:
      return "Blank Mode";
  }
}

function modeCoach(mode: PracticeMode): string {
  switch (mode) {
    case "ghost":
      return "Follow structure precisely. Lock syntax rhythm into muscle memory.";
    case "fill-blank":
      return "Rebuild the hidden tokens without peeking at full code.";
    case "timed":
      return "Recall from memory only. Prioritize flow over perfection.";
    default:
      return "Rebuild from memory. If you hesitate, restart the thought chain.";
  }
}

function lineProgress(
  expected: string,
  typed: string,
): { status: "done" | "partial" | "pending"; score: number }[] {
  const expectedLines = expected.split("\n");
  const typedLines = typed.split("\n");

  return expectedLines.map((expectedLine, index) => {
    const typedLine = typedLines[index] ?? "";
    const maxLen = Math.max(1, expectedLine.length, typedLine.length);
    let correct = 0;

    for (let i = 0; i < maxLen; i += 1) {
      if ((expectedLine[i] ?? "") === (typedLine[i] ?? "")) {
        correct += 1;
      }
    }

    const score = correct / maxLen;
    if (score >= 0.98) {
      return { status: "done", score };
    }
    if (typedLine.length > 0) {
      return { status: "partial", score };
    }
    return { status: "pending", score };
  });
}

function lineStatusClass(status: "done" | "partial" | "pending"): string {
  switch (status) {
    case "done":
      return "line-status done";
    case "partial":
      return "line-status partial";
    default:
      return "line-status pending";
  }
}

function lineFocusClass(index: number, current: number): string {
  const distance = Math.abs(index - current);
  if (distance === 0) {
    return "focus-current";
  }
  if (distance === 1) {
    return "focus-near";
  }
  return "focus-far";
}

function buildRhythm(events: { timestamp: number }[]): {
  score: number;
  bars: number[];
} {
  if (events.length < 3) {
    return { score: 100, bars: Array.from({ length: 12 }, () => 0.35) };
  }

  const intervals: number[] = [];
  for (let i = 1; i < events.length; i += 1) {
    intervals.push(Math.max(1, events[i].timestamp - events[i - 1].timestamp));
  }

  const recent = intervals.slice(-24);
  const sorted = [...recent].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)] ?? 1;

  const qualities = recent.map((gap) =>
    Math.max(0, 1 - Math.abs(gap - median) / Math.max(median, 1)),
  );
  const score = Math.round(
    (qualities.reduce((a, b) => a + b, 0) / qualities.length) * 100,
  );

  const bars = recent.slice(-12).map((gap) => {
    const pace = Math.max(0.12, Math.min(1, median / gap));
    return Number(pace.toFixed(2));
  });
  while (bars.length < 12) {
    bars.unshift(0.25);
  }

  return { score, bars };
}

function renderTokensWithCaret(
  tokens: { value: string; kind: TokenKind }[],
  lineStart: number,
  caretPosition: number,
  caretRef: RefObject<HTMLSpanElement | null>,
): ReactNode[] {
  const parts: ReactNode[] = [];
  let offset = lineStart;
  const caretLine =
    caretPosition >= lineStart &&
    caretPosition <=
      lineStart + tokens.reduce((sum, token) => sum + token.value.length, 0);
  let insertedCaret = false;

  tokens.forEach((token, tokenIndex) => {
    const tokenStart = offset;
    const tokenEnd = tokenStart + token.value.length;

    if (
      caretLine &&
      !insertedCaret &&
      caretPosition >= tokenStart &&
      caretPosition <= tokenEnd
    ) {
      const splitIndex = caretPosition - tokenStart;
      const before = token.value.slice(0, splitIndex);
      const after = token.value.slice(splitIndex);

      if (before) {
        parts.push(
          <span
            className={tokenClass(token.kind)}
            key={`token-before-${tokenIndex}`}
          >
            {before}
          </span>,
        );
      }

      parts.push(
        <span ref={caretRef} className="caret" key={`caret-${tokenIndex}`} />,
      );

      if (after) {
        parts.push(
          <span
            className={tokenClass(token.kind)}
            key={`token-after-${tokenIndex}`}
          >
            {after}
          </span>,
        );
      }

      insertedCaret = true;
    } else {
      parts.push(
        <span className={tokenClass(token.kind)} key={`token-${tokenIndex}`}>
          {token.value}
        </span>,
      );
    }

    offset = tokenEnd;
  });

  if (!insertedCaret && caretPosition === lineStart) {
    parts.unshift(<span ref={caretRef} className="caret" key="caret-start" />);
    insertedCaret = true;
  }

  if (!insertedCaret && caretLine) {
    parts.push(<span ref={caretRef} className="caret" key="caret-end" />);
  }

  return parts;
}

function renderFlowTokens(
  tokens: { value: string; kind: TokenKind }[],
  lineStart: number,
  states: CharState[],
  typedValue: string,
  caretPosition: number,
  caretRef: RefObject<HTMLSpanElement | null>,
): ReactNode[] {
  const parts: ReactNode[] = [];
  let offset = lineStart;

  tokens.forEach((token, tokenIndex) => {
    for (let charIndex = 0; charIndex < token.value.length; charIndex += 1) {
      const absoluteIndex = offset + charIndex;
      const expectedChar = token.value[charIndex] ?? "";
      const typedChar = typedValue[absoluteIndex] ?? "";
      const charState = states[absoluteIndex] ?? "pending";
      const displayChar =
        charState === "incorrect" && typedChar
          ? typedChar
          : expectedChar === " "
            ? "\u00A0"
            : expectedChar;

      if (caretPosition === absoluteIndex) {
        parts.push(
          <span
            ref={caretRef}
            className="caret flow-caret"
            key={`flow-caret-${tokenIndex}-${charIndex}`}
          />,
        );
      }

      parts.push(
        <span
          className={`${tokenClass(token.kind)} flow-char ${getCharClass(charState)}`}
          key={`flow-char-${tokenIndex}-${charIndex}`}
        >
          {displayChar}
        </span>,
      );
    }

    offset += token.value.length;
  });

  if (
    caretPosition ===
    lineStart + tokens.reduce((sum, token) => sum + token.value.length, 0)
  ) {
    parts.push(
      <span
        ref={caretRef}
        className="caret flow-caret"
        key={`flow-caret-end-${lineStart}`}
      />,
    );
  }

  return parts;
}

export default function CodeTypingArea({
  expectedCode,
  mode,
  language = "text",
  timedLimitSec = 180,
  onComplete,
}: CodeTypingAreaProps) {
  const normalizedExpected = useMemo(
    () => normalizeCode(expectedCode),
    [expectedCode],
  );
  const practicePrepared = useMemo(
    () => buildPracticeCode(normalizedExpected, language),
    [language, normalizedExpected],
  );
  const practiceExpected = useMemo(() => {
    const normalized = normalizeCode(practicePrepared.code);
    return normalized.length ? normalized : normalizedExpected;
  }, [normalizedExpected, practicePrepared.code]);
  const fillBlankTemplate = useMemo(
    () => maskEveryOtherLine(practiceExpected),
    [practiceExpected],
  );
  const languageFamily = useMemo(
    () => detectLanguageFamily(language),
    [language],
  );

  const [inputState, dispatch] = useReducer(inputReducer, initialInputState);
  const [now, setNow] = useState(Date.now());
  const [showComments, setShowComments] = useState(true);
  const [renderSurface, setRenderSurface] = useState<RenderSurface>("normal");

  const containerRef = useRef<HTMLDivElement>(null);
  const caretRef = useRef<HTMLSpanElement>(null);
  const completedRef = useRef(false);

  const liveDiff = useMemo(
    () => diffCode(practiceExpected, inputState.typedValue),
    [practiceExpected, inputState.typedValue],
  );

  const elapsedMs = inputState.startTime
    ? Math.max(0, now - inputState.startTime)
    : 0;
  const remainingSec =
    mode === "timed" && inputState.startTime
      ? Math.max(0, Math.ceil((timedLimitSec * 1000 - elapsedMs) / 1000))
      : undefined;

  const liveStats = useMemo(() => {
    return computeSessionStats({
      correctChars: liveDiff.correctCount,
      allChars: Math.max(1, inputState.keystrokeLog.length),
      correctLines: liveDiff.correctLines,
      elapsedMs: Math.max(elapsedMs, 1000),
      incorrect: liveDiff.incorrectCount,
      extra: liveDiff.extraCount,
      missed: liveDiff.missedCount,
      events: inputState.keystrokeLog,
      expectedCode: practiceExpected,
      typedCode: inputState.typedValue,
    });
  }, [
    elapsedMs,
    inputState.keystrokeLog,
    inputState.typedValue,
    liveDiff,
    practiceExpected,
  ]);

  const finalize = useCallback(() => {
    if (completedRef.current || !inputState.startTime) {
      return;
    }

    completedRef.current = true;
    dispatch({ type: "COMPLETE" });

    const endedAt = Date.now();
    const totalElapsed = Math.max(1, endedAt - inputState.startTime);
    const finalDiff = diffCode(practiceExpected, inputState.typedValue);

    const stats = computeSessionStats({
      correctChars: finalDiff.correctCount,
      allChars: Math.max(1, inputState.keystrokeLog.length),
      correctLines: finalDiff.correctLines,
      elapsedMs: totalElapsed,
      incorrect: finalDiff.incorrectCount,
      extra: finalDiff.extraCount,
      missed: finalDiff.missedCount,
      events: inputState.keystrokeLog,
      expectedCode: practiceExpected,
      typedCode: inputState.typedValue,
    });

    onComplete({
      stats,
      elapsedMs: totalElapsed,
      typedValue: inputState.typedValue,
    });
  }, [
    inputState.keystrokeLog,
    inputState.startTime,
    inputState.typedValue,
    onComplete,
    practiceExpected,
  ]);

  useEffect(() => {
    containerRef.current?.focus();
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 200);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const stored = window.localStorage.getItem("twinkytype-render-surface");
    if (stored === "normal" || stored === "flow") {
      setRenderSurface(stored);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem("twinkytype-render-surface", renderSurface);
  }, [renderSurface]);

  useEffect(() => {
    caretRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [inputState.caretPosition]);

  useEffect(() => {
    if (
      !completedRef.current &&
      inputState.startTime &&
      inputState.typedValue.length >= practiceExpected.length
    ) {
      finalize();
    }
  }, [
    finalize,
    inputState.startTime,
    inputState.typedValue.length,
    practiceExpected.length,
  ]);

  useEffect(() => {
    if (
      !completedRef.current &&
      mode === "timed" &&
      inputState.startTime &&
      (remainingSec ?? 1) <= 0
    ) {
      finalize();
    }
  }, [finalize, inputState.startTime, mode, remainingSec]);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      if (event.metaKey || event.ctrlKey || event.altKey) {
        return;
      }

      const key = event.key;
      const printable = key.length === 1 || key === "Enter" || key === "Tab";

      if (!printable && key !== "Backspace") {
        return;
      }

      event.preventDefault();

      if (!inputState.isActive) {
        dispatch({ type: "START" });
      }

      if (key === "Backspace") {
        dispatch({ type: "BACKSPACE" });
        return;
      }

      const cursor = inputState.caretPosition;
      let insertion = "";
      let expectedSlice = practiceExpected.slice(cursor, cursor + 1);
      let caretAdvance: number | undefined;

      if (key === "Enter") {
        insertion = buildEnterInsertion({
          typed: inputState.typedValue,
          expected: practiceExpected,
          cursor,
          language,
        });
      } else if (key === "Tab") {
        insertion = buildTabInsertion({
          typed: inputState.typedValue,
          expected: practiceExpected,
          cursor,
        });
      } else {
        const printableInsertion = buildPrintableInsertion({
          typed: inputState.typedValue,
          expected: practiceExpected,
          cursor,
          key,
        });
        insertion = printableInsertion.text;
        expectedSlice = printableInsertion.expected;
        caretAdvance = printableInsertion.caretAdvance;
      }

      if (key === "Enter" || key === "Tab") {
        expectedSlice = practiceExpected.slice(
          cursor,
          cursor + insertion.length,
        );
      }

      dispatch({
        type: "INSERT",
        text: insertion,
        expected: expectedSlice,
        caretAdvance,
      });
    },
    [
      inputState.caretPosition,
      inputState.isActive,
      inputState.typedValue,
      language,
      practiceExpected,
    ],
  );

  const highlightedLines = useMemo(() => {
    const lines = inputState.typedValue.length
      ? inputState.typedValue.split("\n")
      : [""];
    return lines.map((line) => tokenizeLine(line, language));
  }, [inputState.typedValue, language]);
  const highlightedLineStarts = useMemo(() => {
    let offset = 0;
    return highlightedLines.map((tokens) => {
      const lineStart = offset;
      const lineLength = tokens.reduce(
        (sum, token) => sum + token.value.length,
        0,
      );
      offset += lineLength + 1;
      return lineStart;
    });
  }, [highlightedLines]);
  const flowLines = useMemo(() => {
    const lines = practiceExpected.length ? practiceExpected.split("\n") : [""];
    return lines.map((line) => tokenizeLine(line, language));
  }, [language, practiceExpected]);
  const flowLineStarts = useMemo(() => {
    let offset = 0;
    return flowLines.map((tokens) => {
      const lineStart = offset;
      const lineLength = tokens.reduce(
        (sum, token) => sum + token.value.length,
        0,
      );
      offset += lineLength + 1;
      return lineStart;
    });
  }, [flowLines]);
  const flowCharStates = useMemo(
    () => liveDiff.chars.map((char) => char.state),
    [liveDiff.chars],
  );
  const flowExtraChars = useMemo(
    () =>
      liveDiff.chars
        .filter((char) => char.state === "extra" && char.typed)
        .map((char) => (char.typed === " " ? "\u00A0" : (char.typed ?? ""))),
    [liveDiff.chars],
  );
  const flowCaretLineIndex = useMemo(() => {
    const capped = Math.min(inputState.caretPosition, practiceExpected.length);
    return Math.max(
      0,
      practiceExpected.slice(0, capped).split("\n").length - 1,
    );
  }, [inputState.caretPosition, practiceExpected]);

  const lineScores = useMemo(
    () => lineProgress(practiceExpected, inputState.typedValue),
    [practiceExpected, inputState.typedValue],
  );
  const currentLineIndex = useMemo(
    () =>
      Math.max(
        0,
        inputState.typedValue.slice(0, inputState.caretPosition).split("\n")
          .length - 1,
      ),
    [inputState.caretPosition, inputState.typedValue],
  );
  const rhythm = useMemo(
    () => buildRhythm(inputState.keystrokeLog),
    [inputState.keystrokeLog],
  );
  const ghostSurface = useObservedWidth<HTMLPreElement>();
  const fillBlankSurface = useObservedWidth<HTMLPreElement>();
  const ghostMinHeight = useMemo(() => {
    if (!ghostSurface.width) {
      return 200;
    }

    return Math.max(
      200,
      measureTextLayout({
        text: practiceExpected,
        width: ghostSurface.width,
        font: '16px "JetBrains Mono"',
        lineHeight: 26,
        whiteSpace: "pre-wrap",
        minLines: 8,
        extraHeight: 12,
      }).height,
    );
  }, [ghostSurface.width, practiceExpected]);
  const fillBlankMinHeight = useMemo(() => {
    if (!fillBlankSurface.width) {
      return 200;
    }

    return Math.max(
      200,
      measureTextLayout({
        text: fillBlankTemplate,
        width: fillBlankSurface.width,
        font: '16px "JetBrains Mono"',
        lineHeight: 26,
        whiteSpace: "pre-wrap",
        minLines: 8,
        extraHeight: 12,
      }).height,
    );
  }, [fillBlankSurface.width, fillBlankTemplate]);

  const hesitationLine = liveStats.insights.hesitationLine;
  const hesitationActive = liveStats.insights.maxHesitationMs >= 1200;
  const progressMeta = inputState.typedValue.length
    ? `${liveStats.insights.progress}%`
    : "Ready";

  return (
    <section
      className="panel typing"
      ref={containerRef}
      tabIndex={0}
      onKeyDown={handleKeyDown}
    >
      <div className="typing-head-zone">
        <StatsOverlay
          elapsedMs={elapsedMs}
          stats={liveStats}
          timedRemainingSec={remainingSec}
          modeLabel={modeName(mode)}
        />
      </div>

      <div className="typing-sub-zone">
        <p className="muted tiny">
          {modeName(mode)} · {language} · smart indent ({languageFamily})
        </p>
        <div className="typing-sub-actions">
          <p className="muted tiny">
            {modeCoach(mode)}
            {practicePrepared.skippedLineComments > 0
              ? ` Comments skipped: ${practicePrepared.skippedLineComments}.`
              : ""}
          </p>
          <div
            className="surface-toggle"
            role="tablist"
            aria-label="Typing surface"
          >
            <button
              className={`surface-chip ${renderSurface === "normal" ? "active" : ""}`}
              type="button"
              onClick={() => setRenderSurface("normal")}
            >
              normal
            </button>
            <button
              className={`surface-chip ${renderSurface === "flow" ? "active" : ""}`}
              type="button"
              onClick={() => setRenderSurface("flow")}
            >
              flow
            </button>
          </div>
          {practicePrepared.commentLines.length > 0 ? (
            <button
              className="comment-toggle"
              type="button"
              onClick={() => setShowComments((value) => !value)}
            >
              {showComments ? "hide comments" : "show comments"}
            </button>
          ) : null}
        </div>
      </div>

      {showComments && practicePrepared.commentLines.length > 0 ? (
        <div className="comment-reference">
          <p className="muted label">Comment Reference (Skipped In Typing)</p>
          <div className="comment-reference-list">
            {practicePrepared.commentLines.map((comment, index) => (
              <p
                className="comment-reference-line"
                key={`${comment.line}-${index}`}
              >
                <span className="comment-line-no">L{comment.line}</span>
                <span>{comment.text}</span>
              </p>
            ))}
          </div>
        </div>
      ) : null}

      {mode === "fill-blank" ? (
        <div className="hint-template">
          <p className="muted label">Structure Preview</p>
          <pre
            ref={fillBlankSurface.ref}
            style={{ minHeight: `${fillBlankMinHeight}px` }}
          >
            {fillBlankTemplate}
          </pre>
        </div>
      ) : null}

      <div className="typing-main-zone">
        {renderSurface === "flow" ? (
          <div className="flow-frame">
            <div className="flow-toolbar">
              <p className="flow-toolbar-title">Flow</p>
              <p className="flow-toolbar-meta">{progressMeta}</p>
            </div>
            <div className="flow-progress-track">
              <span style={{ width: `${liveStats.insights.progress}%` }} />
            </div>
            <div className="flow-surface">
              {flowLines.map((tokens, index) => {
                const progress = lineScores[index] ?? {
                  status: "pending",
                  score: 0,
                };
                const focus = lineFocusClass(index, flowCaretLineIndex);
                const hesitant =
                  hesitationActive && hesitationLine === index + 1;
                const lineStart = flowLineStarts[index] ?? 0;

                return (
                  <div
                    className={`flow-line ${focus} ${hesitant ? "hesitation-hot" : ""}`}
                    key={`flow-line-${index}`}
                  >
                    <span className="flow-gutter">
                      <span className={lineStatusClass(progress.status)} />
                      <span>{index + 1}</span>
                    </span>
                    <span className="flow-content">
                      {renderFlowTokens(
                        tokens,
                        lineStart,
                        flowCharStates,
                        inputState.typedValue,
                        inputState.caretPosition,
                        caretRef,
                      )}
                    </span>
                  </div>
                );
              })}
              {flowExtraChars.length > 0 ? (
                <div className="flow-line flow-extra-line">
                  <span className="flow-gutter">
                    <span className="line-status partial" />
                    <span>+</span>
                  </span>
                  <span className="flow-content">
                    {flowExtraChars.map((char, index) => (
                      <span
                        className="flow-char char-extra tok-plain"
                        key={`flow-extra-${index}`}
                      >
                        {char}
                      </span>
                    ))}
                    {inputState.caretPosition > practiceExpected.length ? (
                      <span ref={caretRef} className="caret flow-caret" />
                    ) : null}
                  </span>
                </div>
              ) : null}
            </div>
          </div>
        ) : HIDDEN_MODES.includes(mode) ? (
          <div className="editor-frame">
            <div className="editor-toolbar">
              <div className="editor-dots" aria-hidden>
                <span />
                <span />
                <span />
              </div>
              <p className="editor-toolbar-title">Precision Canvas</p>
              <p className="editor-toolbar-meta">{progressMeta}</p>
            </div>

            <div className="editor-progress-track">
              <span style={{ width: `${liveStats.insights.progress}%` }} />
            </div>

            <div className="code-editor">
              {highlightedLines.map((tokens, index) => {
                const lineHasText = tokens.some(
                  (token) => token.value.length > 0,
                );
                const progress = lineScores[index] ?? {
                  status: "pending",
                  score: 0,
                };
                const hesitant =
                  hesitationActive && hesitationLine === index + 1;
                const focus = lineFocusClass(index, currentLineIndex);
                const lineStart = highlightedLineStarts[index] ?? 0;

                return (
                  <div
                    className={`editor-line ${hesitant ? "hesitation-hot" : ""} ${focus}`}
                    key={`typed-line-${index}`}
                  >
                    <span className="editor-gutter">
                      <span className={lineStatusClass(progress.status)} />
                      <span>{index + 1}</span>
                    </span>
                    <span className="editor-content">
                      {lineHasText
                        ? renderTokensWithCaret(
                            tokens,
                            lineStart,
                            inputState.caretPosition,
                            caretRef,
                          ).map((part, partIndex) => (
                            <Fragment key={`line-${index}-part-${partIndex}`}>
                              {part}
                            </Fragment>
                          ))
                        : null}
                      {!lineHasText ? (
                        inputState.caretPosition === lineStart ? (
                          <>
                            <span ref={caretRef} className="caret" />
                            <span className="tok-plain">{"\u00A0"}</span>
                          </>
                        ) : (
                          <span className="tok-plain">{"\u00A0"}</span>
                        )
                      ) : null}
                    </span>
                  </div>
                );
              })}
              {!inputState.typedValue.length ? (
                <p className="editor-placeholder">
                  Start typing from memory...
                </p>
              ) : null}
            </div>

            <div className="editor-rhythm">
              <p className="editor-rhythm-label">Rhythm {rhythm.score}%</p>
              <div className="rhythm-bars">
                {rhythm.bars.map((value, index) => (
                  <span
                    key={`rhythm-${index}`}
                    style={{ height: `${Math.round(value * 100)}%` }}
                  />
                ))}
              </div>
            </div>
          </div>
        ) : (
          <pre
            className="ghost-surface"
            ref={ghostSurface.ref}
            style={{ minHeight: `${ghostMinHeight}px` }}
          >
            {liveDiff.chars.map((char, index) => {
              const symbol =
                char.expected === "\n"
                  ? "\n"
                  : char.expected || char.typed || "";
              return (
                <span
                  key={`${index}-${symbol}`}
                  className={getCharClass(char.state)}
                >
                  {index === inputState.caretPosition ? (
                    <span ref={caretRef} className="caret" />
                  ) : null}
                  {char.expected === "\n" ? <br /> : symbol}
                </span>
              );
            })}
            {inputState.caretPosition >= liveDiff.chars.length ? (
              <span ref={caretRef} className="caret" />
            ) : null}
          </pre>
        )}
      </div>

      <div className="typing-foot-zone">
        <p className="muted tiny">
          {hesitationActive && hesitationLine
            ? `Longest hesitation detected around line ${hesitationLine}. Rebuild that transition once before advancing.`
            : "Keep a steady rhythm. Tab and Enter follow expected structure automatically."}
        </p>
      </div>
    </section>
  );
}
