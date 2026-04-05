import Link from "next/link";
import {
  getCodingCategories,
  getAllCodingQuestions,
} from "@/lib/coding-interview";

export default function CodingInterviewPage() {
  const questions = getAllCodingQuestions();
  const categories = getCodingCategories();

  // Group questions by category
  const questionsByCategory = categories.reduce(
    (acc, category) => {
      acc[category] = questions.filter((q) => q.category === category);
      return acc;
    },
    {} as Record<string, typeof questions>,
  );

  return (
    <main className="stack">
      <section className="panel">
        <h1 className="page-title">JavaScript & Coding Interview</h1>
        <p className="muted">
          Master coding interview fundamentals. Pick a question and practice
          multiple times until you can answer it from memory.
        </p>
        <div className="row">
          <Link className="button secondary" href="/">
            Back home
          </Link>
        </div>
      </section>

      {categories.map((category) => (
        <section key={category} className="stack">
          <h2>{category}</h2>
          <div className="cards-grid">
            {questionsByCategory[category].map((question) => (
              <article className="card" key={question.id}>
                <h3>{question.title}</h3>
                <div
                  style={{
                    display: "flex",
                    gap: "0.5rem",
                    marginTop: "0.5rem",
                  }}
                >
                  <span
                    className="muted"
                    style={{
                      fontSize: "0.85rem",
                      padding: "0.25rem 0.5rem",
                      backgroundColor:
                        question.difficulty === "easy"
                          ? "rgba(34, 197, 94, 0.1)"
                          : question.difficulty === "medium"
                            ? "rgba(234, 179, 8, 0.1)"
                            : "rgba(239, 68, 68, 0.1)",
                      color:
                        question.difficulty === "easy"
                          ? "rgb(34, 197, 94)"
                          : question.difficulty === "medium"
                            ? "rgb(234, 179, 8)"
                            : "rgb(239, 68, 68)",
                      borderRadius: "4px",
                      fontWeight: "500",
                    }}
                  >
                    {question.difficulty}
                  </span>
                </div>
                <div className="row" style={{ marginTop: "1rem" }}>
                  <Link
                    className="button"
                    href={`/coding/${question.slug}?repeats=4&timed=1`}
                  >
                    Repeat x4
                  </Link>
                  <Link
                    className="button secondary"
                    href={`/coding/${question.slug}?repeats=6&timed=1`}
                  >
                    Sprint x6
                  </Link>
                </div>
              </article>
            ))}
          </div>
        </section>
      ))}
    </main>
  );
}
