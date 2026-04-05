import type { SessionStats } from "@/lib/types";

interface StatsOverlayProps {
  elapsedMs: number;
  stats: Partial<SessionStats>;
  timedRemainingSec?: number;
  modeLabel?: string;
}

function formatSeconds(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const rem = seconds % 60;
  return `${minutes}:${String(rem).padStart(2, "0")}`;
}

export default function StatsOverlay({ elapsedMs, stats, timedRemainingSec, modeLabel }: StatsOverlayProps) {
  const progress = stats.insights?.progress ?? 0;

  return (
    <section className="stats-overlay">
      <div className="stat-side left">
        <p className="stat-label">time</p>
        <p className="stat-value">{formatSeconds(elapsedMs)}</p>
      </div>

      <div className="stat-primary">
        <p className="stat-label">live lpm</p>
        <p className="stat-main">{stats.lpm ?? 0}</p>
        <div className="stat-subline">
          <span>{modeLabel ?? "practice"}</span>
          <span>{progress}% complete</span>
        </div>
      </div>

      <div className="stat-side right">
        <p className="stat-label">accuracy</p>
        <p className="stat-value">{stats.accuracy ?? 100}%</p>
      </div>

      {typeof timedRemainingSec === "number" ? (
        <div className="stat-timer-chip">{Math.max(0, timedRemainingSec)}s</div>
      ) : null}
    </section>
  );
}
