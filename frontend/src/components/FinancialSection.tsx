import { formatPercent, formatNumber } from "../utils/formatters.ts";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";

interface Props {
  data: {
    score: number;
    breakdown?: {
      profitability: number;
      liquidity: number;
      solvency: number;
      growth: number;
    };
    ratios?: Record<string, any>;
    raw?: {
      profitLoss?: any;
      balanceSheet?: any;
      cashFlow?: any;
    };
  };
}

export default function FinancialSection({ data }: Props) {
  const { ratios } = data;

  const ratioGroups = [
    {
      title: "Profitability",
      items: [
        { label: "Net Profit Margin", value: ratios?.netProfitMargin, fmt: "pct" },
        { label: "EBITDA Margin", value: ratios?.ebitdaMargin, fmt: "pct" },
        { label: "ROE", value: ratios?.returnOnEquity, fmt: "pct" },
        { label: "ROA", value: ratios?.returnOnAssets, fmt: "pct" },
        { label: "ROCE", value: ratios?.roce, fmt: "pct" },
        { label: "Operating Margin", value: ratios?.operatingProfitMargin, fmt: "pct" },
      ],
    },
    {
      title: "Liquidity & Solvency",
      items: [
        { label: "Current Ratio", value: ratios?.currentRatio, fmt: "num" },
        { label: "Debt-to-Equity", value: ratios?.debtToEquity, fmt: "num" },
        { label: "Interest Coverage", value: ratios?.interestCoverage, fmt: "num" },
        { label: "Net Debt / EBITDA", value: ratios?.netDebt, fmt: "num" },
        { label: "Asset Turnover", value: ratios?.assetTurnover, fmt: "num" },
      ],
    },
    {
      title: "Growth",
      items: [
        { label: "Revenue CAGR (3yr)", value: ratios?.revenueCAGR3yr, fmt: "pct" },
        { label: "PAT CAGR (3yr)", value: ratios?.patCAGR3yr, fmt: "pct" },
        { label: "EPS CAGR (3yr)", value: ratios?.epsGrowthCAGR, fmt: "pct" },
        { label: "QoQ Revenue Growth", value: ratios?.qoqRevenueGrowth, fmt: "pct" },
        { label: "YoY Revenue Growth", value: ratios?.yoyRevenueGrowth, fmt: "pct" },
      ],
    },
    {
      title: "Valuation",
      items: [
        { label: "P/E", value: ratios?.pe, fmt: "num" },
        { label: "P/B", value: ratios?.pb, fmt: "num" },
        { label: "EV/EBITDA", value: ratios?.evEbitda, fmt: "num" },
        { label: "P/S", value: ratios?.priceToSales, fmt: "num" },
        { label: "Dividend Yield", value: ratios?.dividendYield, fmt: "pct" },
      ],
    },
  ];

  // Prepare quarterly chart data
  const quarterlyData = (data.raw?.profitLoss?.quarterly || [])
    .slice()
    .reverse()
    .map((q: any) => ({
      period: q.period?.replace(/\s+/g, " ").trim() || "—",
      revenue: q.revenue || 0,
      netProfit: q.netProfit || 0,
    }));

  return (
    <div className="glass-card rounded-2xl p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-white">Financial Analysis</h2>
        <div className="flex items-center gap-2">
          <span className="text-sm text-white/40">Score:</span>
          <span className="text-lg font-bold" style={{ color: "#00e5ff" }}>{Math.round(data.score)}/100</span>
        </div>
      </div>

      {/* Breakdown bar */}
      {data.breakdown && (
        <div className="grid grid-cols-4 gap-3 mb-6">
          {Object.entries(data.breakdown).map(([key, val]) => (
            <div key={key} className="text-center rounded-lg p-3" style={{ background: "rgba(0,0,0,0.3)" }}>
              <div className="text-xs text-white/40 capitalize mb-1">{key}</div>
              <div className="text-lg font-bold text-white">{Math.round(val as number)}</div>
            </div>
          ))}
        </div>
      )}

      {/* Revenue & Profit Trend Chart */}
      {quarterlyData.length > 0 && (
        <div className="mb-6">
          <h3 className="text-sm font-semibold text-white/40 uppercase tracking-wider mb-3">
            Quarterly Revenue &amp; Profit Trend
          </h3>
          <div className="rounded-xl p-4" style={{ background: "rgba(0,0,0,0.3)" }}>
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={quarterlyData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                <defs>
                  <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorProfit" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis dataKey="period" tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 11 }} />
                <YAxis tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 11 }} tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}K` : String(v)} />
                <Tooltip
                  contentStyle={{ backgroundColor: "rgba(4,8,20,0.98)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px" }}
                  labelStyle={{ color: "rgba(255,255,255,0.8)" }}
                  itemStyle={{ color: "rgba(255,255,255,0.7)" }}
                  formatter={((value: any) => [`₹${Number(value)?.toLocaleString("en-IN")} Cr`, undefined]) as any}
                />
                <Area type="monotone" dataKey="revenue" name="Revenue" stroke="#3b82f6" fill="url(#colorRevenue)" strokeWidth={2} />
                <Area type="monotone" dataKey="netProfit" name="Net Profit" stroke="#10b981" fill="url(#colorProfit)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
            <div className="flex justify-center gap-6 mt-2">
              <span className="flex items-center gap-1.5 text-xs text-white/40">
                <span className="w-3 h-0.5 bg-blue-500 rounded" /> Revenue
              </span>
              <span className="flex items-center gap-1.5 text-xs text-white/40">
                <span className="w-3 h-0.5 bg-emerald-500 rounded" /> Net Profit
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Ratio Groups */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {ratioGroups.map((group) => (
          <div key={group.title}>
            <h3 className="text-sm font-semibold text-white/40 uppercase tracking-wider mb-3">
              {group.title}
            </h3>
            <div className="space-y-2">
              {group.items.map((item) => (
                <div
                  key={item.label}
                  className="flex items-center justify-between py-1.5 border-b border-white/[0.05]"
                >
                  <span className="text-sm text-white/60">{item.label}</span>
                  <span className="text-sm font-mono text-white">
                    {item.value != null
                      ? item.fmt === "pct"
                        ? formatPercent(item.value)
                        : typeof item.value === "number"
                        ? item.value.toFixed(2)
                        : typeof item.value === "string"
                        ? parseFloat(item.value).toFixed(2)
                        : item.value
                      : "—"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
