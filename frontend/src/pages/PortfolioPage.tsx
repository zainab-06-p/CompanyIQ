/**
 * PortfolioPage — Cross-Portfolio Risk Analysis
 *
 * Users enter their holdings (ticker, shares, buy price, current price),
 * then CompanyIQ runs free_score for each and returns portfolio-level insights:
 * health score, sector exposure, concentration risk, correlated red flags.
 */

import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { API_BASE } from "../utils/api.ts";
import {
  PlusCircle,
  Trash2,
  ArrowLeft,
  BarChart3,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Minus,
  Loader2,
  Layers,
  ShieldAlert,
  PieChart,
} from "lucide-react";

interface Holding {
  ticker: string;
  shares: string;
  buyPrice: string;
  currentPrice: string;
}

interface PortfolioResult {
  portfolio: {
    healthScore: {
      score: number;
      rating: string;
      color: string;
      coverageCount: number;
      totalCount: number;
    } | null;
    grade: { grade: string; label: string; color: string };
    holdings: Array<{
      ticker: string;
      name: string;
      sector: string;
      weight: number;
      companyIQ: number | null;
      rating: string | null;
      currentValue: number;
      gainLossPct: number | null;
      redFlagCount: number;
    }>;
    sectorExposure: Array<{
      sector: string;
      weight: number;
      companies: string[];
      avgIQ: number | null;
      isConcentrated: boolean;
    }>;
    concentration: {
      hhi: number;
      level: string;
      color: string;
      topHolding: { ticker: string; weight: number };
      top5Weight: number;
      stockCount: number;
    };
    diversification: { score: number; level: string };
    correlatedFlags: Array<{
      category: string;
      severity: string;
      message: string;
      affectedCompanies: string[];
      totalWeight: number;
      isSystemic: boolean;
    }>;
    topRisks: Array<{ type: string; severity: string; message: string }>;
    totalValue: number;
    summary: string;
  };
  metadata: {
    holdingsAnalyzed: number;
    totalHoldings: number;
    durationMs: number;
  };
}

const SEVERITY_COLOR: Record<string, string> = {
  CRITICAL: "text-red-400 bg-red-900/20 border-red-700/40",
  HIGH: "text-orange-400 bg-orange-900/20 border-orange-700/40",
  WATCH: "text-yellow-400 bg-yellow-900/20 border-yellow-700/40",
};

const GRADE_COLOR: Record<string, string> = {
  green: "text-green-400 border-green-500/40 bg-green-900/20",
  blue: "text-blue-400 border-blue-500/40 bg-blue-900/20",
  yellow: "text-yellow-400 border-yellow-500/40 bg-yellow-900/20",
  orange: "text-orange-400 border-orange-500/40 bg-orange-900/20",
  red: "text-red-400 border-red-500/40 bg-red-900/20",
};

const HEALTH_COLOR: Record<string, string> = {
  green: "#22c55e",
  yellow: "#eab308",
  orange: "#f97316",
  red: "#ef4444",
};

const SECTOR_COLORS = [
  "#3b82f6", "#10b981", "#f59e0b", "#a855f7", "#ec4899",
  "#06b6d4", "#84cc16", "#f97316", "#6366f1", "#14b8a6",
];

function fmtVal(n: number) {
  if (n >= 1_00_00_000) return `₹${(n / 1_00_00_000).toFixed(2)} Cr`;
  if (n >= 1_00_000) return `₹${(n / 1_00_000).toFixed(1)} L`;
  return `₹${n.toLocaleString("en-IN")}`;
}

export default function PortfolioPage() {
  const PORTFOLIO_STATE_KEY = "companyiq:portfolio-state:v1";
  const navigate = useNavigate();
  const location = useLocation();
  const trackedPortfolioKeyRef = useRef<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [holdings, setHoldings] = useState<Holding[]>([
    { ticker: "", shares: "", buyPrice: "", currentPrice: "" },
  ]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<PortfolioResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      const restoreState = (location.state as any)?.restoreState;
      if (restoreState && Array.isArray(restoreState.holdings)) {
        if (restoreState.holdings.length > 0) {
          setHoldings(restoreState.holdings);
        }
        setResult(restoreState.result || null);
        setHydrated(true);
        return;
      }

      const raw = sessionStorage.getItem(PORTFOLIO_STATE_KEY);
      if (!raw) {
        setHydrated(true);
        return;
      }
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed.holdings) && parsed.holdings.length > 0) {
        setHoldings(parsed.holdings);
      }
      setResult(parsed.result || null);
    } catch {
      // Ignore corrupted session cache.
    } finally {
      setHydrated(true);
    }
  }, [location.state]);

  useEffect(() => {
    if (!hydrated) return;
    const snapshot = { holdings, result };
    sessionStorage.setItem(PORTFOLIO_STATE_KEY, JSON.stringify(snapshot));
  }, [holdings, result, hydrated]);

  useEffect(() => {
    if (!result?.portfolio?.holdings?.length) return;

    const token = localStorage.getItem("token");
    if (!token) return;

    const generatedKey = [
      result.metadata?.durationMs,
      result.metadata?.holdingsAnalyzed,
      ...result.portfolio.holdings.map((h) => `${h.ticker}:${h.companyIQ ?? ""}`),
    ].join("|");
    if (trackedPortfolioKeyRef.current === generatedKey) return;
    trackedPortfolioKeyRef.current = generatedKey;

    for (const h of result.portfolio.holdings) {
      fetch(`${API_BASE}/history/track`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          ticker: h.ticker,
          companyName: h.name || h.ticker,
          sector: h.sector || null,
          companyIQ: h.companyIQ,
          rating: h.rating,
          tier: "free_score",
          source: "portfolio",
        }),
      }).catch(() => {
        // History tracking should not block UI rendering.
      });
    }
  }, [result]);

  function addHolding() {
    if (holdings.length >= 15) return;
    setHoldings([...holdings, { ticker: "", shares: "", buyPrice: "", currentPrice: "" }]);
  }

  function removeHolding(idx: number) {
    setHoldings(holdings.filter((_, i) => i !== idx));
  }

  function updateHolding(idx: number, field: keyof Holding, value: string) {
    const updated = [...holdings];
    updated[idx] = { ...updated[idx], [field]: value };
    setHoldings(updated);
  }

  async function analyzePortfolio() {
    const valid = holdings.filter(
      (h) => h.ticker.trim() && parseFloat(h.shares) > 0 && parseFloat(h.currentPrice) > 0
    );
    if (valid.length === 0) {
      setError("Add at least one holding with ticker, shares, and current price.");
      return;
    }

    setError(null);
    setLoading(true);
    setResult(null);

    try {
      const res = await fetch("/api/portfolio/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          holdings: valid.map((h) => ({
            ticker: h.ticker.trim().toUpperCase(),
            shares: parseFloat(h.shares),
            buyPrice: parseFloat(h.buyPrice) || 0,
            currentPrice: parseFloat(h.currentPrice),
          })),
        }),
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.message || "Portfolio analysis failed");
      }
      setResult(data);
    } catch (err: any) {
      setError(err.message || "Analysis failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  const p = result?.portfolio;

  return (
    <div className="min-h-screen pb-16 themed-page">
      {/* Header */}
      <header className="sticky top-0 z-40 themed-sticky-header">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <button
            onClick={() => navigate("/")}
            className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="text-sm">Home</span>
          </button>
          <div className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-blue-400" />
            <span className="text-white font-semibold">Portfolio Analyser</span>
          </div>
          <span className="themed-header-chip">Cross-Holding Risk Lens</span>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 pt-8 themed-main">
        {/* Input Section */}
        <div className="glass-card hero-glass-card rounded-2xl p-6 mb-8">
          <h2 className="text-xl font-bold text-white mb-1">Enter Your Holdings</h2>
          <p className="text-sm text-white/40 mb-6">
            Add up to 15 stocks. CompanyIQ will analyse each and compute cross-portfolio risk.
          </p>

          {/* Holdings table */}
          <div className="space-y-2 mb-4">
            {/* Column headers */}
            <div className="hidden sm:grid grid-cols-12 gap-2 px-1 text-xs text-slate-500 font-medium">
              <div className="col-span-3">Ticker / Company</div>
              <div className="col-span-2">Shares</div>
              <div className="col-span-2">Buy Price (₹)</div>
              <div className="col-span-2">Current Price (₹)</div>
              <div className="col-span-2">Value</div>
              <div className="col-span-1" />
            </div>

            {holdings.map((h, i) => {
              const val =
                parseFloat(h.shares) > 0 && parseFloat(h.currentPrice) > 0
                  ? parseFloat(h.shares) * parseFloat(h.currentPrice)
                  : 0;

              return (
                <div key={i} className="grid grid-cols-12 gap-2 items-center">
                  <input
                    className="col-span-3 px-3 py-2 rounded-lg text-white text-sm placeholder-white/20 outline-none transition-colors"
                    style={{ background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.08)" }}
                    placeholder="RELIANCE"
                    value={h.ticker}
                    onChange={(e) =>
                      updateHolding(i, "ticker", e.target.value.toUpperCase())
                    }
                  />
                  <input
                    type="number"
                    className="col-span-2 px-3 py-2 rounded-lg text-white text-sm placeholder-white/20 outline-none transition-colors"
                    style={{ background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.08)" }}
                    placeholder="100"
                    value={h.shares}
                    onChange={(e) => updateHolding(i, "shares", e.target.value)}
                  />
                  <input
                    type="number"
                    className="col-span-2 px-3 py-2 rounded-lg text-white text-sm placeholder-white/20 outline-none transition-colors"
                    style={{ background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.08)" }}
                    placeholder="2400"
                    value={h.buyPrice}
                    onChange={(e) => updateHolding(i, "buyPrice", e.target.value)}
                  />
                  <input
                    type="number"
                    className="col-span-2 px-3 py-2 rounded-lg text-white text-sm placeholder-white/20 outline-none transition-colors"
                    style={{ background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.08)" }}
                    placeholder="2650"
                    value={h.currentPrice}
                    onChange={(e) =>
                      updateHolding(i, "currentPrice", e.target.value)
                    }
                  />
                  <div className="col-span-2 text-sm text-slate-400 px-1">
                    {val > 0 ? fmtVal(val) : "—"}
                  </div>
                  <button
                    onClick={() => removeHolding(i)}
                    disabled={holdings.length === 1}
                    className="col-span-1 flex justify-center text-white/20 hover:text-red-400 transition-colors disabled:opacity-20"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              );
            })}
          </div>

          <div className="flex items-center gap-4 mt-4">
            <button
              onClick={addHolding}
              disabled={holdings.length >= 15}
              className="flex items-center gap-2 text-sm hover:opacity-80 transition-opacity disabled:opacity-30"
              style={{ color: "#00ff87" }}
            >
              <PlusCircle className="w-4 h-4" />
              Add holding {holdings.length < 15 && `(${15 - holdings.length} remaining)`}
            </button>

            <button
              onClick={analyzePortfolio}
              disabled={loading}
              className="ml-auto px-6 py-2.5 rounded-xl font-bold text-black text-sm transition-opacity flex items-center gap-2 disabled:opacity-50"
              style={{ background: "#00ff87" }}
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Analysing...
                </>
              ) : (
                <>
                  <BarChart3 className="w-4 h-4" />
                  Analyse Portfolio
                </>
              )}
            </button>
          </div>

          {error && (
            <div className="mt-4 p-3 bg-red-900/20 border border-red-700/40 rounded-lg text-red-400 text-sm">
              {error}
            </div>
          )}

          {loading && (
            <div className="mt-4 p-4 bg-slate-900/50 rounded-xl border border-slate-700 text-sm text-slate-400">
              <div className="flex items-center gap-2 mb-2">
                <Loader2 className="w-4 h-4 animate-spin" style={{ color: "#00ff87" }} />
                <span className="text-white">Running CompanyIQ analysis for each holding…</span>
              </div>
              <p className="text-xs">
                This may take 3–15 minutes depending on how many companies need fresh data. Cached results are returned instantly.
              </p>
            </div>
          )}
        </div>

        {/* Results */}
        {p && (
          <div className="space-y-6">
            {/* Portfolio Health + Grade */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Health Score */}
              <div className="md:col-span-2 rounded-2xl glass-card p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-bold text-white">Portfolio Health Score</h3>
                  <span className="text-xs text-white/35">
                    {result?.metadata.holdingsAnalyzed}/{result?.metadata.totalHoldings} analysed
                  </span>
                </div>
                {p.healthScore ? (
                  <div className="flex items-center gap-6">
                    {/* Big score */}
                    <div
                      className="text-6xl font-black"
                      style={{ color: HEALTH_COLOR[p.healthScore.color] || "#fff" }}
                    >
                      {p.healthScore.score}
                    </div>
                    <div>
                      <div
                        className="text-xl font-bold"
                        style={{ color: HEALTH_COLOR[p.healthScore.color] || "#fff" }}
                      >
                        {p.healthScore.rating}
                      </div>
                      <p className="text-sm text-white/40 mt-1">Weighted CompanyIQ</p>
                      <p className="text-xs text-white/30">{p.diversification.level}</p>
                    </div>
                  </div>
                ) : (
                  <p className="text-white/35">No CompanyIQ scores available yet</p>
                )}
              </div>

              {/* Grade */}
              <div
                className={`rounded-2xl border p-6 flex flex-col items-center justify-center ${
                  GRADE_COLOR[p.grade.color] || ""
                }`}
              >
                <div className="text-6xl font-black">{p.grade.grade}</div>
                <div className="text-sm font-medium mt-1">{p.grade.label}</div>
                <div className="text-xs mt-2 opacity-70">
                  Total: {fmtVal(p.totalValue)}
                </div>
              </div>
            </div>

            {/* Holdings Table */}
              <div className="rounded-2xl glass-card p-6">
              <h3 className="text-base font-semibold text-white mb-4">Holdings Breakdown</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/[0.06] text-xs text-white/35">
                      <th className="pb-2 text-left">Company</th>
                      <th className="pb-2 text-left">Sector</th>
                      <th className="pb-2 text-right">Weight</th>
                      <th className="pb-2 text-right">CompanyIQ</th>
                      <th className="pb-2 text-right">Value</th>
                      <th className="pb-2 text-right">G/L %</th>
                      <th className="pb-2 text-right">Flags</th>
                    </tr>
                  </thead>
                  <tbody>
                    {p.holdings.map((h, i) => (
                      <tr
                        key={i}
                        className="border-b border-white/[0.04] hover:bg-white/[0.02] cursor-pointer"
                        onClick={() =>
                          navigate(`/report/${encodeURIComponent(h.ticker)}`, {
                            state: {
                              returnTo: "/portfolio",
                              returnLabel: "Back to Portfolio",
                              restoreState: {
                                holdings,
                                result,
                              },
                            },
                          })
                        }
                      >
                        <td className="py-2.5 pr-4">
                          <div className="font-medium text-white">{h.name}</div>
                          <div className="text-xs text-white/35 font-mono">{h.ticker}</div>
                        </td>
                          <td className="py-2.5 pr-4 text-white/35 text-xs">{h.sector}</td>
                          <td className="py-2.5 text-right font-medium text-white/60">
                          {h.weight.toFixed(1)}%
                        </td>
                        <td className="py-2.5 text-right">
                          {h.companyIQ != null ? (
                            <span
                              className={`font-bold ${
                                h.companyIQ >= 70
                                  ? "text-green-400"
                                  : h.companyIQ >= 50
                                  ? "text-yellow-400"
                                  : "text-red-400"
                              }`}
                            >
                              {h.companyIQ}
                            </span>
                          ) : (
                            <span className="text-white/30">—</span>
                          )}
                        </td>
                          <td className="py-2.5 text-right text-white/60">
                          {fmtVal(h.currentValue)}
                        </td>
                        <td className="py-2.5 text-right">
                          {h.gainLossPct != null ? (
                            <span
                              className={`flex items-center justify-end gap-0.5 ${
                                h.gainLossPct >= 0 ? "text-green-400" : "text-red-400"
                              }`}
                            >
                              {h.gainLossPct >= 0 ? (
                                <TrendingUp className="w-3 h-3" />
                              ) : (
                                <TrendingDown className="w-3 h-3" />
                              )}
                              {Math.abs(h.gainLossPct).toFixed(1)}%
                            </span>
                          ) : (
                            <Minus className="w-3 h-3 text-white/20 ml-auto" />
                          )}
                        </td>
                        <td className="py-2.5 text-right">
                          {h.redFlagCount > 0 ? (
                            <span className="text-red-400 text-xs font-medium">
                              {h.redFlagCount}⚠
                            </span>
                          ) : (
                            <span className="text-green-400 text-xs">✓</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Sector Exposure + Concentration */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Sector Exposure */}
              <div className="rounded-2xl glass-card p-6">
                <div className="flex items-center gap-2 mb-4">
                  <PieChart className="w-4 h-4" style={{ color: "#00e5ff" }} />
                  <h3 className="text-base font-semibold text-white">Sector Exposure</h3>
                </div>
                <div className="space-y-3">
                  {p.sectorExposure.map((s, i) => (
                    <div key={i}>
                      <div className="flex items-center justify-between text-sm mb-1">
                        <div className="flex items-center gap-2">
                          <span
                            className="w-2 h-2 rounded-full flex-shrink-0"
                            style={{ backgroundColor: SECTOR_COLORS[i % SECTOR_COLORS.length] }}
                          />
                          <span className="text-slate-300">{s.sector}</span>
                          {s.isConcentrated && (
                            <span className="text-xs text-orange-400">⚠ Concentrated</span>
                          )}
                        </div>
                        <span className="text-white font-medium">{s.weight}%</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-slate-700 overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${s.weight}%`,
                            backgroundColor: SECTOR_COLORS[i % SECTOR_COLORS.length],
                          }}
                        />
                      </div>
                      <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-600">
                        <span>{s.companies.join(", ")}</span>
                        {s.avgIQ != null && (
                          <span className="text-slate-500">• Avg IQ: {s.avgIQ}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Concentration Risk */}
              <div className="rounded-2xl glass-card p-6">
                <div className="flex items-center gap-2 mb-4">
                  <ShieldAlert className="w-4 h-4 text-purple-400" />
                  <h3 className="text-base font-semibold text-white">Concentration Risk</h3>
                </div>
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-white/40">HHI Index</span>
                      <span
                        className={`font-bold ${
                          p.concentration.level === "HIGH"
                            ? "text-red-400"
                            : p.concentration.level === "MODERATE"
                            ? "text-yellow-400"
                            : "text-green-400"
                        }`}
                      >
                        {p.concentration.hhi} — {p.concentration.level}
                      </span>
                    </div>
                    <div className="h-2 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
                      <div
                        className={`h-full rounded-full ${
                          p.concentration.level === "HIGH"
                            ? "bg-red-500"
                            : p.concentration.level === "MODERATE"
                            ? "bg-yellow-500"
                            : "bg-green-500"
                        }`}
                        style={{
                          width: `${Math.min(100, (p.concentration.hhi / 5000) * 100)}%`,
                        }}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <span className="text-white/30 block text-xs">Largest holding</span>
                      <span className="text-white font-medium">
                        {p.concentration.topHolding.ticker}
                      </span>
                      <span className="text-white/50 ml-1">
                        ({p.concentration.topHolding.weight}%)
                      </span>
                    </div>
                    <div>
                      <span className="text-white/30 block text-xs">Top 5 weight</span>
                      <span className="text-white font-medium">
                        {p.concentration.top5Weight}%
                      </span>
                    </div>
                    <div>
                      <span className="text-white/30 block text-xs">Diversification</span>
                      <span className="text-white font-medium">
                        {p.diversification.level}
                      </span>
                    </div>
                    <div>
                      <span className="text-white/30 block text-xs">Total stocks</span>
                      <span className="text-white font-medium">
                        {p.concentration.stockCount}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Top Risks */}
            {p.topRisks.length > 0 && (
              <div className="rounded-2xl glass-card p-6">
                <div className="flex items-center gap-2 mb-4">
                  <AlertTriangle className="w-4 h-4 text-red-400" />
                  <h3 className="text-base font-semibold text-white">Top Portfolio Risks</h3>
                </div>
                <div className="space-y-2">
                  {p.topRisks.map((r, i) => (
                    <div
                      key={i}
                      className={`flex items-start gap-2.5 p-3 rounded-lg border text-sm ${
                      SEVERITY_COLOR[r.severity] || "text-white/50 border-white/[0.08]"
                      }`}
                    >
                      <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                      <div>
                        <span className="text-xs opacity-60 mr-2">{r.severity}</span>
                        {r.message}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Correlated Flags */}
            {p.correlatedFlags.length > 0 && (
              <div className="rounded-2xl glass-card p-6">
                <div className="flex items-center gap-2 mb-4">
                  <AlertTriangle className="w-4 h-4 text-orange-400" />
                  <h3 className="text-base font-semibold text-white">
                    Correlated Red Flags
                    <span className="text-sm font-normal text-white/35 ml-2">
                      — issues affecting multiple holdings
                    </span>
                  </h3>
                </div>
                <div className="space-y-3">
                  {p.correlatedFlags.map((f, i) => (
                    <div
                      key={i}
                      className={`p-3 rounded-lg border text-sm ${
                        SEVERITY_COLOR[f.severity] ||
                        "text-white/50 border-white/[0.08]"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-medium">{f.message}</span>
                        {f.isSystemic && (
                          <span className="text-xs px-1.5 py-0.5 rounded bg-red-900/30 text-red-400 border border-red-700/30 ml-2 flex-shrink-0">
                            SYSTEMIC
                          </span>
                        )}
                      </div>
                      <div className="text-xs opacity-70">
                        Affects: {f.affectedCompanies.join(", ")} &nbsp;·&nbsp;{" "}
                        {f.totalWeight}% of portfolio
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <p className="text-xs text-white/20 text-center pb-4">
              Analysis based on CompanyIQ free scores · Generated in{" "}
              {((result?.metadata.durationMs || 0) / 1000).toFixed(1)}s
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
