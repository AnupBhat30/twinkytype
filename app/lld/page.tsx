import Link from "next/link";
import LldCatalogClient from "@/components/LldCatalogClient";
import { getLldCatalogCards, getLldTagCloud } from "@/lib/lld";

export default function LldCatalogPage() {
  const cards = getLldCatalogCards();
  const tags = getLldTagCloud();

  return (
    <main className="stack">
      <section className="panel">
        <h1 className="page-title">Python Low-Level Design Studio</h1>
        <p className="muted">
          Pick a system and study it deeply: requirements, architecture notes, complete source files, and
          consolidated code view.
        </p>
        <div className="row">
          <Link className="button secondary" href="/">
            Back home
          </Link>
        </div>
      </section>

      <LldCatalogClient cards={cards} tags={tags} />
    </main>
  );
}
