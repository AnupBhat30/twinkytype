"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { LldCatalogCard } from "@/lib/lld";

interface LldCatalogClientProps {
  cards: LldCatalogCard[];
  tags: string[];
}

export default function LldCatalogClient({ cards, tags }: LldCatalogClientProps) {
  const [query, setQuery] = useState("");
  const [activeTag, setActiveTag] = useState("all");

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();

    return cards.filter((card) => {
      const matchesTag = activeTag === "all" || card.tags.includes(activeTag);
      if (!matchesTag) {
        return false;
      }

      if (!term.length) {
        return true;
      }

      const haystack = [card.title, card.summary, card.category, ...card.tags].join(" ").toLowerCase();
      return haystack.includes(term);
    });
  }, [activeTag, cards, query]);

  return (
    <section className="panel stack">
      <div className="lld-toolbar">
        <input
          className="input"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search systems, topics, or patterns..."
        />
      </div>

      <div className="chip-row">
        <button
          type="button"
          className={`chip action ${activeTag === "all" ? "active" : ""}`}
          onClick={() => setActiveTag("all")}
        >
          all
        </button>
        {tags.map((tag) => (
          <button
            type="button"
            key={tag}
            className={`chip action ${activeTag === tag ? "active" : ""}`}
            onClick={() => setActiveTag(tag)}
          >
            {tag}
          </button>
        ))}
      </div>

      <p className="muted tiny">Showing {filtered.length} of {cards.length} systems</p>

      <div className="cards-grid">
        {filtered.map((card) => (
          <article className="card lld-card" key={card.id}>
            <h3>{card.title}</h3>
            <p className="muted lld-summary">{card.summary}</p>
            <div className="chip-row">
              {card.tags.slice(0, 5).map((tag) => (
                <span className="chip" key={`${card.id}-${tag}`}>
                  {tag}
                </span>
              ))}
            </div>
            <p className="muted tiny">
              {card.fileCount} files · {card.mainCount} main · {card.demoCount} demo
            </p>
            <div className="row">
              <Link className="button" href={`/lld/${card.slug}`}>
                Study design
              </Link>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
