import { BarChart3, Trophy, Users, ArrowUp, ArrowDown, Minus } from "lucide-react";

interface Props {
  benchmark: {
    hasPeers: boolean;
    peerCount?: number;
    percentileRank?: number;
    sectorAvg?: Record<string, number | null>;
    bestInClass?: { ticker: string; companyIQ: number };
    metrics?: Record<string, { current: number; sectorAvg: number; delta: number; position: string }>;
    peers?: Array<{ ticker: string; companyIQ: number }>;
    message?: string;
  };
}

function PositionBadge({ position }: { position: string }) {
  if (position === "ABOVE") return <span className="flex items-center gap-0.5 text-green-400 text-xs"><ArrowUp className="w-3 h-3" />Above</span>;
  if (position === "BELOW") return <span className="flex items-center gap-0.5 text-red-400 text-xs"><ArrowDown className="w-3 h-3" />Below</span>;
  return <span className="flex items-center gap-0.5 text-slate-400 text-xs"><Minus className="w-3 h-3" />Inline</span>;
}

const METRIC_LABELS: Record<string, string> = {
  companyIQ: "CompanyIQ",
  financial: "Financial",
  legal: "Legal",
  sentiment: "Sentiment",
  deepAnalysis: "Deep Analysis",
};

export default function PeerBenchmarkSection({ benchmark }: Props) {
  if (!benchmark) return null;

  if (!benchmark.hasPeers) {
    return (
      <div className="mt-8">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-600/20 flex items-center justify-center">
            <Users className="w-5 h-5 text-indigo-400" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">Peer Benchmark</h2>
            <p className="text-xs text-white/35">{benchmark.message}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-600/20 flex items-center justify-center">
            <BarChart3 className="w-5 h-5 text-indigo-400" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">Peer Benchmark</h2>
            <p className="text-xs text-white/35">Compared against {benchmark.peerCount} sector peers</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-2xl font-bold text-indigo-400">P{benchmark.percentileRank}</span>
          <span className="text-xs text-white/35">Percentile</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Metrics vs Sector */}
        <div className="glass-card rounded-xl p-4">
          <h3 className="text-sm font-semibold text-white mb-3">vs Sector Average</h3>
          <div className="space-y-2.5">
            {benchmark.metrics && Object.entries(benchmark.metrics).map(([key, m]) => (
              <div key={key} className="flex items-center justify-between">
                <span className="text-xs text-white/40">{METRIC_LABELS[key] || key}</span>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-semibold text-white">{m.current}</span>
                  <span className="text-xs text-white/35">vs {m.sectorAvg}</span>
                  <PositionBadge position={m.position} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Peer Leaderboard */}
        <div className="glass-card rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <Trophy className="w-4 h-4 text-yellow-400" />
            <h3 className="text-sm font-semibold text-white">Sector Leaderboard</h3>
          </div>
          {benchmark.bestInClass && (
            <div className="flex items-center justify-between mb-2 pb-2 border-b border-white/[0.05]">
              <span className="text-xs text-white/40">Best in Class</span>
              <span className="text-sm font-semibold text-yellow-400 font-mono">{benchmark.bestInClass.ticker} ({benchmark.bestInClass.companyIQ})</span>
            </div>
          )}
          {benchmark.peers && benchmark.peers.length > 0 && (
            <div className="space-y-1.5">
              {benchmark.peers.map((p, i) => (
                <div key={p.ticker} className="flex items-center justify-between">
                  <span className="text-xs text-white/40">#{i + 1} {p.ticker}</span>
                  <div className="flex items-center gap-2">
                    <div className="w-16 rounded-full h-1.5" style={{ background: "rgba(255,255,255,0.06)" }}>
                      <div className="h-1.5 rounded-full bg-indigo-500" style={{ width: `${p.companyIQ}%` }} />
                    </div>
                    <span className="text-xs text-white/70 w-6 text-right">{p.companyIQ}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
