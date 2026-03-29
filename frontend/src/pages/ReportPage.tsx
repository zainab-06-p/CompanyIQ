import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { API_BASE, getFreeScore, getLatestReport } from "../utils/api.ts";
import ScoreGauge from "../components/ScoreGauge.tsx";
import PillarBar from "../components/PillarBar.tsx";
import RedFlagSection from "../components/RedFlagSection.tsx";
import FinancialSection from "../components/FinancialSection.tsx";
import LegalSection from "../components/LegalSection.tsx";
import SentimentSection from "../components/SentimentSection.tsx";
import ExecutiveSummary from "../components/ExecutiveSummary.tsx";
import PaymentModal from "../components/PaymentModal.tsx";
import DeepAnalysisSection from "../components/DeepAnalysisSection.tsx";
import MultiHorizonSection from "../components/MultiHorizonSection.tsx";
import RelationshipGraphSection from "../components/RelationshipGraphSection.tsx";
import ReportDiffSection from "../components/ReportDiffSection.tsx";
import AdversarialSection from "../components/AdversarialSection.tsx";
import PeerBenchmarkSection from "../components/PeerBenchmarkSection.tsx";
import ScoreTrendSection from "../components/ScoreTrendSection.tsx";
import InsiderSection from "../components/InsiderSection.tsx";
import AnnualReportSection from "../components/AnnualReportSection.tsx";
import CompetitorSection from "../components/CompetitorSection.tsx";
import { getRatingBg } from "../utils/formatters.ts";
import { ArrowLeft, Clock, Zap, Download } from "lucide-react";

export default function ReportPage() {
  const { company } = useParams<{ company: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const navState = (location.state as {
    fromCompare?: boolean;
    returnTo?: string;
    returnLabel?: string;
    restoreState?: any;
  } | null);
  const returnTo = navState?.returnTo || (navState?.fromCompare ? "/compare" : "/");
  const returnLabel = navState?.returnLabel || (navState?.fromCompare ? "Back to Battle" : "New Search");
  const errorBackLabel = returnTo === "/" ? "Back to Search" : returnLabel;

  const handleBack = () => {
    if (returnTo === "/") {
      navigate("/");
      return;
    }

    // Prefer browser history to preserve the exact comparison screen state.
    if (window.history.length > 1) {
      navigate(-1);
      return;
    }

    if (navState?.restoreState) {
      navigate(returnTo, {
        state: {
          restoreState: navState.restoreState,
        },
      });
      return;
    }

    navigate(returnTo);
  };

  const [report, setReport] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalTier, setModalTier] = useState<"quick_scan" | "standard" | null>(null);
  const [hydrating, setHydrating] = useState(false);
  const trackedHistoryKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (!company) return;

    // Check if we have a full report from SSE stream
    const cached = sessionStorage.getItem(`report_${company}`);
    if (cached) {
      try {
        setReport(JSON.parse(cached));
        setLoading(false);
        return;
      } catch {
        // fall through to API
      }
    }

    // Otherwise, fetch free score
    setLoading(true);
    getFreeScore(company)
      .then((data) => {
        setReport(data);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, [company]);

  useEffect(() => {
    if (!company || !report?.metadata?.partial) {
      setHydrating(false);
      return;
    }

    setHydrating(true);
    const interval = setInterval(async () => {
      try {
        const latest = await getLatestReport(company);
        if (latest?.report) {
          setReport(latest.report);
          sessionStorage.setItem(`report_${company}`, JSON.stringify(latest.report));
        }
        if (latest?.ready) {
          setHydrating(false);
          clearInterval(interval);
        }
      } catch {
        // Keep polling silently; user already has a usable fast report.
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [company, report?.metadata?.partial]);

  useEffect(() => {
    if (!report?.company?.ticker) return;

    const token = localStorage.getItem("token");
    if (!token) return;

    const generatedKey = `${report.company?.ticker}:${report.metadata?.generatedAt || ""}:${report.companyIQ || ""}`;
    if (trackedHistoryKeyRef.current === generatedKey) return;
    trackedHistoryKeyRef.current = generatedKey;

    const source =
      returnTo === "/compare"
        ? "compare"
        : returnTo === "/portfolio"
        ? "portfolio"
        : returnTo === "/watchlist"
        ? "watchlist"
        : "report";

    fetch(`${API_BASE}/history/track`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        ticker: report.company?.ticker,
        companyName: report.company?.name || report.company?.ticker,
        sector: report.company?.sector || null,
        companyIQ: report.companyIQ,
        rating: report.rating,
        tier: report.payment?.tier || "free_score",
        source,
        reportData: report,
      }),
    }).catch(() => {
      // History tracking should never block report rendering.
    });
  }, [report, returnTo]);

  if (loading) {
    return (
      <div className="min-h-screen pb-16" style={{ background: "#040810" }}>
        <header className="sticky top-0 z-40 backdrop-blur-sm border-b border-white/[0.06]" style={{ background: "rgba(4,8,16,0.85)" }}>
          <div className="max-w-6xl mx-auto px-4 py-3">
            <div className="h-4 w-24 rounded animate-pulse" style={{ background: "rgba(255,255,255,0.08)" }} />
          </div>
        </header>
        <main className="max-w-6xl mx-auto px-4 pt-8 space-y-6">
          <div className="rounded-2xl border border-white/[0.06] p-8" style={{ background: "rgba(255,255,255,0.03)" }}>
            <div className="flex flex-col md:flex-row items-center gap-8">
              <div className="flex-1 space-y-3">
                <div className="h-8 w-64 rounded animate-pulse" style={{ background: "rgba(255,255,255,0.08)" }} />
                <div className="h-4 w-40 rounded animate-pulse" style={{ background: "rgba(255,255,255,0.05)" }} />
                <div className="h-6 w-32 rounded animate-pulse mt-2" style={{ background: "rgba(255,255,255,0.04)" }} />
              </div>
              <div className="w-36 h-36 rounded-full animate-pulse" style={{ background: "rgba(255,255,255,0.06)" }} />
            </div>
            <div className="mt-8 grid grid-cols-3 gap-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-16 rounded-lg animate-pulse" style={{ background: "rgba(255,255,255,0.04)" }} />
              ))}
            </div>
          </div>
          {[1, 2].map((i) => (
            <div key={i} className="rounded-2xl border border-white/[0.06] p-6 space-y-4" style={{ background: "rgba(255,255,255,0.03)" }}>
              <div className="h-5 w-48 rounded animate-pulse" style={{ background: "rgba(255,255,255,0.08)" }} />
              <div className="grid grid-cols-2 gap-3">
                {[1, 2, 3, 4].map((j) => (
                  <div key={j} className="h-10 rounded animate-pulse" style={{ background: "rgba(255,255,255,0.04)" }} />
                ))}
              </div>
            </div>
          ))}
        </main>
      </div>
    );
  }

  if (error || !report) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4" style={{ background: "#040810" }}>
        <p className="text-red-400">{error || "Report not found"}</p>
        <button
          onClick={handleBack}
          className="px-5 py-2.5 rounded-xl text-black font-bold"
          style={{ background: "#00ff87" }}
        >
          {errorBackLabel}
        </button>
      </div>
    );
  }

  const hasDetailedData = report.financial || report.legal || report.sentiment;
  const generatedAt = report.metadata?.generatedAt
    ? new Date(report.metadata.generatedAt)
    : new Date();
  const generatedDateLabel = generatedAt.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
  const generatedTimeLabel = generatedAt.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="min-h-screen pb-16 report-pdf-root themed-page">
      {/* Header */}
      <header className="sticky top-0 z-40 themed-sticky-header">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <button
            onClick={handleBack}
            className="flex items-center gap-2 text-white/40 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="text-sm">{returnLabel}</span>
          </button>
          <div className="text-sm text-white/35 flex items-center gap-4">
            {report.metadata?.durationMs && (
              <span className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                {(report.metadata.durationMs / 1000).toFixed(1)}s
              </span>
            )}
            {report.metadata?.totalSteps > 0 && (
              <span className="flex items-center gap-1">
                <Zap className="w-3.5 h-3.5" />
                {report.metadata.totalSteps} steps
              </span>
            )}
            <button
              onClick={() => window.print()}
              className="flex items-center gap-1 px-3 py-1 rounded-lg transition-colors print:hidden"
              style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.5)" }}
              onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.10)"; e.currentTarget.style.color = "white"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.06)"; e.currentTarget.style.color = "rgba(255,255,255,0.5)"; }}
              title="Download as PDF"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">PDF</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 pt-8 report-document themed-main">
        <section className="hidden print:block report-print-cover">
          <div className="report-print-cover-topline">CompanyIQ Intelligence Memo</div>
          <div className="report-print-hero">
            <div>
              <h1 className="report-print-title">CompanyIQ Due Diligence Report</h1>
              <p className="report-print-subtitle">Professional equity health and risk assessment</p>
            </div>
            <div className="report-print-score-badge">
              <span>Score</span>
              <strong>{Math.round(report.companyIQ || 0)}/100</strong>
            </div>
          </div>

          <div className="report-print-meta-grid">
            <div>
              <span className="report-print-meta-label">Company</span>
              <strong>{report.company?.name || "-"}</strong>
            </div>
            <div>
              <span className="report-print-meta-label">Ticker</span>
              <strong>{report.company?.ticker || "-"}</strong>
            </div>
            <div>
              <span className="report-print-meta-label">Sector</span>
              <strong>{report.company?.sector || "-"}</strong>
            </div>
            <div>
              <span className="report-print-meta-label">Rating</span>
              <strong>{report.rating || "-"}</strong>
            </div>
            <div>
              <span className="report-print-meta-label">Generated</span>
              <strong>{generatedDateLabel} {generatedTimeLabel}</strong>
            </div>
            <div>
              <span className="report-print-meta-label">Coverage</span>
              <strong>Financial • Legal • Sentiment • Deep Modules</strong>
            </div>
          </div>

          <div className="report-print-cover-footer">
            <span>Prepared by CompanyIQ AI Research Stack</span>
            <span>Confidential • For research workflow support</span>
          </div>
        </section>

        {hydrating && (
          <div className="mb-4 rounded-xl px-4 py-3 text-sm border" style={{ background: "rgba(0,255,135,0.08)", borderColor: "rgba(0,255,135,0.25)", color: "#00ff87" }}>
            Fast report loaded. Completing full deep analysis in background; this page will auto-refresh when ready.
          </div>
        )}

        {/* Company Header + Score */}
        <section
          className="report-section"
          data-section-title="Overall Assessment"
        >
          <div
          className={`rounded-2xl border p-8 mb-8 ${getRatingBg(report.rating)}`}
          >
            <div className="flex flex-col md:flex-row items-center gap-8">
            {/* Company Info */}
              <div className="flex-1 text-center md:text-left">
                <h1 className="text-3xl md:text-4xl font-bold text-white">
                  {report.company?.name}
                </h1>
                <div className="flex items-center justify-center md:justify-start gap-3 mt-2">
                  <span className="text-slate-300 font-mono">
                    {report.company?.ticker}
                  </span>
                  {report.company?.sector && (
                    <span className="px-2 py-0.5 bg-slate-700/50 rounded text-xs text-slate-300">
                      {report.company.sector}
                    </span>
                  )}
                </div>
                <div className="mt-4">
                  <span className="text-2xl font-bold text-white">{report.rating}</span>
                </div>
                <p className="mt-2 text-sm text-white/50 print:text-slate-600">
                  Report generated on {generatedDateLabel} at {generatedTimeLabel}
                </p>
              </div>

              {/* Score Gauge */}
              <ScoreGauge score={report.companyIQ} color={report.ratingColor} />
            </div>

            {/* Pillar Bars */}
            {report.pillarScores && (
              <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
                <PillarBar label="Financial" score={report.pillarScores.financial ?? 0} color="#3b82f6" />
                <PillarBar
                  label={`Legal & Governance${report.pillarScores.legal == null ? " (N/A)" : ""}`}
                  score={report.pillarScores.legal ?? 0}
                  color={report.pillarScores.legal == null ? "#475569" : "#22c55e"}
                />
                <PillarBar label="Sentiment" score={report.pillarScores.sentiment ?? 0} color="#a855f7" />
              </div>
            )}
          </div>
        </section>

        {/* Red Flags */}
        <section className="report-section" data-section-title="Risk Flags">
          {report.redFlags && report.redFlags.length > 0 ? (
            <RedFlagSection flags={report.redFlags} />
          ) : (
            <div className="bg-green-900/15 border border-green-700/30 rounded-2xl p-6 flex items-center gap-3">
              <span className="text-2xl">OK</span>
              <div>
                <h3 className="font-semibold" style={{ color: "#00ff87" }}>No Red Flags Detected</h3>
                <p className="text-white/40 text-sm">No critical governance or financial warning signs were found.</p>
              </div>
            </div>
          )}
        </section>

        {/* Detailed Sections (paid tiers) */}
        {hasDetailedData && (
          <div className="space-y-8 mt-8 report-section" data-section-title="Detailed Analysis">
            {/* Executive Summary */}
            {report.synthesis && (
              <ExecutiveSummary synthesis={report.synthesis} />
            )}

            {/* Financial */}
            {report.financial && (
              <FinancialSection data={report.financial} />
            )}

            {/* Legal */}
            {report.legal && (
              <LegalSection data={report.legal} />
            )}

            {/* Sentiment */}
            {report.sentiment && (
              <SentimentSection data={report.sentiment} />
            )}
          </div>
        )}

        {/* Deep Analysis Section — visible in all tiers */}
        <section className="report-section" data-section-title="Deep Analysis Modules">
          <DeepAnalysisSection
            deepAnalysis={report.deepAnalysis}
            deepAnalysisSummary={report.deepAnalysisSummary}
            deepAnalysisScore={report.deepAnalysisScore}
          />
        </section>

        {/* Multi-Horizon Analysis */}
        {report.multiHorizon && (
          <section className="report-section" data-section-title="Multi-Horizon Outlook">
            <MultiHorizonSection multiHorizon={report.multiHorizon} />
          </section>
        )}

        {/* Company Network / Relationship Graph */}
        {report.relationshipGraph && (
          <section className="report-section" data-section-title="Relationship Graph">
            <RelationshipGraphSection graph={report.relationshipGraph} />
          </section>
        )}

        {/* Report Diff — What Changed */}
        {report.diff && (
          <section className="report-section" data-section-title="What Changed">
            <ReportDiffSection diff={report.diff} />
          </section>
        )}

        {/* Adversarial Data Integrity */}
        {report.adversarialAnalysis && (
          <section className="report-section" data-section-title="Data Integrity">
            <AdversarialSection analysis={report.adversarialAnalysis} />
          </section>
        )}

        {/* Peer Benchmark — Sector Comparison */}
        {report.peerBenchmark && (
          <section className="report-section" data-section-title="Peer Benchmark">
            <PeerBenchmarkSection benchmark={report.peerBenchmark} />
          </section>
        )}

        {/* Score Trend — Historical Tracking */}
        {report.scoreTrend && (
          <section className="report-section" data-section-title="Score Trend">
            <ScoreTrendSection trend={report.scoreTrend} />
          </section>
        )}

        {/* Insider / Promoter Activity */}
        {report.insiderActivity && (
          <section className="report-section" data-section-title="Insider Activity">
            <InsiderSection data={report.insiderActivity} />
          </section>
        )}

        {/* Annual Report Deep Dive */}
        {report.annualReport && (
          <section className="report-section" data-section-title="Annual Report Insights">
            <AnnualReportSection data={report.annualReport} />
          </section>
        )}

        {/* Auto-Discovered Competitors */}
        {report.competitors && (
          <section className="report-section" data-section-title="Competitive Landscape">
            <CompetitorSection data={report.competitors} />
          </section>
        )}

        {/* Upgrade CTA for free tier */}
        {!hasDetailedData && (
          <div className="mt-8 glass-card rounded-2xl p-8 text-center">
            <h3 className="text-xl font-bold text-white mb-2">
              Want the full picture?
            </h3>
            <p className="text-white/40 mb-6 max-w-lg mx-auto">
              Unlock detailed financials, legal analysis, AI sentiment, executive summary, and investment thesis.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <button
                onClick={() => setModalTier("quick_scan")}
                className="px-6 py-3 rounded-xl font-bold text-black transition-opacity hover:opacity-90"
                style={{ background: "#00ff87" }}
              >
                Quick Scan — ₹249
              </button>
              <button
                onClick={() => setModalTier("standard")}
                className="px-6 py-3 rounded-xl font-bold transition-all"
                style={{ background: "rgba(168,85,247,0.15)", border: "1px solid rgba(168,85,247,0.3)", color: "#c084fc" }}
              >
                Full Report — ₹499
              </button>
            </div>
          </div>
        )}

        {/* Data Sources Footer */}
        {hasDetailedData && report.metadata && (
          <section className="mt-8 border-t border-white/[0.05] pt-6 pb-4 report-section" data-section-title="Sources and Notes">
            <div className="flex flex-col sm:flex-row items-center justify-between text-xs text-white/25 gap-3">
              <div className="flex items-center gap-1">
                <span>Sources:</span>
                <span className="text-white/40">Screener.in</span>
                <span>•</span>
                <span className="text-white/40">BSE India</span>
                <span>•</span>
                <span className="text-white/40">Google News</span>
                <span>•</span>
                <span className="text-white/40">Economic Times</span>
              </div>
              {report.metadata.agentSteps && (
                <div className="flex items-center gap-2">
                  <Zap className="w-3 h-3" />
                  <span>Financial: {report.metadata.agentSteps.financial || 0}</span>
                  <span>•</span>
                  <span>Legal: {report.metadata.agentSteps.legal || 0}</span>
                  <span>•</span>
                  <span>Sentiment: {report.metadata.agentSteps.sentiment || 0}</span>
                  <span className="text-slate-400">steps</span>
                </div>
              )}
            </div>
            <div className="text-center mt-3 text-xs text-white/15">
              Powered by TinyFish Web Agent API • CompanyIQ
            </div>
          </section>
        )}

        <section className="hidden print:block report-print-disclaimer">
          <h3>Interpretation Note</h3>
          <p>
            This report is a decision-support document generated from publicly available disclosures and automated analysis modules.
            It should be used alongside independent financial advice and the latest filings before any investment decision.
          </p>
        </section>
      </main>

      {/* Payment Modal */}
      {modalTier && company && (
        <PaymentModal
          company={company}
          tier={modalTier}
          onClose={() => setModalTier(null)}
          onReport={(fullReport) => {
            setModalTier(null);
            setReport(fullReport);
            // Cache the full report
            sessionStorage.setItem(`report_${company}`, JSON.stringify(fullReport));
          }}
        />
      )}
    </div>
  );
}
