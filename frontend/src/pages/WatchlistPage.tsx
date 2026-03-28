import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Eye, Trash2, Bell, Plus, ArrowLeft, AlertTriangle, TrendingUp, TrendingDown } from "lucide-react";

const BASE = "/api";

interface WatchlistItem {
  id: number;
  ticker: string;
  company_name: string;
  alert_threshold: number;
  last_score: number | null;
  created_at: string;
}

interface Alert {
  ticker: string;
  companyName: string;
  previousScore: number;
  currentScore: number;
  delta: number;
  direction: string;
}

function getHeaders() {
  const token = localStorage.getItem("token");
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
}

const inputStyle = {
  background: "rgba(0,0,0,0.3)",
  border: "1px solid rgba(255,255,255,0.08)",
};

export default function WatchlistPage() {
  const navigate = useNavigate();
  const [items, setItems] = useState<WatchlistItem[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [addInput, setAddInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchWatchlist = async () => {
    try {
      const res = await fetch(`${BASE}/watchlist`, { headers: getHeaders() });
      if (res.status === 401) { navigate("/auth"); return; }
      const data = await res.json();
      setItems(data.watchlist || []);
    } catch {
      setError("Failed to load watchlist");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchWatchlist(); }, []);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addInput.trim()) return;
    try {
      const res = await fetch(`${BASE}/watchlist/add`, {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify({ company: addInput.trim() }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.message); return; }
      setAddInput("");
      fetchWatchlist();
    } catch {
      setError("Failed to add company");
    }
  };

  const handleRemove = async (ticker: string) => {
    try {
      await fetch(`${BASE}/watchlist/${ticker}`, { method: "DELETE", headers: getHeaders() });
      setItems(items.filter((i) => i.ticker !== ticker));
    } catch {
      setError("Failed to remove");
    }
  };

  const handleCheckAlerts = async () => {
    try {
      const res = await fetch(`${BASE}/watchlist/check-alerts`, { method: "POST", headers: getHeaders() });
      const data = await res.json();
      setAlerts(data.alerts || []);
    } catch {
      setError("Failed to check alerts");
    }
  };

  return (
    <div className="min-h-screen pb-16 themed-page">
      {/* Header */}
      <header
        className="sticky top-0 z-40 themed-sticky-header"
      >
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <button
            onClick={() => navigate("/")}
            className="flex items-center gap-2 text-white/40 hover:text-white transition-colors text-sm"
          >
            <ArrowLeft className="w-4 h-4" /> Home
          </button>
          <h1 className="text-lg font-bold text-white flex items-center gap-2">
            <Eye className="w-5 h-5" style={{ color: "#00ff87" }} /> Watchlist
          </h1>
          <div className="flex items-center gap-2">
            <span className="themed-header-chip">Live Score Monitoring</span>
            <button
              onClick={handleCheckAlerts}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
              style={{ background: "rgba(234,179,8,0.1)", border: "1px solid rgba(234,179,8,0.25)", color: "#eab308" }}
            >
              <Bell className="w-3.5 h-3.5" /> Check Alerts
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 pt-8 themed-main">
        {/* Add Company */}
        <form onSubmit={handleAdd} className="flex gap-2 mb-6 glass-card hero-glass-card rounded-2xl p-4">
          <input
            type="text"
            value={addInput}
            onChange={(e) => setAddInput(e.target.value)}
            placeholder="Add company (name or ticker)…"
            className="flex-1 rounded-xl px-4 py-3 text-white text-sm focus:outline-none transition-colors placeholder-white/25"
            style={inputStyle}
            onFocus={(e) => (e.currentTarget.style.borderColor = "rgba(0,255,135,0.4)")}
            onBlur={(e) => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)")}
          />
          <button
            type="submit"
            className="px-5 py-3 rounded-xl text-black text-sm font-bold flex items-center gap-1.5 transition-opacity hover:opacity-90"
            style={{ background: "#00ff87" }}
          >
            <Plus className="w-4 h-4" /> Add
          </button>
        </form>

        {error && (
          <div
            className="text-red-400 text-sm mb-4 rounded-xl px-4 py-3"
            style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)" }}
          >
            {error}
          </div>
        )}

        {/* Active Alerts */}
        {alerts.length > 0 && (
          <div className="mb-6 space-y-2">
            <h2 className="text-sm font-semibold flex items-center gap-1.5 mb-3" style={{ color: "#eab308" }}>
              <AlertTriangle className="w-4 h-4" /> Score Change Alerts
            </h2>
            {alerts.map((a) => (
              <div
                key={a.ticker}
                className="flex items-center justify-between rounded-xl px-4 py-3"
                style={{
                  background: a.direction === "DOWN" ? "rgba(239,68,68,0.08)" : "rgba(0,255,135,0.07)",
                  border: `1px solid ${a.direction === "DOWN" ? "rgba(239,68,68,0.2)" : "rgba(0,255,135,0.15)"}`,
                }}
              >
                <div className="flex items-center gap-3">
                  {a.direction === "DOWN"
                    ? <TrendingDown className="w-5 h-5 text-red-400" />
                    : <TrendingUp className="w-5 h-5" style={{ color: "#00ff87" }} />}
                  <div>
                    <p className="text-sm font-semibold text-white">{a.companyName}</p>
                    <p className="text-xs text-white/40 font-mono">{a.ticker}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className={`text-sm font-bold ${a.direction === "DOWN" ? "text-red-400" : ""}`}
                    style={a.direction !== "DOWN" ? { color: "#00ff87" } : {}}>
                    {a.direction === "DOWN" ? "" : "+"}{a.delta} pts
                  </p>
                  <p className="text-xs text-white/30">{a.previousScore} → {a.currentScore}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Watchlist Items */}
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 rounded-xl animate-pulse" style={{ background: "rgba(255,255,255,0.04)" }} />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-16 text-white/30">
            <Eye className="w-12 h-12 mx-auto mb-4 opacity-30" />
            <p className="font-medium text-white/50">Your watchlist is empty</p>
            <p className="text-sm mt-1">Add companies to monitor score changes.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {items.map((item) => (
              <div
                key={item.ticker}
                className="flex items-center justify-between rounded-xl px-4 py-3.5 transition-all glass-card glass-card-hover"
              >
                <div
                  className="flex-1 cursor-pointer"
                  onClick={() =>
                    navigate(`/report/${encodeURIComponent(item.ticker)}`, {
                      state: {
                        returnTo: "/watchlist",
                        returnLabel: "Back to Watchlist",
                      },
                    })
                  }
                >
                  <p className="text-sm font-semibold text-white">{item.company_name}</p>
                  <div className="flex items-center gap-2 text-xs text-white/40 mt-0.5">
                    <span className="font-mono">{item.ticker}</span>
                    {item.last_score !== null && (
                      <span
                        className="px-1.5 py-0.5 rounded text-white/60"
                        style={{ background: "rgba(255,255,255,0.06)" }}
                      >
                        Last: {item.last_score}
                      </span>
                    )}
                    <span>Alert: ±{item.alert_threshold} pts</span>
                  </div>
                </div>
                <button
                  onClick={() => handleRemove(item.ticker)}
                  className="p-2 text-white/20 hover:text-red-400 transition-colors ml-2"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}


