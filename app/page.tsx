import Link from "next/link";
import CustomSnippetForm from "@/components/CustomSnippetForm";
import { getAllQuestions } from "@/lib/questions";

export default function HomePage() {
  const questions = getAllQuestions();

  return (
    <main className="stack">
      <section className="panel">
        <h1 className="page-title">TwinkyType</h1>
        <p className="muted">
          Repetition-first coding practice. Pick one problem and run it multiple
          times in a row until the implementation pathway is automatic.
        </p>
        <div className="row">
          <Link className="button" href="/review">
            Review queue
          </Link>
          <Link className="button secondary" href="/stats">
            Stats dashboard
          </Link>
          <Link className="button secondary" href="/lld">
            LLD studio
          </Link>
          <Link className="button secondary" href="/coding">
            Interview prep
          </Link>
        </div>
      </section>

      <section className="stack">
        <h2>Practice the same question repeatedly</h2>
        <div className="cards-grid">
          {questions.map((question) => (
            <article className="card" key={question.id}>
              <h3>{question.title}</h3>
              <p className="muted">{question.pattern.join(" · ")}</p>
              <div className="row">
                <Link
                  className="button"
                  href={`/practice/${question.slug}?repeats=4&timed=1`}
                >
                  Repeat x4
                </Link>
                <Link
                  className="button secondary"
                  href={`/practice/${question.slug}?repeats=6&timed=1`}
                >
                  Sprint x6
                </Link>
              </div>
            </article>
          ))}
        </div>
      </section>

      <CustomSnippetForm />
    </main>
  );
}
