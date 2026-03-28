import { ArrowUpDown, TrendingUp, TrendingDown, Minus, AlertCircle, History } from "lucide-react";

interface PillarChange {
  pillar: string;
  previous: number | null;
  current: number | null;
  delta: number;
}

interface FlagChange {
  type: string;
  message: string;
  severity?: string;
}

interface Props {
  diff: {
    hasPrevious: boolean;
    previousDate: string | null;
    scoreChanges: {
      companyIQ: { previous: number; current: number; delta: number };
      deepAnalysis: { previous: number; current: number; delta: number };
    };
    pillarChanges: PillarChange[];
    redFlagChanges: {
      new: FlagChange[];
      resolved: FlagChange[];
      unchanged: number;
    };
    deepAnalysisChanges: Array<{
      module: string;
      previous: number;
      current: number;
      delta: number;
    }>;
    summary: {
      overallDirection: string;
      keyChanges: string[];
    };
  };
}

function DeltaBadge({ delta }: { delta: number }) {
  if (delta === 0) return <Minus className="w-3 h-3 text-slate-500" />;
  const isUp = delta > 0;
  return (
    <span className={`flex items-center gap-0.5 text-xs font-semibold ${isUp ? "text-green-400" : "text-red-400"}`}>
      {isUp ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
      {isUp ? "+" : ""}{delta.toFixed(1)}
    </span>
  );
}

function directionStyle(dir: string) {
  switch (dir) {
    case "IMPROVING": return "text-green-400";
    case "DECLINING": return "text-red-400";
    default: return "text-slate-400";
  }
}

export default function ReportDiffSection({ diff }: Props) {
  if (!diff || !diff.hasPrevious) return null;

  const { scoreChanges, pillarChanges, redFlagChanges, deepAnalysisChanges, summary, previousDate } = diff;

  const significantModules = deepAnalysisChanges
    ?.filter((m) => Math.abs(m.delta) >= 3)
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
    .slice(0, 6) || [];

  return (
    <div className="mt-8">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-xl bg-cyan-600/20 flex items-center justify-center">
          <History className="w-5 h-5 text-cyan-400" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-white">What Changed</h2>
          <p className="text-xs text-white/35">
            Compared to analysis from {previousDate ? new Date(previousDate).toLocaleDateString() : "previous run"}
          </p>
        </div>
        <span className={`ml-auto text-sm font-semibold ${directionStyle(summary.overallDirection)}`}>
          {summary.overallDirection === "IMPROVING" ? "📈" : summary.overallDirection === "DECLINING" ? "📉" : "➡️"}{" "}
          {summary.overallDirection}
        </span>
      </div>

      {/* Score Deltas */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="glass-card rounded-xl p-3 flex items-center justify-between">
          <div>
            <p className="text-xs text-white/35">CompanyIQ</p>
            <p className="text-lg font-bold text-white">{scoreChanges.companyIQ.current}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-white/35">was {scoreChanges.companyIQ.previous}</p>
            <DeltaBadge delta={scoreChanges.companyIQ.delta} />
          </div>
        </div>
        <div className="glass-card rounded-xl p-3 flex items-center justify-between">
          <div>
            <p className="text-xs text-white/35">Deep Analysis</p>
            <p className="text-lg font-bold text-white">{scoreChanges.deepAnalysis.current}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-white/35">was {scoreChanges.deepAnalysis.previous}</p>
            <DeltaBadge delta={scoreChanges.deepAnalysis.delta} />
          </div>
        </div>
      </div>

      {/* Pillar Changes */}
      {pillarChanges.length > 0 && (
        <div className="glass-card rounded-xl p-4 mb-4">
          <div className="flex items-center gap-2 mb-3">
            <ArrowUpDown className="w-4 h-4 text-slate-400" />
            <h3 className="text-sm font-semibold text-white">Pillar Score Changes</h3>
          </div>
          <div className="space-y-2">
            {pillarChanges.map((pc) => (
              <div key={pc.pillar} className="flex items-center justify-between">
                <span className="text-sm text-white/70 capitalize">{pc.pillar}</span>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-white/35">
                    {pc.previous ?? "N/A"} → {pc.current ?? "N/A"}
                  </span>
                  <DeltaBadge delta={pc.delta} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Red Flag Changes */}
      {(redFlagChanges.new.length > 0 || redFlagChanges.resolved.length > 0) && (
        <div className="glass-card rounded-xl p-4 mb-4">
          <div className="flex items-center gap-2 mb-3">
            <AlertCircle className="w-4 h-4 text-red-400" />
            <h3 className="text-sm font-semibold text-white">Flag Changes</h3>
          </div>
          {redFlagChanges.new.map((f, i) => (
            <div key={`new-${i}`} className="flex items-center gap-2 mb-1.5">
              <span className="px-1.5 py-0.5 bg-red-900/30 text-red-400 text-[10px] rounded">NEW</span>
              <span className="text-xs text-white/70">{f.message}</span>
            </div>
          ))}
          {redFlagChanges.resolved.map((f, i) => (
            <div key={`res-${i}`} className="flex items-center gap-2 mb-1.5">
              <span className="px-1.5 py-0.5 bg-green-900/30 text-green-400 text-[10px] rounded">RESOLVED</span>
              <span className="text-xs text-white/70">{f.message}</span>
            </div>
          ))}
        </div>
      )}

      {/* Module Changes */}
      {significantModules.length > 0 && (
        <div className="glass-card rounded-xl p-4 mb-4">
          <h3 className="text-sm font-semibold text-white mb-3">Notable Module Changes</h3>
          <div className="grid grid-cols-2 gap-2">
            {significantModules.map((m) => (
              <div key={m.module} style={{ background: "rgba(0,0,0,0.3)" }} className="flex items-center justify-between rounded-lg px-3 py-2">
                <span className="text-xs text-white/70 capitalize">{m.module.replace(/([A-Z])/g, " $1").trim()}</span>
                <DeltaBadge delta={m.delta} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Key Changes Summary */}
      {summary.keyChanges.length > 0 && (
        <div className="text-xs text-white/50 space-y-1 pl-1">
          {summary.keyChanges.map((kc, i) => (
            <p key={i}>• {kc}</p>
          ))}
        </div>
      )}
    </div>
  );
}
