"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { createNewCard, sm2Update } from "@/lib/sm2";
import type { ProgressMap, SessionEvent, SM2Card } from "@/lib/types";

interface SessionStore {
  cards: ProgressMap;
  sessionHistory: SessionEvent[];
  getCardForQuestion: (id: string) => SM2Card;
  rateQuestion: (questionId: string, quality: number, timeMs: number) => void;
  getDueToday: () => string[];
  addSessionEvent: (event: SessionEvent) => void;
  clearHistory: () => void;
}

function today(): string {
  return new Date().toISOString().split("T")[0];
}

export const useSessionStore = create<SessionStore>()(
  persist(
    (set, get) => ({
      cards: {},
      sessionHistory: [],

      getCardForQuestion: (id) => {
        return get().cards[id] ?? createNewCard(id);
      },

      rateQuestion: (questionId, quality, timeMs) => {
        const existingCard = get().getCardForQuestion(questionId);
        const updated = sm2Update(existingCard, quality, timeMs);

        set((state) => ({
          cards: {
            ...state.cards,
            [questionId]: updated,
          },
        }));
      },

      getDueToday: () => {
        const now = today();

        return Object.values(get().cards)
          .filter((card) => card.nextReview <= now)
          .map((card) => card.questionId);
      },

      addSessionEvent: (event) => {
        set((state) => ({
          sessionHistory: [event, ...state.sessionHistory].slice(0, 500),
        }));
      },

      clearHistory: () => {
        set({ sessionHistory: [] });
      },
    }),
    {
      name: "twinkytype-progress",
      partialize: (state) => ({ cards: state.cards, sessionHistory: state.sessionHistory }),
    }
  )
);
