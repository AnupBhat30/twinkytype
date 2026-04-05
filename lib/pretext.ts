import { layout, prepare, type PrepareOptions } from "@chenglou/pretext";
import { useEffect, useMemo, useState } from "react";

interface TextLayoutOptions {
  text: string;
  width: number;
  font: string;
  lineHeight: number;
  whiteSpace?: PrepareOptions["whiteSpace"];
  minLines?: number;
  extraHeight?: number;
}

interface TextStackOptions {
  texts: string[];
  width: number;
  font: string;
  lineHeight: number;
  gap?: number;
  whiteSpace?: PrepareOptions["whiteSpace"];
  extraHeight?: number;
}

export function measureTextLayout({
  text,
  width,
  font,
  lineHeight,
  whiteSpace = "normal",
  minLines = 1,
  extraHeight = 0,
}: TextLayoutOptions): { height: number; lineCount: number } {
  const safeWidth = Math.max(1, width);
  const prepared = prepare(text.length ? text : " ", font, { whiteSpace });
  const result = layout(prepared, safeWidth, lineHeight);
  const lineCount = Math.max(minLines, result.lineCount || 1);

  return {
    height: Math.ceil(lineCount * lineHeight + extraHeight),
    lineCount,
  };
}

export function measureTextStack({
  texts,
  width,
  font,
  lineHeight,
  gap = 0,
  whiteSpace = "normal",
  extraHeight = 0,
}: TextStackOptions): { height: number; lineCount: number } {
  if (!texts.length) {
    return { height: Math.ceil(lineHeight + extraHeight), lineCount: 1 };
  }

  let totalHeight = extraHeight;
  let totalLines = 0;

  texts.forEach((text, index) => {
    const result = measureTextLayout({
      text,
      width,
      font,
      lineHeight,
      whiteSpace,
    });

    totalHeight += result.height;
    totalLines += result.lineCount;

    if (index < texts.length - 1) {
      totalHeight += gap;
    }
  });

  return {
    height: Math.ceil(totalHeight),
    lineCount: totalLines,
  };
}

export function useObservedWidth<T extends HTMLElement>(): {
  ref: (node: T | null) => void;
  width: number;
} {
  const [node, setNode] = useState<T | null>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    if (!node || typeof ResizeObserver === "undefined") {
      return;
    }

    const observer = new ResizeObserver((entries) => {
      const nextWidth = entries[0]?.contentRect.width ?? 0;
      setWidth((current) => (Math.abs(current - nextWidth) > 0.5 ? nextWidth : current));
    });

    observer.observe(node);
    return () => observer.disconnect();
  }, [node]);

  return useMemo(
    () => ({
      ref: setNode,
      width,
    }),
    [width]
  );
}
