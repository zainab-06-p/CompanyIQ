import { ThumbsUp, ThumbsDown, Minus } from "lucide-react";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
} from "recharts";

interface Props {
  data: {
    score: number;
    positive: number;
    negative: number;
    neutral: number;
    total: number;
    topThemes?: Array<{ theme: string; count: number }>;
    flags?: Array<{ type: string; message: string }>;
    articles?: Array<{
      headline: string;
      source?: string;
      date?: string;
      sentiment?: string;
      topic?: string;
    }>;
  };
}

export default function SentimentSection({ data }: Props) {
  const COLORS = ["#22c55e", "#ef4444", "#64748b"];
  const pieData = [
    { name: "Positive", value: data.positive || 0 },
    { name: "Negative", value: data.negative || 0 },
    { name: "Neutral", value: data.neutral || 0 },
  ].filter((d) => d.value > 0);

  return (
    <div className="glass-card rounded-2xl p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-white">News Sentiment</h2>
        <div className="flex items-center gap-2">
          <span className="text-sm text-white/40">Score:</span>
          <span className="text-lg font-bold text-purple-400">
            {Math.round(data.score)}/100
          </span>
        </div>
      </div>

      {/* Sentiment Breakdown */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-green-900/20 border border-green-800/30 rounded-lg p-4 text-center">
          <ThumbsUp className="w-5 h-5 text-green-400 mx-auto mb-2" />
          <div className="text-2xl font-bold text-green-400">{data.positive}</div>
          <div className="text-xs text-white/40">Positive</div>
        </div>
        <div className="bg-red-900/20 border border-red-800/30 rounded-lg p-4 text-center">
          <ThumbsDown className="w-5 h-5 text-red-400 mx-auto mb-2" />
          <div className="text-2xl font-bold text-red-400">{data.negative}</div>
          <div className="text-xs text-white/40">Negative</div>
        </div>
        <div style={{ background: "rgba(255,255,255,0.04)" }} className="border border-white/[0.06] rounded-lg p-4 text-center">
          <Minus className="w-5 h-5 text-white/40 mx-auto mb-2" />
          <div className="text-2xl font-bold text-white">{data.neutral}</div>
          <div className="text-xs text-white/40">Neutral</div>
        </div>
      </div>

      {/* Sentiment Donut */}
      {pieData.length > 0 && (
        <div className="mb-6">
          <div style={{ background: "rgba(0,0,0,0.3)" }} className="rounded-xl p-4 flex flex-col items-center">
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={75}
                  paddingAngle={3}
                  dataKey="value"
                  strokeWidth={0}
                >
                  {pieData.map((_entry, index) => (
                    <Cell key={index} fill={COLORS[["Positive", "Negative", "Neutral"].indexOf(_entry.name)] || COLORS[2]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ backgroundColor: "rgba(4,8,20,0.98)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px" }}
                  formatter={((value: any, name: any) => [`${value} articles`, name]) as any}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex gap-4 mt-1">
              <span className="flex items-center gap-1.5 text-xs text-white/40">
                <span className="w-2.5 h-2.5 rounded-full bg-green-500" /> Positive
              </span>
              <span className="flex items-center gap-1.5 text-xs text-white/40">
                <span className="w-2.5 h-2.5 rounded-full bg-red-500" /> Negative
              </span>
              <span className="flex items-center gap-1.5 text-xs text-white/40">
                <span className="w-2.5 h-2.5 rounded-full bg-slate-500" /> Neutral
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Top Themes */}
      {data.topThemes && data.topThemes.length > 0 && (
        <div className="mb-6">
          <h3 className="text-sm font-semibold text-white/40 uppercase tracking-wider mb-3">
            Top Themes
          </h3>
          <div className="flex flex-wrap gap-2">
            {data.topThemes.map((theme, i) => (
              <span
                key={i}
                style={{ background: "rgba(255,255,255,0.05)" }}
                className="px-3 py-1 border border-white/[0.08] rounded-full text-sm text-white/70"
              >
                {theme.theme}
                <span className="text-white/30 ml-1">×{theme.count}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Headlines */}
      {data.articles && data.articles.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-white/40 uppercase tracking-wider mb-3">
            Recent Headlines ({data.total} total)
          </h3>
          <div className="space-y-1 max-h-64 overflow-y-auto">
            {data.articles.map((article, i) => (
              <div
                key={i}
                className="flex items-start gap-3 py-2 border-b border-white/[0.05]"
              >
                <span className="mt-1 shrink-0">
                  {article.sentiment === "POSITIVE" ? (
                    <ThumbsUp className="w-3.5 h-3.5 text-green-500" />
                  ) : article.sentiment === "NEGATIVE" ? (
                    <ThumbsDown className="w-3.5 h-3.5 text-red-500" />
                  ) : (
                    <Minus className="w-3.5 h-3.5 text-slate-500" />
                  )}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-white/80 leading-snug">
                    {article.headline}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    {article.source && (
                      <span className="text-xs text-white/35">{article.source}</span>
                    )}
                    {article.date && (
                      <span className="text-xs text-white/25">{article.date}</span>
                    )}
                    {article.topic && article.topic !== "Other" && (
                      <span className="text-xs text-blue-400">{article.topic}</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
