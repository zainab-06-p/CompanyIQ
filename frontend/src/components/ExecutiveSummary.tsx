import { Sparkles, TrendingUp, AlertTriangle } from "lucide-react";

interface Props {
  synthesis: {
    executiveSummary: string;
    strengths: string[];
    risks: string[];
    investmentThesis: string;
  };
}

export default function ExecutiveSummary({ synthesis }: Props) {
  return (
    <div className="glass-card rounded-2xl p-6">
      <h2 className="text-xl font-bold text-white flex items-center gap-2 mb-6">
        <Sparkles className="w-5 h-5 text-yellow-400" />
        AI Executive Summary
      </h2>

      {/* Summary */}
      <div className="prose prose-invert max-w-none mb-8">
        <p className="text-white/70 leading-relaxed whitespace-pre-line">
          {synthesis.executiveSummary}
        </p>
      </div>

      {/* Strengths & Risks */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <div className="rounded-xl p-5" style={{ background: "rgba(0,255,135,0.05)", border: "1px solid rgba(0,255,135,0.12)" }}>
          <h3 className="text-sm font-semibold uppercase tracking-wider mb-3 flex items-center gap-2" style={{ color: "#00ff87" }}>
            <TrendingUp className="w-4 h-4" />
            Top 3 Positives
          </h3>
          <ul className="space-y-2">
            {synthesis.strengths.map((s, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="mt-1 shrink-0" style={{ color: "#00ff87" }}>•</span>
                <span className="text-sm text-white/70">{s}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-xl p-5" style={{ background: "rgba(239,68,68,0.05)", border: "1px solid rgba(239,68,68,0.12)" }}>
          <h3 className="text-sm font-semibold text-red-400 uppercase tracking-wider mb-3 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" />
            Top 3 Concerns
          </h3>
          <ul className="space-y-2">
            {synthesis.risks.map((r, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="text-red-500 mt-1 shrink-0">•</span>
                <span className="text-sm text-white/70">{r}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Investment Thesis */}
      {synthesis.investmentThesis && (
        <div className="rounded-xl p-5" style={{ background: "rgba(0,0,0,0.3)" }}>
          <h3 className="text-sm font-semibold text-white/40 uppercase tracking-wider mb-3">
            Investment Thesis
          </h3>
          <p className="text-white/70 text-sm leading-relaxed whitespace-pre-line">
            {synthesis.investmentThesis}
          </p>
        </div>
      )}
    </div>
  );
}
