import { formatPercent } from "../utils/formatters.ts";
import { Shield, Users, AlertTriangle } from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Cell,
} from "recharts";

interface Props {
  data: {
    score: number;
    flags?: Array<{ type: string; message: string }>;
    shareholding?: {
      latest?: {
        promoterHolding?: number;
        pledgedPercent?: number;
        fiiHolding?: number;
        diiHolding?: number;
        retailHolding?: number;
      };
      trend?: Array<{ quarter: string; promoterHolding: number; pledgedPercent: number }>;
    };
    announcements?: Array<{ subject: string; date: string; category: string }>;
    directors?: Array<{ name: string; designation: string }>;
  };
}

export default function LegalSection({ data }: Props) {
  const sh = data.shareholding?.latest;

  return (
    <div className="glass-card rounded-2xl p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <Shield className="w-5 h-5 text-green-400" />
          Legal &amp; Governance
        </h2>
        <div className="flex items-center gap-2">
          <span className="text-sm text-white/40">Score:</span>
          <span className="text-lg font-bold text-green-400">{Math.round(data.score)}/100</span>
        </div>
      </div>

      {/* Shareholding */}
      {sh && (
        <div className="mb-6">
          <h3 className="text-sm font-semibold text-white/40 uppercase tracking-wider mb-3">
            Shareholding Pattern
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <HoldingCard label="Promoter" value={sh.promoterHolding} color="text-blue-400" />
            <HoldingCard label="Pledged" value={sh.pledgedPercent} color={
              (sh.pledgedPercent || 0) > 30 ? "text-red-400" : "text-slate-300"
            } />
            <HoldingCard label="FII" value={sh.fiiHolding} color="text-purple-400" />
            <HoldingCard label="DII" value={sh.diiHolding} color="text-green-400" />
            <HoldingCard label="Retail" value={sh.retailHolding} color="text-yellow-400" />
          </div>
        </div>
      )}

      {/* Shareholding Trend */}
      {data.shareholding?.trend && data.shareholding.trend.length > 0 && (
        <div className="mb-6">
          <h3 className="text-sm font-semibold text-white/40 uppercase tracking-wider mb-3">
            Promoter Holding Trend
          </h3>
          <div className="rounded-xl p-4" style={{ background: "rgba(0,0,0,0.3)" }}>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={data.shareholding.trend} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis dataKey="quarter" tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 11 }} />
                <YAxis domain={[0, 100]} tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 11 }} tickFormatter={(v) => `${v}%`} />
                <Tooltip
                  contentStyle={{ backgroundColor: "rgba(4,8,20,0.98)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px" }}
                  labelStyle={{ color: "rgba(255,255,255,0.8)" }}
                  formatter={((value: any, name: any) => [`${Number(value)?.toFixed(1)}%`, name === "promoterHolding" ? "Promoter" : "Pledged"]) as any}
                />
                <Bar dataKey="promoterHolding" name="promoterHolding" radius={[4, 4, 0, 0]}>
                  {data.shareholding.trend.map((_: any, i: number) => (
                    <Cell key={i} fill="#3b82f6" fillOpacity={0.6 + (i / data.shareholding!.trend!.length) * 0.4} />
                  ))}
                </Bar>
                <Bar dataKey="pledgedPercent" name="pledgedPercent" radius={[4, 4, 0, 0]} fill="#ef4444" fillOpacity={0.7} />
              </BarChart>
            </ResponsiveContainer>
            <div className="flex justify-center gap-6 mt-2">
              <span className="flex items-center gap-1.5 text-xs text-white/40">
                <span className="w-3 h-3 bg-blue-500 rounded-sm" /> Promoter
              </span>
              <span className="flex items-center gap-1.5 text-xs text-white/40">
                <span className="w-3 h-3 bg-red-500 rounded-sm" /> Pledged
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Legal Flags */}
      {data.flags && data.flags.length > 0 && (
        <div className="mb-6">
          <h3 className="text-sm font-semibold text-white/40 uppercase tracking-wider mb-3">
            Governance Flags
          </h3>
          <div className="space-y-2">
            {data.flags.map((flag, i) => (
              <div key={i} className="flex items-start gap-2 text-sm">
                <AlertTriangle className="w-4 h-4 text-yellow-500 mt-0.5 shrink-0" />
                <span className="text-white/70">{flag.message}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent Announcements */}
      {data.announcements && data.announcements.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-white/40 uppercase tracking-wider mb-3">
            Recent BSE Announcements
          </h3>
          <div className="space-y-1 max-h-48 overflow-y-auto">
            {data.announcements.slice(0, 10).map((ann, i) => (
              <div key={i} className="flex items-start gap-3 py-2 border-b border-white/[0.05]">
                <span className="text-xs text-white/30 shrink-0 mt-0.5">{ann.date}</span>
                <span className="text-sm text-white/70">{ann.subject}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function HoldingCard({ label, value, color }: { label: string; value?: number; color: string }) {
  return (
    <div className="rounded-lg p-3 text-center" style={{ background: "rgba(0,0,0,0.3)" }}>
      <div className="text-xs text-white/40 mb-1">{label}</div>
      <div className={`text-lg font-bold ${color}`}>
        {value != null ? formatPercent(value) : "—"}
      </div>
    </div>
  );
}
