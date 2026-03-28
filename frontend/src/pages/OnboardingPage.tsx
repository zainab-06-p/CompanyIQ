import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { CheckCircle2, Sparkles } from "lucide-react";

const BASE = "/api";

interface Props {
  user: { email?: string; selectedPlan?: string | null };
  onPlanSelected: (plan: string) => void;
}

const plans = [
  {
    id: "free_score",
    title: "Free Tier",
    price: "Rs0",
    desc: "Quick score and core risk snapshot",
    accent: "#00ff87",
  },
  {
    id: "quick_scan",
    title: "Quick Scan",
    price: "Rs249",
    desc: "Broader due diligence for faster investment decisions",
    accent: "#00e5ff",
  },
  {
    id: "standard",
    title: "Standard",
    price: "Rs499",
    desc: "Full professional report with advanced modules",
    accent: "#f59e0b",
  },
];

export default function OnboardingPage({ user, onPlanSelected }: Props) {
  const navigate = useNavigate();
  const [selectedPlan, setSelectedPlan] = useState(user?.selectedPlan || "free_score");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const savePlan = async () => {
    setSaving(true);
    setError(null);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${BASE}/auth/select-plan`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ plan: selectedPlan }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message || "Failed to save plan.");
        setSaving(false);
        return;
      }

      onPlanSelected(selectedPlan);
      navigate("/");
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen themed-page flex items-center justify-center px-4">
      <div className="w-full max-w-5xl glass-card hero-glass-card rounded-2xl p-6 md:p-8">
        <div className="text-center mb-7">
          <div className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs border border-white/15 text-white/70 mb-3">
            <Sparkles className="w-3.5 h-3.5" /> First-time setup
          </div>
          <h1 className="text-3xl font-bold text-white">Choose Your Plan Before You Start</h1>
          <p className="text-white/45 mt-2 text-sm">Signed in as {user?.email}. You can change plan later.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {plans.map((p) => {
            const active = selectedPlan === p.id;
            return (
              <button
                key={p.id}
                onClick={() => setSelectedPlan(p.id)}
                className="text-left rounded-2xl p-5 transition-all border"
                style={{
                  background: active ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.03)",
                  borderColor: active ? p.accent : "rgba(255,255,255,0.08)",
                  boxShadow: active ? `0 0 0 1px ${p.accent} inset` : "none",
                }}
              >
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-white">{p.title}</h3>
                  {active && <CheckCircle2 className="w-5 h-5" style={{ color: p.accent }} />}
                </div>
                <p className="text-xl font-black mt-2" style={{ color: p.accent }}>{p.price}</p>
                <p className="text-white/45 text-sm mt-2">{p.desc}</p>
              </button>
            );
          })}
        </div>

        {error && (
          <div className="mt-4 rounded-xl px-4 py-3 text-sm text-red-300" style={{ background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.3)" }}>
            {error}
          </div>
        )}

        <div className="flex justify-end mt-6">
          <button
            onClick={savePlan}
            disabled={saving}
            className="px-6 py-2.5 rounded-xl font-semibold text-black disabled:opacity-60"
            style={{ background: "#00ff87" }}
          >
            {saving ? "Saving..." : "Continue to Platform"}
          </button>
        </div>
      </div>
    </div>
  );
}
