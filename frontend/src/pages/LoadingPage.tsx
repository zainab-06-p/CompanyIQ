import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { connectSSE, type ProgressEvent } from "../utils/api.ts";

const PHASE_LABELS: Record<string, string> = {
  connected: "Connecting...",
  heartbeat: "Still processing...",
  resolve: "Identifying company...",
  agents: "Launching data agents...",
  financial: "Scraping financial data...",
  legal: "Checking legal filings...",
  sentiment: "Gathering news sentiment...",
  compute: "Crunching ratios...",
  classify: "AI classifying headlines...",
  score: "Scoring pillars...",
  flags: "Scanning for red flags...",
  composite: "Computing CompanyIQ...",
  synthesis: "Generating AI summary...",
  done: "Report ready!",
  complete: "Complete!",
  error: "Error occurred",
};

export default function LoadingPage() {
  const { company } = useParams<{ company: string }>();
  const navigate = useNavigate();
  const [events, setEvents] = useState<ProgressEvent[]>([]);
  const [pct, setPct] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [elapsedSec, setElapsedSec] = useState(0);
  const cleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!company) return;

    const startedAt = Date.now();
    const elapsedTicker = setInterval(() => {
      setElapsedSec(Math.floor((Date.now() - startedAt) / 1000));
    }, 1000);

    const cleanup = connectSSE(
      company,
      "free_score",
      (event) => {
        setEvents((prev) => [...prev, event]);
        if (event.pct) setPct(event.pct);

        if (event.phase === "complete") {
          sessionStorage.setItem(
            `report_${company}`,
            JSON.stringify(event.report)
          );
          setTimeout(() => navigate(`/report/${company}`), 500);
        }
        if (event.phase === "error") {
          setError(event.message || "Pipeline failed");
        }
      },
      (errMsg) => {
        setError(errMsg);
      }
    );

    cleanupRef.current = cleanup;

    return () => {
      clearInterval(elapsedTicker);
      cleanup();
    };
  }, [company, navigate]);

  const latestPhase = events.length > 0 ? events[events.length - 1].phase : "connected";
  const latestMsg = events.length > 0 ? events[events.length - 1].message : "Connecting...";

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-4 relative overflow-hidden themed-page"
    >
      {/* ambient glow */}
      <div className="absolute pointer-events-none" style={{ top: "20%", left: "50%", transform: "translateX(-50%)", width: 500, height: 500, borderRadius: "50%", background: "radial-gradient(circle, rgba(0,255,135,0.05) 0%, transparent 65%)", filter: "blur(60px)" }} />

      {/* Title */}
      <h1 className="text-3xl font-bold text-white mb-2 text-center relative z-10">
        Analysing{" "}
        <span style={{ color: "#00ff87" }}>{decodeURIComponent(company || "")}</span>
      </h1>
      <p className="text-white/40 mb-12 text-sm relative z-10">
        Running web agents in parallel — may take a few minutes for full completion
      </p>

      {elapsedSec > 0 && (
        <p className="text-white/30 mb-4 text-xs relative z-10">
          Elapsed: {elapsedSec}s
        </p>
      )}

      {/* Progress Ring */}
      <div className="relative w-48 h-48 mb-8 relative z-10">
        <svg className="w-48 h-48 -rotate-90" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r="45" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="8" />
          <circle
            cx="50" cy="50" r="45" fill="none"
            stroke="#00ff87"
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={`${283 * (pct / 100)} 283`}
            className="transition-all duration-500 ease-out"
            style={{ filter: "drop-shadow(0 0 8px rgba(0,255,135,0.6))" }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-4xl font-bold text-white">{Math.round(pct)}%</span>
          <span className="text-white/30 text-xs mt-1">complete</span>
        </div>
      </div>

      {/* Current Phase */}
      <div className="text-center mb-8 relative z-10">
        <div className="font-semibold text-lg" style={{ color: "#00ff87" }}>
          {PHASE_LABELS[latestPhase] || latestPhase}
        </div>
        <div className="text-white/35 text-sm mt-1">{latestMsg}</div>
      </div>

      {/* Step Log (TinyFish Terminal Style) */}
      <div
        className="w-full max-w-xl rounded-xl p-4 max-h-52 overflow-y-auto relative z-10 bg-black/60 border border-green-500/30 font-mono text-xs shadow-lg shadow-green-500/10"
      >
        <div className="flex justify-between items-center mb-2 border-b border-green-500/20 pb-2">
          <span className="text-green-500/70 font-semibold tracking-wider">TINYFISH_AGENT_STREAM</span>
          <span className="text-green-500/50">LIVE</span>
        </div>
        
        {events.map((evt, i) => (
          <div key={i} className="flex gap-3 py-1.5 border-b border-white/[0.02] last:border-0 items-start">
            <span className="text-green-500/40 w-16 shrink-0">
               {new Date().toLocaleTimeString('en-US', { hour12: false, hour: "numeric", minute: "numeric", second: "numeric" })}
            </span>
            <span className="text-green-400/80 font-semibold uppercase shrink-0 w-24">[{evt.phase}]</span>
            <span className="text-white/70 tracking-wide">{evt.message}</span>
          </div>
        ))}
        {events.length === 0 && (
          <div className="text-green-500/40 text-sm pulse-glow text-center py-2">Establishing secure web agent connection…</div>
        )}
      </div>

      {/* Error state */}
      {error && (
        <div
          className="mt-6 rounded-xl px-6 py-4 max-w-md text-center relative z-10"
          style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)" }}
        >
          <p className="text-red-300 mb-3">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-5 py-2 text-white rounded-lg text-sm font-semibold transition-colors"
            style={{ background: "rgba(239,68,68,0.4)" }}
          >
            Retry
          </button>
        </div>
      )}
    </div>
  );
}
