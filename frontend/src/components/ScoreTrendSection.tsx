import { TrendingUp, TrendingDown, Minus, Activity, AlertTriangle } from "lucide-react";

interface TrendData {
  direction: string;
  slope?: number;
  recentDelta?: number;
  current?: number;
  min?: number;
  max?: number;
  avg?: number;
  dataPoints?: number;
  insufficient?: boolean;
}

interface Alert {
  severity: string;
  message: string;
}

interface Props {
  trend: {
    hasHistory: boolean;
    dataPoints?: number;
    trends?: Record<string, TrendData>;
    alerts?: Alert[];
    history?: Array<{ companyIQ: number; timestamp: string }>;
    message?: string;
  };
}

function DirectionIcon({ direction }: { direction: string }) {
  if (direction === "IMPROVING") return <TrendingUp className="w-4 h-4 text-green-400" />;
  if (direction === "DECLINING") return <TrendingDown className="w-4 h-4 text-red-400" />;
  return <Minus className="w-4 h-4 text-slate-400" />;
}

function directionColor(direction: string) {
  if (direction === "IMPROVING") return "text-green-400";
  if (direction === "DECLINING") return "text-red-400";
  return "text-slate-400";
}

const METRIC_LABELS: Record<string, string> = {
  companyIQ: "CompanyIQ",
  financial: "Financial",
  legal: "Legal",
  sentiment: "Sentiment",
  deepAnalysis: "Deep Analysis",
};

export default function ScoreTrendSection({ trend }: Props) {
  if (!trend) return null;

  if (!trend.hasHistory) {
    return (
      <div className="mt-8">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-600/20 flex items-center justify-center">
            <Activity className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">Score Trend</h2>
            <p className="text-xs text-white/35">{trend.message}</p>
          </div>
        </div>
      </div>
    );
  }

  const iqTrend = trend.trends?.companyIQ;

  return (
    <div className="mt-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-600/20 flex items-center justify-center">
            <Activity className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">Score Trend</h2>
            <p className="text-xs text-white/35">{trend.dataPoints} historical data points</p>
          </div>
        </div>
        {iqTrend && !iqTrend.insufficient && (
          <div className="flex items-center gap-2">
            <DirectionIcon direction={iqTrend.direction} />
            <span className={`text-sm font-semibold ${directionColor(iqTrend.direction)}`}>
              {iqTrend.direction}
            </span>
          </div>
        )}
      </div>

      {/* Mini History Chart (text-based sparkline) */}
      {trend.history && trend.history.length > 0 && (
        <div className="glass-card rounded-xl p-4 mb-4">
          <h3 className="text-xs text-white/35 mb-3">CompanyIQ History</h3>
          <div className="flex items-end gap-1 h-12">
            {trend.history.map((h, i) => {
              const height = Math.max(8, (h.companyIQ / 100) * 48);
              const color = h.companyIQ >= 80 ? "bg-green-500" : h.companyIQ >= 60 ? "bg-yellow-500" : h.companyIQ >= 40 ? "bg-orange-500" : "bg-red-500";
              return (
                <div
                  key={i}
                  className={`flex-1 rounded-sm ${color} opacity-70 hover:opacity-100 transition-opacity relative group`}
                  style={{ height: `${height}px` }}
                  title={`${h.companyIQ} — ${new Date(h.timestamp).toLocaleDateString()}`}
                >
                  <div className="absolute -top-5 left-1/2 -translate-x-1/2 text-[9px] text-white px-1 rounded opacity-0 group-hover:opacity-100 whitespace-nowrap" style={{ background: "rgba(4,8,20,0.9)" }}>
                    {h.companyIQ}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Pillar Trends */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-4">
        {trend.trends && Object.entries(trend.trends).map(([key, t]) => {
          if (t.insufficient) return null;
          return (
            <div key={key} className="glass-card rounded-lg p-3">
              <p className="text-[10px] text-white/35 mb-1">{METRIC_LABELS[key] || key}</p>
              <div className="flex items-center gap-1.5">
                <DirectionIcon direction={t.direction} />
                <span className={`text-xs font-semibold ${directionColor(t.direction)}`}>
                  {t.direction}
                </span>
              </div>
              {typeof t.slope === "number" && (
                <p className="text-[10px] text-white/35 mt-1">
                  Slope: {t.slope > 0 ? "+" : ""}{t.slope}/run | Range: {t.min}–{t.max}
                </p>
              )}
            </div>
          );
        })}
      </div>

      {/* Alerts */}
      {trend.alerts && trend.alerts.length > 0 && (
        <div className="space-y-1.5">
          {trend.alerts.map((a, i) => (
            <div key={i} className={`flex items-center gap-2 text-xs px-3 py-1.5 rounded-lg ${
              a.severity === "HIGH" ? "bg-red-900/15 text-red-400" :
              a.severity === "POSITIVE" ? "bg-green-900/15 text-green-400" :
              "bg-yellow-900/15 text-yellow-400"
            }`}>
              {a.severity === "POSITIVE"
                ? <TrendingUp className="w-3 h-3" />
                : <AlertTriangle className="w-3 h-3" />}
              <span>{a.message}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
