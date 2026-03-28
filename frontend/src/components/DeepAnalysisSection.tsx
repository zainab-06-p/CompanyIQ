import {
  BarChart3,
  TrendingUp,
  Shield,
  Brain,
  Leaf,
  Users,
  CreditCard,
  Cpu,
  Truck,
  Calculator,
  UserCheck,
  Factory,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { useState } from "react";

interface ModuleData {
  score: number;
  rating: string;
  [key: string]: any;
}

interface Props {
  /** Full deep analysis (paid tiers) or null */
  deepAnalysis?: Record<string, ModuleData> | null;
  /** Summary only (free tier) */
  deepAnalysisSummary?: Record<string, { score: number; rating: string }> | null;
  /** Overall deep analysis score */
  deepAnalysisScore?: number | null;
}

const MODULE_META: Record<string, { label: string; icon: any; color: string; description: string }> = {
  accountingQuality: {
    label: "Accounting Quality",
    icon: BarChart3,
    color: "#3b82f6",
    description: "Earnings quality, accruals, and reporting reliability",
  },
  capitalAllocation: {
    label: "Capital Allocation",
    icon: TrendingUp,
    color: "#10b981",
    description: "How efficiently the company deploys capital",
  },
  managementQuality: {
    label: "Management Quality",
    icon: Brain,
    color: "#8b5cf6",
    description: "Leadership effectiveness and governance track record",
  },
  moatAnalysis: {
    label: "Economic Moat",
    icon: Shield,
    color: "#f59e0b",
    description: "Competitive advantages and durability of moat",
  },
  esgAnalysis: {
    label: "ESG Score",
    icon: Leaf,
    color: "#22c55e",
    description: "Environmental, social, and governance practices",
  },
  shareholdingAnalysis: {
    label: "Shareholding",
    icon: Users,
    color: "#06b6d4",
    description: "Promoter, institutional, and public holding patterns",
  },
  creditAnalysis: {
    label: "Credit Quality",
    icon: CreditCard,
    color: "#ec4899",
    description: "Debt serviceability and credit risk indicators",
  },
  techInnovation: {
    label: "Tech & Innovation",
    icon: Cpu,
    color: "#6366f1",
    description: "R&D intensity and technological moat",
  },
  supplyChainRisk: {
    label: "Supply Chain Risk",
    icon: Truck,
    color: "#ef4444",
    description: "Dependency risks and supply chain resilience",
  },
  valuation: {
    label: "Valuation",
    icon: Calculator,
    color: "#f97316",
    description: "Relative and intrinsic valuation metrics",
  },
  insiderTracking: {
    label: "Insider Activity",
    icon: UserCheck,
    color: "#14b8a6",
    description: "Insider buying/selling and pledging signals",
  },
  industryKPIs: {
    label: "Industry KPIs",
    icon: Factory,
    color: "#a855f7",
    description: "Sector-specific key performance indicators",
  },
};

function getRatingColor(rating: string): string {
  switch (rating?.toUpperCase()) {
    case "STRONG":
    case "EXCELLENT":
      return "text-green-400";
    case "GOOD":
    case "MODERATE":
      return "text-yellow-400";
    case "FAIR":
    case "CAUTION":
      return "text-orange-400";
    case "WEAK":
    case "POOR":
    case "HIGH RISK":
      return "text-red-400";
    default:
      return "text-white/40";
  }
}

function getScoreBarColor(score: number): string {
  if (score >= 75) return "#22c55e";
  if (score >= 55) return "#f59e0b";
  if (score >= 35) return "#f97316";
  return "#ef4444";
}

// ─── Safe value formatter — never produces [object Object] ──────────────
function fmtVal(v: any, depth = 0): string {
  if (v == null) return "—";
  if (typeof v === "boolean") return v ? "Yes" : "No";
  if (typeof v === "number") return Number.isInteger(v) ? String(v) : v.toFixed(2);
  if (typeof v === "string") return v || "—";
  if (Array.isArray(v)) {
    if (v.length === 0) return "—";
    if (typeof v[0] !== "object") return v.slice(0, 5).join(", ") + (v.length > 5 ? ` +${v.length - 5}` : "");
    return `${v.length} record${v.length !== 1 ? "s" : ""}`;
  }
  if (typeof v === "object") {
    if (depth > 0) return "…"; // prevent deep nesting
    const entries = Object.entries(v).filter(([, val]) => typeof val !== "object");
    if (entries.length === 0) return "—";
    return entries.slice(0, 3).map(([k, val]) => `${k.replace(/([A-Z])/g, " $1").trim()}: ${fmtVal(val, 1)}`).join("; ")
      + (Object.keys(v).length > 3 ? " …" : "");
  }
  return String(v);
}

function camel(k: string) {
  return k.replace(/([A-Z])/g, " $1").trim();
}

function ModuleCard({
  moduleKey,
  data,
}: {
  moduleKey: string;
  data: { score: number; rating: string; [key: string]: any };
}) {
  const [expanded, setExpanded] = useState(false);
  const meta = MODULE_META[moduleKey];
  if (!meta) return null;

  const Icon = meta.icon;
  const score = Math.min(100, Math.max(0, data.score || 0));

  // Extract details (everything except score, rating, and commentary)
  const details = Object.entries(data).filter(
    ([k]) => !["score", "rating", "commentary"].includes(k) && data[k] != null
  );

  return (
    <div className="deep-module-card glass-card-hover rounded-xl overflow-hidden transition-colors">
      {/* Card Header - Always Visible */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full p-5 flex items-start gap-3 cursor-pointer hover:bg-white/[0.02] print:cursor-default"
      >
        <div
          className="w-8 h-8 rounded-lg flex-shrink-0 flex items-center justify-center mt-0.5"
          style={{ backgroundColor: `${meta.color}20` }}
        >
          <Icon className="w-4 h-4" style={{ color: meta.color }} />
        </div>
        <div className="flex-1 text-left">
          <h4 className="text-sm font-semibold text-white">{meta.label}</h4>
          <p className="text-xs text-white/35 mt-0.5">{meta.description}</p>
        </div>
        <div className="flex flex-col items-end gap-1 flex-shrink-0">
          <span className={`text-xs font-semibold ${getRatingColor(data.rating)}`}>
            {data.rating}
          </span>
          <span className="text-lg font-bold text-white">{Math.round(score)}</span>
        </div>
      </button>

      {/* Expandable Details Section — Always rendered, visibility controlled by CSS + React state */}
      {details.length > 0 && (
        <div
          className={`deep-module-details transition-all overflow-hidden ${
            expanded ? "max-h-screen opacity-100" : "max-h-0 opacity-0 print:max-h-none print:opacity-100"
          }`}
          style={{ background: "rgba(0,0,0,0.2)" }}
        >
          <div className="px-5 py-4 space-y-4">
            {details.map(([key, value]) => {
              if (typeof value === "object" && !Array.isArray(value) && value !== null) {
                return (
                  <div key={key} className="space-y-2.5">
                    <div className="text-xs font-medium text-white/50 uppercase tracking-wide">
                      {camel(key)}
                    </div>
                    <div className="space-y-1.5 pl-3">
                      {Object.entries(value as Record<string, any>).map(([k, v]) => (
                        <div key={k} className="flex justify-between gap-4 text-xs">
                          <span className="text-white/60 capitalize">{camel(k)}</span>
                          <span className="text-right text-white/80 font-medium">{fmtVal(v, 1)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              }
              if (Array.isArray(value)) {
                return (
                  <div key={key} className="flex justify-between gap-4 text-xs">
                    <span className="text-white/60 capitalize font-medium">{camel(key)}</span>
                    <span className="text-right text-white/80">
                      {value.length === 0 ? "—"
                        : typeof value[0] !== "object"
                          ? value.slice(0, 3).join(", ") + (value.length > 3 ? "…" : "")
                          : `${value.length} records`}
                    </span>
                  </div>
                );
              }
              return (
                <div key={key} className="flex justify-between gap-4 text-xs">
                  <span className="text-white/60 capitalize font-medium">{camel(key)}</span>
                  <span className="text-right text-white/80 font-medium">{fmtVal(value)}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Toggle indicator when there are details */}
      {details.length > 0 && (
        <div className="px-5 py-2 flex justify-center border-t border-white/[0.05] print:hidden">
          {expanded ? (
            <ChevronUp className="w-4 h-4 text-white/30" />
          ) : (
            <ChevronDown className="w-4 h-4 text-white/30" />
          )}
        </div>
      )}

      {/* Commentary Box — PDF Only (Print Mode) */}
      <div className="hidden print:block px-5 py-4 border-t border-white/[0.05]">
        <div className="bg-white rounded-lg p-3 border border-gray-200">
          <div className="text-xs font-semibold text-gray-700 mb-2">Commentary</div>
          <div className="text-xs text-gray-600 leading-relaxed">
            {data.commentary || "Analysis details provided above."}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function DeepAnalysisSection({ deepAnalysis, deepAnalysisSummary, deepAnalysisScore }: Props) {
  // Merge: prefer full deepAnalysis, fallback to summary
  const modules = deepAnalysis || deepAnalysisSummary;
  if (!modules || Object.keys(modules).length === 0) return null;

  const isSummary = !deepAnalysis;
  const validModules = Object.entries(modules).filter(
    ([, v]) => v && typeof v.score === "number"
  );
  if (validModules.length === 0) return null;

  // Sort by score descending
  const sorted = [...validModules].sort((a, b) => (b[1].score || 0) - (a[1].score || 0));
  const avgScore = deepAnalysisScore ?? Math.round(
    sorted.reduce((s, [, v]) => s + v.score, 0) / sorted.length
  );

  return (
    <div className="mt-8">
      {/* Section Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-600/20 flex items-center justify-center">
            <BarChart3 className="w-5 h-5 text-indigo-400" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">Deep Analysis</h2>
            <p className="text-xs text-white/35">{sorted.length} modules analyzed</p>
          </div>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold text-white">{avgScore}</div>
          <div className="text-xs text-white/35">Avg Score</div>
        </div>
      </div>

      {/* Module Grid — 2 Column Layout (as in PDF) */}
      <div className="deep-module-grid grid grid-cols-1 lg:grid-cols-2 gap-4">
        {sorted.map(([key, data]) => (
          <ModuleCard
            key={key}
            moduleKey={key}
            data={data as any}
          />
        ))}
      </div>

      {isSummary && (
        <p className="text-xs text-white/25 text-center mt-4">
          Upgrade to a paid tier to see detailed breakdowns for each module
        </p>
      )}
    </div>
  );
}
