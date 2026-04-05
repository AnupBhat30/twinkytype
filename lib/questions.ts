import questions from "@/data/blind75.json";
import type { Question } from "@/lib/types";

const questionBank = questions as Question[];

export function getAllQuestions(): Question[] {
  return questionBank;
}

export function getQuestionBySlug(slug: string): Question | undefined {
  return questionBank.find((question) => question.slug === slug);
}

export function getQuestionById(id: string): Question | undefined {
  return questionBank.find((question) => question.id === id);
}
