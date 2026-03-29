import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { API_BASE, searchCompanies, compareCompanies, type CompanyResult } from "../utils/api.ts";
import ScoreGauge from "../components/ScoreGauge.tsx";
import { ArrowLeft, Swords, Loader2, TrendingUp, TrendingDown, Minus, Trophy } from "lucide-react";

type CompareResult = {
  companyA: any;
  companyB: any;
  comparison: {
    winner: string;
    scoreDiff: number;
    metrics: Array<{
      label: string;
      valueA: number | null;
      valueB: number | null;
      format: string;
      winner: "A" | "B" | "tie";
    }>;
  };
  metadata: { durationMs: number };
};

export default function ComparePage() {
  const COMPARE_STATE_KEY = "companyiq:compare-state:v1";
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [queryA, setQueryA] = useState("");
  const [queryB, setQueryB] = useState("");
  const [suggestionsA, setSuggestionsA] = useState<CompanyResult[]>([]);
  const [suggestionsB, setSuggestionsB] = useState<CompanyResult[]>([]);
  const [selectedA, setSelectedA] = useState<string | null>(null);
  const [selectedB, setSelectedB] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CompareResult | null>(null);
  const trackedCompareKeyRef = useRef<string | null>(null);
  const appliedUrlPrefillRef = useRef(false);
  const autoComparedFromUrlRef = useRef(false);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(COMPARE_STATE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      setQueryA(typeof parsed.queryA === "string" ? parsed.queryA : "");
      setQueryB(typeof parsed.queryB === "string" ? parsed.queryB : "");
      setSelectedA(typeof parsed.selectedA === "string" ? parsed.selectedA : null);
      setSelectedB(typeof parsed.selectedB === "string" ? parsed.selectedB : null);
      setResult(parsed.result || null);
    } catch {
      // Ignore corrupted session cache.
    }
  }, []);

  useEffect(() => {
    const snapshot = {
      queryA,
      queryB,
      selectedA,
      selectedB,
      result,
    };
    sessionStorage.setItem(COMPARE_STATE_KEY, JSON.stringify(snapshot));
  }, [queryA, queryB, selectedA, selectedB, result]);

  useEffect(() => {
    if (appliedUrlPrefillRef.current) return;

    const a = String(searchParams.get("a") || "").trim();
    const b = String(searchParams.get("b") || "").trim();
    if (!a || !b) {
      appliedUrlPrefillRef.current = true;
      return;
    }

    setQueryA(a);
    setQueryB(b);
    setSelectedA(a);
    setSelectedB(b);
    appliedUrlPrefillRef.current = true;
  }, [searchParams]);

  useEffect(() => {
    if (autoComparedFromUrlRef.current) return;
    if (!selectedA || !selectedB) return;

    const a = String(searchParams.get("a") || "").trim();
    const b = String(searchParams.get("b") || "").trim();
    if (!a || !b) return;
    if (loading) return;

    autoComparedFromUrlRef.current = true;
    setLoading(true);
    setError(null);
    setResult(null);

    compareCompanies(selectedA, selectedB)
      .then((data) => {
        setResult(data);
      })
      .catch((err: any) => {
        setError(err.message || "Comparison failed");
      })
      .finally(() => {
        setLoading(false);
      });
  }, [selectedA, selectedB, searchParams, loading]);

  useEffect(() => {
    if (!result?.companyA?.company?.ticker || !result?.companyB?.company?.ticker) return;

    const token = localStorage.getItem("token");
    if (!token) return;

    const key = [
      result.companyA.company.ticker,
      result.companyB.company.ticker,
      result.companyA.companyIQ,
      result.companyB.companyIQ,
      result.metadata?.durationMs,
    ].join("|");

    if (trackedCompareKeyRef.current === key) return;
    trackedCompareKeyRef.current = key;

    const tickerA = result.companyA.company?.ticker;
    const tickerB = result.companyB.company?.ticker;
    const nameA = result.companyA.company?.name || tickerA;
    const nameB = result.companyB.company?.name || tickerB;

    fetch(`${API_BASE}/history/track`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        ticker: `${tickerA}|${tickerB}`,
        companyName: `${nameA} vs ${nameB}`,
        sector: null,
        companyIQ: null,
        rating: `Winner: ${result.comparison?.winner || "N/A"}`,
        tier: "free_score",
        source: "battle",
      }),
    }).catch(() => {
      // History tracking should not block UI rendering.
    });
  }, [result]);

  const handleSearch = async (q: string, side: "A" | "B") => {
    if (side === "A") {
      setQueryA(q);
      setSelectedA(null);
    } else {
      setQueryB(q);
      setSelectedB(null);
    }
    if (q.length < 2) {
      side === "A" ? setSuggestionsA([]) : setSuggestionsB([]);
      return;
    }
    const results = await searchCompanies(q);
    side === "A" ? setSuggestionsA(results) : setSuggestionsB(results);
  };

  const selectCompany = (company: CompanyResult, side: "A" | "B") => {
    if (side === "A") {
      setQueryA(company.name);
      setSelectedA(company.name);
      setSuggestionsA([]);
    } else {
      setQueryB(company.name);
      setSelectedB(company.name);
      setSuggestionsB([]);
    }
  };

  const handleCompare = async () => {
    if (!selectedA || !selectedB) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const data = await compareCompanies(selectedA, selectedB);
      setResult(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fmtVal = (v: number | null, format: string) => {
    if (v == null) return "—";
    if (format === "pct") return `${v.toFixed(1)}%`;
    return v.toFixed(2);
  };

  return (
    <div className="min-h-screen pb-16 themed-page">
      {/* Header */}
      <header
        className="sticky top-0 z-40 themed-sticky-header"
      >
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-4">
          <button
            onClick={() => navigate("/")}
            className="flex items-center gap-2 text-white/40 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="text-sm">Home</span>
          </button>
          <div className="flex items-center gap-2">
            <Swords className="w-5 h-5 text-orange-400" />
            <span className="text-white font-bold">Battle of Stocks</span>
          </div>
          <span className="themed-header-chip ml-auto">Head-to-Head Comparison</span>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 pt-8 themed-main">
        {/* Selection Area */}
        <div className="glass-card hero-glass-card rounded-2xl p-6 mb-8">
          <h2 className="text-xl font-bold text-white text-center mb-6">
            Compare Two Companies Head-to-Head
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-4 items-start">
            {/* Company A */}
            <div className="relative">
              <label className="text-sm text-white/40 mb-1 block">Company A</label>
              <input
                type="text"
                value={queryA}
                onChange={(e) => handleSearch(e.target.value, "A")}
                placeholder="Search company..."
                className="w-full px-4 py-3 rounded-xl text-white placeholder-white/25 focus:outline-none transition-colors"
                style={{ background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.08)" }}
                onFocus={(e) => (e.currentTarget.style.borderColor = "rgba(0,255,135,0.4)")}
                onBlur={(e) => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)")}
              />
              {selectedA && (
                <span className="absolute right-3 top-9 text-green-400 text-sm">✓</span>
              )}
              {suggestionsA.length > 0 && (
                <div className="absolute z-20 mt-1 w-full rounded-lg max-h-48 overflow-y-auto" style={{ background: "rgba(4,8,20,0.98)", border: "1px solid rgba(255,255,255,0.1)" }}>
                  {suggestionsA.map((c) => (
                    <button
                      key={c.ticker}
                      onClick={() => selectCompany(c, "A")}
                      className="w-full text-left px-4 py-2.5 hover:bg-white/[0.05] text-sm text-white/80 transition-colors"
                    >
                      {c.name} <span className="text-white/30 ml-1">{c.ticker}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* VS */}
            <div className="flex items-center justify-center pt-6">
              <span className="text-2xl font-black text-orange-400">VS</span>
            </div>

            {/* Company B */}
            <div className="relative">
              <label className="text-sm text-white/40 mb-1 block">Company B</label>
              <input
                type="text"
                value={queryB}
                onChange={(e) => handleSearch(e.target.value, "B")}
                placeholder="Search company..."
                className="w-full px-4 py-3 rounded-xl text-white placeholder-white/25 focus:outline-none transition-colors"
                style={{ background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.08)" }}
                onFocus={(e) => (e.currentTarget.style.borderColor = "rgba(0,255,135,0.4)")}
                onBlur={(e) => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)")}
              />
              {selectedB && (
                <span className="absolute right-3 top-9 text-green-400 text-sm">✓</span>
              )}
              {suggestionsB.length > 0 && (
                <div className="absolute z-20 mt-1 w-full rounded-lg max-h-48 overflow-y-auto" style={{ background: "rgba(4,8,20,0.98)", border: "1px solid rgba(255,255,255,0.1)" }}>
                  {suggestionsB.map((c) => (
                    <button
                      key={c.ticker}
                      onClick={() => selectCompany(c, "B")}
                      className="w-full text-left px-4 py-2.5 hover:bg-white/[0.05] text-sm text-white/80 transition-colors"
                    >
                      {c.name} <span className="text-white/30 ml-1">{c.ticker}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="text-center mt-6">
            <button
              onClick={handleCompare}
              disabled={!selectedA || !selectedB || loading}
              className="px-8 py-3 rounded-xl font-bold transition-all inline-flex items-center gap-2 disabled:opacity-40"
              style={{ background: !selectedA || !selectedB || loading ? "rgba(255,255,255,0.06)" : "#f97316", color: !selectedA || !selectedB || loading ? "rgba(255,255,255,0.3)" : "white" }}
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Analyzing...
                </>
              ) : (
                <>
                  <Swords className="w-4 h-4" />
                  Compare
                </>
              )}
            </button>
          </div>

          {error && (
            <p className="text-red-400 text-sm text-center mt-4">{error}</p>
          )}
        </div>

        {/* Results */}
        {result && (
          <div className="space-y-8">
            {/* Winner Banner */}
            <div className="rounded-2xl p-6 text-center" style={{ background: "rgba(234,179,8,0.05)", border: "1px solid rgba(234,179,8,0.2)" }}>
              <Trophy className="w-10 h-10 text-yellow-400 mx-auto mb-3" />
              <h3 className="text-2xl font-bold text-white">
                {result.comparison.winner} wins!
              </h3>
              <p className="text-slate-400 text-sm mt-1">
                Leading by {result.comparison.scoreDiff.toFixed(1)} points on CompanyIQ
              </p>
              <p className="text-xs text-slate-500 mt-2">
                Analyzed in {(result.metadata.durationMs / 1000).toFixed(1)}s
              </p>
            </div>

            {/* Side-by-side Score Gauges */}
            <div className="grid grid-cols-2 gap-6">
              <div className="glass-card rounded-2xl p-6 text-center">
                <h4 className="text-lg font-bold text-white mb-2">
                  {result.companyA.company?.name}
                </h4>
                <span className="text-xs text-white/40">
                  {result.companyA.company?.sector}
                </span>
                <div className="mt-4 flex justify-center">
                  <ScoreGauge
                    score={result.companyA.companyIQ}
                    color={result.companyA.ratingColor}
                  />
                </div>
                <div className="mt-2 text-lg font-bold text-white">
                  {result.companyA.rating}
                </div>
              </div>

              <div className="glass-card rounded-2xl p-6 text-center">
                <h4 className="text-lg font-bold text-white mb-2">
                  {result.companyB.company?.name}
                </h4>
                <span className="text-xs text-white/40">
                  {result.companyB.company?.sector}
                </span>
                <div className="mt-4 flex justify-center">
                  <ScoreGauge
                    score={result.companyB.companyIQ}
                    color={result.companyB.ratingColor}
                  />
                </div>
                <div className="mt-2 text-lg font-bold text-white">
                  {result.companyB.rating}
                </div>
              </div>
            </div>

            {/* Comparison Table */}
            <div className="glass-card rounded-2xl overflow-hidden">
              <div className="grid grid-cols-[1fr_auto_1fr] items-center px-4 py-3 text-sm font-semibold" style={{ background: "rgba(255,255,255,0.04)" }}>
                <span className="text-center" style={{ color: "#00ff87" }}>{result.companyA.company?.ticker}</span>
                <span className="text-white/40 px-4">Metric</span>
                <span className="text-center text-orange-400">{result.companyB.company?.ticker}</span>
              </div>

              {result.comparison.metrics.map((m, i) => {
                // Add section separators for readability
                const isFirstDeep = m.label === "Accounting Quality";
                const isFirstFinancial = m.label === "Net Profit Margin";
                const isRedFlag = m.label === "Red Flags";
                const showSeparator = isFirstDeep || isFirstFinancial || isRedFlag;
                const sectionLabel = isFirstDeep ? "Deep Analysis Modules" : isFirstFinancial ? "Financial Ratios" : isRedFlag ? "Risk" : "";

                return (
                  <div key={i}>
                    {showSeparator && (
                      <div className="px-4 py-1.5 border-t" style={{ background: "rgba(255,255,255,0.03)", borderColor: "rgba(255,255,255,0.06)" }}>
                        <span className="text-[10px] uppercase tracking-wider text-white/30 font-semibold">{sectionLabel}</span>
                      </div>
                    )}
                    <div className="grid grid-cols-[1fr_auto_1fr] items-center px-4 py-2.5 border-t border-white/[0.04] hover:bg-white/[0.02] transition-colors">
                      <div className="text-center">
                        <span
                          className={`font-mono text-sm ${
                            m.winner === "A" ? "text-green-400 font-bold" : "text-slate-300"
                          }`}
                        >
                          {fmtVal(m.valueA, m.format)}
                        </span>
                        {m.winner === "A" && (
                          <TrendingUp className="w-3 h-3 text-green-400 inline ml-1" />
                        )}
                      </div>
                      <div className="text-xs text-white/40 px-4 min-w-35 text-center">
                        {m.label}
                      </div>
                      <div className="text-center">
                        <span
                          className={`font-mono text-sm ${
                            m.winner === "B" ? "text-green-400 font-bold" : "text-slate-300"
                          }`}
                        >
                          {fmtVal(m.valueB, m.format)}
                        </span>
                        {m.winner === "B" && (
                          <TrendingUp className="w-3 h-3 text-green-400 inline ml-1" />
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* View Individual Reports */}
            <div className="flex justify-center gap-4">
              <button
                onClick={() =>
                  navigate(`/report/${encodeURIComponent(result.companyA.company?.name || "")}`, {
                    state: {
                      fromCompare: true,
                      returnTo: "/compare",
                      returnLabel: "Back to Battle",
                    },
                  })
                }
                className="px-6 py-2.5 rounded-lg text-sm font-semibold transition-all"
                style={{ background: "rgba(0,255,135,0.12)", border: "1px solid rgba(0,255,135,0.2)", color: "#00ff87" }}
              >
                View {result.companyA.company?.ticker} Report →
              </button>
              <button
                onClick={() =>
                  navigate(`/report/${encodeURIComponent(result.companyB.company?.name || "")}`, {
                    state: {
                      fromCompare: true,
                      returnTo: "/compare",
                      returnLabel: "Back to Battle",
                    },
                  })
                }
                className="px-6 py-2.5 rounded-lg text-sm font-semibold transition-all"
                style={{ background: "rgba(249,115,22,0.12)", border: "1px solid rgba(249,115,22,0.2)", color: "#f97316" }}
              >
                View {result.companyB.company?.ticker} Report →
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
