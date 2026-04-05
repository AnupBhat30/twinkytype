import codingData from "@/data/coding-interview.json";

export interface CodingQuestion {
  id: string;
  slug: string;
  title: string;
  category: string;
  difficulty: "easy" | "medium" | "hard";
  problem: string;
  solution: string;
  explanation: string;
}

const questionBank = codingData as CodingQuestion[];

export function getAllCodingQuestions(): CodingQuestion[] {
  return questionBank;
}

export function getCodingQuestionBySlug(slug: string): CodingQuestion | undefined {
  return questionBank.find((question) => question.slug === slug);
}

export function getCodingQuestionById(id: string): CodingQuestion | undefined {
  return questionBank.find((question) => question.id === id);
}

export function getCodingQuestionsByCategory(category: string): CodingQuestion[] {
  return questionBank.filter((question) => question.category === category);
}

export function getCodingCategories(): string[] {
  const categories = new Set(questionBank.map((q) => q.category));
  return Array.from(categories).sort();
}

export function searchCodingQuestions(query: string): CodingQuestion[] {
  const lowerQuery = query.toLowerCase();
  return questionBank.filter(
    (q) =>
      q.title.toLowerCase().includes(lowerQuery) ||
      q.problem.toLowerCase().includes(lowerQuery) ||
      q.category.toLowerCase().includes(lowerQuery)
  );
}
