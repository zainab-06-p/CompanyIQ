interface Props {
  label: string;
  score: number;
  color: string;
}

export default function PillarBar({ label, score, color }: Props) {
  const safeScore = Math.min(100, Math.max(0, score || 0));

  return (
    <div className="rounded-xl p-4" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-white/70">{label}</span>
        <span className="text-sm font-bold text-white">{Math.round(safeScore)}</span>
      </div>
      <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.08)" }}>
        <div
          className="h-full rounded-full transition-all duration-1000 ease-out"
          style={{ width: `${safeScore}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}
