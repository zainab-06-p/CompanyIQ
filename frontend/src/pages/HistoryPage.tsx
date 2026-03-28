import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, History, ExternalLink } from "lucide-react";

const BASE = "/api";

type HistoryItem = {
  id: string;
  ticker: string;
  company_name: string;
  sector: string | null;
  company_iq: number | null;
  rating: string | null;
  tier: string | null;
  source: string | null;
  created_at: string;
  report_data?: any;
};

function sourceLabel(source: string | null) {
  const value = String(source || "report").toLowerCase();
  if (value === "portfolio") return "Portfolio";
  if (value === "battle") return "Battle";
  if (value === "compare") return "Battle";
  if (value === "watchlist") return "Watchlist";
  return "Report";
}

export default function HistoryPage() {
  const navigate = useNavigate();
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const run = async () => {
      try {
        const token = localStorage.getItem("token");
        const res = await fetch(`${BASE}/history?limit=100`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data.message || "Failed to load history.");
          setLoading(false);
          return;
        }
        setItems(data.history || []);
      } catch {
        setError("Network error while loading history.");
      } finally {
        setLoading(false);
      }
    };

    run();
  }, []);

  return (
    <div className="min-h-screen pb-16 themed-page">
      <header className="sticky top-0 z-40 themed-sticky-header">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <button
            onClick={() => navigate("/")}
            className="flex items-center gap-2 text-white/40 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="text-sm">Home</span>
          </button>
          <div className="flex items-center gap-2 text-white">
            <History className="w-5 h-5 text-cyan-300" />
            <span className="font-semibold">My Report History</span>
          </div>
          <span className="themed-header-chip">Cross-device timeline</span>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 pt-8 themed-main">
        {loading ? (
          <div className="glass-card rounded-2xl p-6 text-white/55">Loading your history...</div>
        ) : error ? (
          <div className="glass-card rounded-2xl p-6 text-red-300">{error}</div>
        ) : items.length === 0 ? (
          <div className="glass-card rounded-2xl p-8 text-center">
            <p className="text-white/60">No reports in history yet.</p>
            <p className="text-white/35 text-sm mt-1">Open any report while logged in and it will appear here.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {items.map((item) => (
              <button
                key={item.id}
                onClick={async () => {
                  const source = String(item.source || "").toLowerCase();
                  if (source === "battle" || source === "compare") {
                    const [a, b] = String(item.ticker || "")
                      .split("|")
                      .map((s) => s.trim())
                      .filter(Boolean);
                    if (a && b) {
                      navigate(`/compare?a=${encodeURIComponent(a)}&b=${encodeURIComponent(b)}`);
                      return;
                    }
                  }

                  // Try to retrieve the full report data from history
                  if (item.id) {
                    try {
                      const token = localStorage.getItem("token");
                      const res = await fetch(`${BASE}/history/${item.id}`, {
                        headers: {
                          Authorization: `Bearer ${token}`,
                        },
                      });
                      if (res.ok) {
                        const { history } = await res.json();
                        if (history?.report_data) {
                          // Store the full report in session storage to avoid re-analysis
                          sessionStorage.setItem(
                            `report_${item.ticker}`,
                            JSON.stringify(history.report_data)
                          );
                        }
                      }
                    } catch {
                      // If retrieval fails, fallback to fresh analysis
                    }
                  }

                  navigate(`/report/${encodeURIComponent(item.ticker)}`);
                }}
                className="w-full text-left glass-card glass-card-hover rounded-2xl p-4 border border-white/10"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="text-white font-semibold">
                      {item.company_name} <span className="text-white/35 font-mono text-sm">({item.ticker})</span>
                    </div>
                    <div className="text-xs text-white/35 mt-1">
                      {item.sector || "Sector N/A"} • {new Date(item.created_at).toLocaleString("en-IN")}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {item.company_iq != null && (
                      <span className="px-2 py-1 rounded-lg text-xs font-semibold" style={{ background: "rgba(0,255,135,0.12)", color: "#00ff87" }}>
                        IQ {item.company_iq}
                      </span>
                    )}
                    {item.rating && (
                      <span className="px-2 py-1 rounded-lg text-xs text-white/70" style={{ background: "rgba(255,255,255,0.08)" }}>
                        {item.rating}
                      </span>
                    )}
                    <span className="px-2 py-1 rounded-lg text-xs text-cyan-200" style={{ background: "rgba(34,211,238,0.12)" }}>
                      {sourceLabel(item.source)}
                    </span>
                    <span className="text-white/30 text-xs">{item.tier || "free_score"}</span>
                    <ExternalLink className="w-4 h-4 text-white/30" />
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
