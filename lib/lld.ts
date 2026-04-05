import lldFlat from "@/data/awesome_low_level_design_python_flat.json";

export interface LldFile {
  name: string;
  path: string;
  content: string;
}

export interface LldSource {
  repo?: string;
  base_path?: string;
  language?: string;
}

export interface LldEntry {
  id: string;
  slug: string;
  title: string;
  category?: string;
  source?: LldSource;
  summary?: string;
  tags?: string[];
  readme?: string;
  files?: {
    python?: LldFile[];
    other_docs?: LldFile[];
  };
  main_files?: string[];
  demo_files?: string[];
  combined_view?: string;
}

export interface LldCatalogCard {
  id: string;
  slug: string;
  title: string;
  summary: string;
  tags: string[];
  category: string;
  fileCount: number;
  mainCount: number;
  demoCount: number;
}

const IDENTIFIER_WORDS = [
  "management",
  "registration",
  "restaurant",
  "networking",
  "brokerage",
  "streaming",
  "delivery",
  "shopping",
  "parking",
  "machine",
  "booking",
  "vending",
  "digital",
  "traffic",
  "service",
  "concert",
  "library",
  "wallet",
  "ticket",
  "rental",
  "course",
  "online",
  "airline",
  "coffee",
  "hotel",
  "elevator",
  "movie",
  "music",
  "snake",
  "ladder",
  "splitwise",
  "stackoverflow",
  "linkedin",
  "cricinfo",
  "pubsub",
  "cache",
  "frame",
  "framework",
  "task",
  "voting",
  "ride",
  "sharing",
  "game",
  "system",
  "atm",
  "lru",
  "car",
  "food",
  "tic",
  "tac",
  "toe",
];

const UPPERCASE_WORDS: Record<string, string> = {
  atm: "ATM",
  lru: "LRU",
  pubsub: "Pub/Sub",
  cricinfo: "CricInfo",
  linkedin: "LinkedIn",
  stackoverflow: "StackOverflow",
  tictactoe: "TicTacToe",
};

function capitalizeWord(value: string): string {
  if (!value) {
    return value;
  }
  const lower = value.toLowerCase();
  if (UPPERCASE_WORDS[lower]) {
    return UPPERCASE_WORDS[lower];
  }
  return lower[0].toUpperCase() + lower.slice(1);
}

function splitIdentifier(raw: string): string[] {
  const normalized = raw
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

  if (!normalized) {
    return [];
  }

  if (normalized.includes(" ")) {
    return normalized.split(/\s+/g).filter(Boolean);
  }

  let working = ` ${normalized} `;
  const dictionary = [...IDENTIFIER_WORDS].sort((a, b) => b.length - a.length);

  dictionary.forEach((word) => {
    working = working.replaceAll(word, ` ${word} `);
  });

  const tokens = working
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean);

  if (!tokens.length || tokens.join("") !== normalized) {
    return [normalized];
  }

  return tokens;
}

function fallbackTitle(raw: string): string {
  return splitIdentifier(raw)
    .map((word) => capitalizeWord(word))
    .join(" ");
}

function titleFromReadme(readme?: string): string | null {
  if (!readme) {
    return null;
  }

  const heading = readme
    .split("\n")
    .map((line) => line.trim())
    .find((line) => line.startsWith("# "));

  if (!heading) {
    return null;
  }

  const extracted = heading.replace(/^#\s*/g, "").trim();
  if (!extracted) {
    return null;
  }

  return extracted
    .replace(/^designing\s+(?:an?\s+|the\s+)?/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeTitle(entry: LldEntry): string {
  const fromReadme = titleFromReadme(entry.readme);
  if (fromReadme) {
    return fromReadme;
  }

  if (entry.title?.trim()) {
    return fallbackTitle(entry.title.trim());
  }

  if (entry.slug?.trim()) {
    return fallbackTitle(entry.slug.trim());
  }

  return "Untitled LLD";
}

function isSummaryGood(summary: string): boolean {
  if (summary.length < 70) {
    return false;
  }

  if (!/[.!?]$/.test(summary)) {
    return false;
  }

  return true;
}

function summaryFromReadme(readme?: string): string | null {
  if (!readme) {
    return null;
  }

  const listItems = readme
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => /^\d+\.\s+/.test(line))
    .map((line) => line.replace(/^\d+\.\s+/, "").trim())
    .filter(Boolean);

  if (listItems.length >= 2) {
    return `${listItems[0]} ${listItems[1]}`.trim();
  }

  if (listItems.length === 1) {
    return listItems[0];
  }

  const paragraph = readme
    .split("\n")
    .map((line) => line.trim())
    .find((line) => line && !line.startsWith("#"));

  return paragraph || null;
}

function normalizeSummary(entry: LldEntry): string {
  const cleaned = (entry.summary ?? "").replace(/\s+/g, " ").trim();
  if (cleaned && isSummaryGood(cleaned)) {
    return cleaned;
  }

  const fromReadme = summaryFromReadme(entry.readme);
  if (fromReadme) {
    return fromReadme;
  }

  if (cleaned) {
    return cleaned;
  }

  return "No summary available.";
}

const lldEntries = (lldFlat as LldEntry[])
  .filter((entry) => Boolean(entry?.slug && entry?.title))
  .map((entry) => normalizeEntry(entry));

function normalizeEntry(entry: LldEntry): LldEntry {
  return {
    ...entry,
    title: normalizeTitle(entry),
    category: entry.category?.trim() || "low-level-design",
    summary: normalizeSummary(entry),
    tags: entry.tags ?? [],
    readme: entry.readme ?? "",
    files: {
      python: entry.files?.python ?? [],
      other_docs: entry.files?.other_docs ?? [],
    },
    main_files: entry.main_files ?? [],
    demo_files: entry.demo_files ?? [],
    combined_view: entry.combined_view ?? "",
  };
}

export function getLldCatalogCards(): LldCatalogCard[] {
  return lldEntries
    .map((entry) => ({
      id: entry.id,
      slug: entry.slug,
      title: entry.title,
      summary: entry.summary ?? "No summary available.",
      tags: entry.tags ?? [],
      category: entry.category ?? "low-level-design",
      fileCount: entry.files?.python?.length ?? 0,
      mainCount: entry.main_files?.length ?? 0,
      demoCount: entry.demo_files?.length ?? 0,
    }))
    .sort((a, b) => a.title.localeCompare(b.title));
}

export function getLldBySlug(slug: string): LldEntry | undefined {
  return lldEntries.find((entry) => entry.slug === slug);
}

export function getLldTagCloud(): string[] {
  const tags = new Set<string>();

  lldEntries.forEach((entry) => {
    (entry.tags ?? []).forEach((tag) => tags.add(tag));
  });

  return [...tags].sort((a, b) => a.localeCompare(b));
}
