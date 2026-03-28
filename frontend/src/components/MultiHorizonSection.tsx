import { Clock, TrendingUp, TrendingDown, Minus, AlertTriangle } from "lucide-react";

interface HorizonData {
  label: string;
  score: number;
  rating: string;
  color: string;
  focus: string;
  keyQuestion: string;
  flagPenalty: number;
}

interface DivergenceData {
  pattern: string;
  message: string;
  severity: string;
}

interface Props {
  multiHorizon: {
    horizons: {
      shortTerm: HorizonData;
      mediumTerm: HorizonData;
      longTerm: HorizonData;
    };
    divergence: DivergenceData;
  };
}

function getColorClass(color: string): string {
  switch (color) {
    case "green": return "text-green-400";
    case "yellow": return "text-yellow-400";
    case "orange": return "text-orange-400";
    case "red": return "text-red-400";
    default: return "text-slate-400";
  }
}

function getBgClass(color: string): string {
  switch (color) {
    case "green": return "bg-green-500";
    case "yellow": return "bg-yellow-500";
    case "orange": return "bg-orange-500";
    case "red": return "bg-red-500";
    default: return "bg-slate-500";
  }
}

function getDivergenceBg(severity: string): string {
  switch (severity) {
    case "POSITIVE": return "bg-green-900/20 border-green-700/50";
    case "WATCH": return "bg-orange-900/20 border-orange-700/50";
    default: return "bg-slate-800/50 border-slate-700/50";
  }
}

function getDivergenceIcon(pattern: string) {
  switch (pattern) {
    case "BUY_ON_WEAKNESS": return <TrendingUp className="w-5 h-5 text-green-400" />;
    case "SELL_ON_STRENGTH": return <TrendingDown className="w-5 h-5 text-orange-400" />;
    default: return <Minus className="w-5 h-5 text-slate-400" />;
  }
}

export default function MultiHorizonSection({ multiHorizon }: Props) {
  if (!multiHorizon?.horizons) return null;

  const { horizons, divergence } = multiHorizon;
  const horizonList = [
    { key: "shortTerm", data: horizons.shortTerm, icon: "⚡" },
    { key: "mediumTerm", data: horizons.mediumTerm, icon: "📈" },
    { key: "longTerm", data: horizons.longTerm, icon: "🏛️" },
  ];

  return (
    <div className="mt-8">
      {/* Section Header */}
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-xl bg-cyan-600/20 flex items-center justify-center">
          <Clock className="w-5 h-5 text-cyan-400" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-white">Multi-Horizon Analysis</h2>
          <p className="text-xs text-slate-500">Score varies by investment timeframe</p>
        </div>
      </div>

      {/* Horizon Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {horizonList.map(({ key, data, icon }) => (
          <div
            key={key}
            className="glass-card glass-card-hover rounded-xl p-5 transition-colors"
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-lg">{icon}</span>
              <div className={`text-2xl font-bold ${getColorClass(data.color)}`}>
                {data.score}
              </div>
            </div>
            <h3 className="text-sm font-semibold text-white mb-1">{data.label}</h3>
            <span className={`text-xs font-medium ${getColorClass(data.color)}`}>
              {data.rating}
            </span>

            {/* Score Bar */}
            <div className="mt-3 h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.08)" }}>
              <div
                className={`h-full rounded-full transition-all duration-700 ${getBgClass(data.color)}`}
                style={{ width: `${Math.min(100, Math.max(0, data.score))}%` }}
              />
            </div>

            <p className="text-xs text-white/35 mt-3 leading-relaxed">{data.focus}</p>

            {data.flagPenalty > 0 && (
              <div className="flex items-center gap-1 mt-2 text-xs text-orange-400">
                <AlertTriangle className="w-3 h-3" />
                <span>−{data.flagPenalty} from red flags</span>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Divergence Alert */}
      {divergence && (
        <div className={`mt-4 rounded-xl border p-4 flex items-start gap-3 ${getDivergenceBg(divergence.severity)}`}>
          {getDivergenceIcon(divergence.pattern)}
          <div>
            <h4 className="text-sm font-semibold text-white">
              {divergence.pattern === "BUY_ON_WEAKNESS"
                ? "Buy-on-Weakness Signal"
                : divergence.pattern === "SELL_ON_STRENGTH"
                ? "Sell-on-Strength Signal"
                : "Horizons Aligned"}
            </h4>
            <p className="text-xs text-white/50 mt-1 leading-relaxed">{divergence.message}</p>
          </div>
        </div>
      )}
    </div>
  );
}
