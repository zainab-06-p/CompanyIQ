import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { LogIn, UserPlus, Mail, Lock, User, Fish } from "lucide-react";

const BASE = "/api";

interface Props {
  onAuth: (user: { id: number; email: string; name: string }, token: string) => void;
}

const inputStyle = {
  background: "rgba(0,0,0,0.35)",
  border: "1px solid rgba(255,255,255,0.08)",
};
const inputFocus = (e: React.FocusEvent<HTMLInputElement>) =>
  (e.currentTarget.style.borderColor = "rgba(0,255,135,0.5)");
const inputBlur = (e: React.FocusEvent<HTMLInputElement>) =>
  (e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)");

export default function AuthPage({ onAuth }: Props) {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [canResend, setCanResend] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleResend = async () => {
    if (!email) return;
    setError(null);
    try {
      const res = await fetch(`${BASE}/auth/resend-confirmation`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message || "Failed to resend confirmation mail.");
        return;
      }
      setInfo(data.message || "Confirmation mail sent.");
    } catch {
      setError("Network error. Please try again.");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setLoading(true);
    try {
      const endpoint = mode === "login" ? `${BASE}/auth/login` : `${BASE}/auth/register`;
      const body: Record<string, string> = { email, password };
      if (mode === "register" && name) body.name = name;
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.message || "Authentication failed"); setLoading(false); return; }

      if (mode === "register") {
        setInfo(data.message || "Please verify your email before signing in.");
        setCanResend(true);
        setMode("login");
        setPassword("");
        setLoading(false);
        return;
      }

      localStorage.setItem("token", data.token);
      localStorage.setItem("user", JSON.stringify(data.user));
      onAuth(data.user, data.token);
      navigate(data.user?.requiresPlanSelection ? "/onboarding" : "/");
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4 relative overflow-hidden themed-page"
    >
      {/* ambient glows */}
      <div className="absolute pointer-events-none" style={{ top: "10%", left: "15%", width: 400, height: 400, borderRadius: "50%", background: "radial-gradient(circle, rgba(0,255,135,0.06) 0%, transparent 70%)", filter: "blur(40px)" }} />
      <div className="absolute pointer-events-none" style={{ bottom: "15%", right: "15%", width: 350, height: 350, borderRadius: "50%", background: "radial-gradient(circle, rgba(0,229,255,0.05) 0%, transparent 70%)", filter: "blur(40px)" }} />

      <div className="w-full max-w-md relative z-10">
        {/* Back link */}
        <div className="text-center mb-8">
          <button
            onClick={() => navigate("/")}
            className="inline-flex items-center gap-2 mb-5 text-white/40 hover:text-white/80 transition-colors text-sm"
          >
            ← Back to CompanyIQ
          </button>
          <div className="flex items-center justify-center gap-2 mb-3">
            <Fish className="w-7 h-7" style={{ color: "#00ff87" }} />
            <span className="text-2xl font-bold text-white">CompanyIQ</span>
          </div>
          <h1 className="text-2xl font-bold text-white">
            {mode === "login" ? "Welcome back" : "Create your account"}
          </h1>
          <p className="text-white/40 mt-1 text-sm">
            {mode === "login" ? "Sign in to access your reports and watchlist" : "Start analysing Indian stocks for free"}
          </p>
        </div>

        <div className="glass-card hero-glass-card rounded-2xl p-8">
          {/* Tabs */}
          <div
            className="flex gap-1.5 mb-6 p-1 rounded-xl"
            style={{ background: "rgba(255,255,255,0.04)" }}
          >
            <button
              onClick={() => { setMode("login"); setError(null); }}
              className="flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all flex items-center justify-center gap-1.5"
              style={mode === "login" ? { background: "#00ff87", color: "#000" } : { color: "rgba(255,255,255,0.45)" }}
            >
              <LogIn className="w-4 h-4" /> Sign In
            </button>
            <button
              onClick={() => { setMode("register"); setError(null); }}
              className="flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all flex items-center justify-center gap-1.5"
              style={mode === "register" ? { background: "#00ff87", color: "#000" } : { color: "rgba(255,255,255,0.45)" }}
            >
              <UserPlus className="w-4 h-4" /> Register
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === "register" && (
              <div>
                <label className="text-xs text-white/40 mb-1.5 block font-medium tracking-wide uppercase">Name</label>
                <div className="relative">
                  <User className="w-4 h-4 absolute left-3.5 top-3.5" style={{ color: "#00ff87" }} />
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full rounded-xl pl-10 pr-4 py-3 text-white text-sm focus:outline-none transition-colors placeholder-white/20"
                    style={inputStyle}
                    onFocus={inputFocus}
                    onBlur={inputBlur}
                    placeholder="Your name"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="text-xs text-white/40 mb-1.5 block font-medium tracking-wide uppercase">Email</label>
              <div className="relative">
                <Mail className="w-4 h-4 absolute left-3.5 top-3.5" style={{ color: "#00ff87" }} />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-xl pl-10 pr-4 py-3 text-white text-sm focus:outline-none transition-colors placeholder-white/20"
                  style={inputStyle}
                  onFocus={inputFocus}
                  onBlur={inputBlur}
                  placeholder="you@example.com"
                  required
                />
              </div>
            </div>

            <div>
              <label className="text-xs text-white/40 mb-1.5 block font-medium tracking-wide uppercase">Password</label>
              <div className="relative">
                <Lock className="w-4 h-4 absolute left-3.5 top-3.5" style={{ color: "#00ff87" }} />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-xl pl-10 pr-4 py-3 text-white text-sm focus:outline-none transition-colors placeholder-white/20"
                  style={inputStyle}
                  onFocus={inputFocus}
                  onBlur={inputBlur}
                  placeholder="Min. 6 characters"
                  required
                  minLength={6}
                />
              </div>
            </div>

            {error && (
              <div
                className="text-red-400 text-sm rounded-xl px-4 py-3 flex items-center gap-2"
                style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)" }}
              >
                <span>⚠</span> {error}
              </div>
            )}

            {info && (
              <div
                className="text-emerald-300 text-sm rounded-xl px-4 py-3"
                style={{ background: "rgba(16,185,129,0.12)", border: "1px solid rgba(16,185,129,0.25)" }}
              >
                <div>{info}</div>
                {canResend && (
                  <button
                    type="button"
                    onClick={handleResend}
                    className="mt-2 text-xs underline text-emerald-200/90 hover:text-emerald-100"
                  >
                    Resend confirmation email
                  </button>
                )}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl font-bold text-black text-sm transition-opacity disabled:opacity-60 mt-1"
              style={{ background: "#00ff87" }}
            >
              {loading ? "Please wait…" : mode === "login" ? "Sign In →" : "Create Account →"}
            </button>
          </form>
        </div>

        <p className="text-center text-white/25 text-xs mt-6">
          Your data is encrypted and never shared with third parties.
        </p>
      </div>
    </div>
  );
}
