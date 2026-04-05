"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { CustomSnippet } from "@/lib/types";

interface CustomStore {
  snippets: Record<string, CustomSnippet>;
  addSnippet: (input: { title: string; language: string; code: string }) => string;
  removeSnippet: (id: string) => void;
  getSnippet: (id: string) => CustomSnippet | undefined;
}

function createSnippetId(): string {
  return `snippet-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export const useCustomStore = create<CustomStore>()(
  persist(
    (set, get) => ({
      snippets: {},

      addSnippet: ({ title, language, code }) => {
        const id = createSnippetId();
        const snippet: CustomSnippet = {
          id,
          title: title.trim() || "Custom Practice",
          language: language.trim() || "text",
          code,
          createdAt: Date.now(),
        };

        set((state) => ({
          snippets: {
            [id]: snippet,
            ...state.snippets,
          },
        }));

        return id;
      },

      removeSnippet: (id) => {
        set((state) => {
          const next = { ...state.snippets };
          delete next[id];
          return { snippets: next };
        });
      },

      getSnippet: (id) => get().snippets[id],
    }),
    {
      name: "twinkytype-custom-snippets",
    }
  )
);
