import { ShieldAlert, ShieldCheck, Eye, AlertTriangle, Radio, FileWarning, TrendingDown } from "lucide-react";

interface AdversarialFlag {
  type: string;
  severity: string;
  message: string;
  confidence: number;
}

interface Props {
  analysis: {
    score: number;
    rating: string;
    riskLevel: string;
    checks: {
      sentimentAnomaly: { detected: boolean; distribution?: { positive: number; negative: number; neutral: number } };
      sourceCredibility: { detected: boolean; prWireRatio?: number; sourceDiversity?: number };
      temporalClustering: { detected: boolean };
      contentPatterns: { detected: boolean; promotionalCount?: number; fearCount?: number };
      financialSentimentDivergence: { detected: boolean; gap?: number };
    };
    flags: AdversarialFlag[];
  };
}

const CHECK_META: Record<string, { label: string; icon: React.ReactNode; description: string }> = {
  sentimentAnomaly: { label: "Sentiment Distribution", icon: <TrendingDown className="w-4 h-4" />, description: "Statistical outliers in news sentiment" },
  sourceCredibility: { label: "Source Credibility", icon: <Radio className="w-4 h-4" />, description: "PR wire reliance & source diversity" },
  temporalClustering: { label: "Temporal Clustering", icon: <Eye className="w-4 h-4" />, description: "Coordinated news release detection" },
  contentPatterns: { label: "Content Patterns", icon: <FileWarning className="w-4 h-4" />, description: "Promotional/fear language & duplicates" },
  financialSentimentDivergence: { label: "Finance–Sentiment Gap", icon: <AlertTriangle className="w-4 h-4" />, description: "Divergence between data and narrative" },
};

function getRiskStyle(level: string) {
  switch (level) {
    case "CRITICAL": return { bg: "bg-red-900/30", border: "border-red-700/50", text: "text-red-400", bar: "bg-red-500" };
    case "HIGH": return { bg: "bg-orange-900/30", border: "border-orange-700/50", text: "text-orange-400", bar: "bg-orange-500" };
    case "MODERATE": return { bg: "bg-yellow-900/30", border: "border-yellow-700/50", text: "text-yellow-400", bar: "bg-yellow-500" };
    default: return { bg: "bg-green-900/30", border: "border-green-700/50", text: "text-green-400", bar: "bg-green-500" };
  }
}

export default function AdversarialSection({ analysis }: Props) {
  if (!analysis) return null;

  const style = getRiskStyle(analysis.riskLevel);
  const isClean = analysis.riskLevel === "LOW";

  return (
    <div className="mt-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl ${isClean ? "bg-green-600/20" : "bg-red-600/20"} flex items-center justify-center`}>
            {isClean
              ? <ShieldCheck className="w-5 h-5 text-green-400" />
              : <ShieldAlert className="w-5 h-5 text-red-400" />}
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">Data Integrity Check</h2>
            <p className="text-xs text-white/35">Adversarial detection — manipulated news & sentiment gaming</p>
          </div>
        </div>
        <div className="text-right">
          <span className={`px-3 py-1 text-xs font-semibold rounded-full border ${style.bg} ${style.border} ${style.text}`}>
            {analysis.rating}
          </span>
          <p className="text-xs text-white/35 mt-1">Integrity: {analysis.score}/100</p>
        </div>
      </div>

      {/* Integrity Bar */}
      <div className="w-full rounded-full h-2 mb-4" style={{ background: "rgba(255,255,255,0.08)" }}>
        <div
          className={`h-2 rounded-full transition-all ${style.bar}`}
          style={{ width: `${analysis.score}%` }}
        />
      </div>

      {/* Check Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-4">
        {Object.entries(analysis.checks).map(([key, check]) => {
          const meta = CHECK_META[key];
          if (!meta) return null;
          return (
            <div
              key={key}
              className={`rounded-lg border p-3 ${
                check.detected
                  ? "bg-red-900/10 border-red-800/40"
                  : "glass-card"
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <span className={check.detected ? "text-red-400" : "text-green-400"}>{meta.icon}</span>
                <span className="text-xs font-semibold text-white">{meta.label}</span>
                <span className={`ml-auto text-[10px] font-bold ${check.detected ? "text-red-400" : "text-green-400"}`}>
                  {check.detected ? "⚠ DETECTED" : "✓ CLEAR"}
                </span>
              </div>
              <p className="text-[11px] text-white/35">{meta.description}</p>
            </div>
          );
        })}
      </div>

      {/* Flags */}
      {analysis.flags.length > 0 && (
        <div className="space-y-2">
          {analysis.flags.map((flag, i) => (
            <div
              key={i}
              className={`flex items-start gap-2 rounded-lg px-3 py-2 ${
                flag.severity === "HIGH" ? "bg-red-900/15 border border-red-800/30" : "bg-yellow-900/10 border border-yellow-800/30"
              }`}
            >
              <AlertTriangle className={`w-3.5 h-3.5 mt-0.5 flex-shrink-0 ${
                flag.severity === "HIGH" ? "text-red-400" : "text-yellow-400"
              }`} />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-white/70">{flag.message}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className={`text-[10px] ${flag.severity === "HIGH" ? "text-red-500" : "text-yellow-500"}`}>
                    {flag.type.replace(/_/g, " ")}
                  </span>
                  <span className="text-[10px] text-white/25">•</span>
                  <span className="text-[10px] text-white/35">Confidence: {Math.round(flag.confidence)}%</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {isClean && analysis.flags.length === 0 && (
        <div className="bg-green-900/10 border border-green-800/30 rounded-lg p-3 flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-green-400" />
          <span className="text-sm text-green-300">No adversarial patterns detected — data appears authentic</span>
        </div>
      )}
    </div>
  );
}
