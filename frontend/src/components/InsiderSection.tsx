/**
 * InsiderSection — Live Insider & Promoter Activity
 *
 * Displays bulk deals, block deals, SAST filings, and derived signals
 * from the Insider Agent (BSE live data).
 */

import { TrendingUp, TrendingDown, Minus, Activity, Briefcase, FileText } from "lucide-react";

interface Deal {
  date: string | null;
  clientName: string;
  dealType: "BUY" | "SELL";
  quantity: number;
  price: number;
  totalValue: number;
  clientType: string;
  source: string;
}

interface SASTFiling {
  date: string | null;
  subject: string;
  type: string;
  sentiment: "BULLISH" | "BEARISH" | "NEUTRAL";
}

interface InsiderSignals {
  insiderConfidence: number;
  signal: "ACCUMULATION" | "DISTRIBUTION" | "NEUTRAL";
  signalColor: string;
  promoterBuyCount: number;
  promoterSellCount: number;
  totalBuyValue: number;
  totalSellValue: number;
  bullishFilings: number;
  bearishFilings: number;
  pledgeSignal: "INCREASING" | "DECREASING" | "STABLE";
  pledgeCreations: number;
  pledgeReleases: number;
  totalDeals: number;
  hasFIIActivity: boolean;
  hasMFActivity: boolean;
}

interface Props {
  data: {
    bulkDeals: Deal[];
    blockDeals: Deal[];
    sastFilings: SASTFiling[];
    signals: InsiderSignals;
  };
}

function fmt(n: number) {
  if (n >= 1_00_00_00_000) return `₹${(n / 1_00_00_00_000).toFixed(2)}T`;
  if (n >= 1_00_00_000) return `₹${(n / 1_00_00_000).toFixed(1)} Cr`;
  if (n >= 1_00_000) return `₹${(n / 1_00_000).toFixed(1)} L`;
  return `₹${n.toLocaleString("en-IN")}`;
}

function fmtNum(n: number) {
  if (n >= 1_00_00_000) return `${(n / 1_00_00_000).toFixed(2)} Cr`;
  if (n >= 1_00_000) return `${(n / 1_00_000).toFixed(1)} L`;
  return n.toLocaleString("en-IN");
}

const DEAL_TYPE_COLOR: Record<string, string> = {
  BUY: "text-green-400 bg-green-900/30 border-green-700/50",
  SELL: "text-red-400 bg-red-900/30 border-red-700/50",
};

const SENTIMENT_COLOR: Record<string, string> = {
  BULLISH: "text-green-400 bg-green-900/20",
  BEARISH: "text-red-400 bg-red-900/20",
  NEUTRAL: "text-slate-400 bg-slate-700/30",
};

export default function InsiderSection({ data }: Props) {
  const { bulkDeals, blockDeals, sastFilings, signals } = data;

  if (!signals) return null;

  const allDeals = [...bulkDeals, ...blockDeals].sort((a, b) =>
    (b.date || "").localeCompare(a.date || "")
  );

  const SignalIcon =
    signals.signal === "ACCUMULATION"
      ? TrendingUp
      : signals.signal === "DISTRIBUTION"
      ? TrendingDown
      : Minus;

  const signalColorClass =
    signals.signal === "ACCUMULATION"
      ? "text-green-400"
      : signals.signal === "DISTRIBUTION"
      ? "text-red-400"
      : "text-yellow-400";

  const confidenceBg =
    signals.insiderConfidence >= 60
      ? "bg-green-500"
      : signals.insiderConfidence >= 40
      ? "bg-yellow-500"
      : "bg-red-500";

  return (
    <section className="rounded-2xl glass-card p-6 mt-8">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 rounded-lg bg-purple-500/10 border border-purple-500/20">
          <Activity className="w-5 h-5 text-purple-400" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-white">Insider & Promoter Activity</h2>
          <p className="text-xs text-white/40">
            Live BSE bulk deals, block deals & SAST filings — {signals.totalDeals} deals in last 60 days
          </p>
        </div>
      </div>

      {/* Signal Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        {/* Insider Signal Card */}
        <div className="rounded-xl glass-card p-4 sm:col-span-1">
          <p className="text-xs text-white/35 mb-1">Insider Confidence</p>
          <div className="flex items-center gap-2 mb-2">
            <SignalIcon className={`w-5 h-5 ${signalColorClass}`} />
            <span className={`text-lg font-bold ${signalColorClass}`}>
              {signals.signal}
            </span>
          </div>
          {/* Confidence bar */}
          <div className="h-2 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.08)" }}>
            <div
              className={`h-full rounded-full transition-all ${confidenceBg}`}
              style={{ width: `${signals.insiderConfidence}%` }}
            />
          </div>
          <p className="text-xs text-white/35 mt-1">{signals.insiderConfidence}/100</p>
        </div>

        {/* Promoter Deals */}
        <div className="rounded-xl glass-card p-4">
          <p className="text-xs text-white/35 mb-2">Promoter Deals</p>
          <div className="flex justify-between text-sm">
            <div>
              <span className="text-green-400 font-semibold">{signals.promoterBuyCount}</span>
              <span className="text-white/35 ml-1">buys</span>
            </div>
            <div>
              <span className="text-red-400 font-semibold">{signals.promoterSellCount}</span>
              <span className="text-white/35 ml-1">sells</span>
            </div>
          </div>
          <div className="mt-2 text-xs text-white/35">
            Buy value: <span className="text-green-400">{fmt(signals.totalBuyValue)}</span>
          </div>
          <div className="text-xs text-white/35">
            Sell value: <span className="text-red-400">{fmt(signals.totalSellValue)}</span>
          </div>
        </div>

        {/* Pledge Signal */}
        <div className="rounded-xl glass-card p-4">
          <p className="text-xs text-white/35 mb-2">Pledge Activity (6M)</p>
          <div
            className={`text-base font-bold ${
              signals.pledgeSignal === "INCREASING"
                ? "text-red-400"
                : signals.pledgeSignal === "DECREASING"
                ? "text-green-400"
                : "text-slate-400"
            }`}
          >
            {signals.pledgeSignal}
          </div>
          <div className="mt-1 text-xs text-white/35">
            {signals.pledgeCreations} creation(s) · {signals.pledgeReleases} release(s)
          </div>
          {signals.hasFIIActivity && (
            <div className="mt-2 text-xs text-blue-400">🌐 FII activity detected</div>
          )}
          {signals.hasMFActivity && (
            <div className="text-xs text-cyan-400">🏦 MF activity detected</div>
          )}
        </div>
      </div>

      {/* Deals Table */}
      {allDeals.length > 0 && (
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <Briefcase className="w-4 h-4 text-white/40" />
            <h3 className="text-sm font-medium text-white/70">
              Recent Bulk & Block Deals ({allDeals.length})
            </h3>
          </div>
          <div className="overflow-x-auto rounded-xl border border-white/[0.06]">
            <table className="w-full text-xs">
              <thead>
                <tr style={{ background: "rgba(0,0,0,0.4)" }} className="border-b border-white/[0.06]">
                  <th className="px-3 py-2 text-left text-white/35 font-medium">Date</th>
                  <th className="px-3 py-2 text-left text-white/35 font-medium">Client</th>
                  <th className="px-3 py-2 text-left text-white/35 font-medium">Type</th>
                  <th className="px-3 py-2 text-right text-white/35 font-medium">Qty</th>
                  <th className="px-3 py-2 text-right text-white/35 font-medium">Price</th>
                  <th className="px-3 py-2 text-right text-white/35 font-medium">Value</th>
                  <th className="px-3 py-2 text-left text-white/35 font-medium">Category</th>
                </tr>
              </thead>
              <tbody>
                {allDeals.slice(0, 10).map((deal, i) => (
                  <tr
                    key={i}
                    className="border-b border-white/[0.04] hover:bg-white/[0.03] transition-colors"
                  >
                    <td className="px-3 py-2 text-white/40">{deal.date || "—"}</td>
                    <td className="px-3 py-2 text-white font-medium truncate max-w-[140px]">
                      {deal.clientName}
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={`px-2 py-0.5 rounded-full text-xs border font-medium ${
                          DEAL_TYPE_COLOR[deal.dealType]
                        }`}
                      >
                        {deal.dealType}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right text-white/70">
                      {fmtNum(deal.quantity)}
                    </td>
                    <td className="px-3 py-2 text-right text-white/70">
                      ₹{deal.price.toFixed(2)}
                    </td>
                    <td className="px-3 py-2 text-right font-medium text-white">
                      {fmt(deal.totalValue)}
                    </td>
                    <td className="px-3 py-2">
                      <span style={{ background: "rgba(255,255,255,0.06)" }} className="px-1.5 py-0.5 rounded text-white/40">
                        {deal.clientType}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {allDeals.length > 10 && (
              <p style={{ background: "rgba(0,0,0,0.3)" }} className="px-3 py-2 text-xs text-white/35">
                + {allDeals.length - 10} more deal(s) not shown
              </p>
            )}
          </div>
        </div>
      )}

      {/* SAST Filings */}
      {sastFilings.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <FileText className="w-4 h-4 text-white/40" />
            <h3 className="text-sm font-medium text-white/70">
              SAST / Insider Filings ({sastFilings.length})
            </h3>
          </div>
          <div className="space-y-2">
            {sastFilings.slice(0, 8).map((f, i) => (
              <div
                key={i}
                style={{ background: "rgba(0,0,0,0.3)" }}
                className="flex items-start gap-3 p-3 rounded-lg border border-white/[0.05]"
              >
                <span
                  className={`mt-0.5 px-1.5 py-0.5 rounded text-xs font-medium flex-shrink-0 ${
                    SENTIMENT_COLOR[f.sentiment]
                  }`}
                >
                  {f.sentiment}
                </span>
                <div className="min-w-0">
                  <p className="text-sm text-white/85 leading-snug">{f.subject}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-white/35">{f.date || "—"}</span>
                    <span style={{ background: "rgba(255,255,255,0.06)" }} className="text-xs px-1.5 py-0.5 rounded text-white/40">
                      {f.type}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {allDeals.length === 0 && sastFilings.length === 0 && (
        <div className="text-center py-8 text-white/35">
          <Activity className="w-8 h-8 mx-auto mb-2 opacity-40" />
          <p className="text-sm">No bulk/block deals or insider filings found in the last 60 days</p>
        </div>
      )}
    </section>
  );
}
