import { notFound } from "next/navigation";
import LldStudyClient from "@/components/LldStudyClient";
import { getLldBySlug } from "@/lib/lld";

interface LldStudyPageProps {
  params: Promise<{ slug: string }>;
}

export default async function LldStudyPage({ params }: LldStudyPageProps) {
  const resolved = await params;
  const entry = getLldBySlug(resolved.slug);

  if (!entry) {
    return notFound();
  }

  return <LldStudyClient entry={entry} />;
}
