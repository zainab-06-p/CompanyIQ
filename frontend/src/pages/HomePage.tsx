import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { motion, useScroll, useMotionValueEvent, AnimatePresence } from "framer-motion";
import {
  Menu, X, ChevronRight, Mail,
  Twitter, Linkedin, ArrowRight, Sparkles, Zap,
  Activity, Check, Star, TrendingUp, Shield,
  Rocket, Brain, Gauge, BarChart3, Lock, Globe,
  ArrowUpRight, ChevronDown, Cpu, Layers, Search,
  Eye, LogIn, LogOut, User, Swords, Briefcase, History
} from "lucide-react";
import { searchCompanies, type CompanyResult } from "../utils/api.ts";

function cn(...classes: (string | undefined | null | boolean)[]): string {
  return classes.filter(Boolean).join(" ");
}

// ─── Fish Canvas ──────────────────────────────────────────────────────────────
interface Fish { id: number; x: number; y: number; size: number; speed: number; direction: number; alpha: number; }

const FishCanvas: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fishRef = useRef<Fish[]>([]);
  const frameRef = useRef<number | null>(null);
  const mouseRef = useRef({ x: -999, y: -999 });

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; };
    resize();
    window.addEventListener("resize", resize);
    window.addEventListener("mousemove", (e) => { mouseRef.current = { x: e.clientX, y: e.clientY }; });

    fishRef.current = Array.from({ length: 28 }, (_, i) => ({
      id: i, x: Math.random() * window.innerWidth, y: Math.random() * window.innerHeight,
      size: Math.random() * 8 + 4, speed: Math.random() * 0.6 + 0.2,
      direction: Math.random() * Math.PI * 2, alpha: Math.random() * 0.3 + 0.1,
    }));

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      fishRef.current.forEach((f) => {
        const dx = mouseRef.current.x - f.x;
        const dy = mouseRef.current.y - f.y;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d < 120) { f.direction = Math.atan2(dy, dx) + Math.PI + (Math.random() - 0.5) * 0.8; }
        else if (Math.random() < 0.015) { f.direction += (Math.random() - 0.5) * 0.4; }
        f.x += Math.cos(f.direction) * f.speed;
        f.y += Math.sin(f.direction) * f.speed;
        if (f.x < -20) f.x = canvas.width + 20;
        if (f.x > canvas.width + 20) f.x = -20;
        if (f.y < -20) f.y = canvas.height + 20;
        if (f.y > canvas.height + 20) f.y = -20;
        ctx.save();
        ctx.translate(f.x, f.y);
        ctx.rotate(f.direction);
        ctx.fillStyle = `rgba(0,255,135,${f.alpha})`;
        ctx.beginPath();
        ctx.moveTo(f.size, 0);
        ctx.quadraticCurveTo(0, f.size * 0.4, -f.size * 0.5, f.size * 0.35);
        ctx.quadraticCurveTo(-f.size * 0.3, 0, -f.size * 0.5, -f.size * 0.35);
        ctx.quadraticCurveTo(0, -f.size * 0.4, f.size, 0);
        ctx.fill();
        ctx.fillStyle = `rgba(0,229,255,${f.alpha * 0.6})`;
        ctx.beginPath();
        ctx.moveTo(-f.size * 0.45, 0);
        ctx.lineTo(-f.size * 1.1, f.size * 0.4);
        ctx.lineTo(-f.size * 1.1, -f.size * 0.4);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = `rgba(0,0,0,${f.alpha * 2})`;
        ctx.beginPath();
        ctx.arc(f.size * 0.55, -f.size * 0.1, f.size * 0.12, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      });
      frameRef.current = requestAnimationFrame(draw);
    };
    draw();
    return () => {
      window.removeEventListener("resize", resize);
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
    };
  }, []);
  return <canvas ref={canvasRef} className="fixed inset-0 pointer-events-none z-0" style={{ opacity: 0.6 }} />;
};

// ─── Particle Web ─────────────────────────────────────────────────────────────
const ParticleWeb: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pts = useRef<{ x: number; y: number; vx: number; vy: number; r: number }[]>([]);
  const frameRef = useRef<number | null>(null);
  const mouse = useRef({ x: -999, y: -999 });

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; };
    resize();
    window.addEventListener("resize", resize);
    window.addEventListener("mousemove", (e) => { mouse.current = { x: e.clientX, y: e.clientY }; });

    pts.current = Array.from({ length: 60 }, () => ({
      x: Math.random() * window.innerWidth, y: Math.random() * window.innerHeight,
      vx: (Math.random() - 0.5) * 0.4, vy: (Math.random() - 0.5) * 0.4,
      r: Math.random() * 1.5 + 0.5,
    }));

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      pts.current.forEach((p, i) => {
        p.x += p.vx; p.y += p.vy;
        if (p.x < 0 || p.x > canvas.width) p.vx *= -1;
        if (p.y < 0 || p.y > canvas.height) p.vy *= -1;
        const mdx = p.x - mouse.current.x;
        const mdy = p.y - mouse.current.y;
        const md = Math.sqrt(mdx * mdx + mdy * mdy);
        if (md < 80) { p.vx += mdx * 0.003; p.vy += mdy * 0.003; }
        ctx.fillStyle = "rgba(0,255,135,0.5)";
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
        pts.current.slice(i + 1).forEach((q) => {
          const dx = q.x - p.x; const dy = q.y - p.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 110) {
            ctx.strokeStyle = `rgba(0,229,255,${(1 - dist / 110) * 0.18})`;
            ctx.lineWidth = 0.6;
            ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y); ctx.stroke();
          }
        });
      });
      frameRef.current = requestAnimationFrame(draw);
    };
    draw();
    return () => {
      window.removeEventListener("resize", resize);
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
    };
  }, []);
  return <canvas ref={canvasRef} className="fixed inset-0 pointer-events-none z-0" style={{ opacity: 0.35 }} />;
};

// ─── Background Layers ───────────────────────────────────────────────────────
const GridBg: React.FC = () => (
  <div className="fixed inset-0 pointer-events-none z-0" style={{
    backgroundImage: `linear-gradient(rgba(0,255,135,0.03) 1px,transparent 1px),linear-gradient(90deg,rgba(0,255,135,0.03) 1px,transparent 1px)`,
    backgroundSize: "60px 60px",
  }} />
);
const GlowOrbs: React.FC = () => (
  <>
    <div className="fixed top-[-20vh] left-[10%] w-[600px] h-[600px] rounded-full pointer-events-none z-0"
      style={{ background: "radial-gradient(circle,rgba(0,255,135,0.06) 0%,transparent 70%)" }} />
    <div className="fixed top-[30vh] right-[-10%] w-[500px] h-[500px] rounded-full pointer-events-none z-0"
      style={{ background: "radial-gradient(circle,rgba(0,229,255,0.05) 0%,transparent 70%)" }} />
    <div className="fixed bottom-[-10vh] left-[30%] w-[700px] h-[700px] rounded-full pointer-events-none z-0"
      style={{ background: "radial-gradient(circle,rgba(0,255,135,0.04) 0%,transparent 70%)" }} />
  </>
);

// ─── Count-up ─────────────────────────────────────────────────────────────────
const CountUp: React.FC<{ end: number; suffix?: string; duration?: number }> = ({ end, suffix = "", duration = 2 }) => {
  const [val, setVal] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const startRef = useRef(false);
  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !startRef.current) {
        startRef.current = true;
        const t0 = performance.now();
        const step = (now: number) => {
          const prog = Math.min((now - t0) / (duration * 1000), 1);
          const eased = 1 - Math.pow(1 - prog, 4);
          setVal(Math.floor(eased * end));
          if (prog < 1) requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
      }
    }, { threshold: 0.5 });
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [end, duration]);
  return <span ref={ref}>{val.toLocaleString()}{suffix}</span>;
};

// ─── Navbar ───────────────────────────────────────────────────────────────────
interface NavProps { user?: any; onLogout?: () => void; }
const Nav: React.FC<NavProps> = ({ user, onLogout }) => {
  const navigate = useNavigate();
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { scrollY } = useScroll();
  useMotionValueEvent(scrollY, "change", (v) => setScrolled(v > 20));

  const sections = ["Features", "Proof", "Pricing"];

  return (
    <motion.header
      initial={{ y: -80, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className={cn(
        "fixed top-0 inset-x-0 z-50 transition-all duration-500",
        scrolled
          ? "py-3 backdrop-blur-2xl border-b border-white/[0.06] shadow-[0_8px_32px_rgba(0,0,0,0.4)]"
          : "py-5 bg-transparent",
        scrolled ? "bg-[rgba(4,8,16,0.85)]" : ""
      )}
    >
      <div className="max-w-7xl mx-auto px-6 flex items-center justify-between">
        {/* Logo */}
        <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate("/")}>
          <div className="w-9 h-9 rounded-xl flex items-center justify-center shadow-glow-sm"
            style={{ background: "#00ff87" }}>
            <TrendingUp className="w-[18px] h-[18px]" style={{ color: "#040810" }} />
          </div>
          <span className="font-display text-xl font-extrabold text-white tracking-tight">
            Company<span className="text-gradient">IQ</span>
          </span>
        </div>

        {/* Desktop sections */}
        <nav className="hidden md:flex items-center gap-1">
          {sections.map((l) => (
            <motion.a key={l} href={`#${l.toLowerCase()}`}
              className="relative px-4 py-2 text-sm text-[#7c8fa6] hover:text-white transition-colors rounded-lg group"
              whileHover={{ backgroundColor: "rgba(255,255,255,0.05)" }}>
              {l}
              <span className="absolute bottom-1 left-4 right-4 h-px bg-[#00ff87] scale-x-0 group-hover:scale-x-100 transition-transform duration-300 origin-left" />
            </motion.a>
          ))}
          <motion.button onClick={() => navigate("/compare")}
            className="relative px-4 py-2 text-sm text-[#7c8fa6] hover:text-white transition-colors rounded-lg group"
            whileHover={{ backgroundColor: "rgba(255,255,255,0.05)" }}>
            <span className="flex items-center gap-1.5"><Swords className="w-3.5 h-3.5" />Compare</span>
            <span className="absolute bottom-1 left-4 right-4 h-px bg-[#00ff87] scale-x-0 group-hover:scale-x-100 transition-transform duration-300 origin-left" />
          </motion.button>
          <motion.button onClick={() => navigate("/portfolio")}
            className="relative px-4 py-2 text-sm text-[#7c8fa6] hover:text-white transition-colors rounded-lg group"
            whileHover={{ backgroundColor: "rgba(255,255,255,0.05)" }}>
            <span className="flex items-center gap-1.5"><Layers className="w-3.5 h-3.5" />Portfolio</span>
            <span className="absolute bottom-1 left-4 right-4 h-px bg-[#00ff87] scale-x-0 group-hover:scale-x-100 transition-transform duration-300 origin-left" />
          </motion.button>
        </nav>

        {/* Desktop CTA */}
        <div className="hidden md:flex items-center gap-3">
          {user ? (
            <>
              {user && (
                <button onClick={() => navigate("/watchlist")}
                  className="flex items-center gap-1.5 px-3 py-2 text-sm text-[#7c8fa6] hover:text-white transition-colors rounded-lg"
                  style={{ background: "rgba(255,255,255,0.04)" }}>
                  <Eye className="w-3.5 h-3.5" /> Watchlist
                </button>
              )}
              {user && (
                <button onClick={() => navigate("/history")}
                  className="flex items-center gap-1.5 px-3 py-2 text-sm text-[#7c8fa6] hover:text-white transition-colors rounded-lg"
                  style={{ background: "rgba(255,255,255,0.04)" }}>
                  <History className="w-3.5 h-3.5" /> History
                </button>
              )}
              <span className="text-[#7c8fa6] text-sm flex items-center gap-1.5">
                <User className="w-3.5 h-3.5" />{user.name || user.email}
              </span>
              <button onClick={onLogout}
                className="flex items-center gap-1 px-3 py-2 text-sm text-[#7c8fa6] hover:text-white transition-colors rounded-lg"
                style={{ background: "rgba(255,255,255,0.04)" }}>
                <LogOut className="w-3.5 h-3.5" /> Logout
              </button>
            </>
          ) : (
            <>
              <button onClick={() => navigate("/auth")}
                className="px-4 py-2 text-sm text-[#7c8fa6] hover:text-white transition-colors">
                Sign In
              </button>
              <motion.button onClick={() => navigate("/auth")}
                whileHover={{ scale: 1.04, boxShadow: "0 0 25px rgba(0,255,135,0.4)" }}
                whileTap={{ scale: 0.97 }}
                className="px-5 py-2.5 text-sm font-semibold rounded-full transition-all"
                style={{ background: "#00ff87", color: "#040810" }}>
                Get Started Free
              </motion.button>
            </>
          )}
        </div>

        {/* Mobile toggle */}
        <button className="md:hidden text-white p-1" onClick={() => setMobileOpen(!mobileOpen)}>
          {mobileOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      {/* Mobile menu */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
            className="md:hidden overflow-hidden backdrop-blur-2xl border-t border-white/[0.06]"
            style={{ background: "rgba(4,8,16,0.95)" }}>
            <div className="px-6 py-4 flex flex-col gap-1">
              {sections.map((l, i) => (
                <motion.a key={l} href={`#${l.toLowerCase()}`}
                  initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.06 }}
                  className="flex items-center justify-between py-3 px-3 rounded-xl text-[#7c8fa6] hover:text-white hover:bg-white/[0.05] transition-all"
                  onClick={() => setMobileOpen(false)}>
                  {l} <ChevronRight size={16} />
                </motion.a>
              ))}
              <button onClick={() => { navigate("/compare"); setMobileOpen(false); }}
                className="flex items-center gap-2 py-3 px-3 rounded-xl text-[#7c8fa6] hover:text-white hover:bg-white/[0.05] transition-all">
                <Swords size={15} /> Battle of Stocks
              </button>
              <button onClick={() => { navigate("/portfolio"); setMobileOpen(false); }}
                className="flex items-center gap-2 py-3 px-3 rounded-xl text-[#7c8fa6] hover:text-white hover:bg-white/[0.05] transition-all">
                <Layers size={15} /> Portfolio Analyser
              </button>
              {user ? (
                <>
                  <button onClick={() => { navigate("/watchlist"); setMobileOpen(false); }}
                    className="flex items-center gap-2 py-3 px-3 rounded-xl text-[#7c8fa6] hover:text-white hover:bg-white/[0.05] transition-all">
                    <Eye size={15} /> Watchlist
                  </button>
                  <button onClick={() => { navigate("/history"); setMobileOpen(false); }}
                    className="flex items-center gap-2 py-3 px-3 rounded-xl text-[#7c8fa6] hover:text-white hover:bg-white/[0.05] transition-all">
                    <History size={15} /> History
                  </button>
                  <button onClick={() => { onLogout?.(); setMobileOpen(false); }}
                    className="flex items-center gap-2 py-3 px-3 rounded-xl text-[#7c8fa6] hover:text-white hover:bg-white/[0.05] transition-all">
                    <LogOut size={15} /> Logout
                  </button>
                </>
              ) : (
                <motion.button onClick={() => { navigate("/auth"); setMobileOpen(false); }}
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}
                  className="mt-3 py-3 font-semibold rounded-xl" style={{ background: "#00ff87", color: "#040810" }}>
                  Get Started Free
                </motion.button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.header>
  );
};

// ─── Hero ─────────────────────────────────────────────────────────────────────
const TICKER_STOCKS = [
  { name: "TCS", score: 84, change: "+2.3%", pos: true },
  { name: "Infosys", score: 79, change: "+1.8%", pos: true },
  { name: "Reliance", score: 72, change: "-0.5%", pos: false },
  { name: "HDFC Bank", score: 88, change: "+3.1%", pos: true },
  { name: "Adani Ent", score: 51, change: "-1.2%", pos: false },
  { name: "Wipro", score: 76, change: "+0.9%", pos: true },
  { name: "ICICI Bank", score: 83, change: "+2.6%", pos: true },
  { name: "Tata Motors", score: 67, change: "-0.3%", pos: false },
];

interface HeroProps { user?: any; onLogout?: () => void; }
const Hero: React.FC<HeroProps> = () => {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CompanyResult[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedIdx, setSelectedIdx] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    if (query.length < 1) { setResults([]); return; }
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await searchCompanies(query);
        setResults(res);
        setShowDropdown(res.length > 0);
        setSelectedIdx(-1);
      } catch { setResults([]); }
    }, 250);
  }, [query]);

  function handleSelect(company: CompanyResult) {
    setShowDropdown(false);
    navigate(`/loading/${encodeURIComponent(company.ticker)}`);
  }
  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") { e.preventDefault(); setSelectedIdx((p) => Math.min(p + 1, results.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setSelectedIdx((p) => Math.max(p - 1, -1)); }
    else if (e.key === "Escape") setShowDropdown(false);
    else if (e.key === "Enter") {
      if (selectedIdx >= 0 && results[selectedIdx]) handleSelect(results[selectedIdx]);
      else if (query.trim().length >= 2) navigate(`/loading/${encodeURIComponent(query.trim())}`);
    }
  }

  return (
    <section className="relative min-h-screen flex flex-col items-center justify-center pt-24 pb-16 overflow-hidden">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full pointer-events-none"
        style={{ background: "radial-gradient(circle,rgba(0,255,135,0.05) 0%,transparent 65%)" }} />

      <div className="max-w-7xl mx-auto px-6 w-full relative z-10">
        <div className="flex flex-col items-center text-center">
          {/* Badge */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
            className="mb-8 inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm backdrop-blur-sm"
            style={{ border: "1px solid rgba(0,255,135,0.25)", background: "rgba(0,255,135,0.07)", color: "#00ff87" }}>
            <span className="relative flex w-2 h-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ background: "#00ff87" }} />
              <span className="relative inline-flex rounded-full h-2 w-2" style={{ background: "#00ff87" }} />
            </span>
            AI-Powered Due Diligence · Indian Equities
          </motion.div>

          {/* Headline */}
          <motion.h1 initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.65, delay: 0.1 }}
            className="font-display text-6xl sm:text-7xl xl:text-8xl font-extrabold tracking-tight leading-tight mb-6">
            <span className="text-white">Know Every Stock.</span><br />
            <span className="text-gradient">Risk Nothing.</span>
          </motion.h1>

          {/* Sub */}
          <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.2 }}
            className="max-w-2xl text-lg leading-relaxed mb-10" style={{ color: "#7c8fa6" }}>
            30+ AI engines analyse financial health, promoter integrity, legal exposure, and market sentiment — delivering
            a single CompanyIQ score for{" "}
            <span className="text-white font-medium">80+ listed Indian companies</span>.
          </motion.p>

          {/* Search bar */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.3 }}
            className="w-full max-w-2xl mb-6 relative">
            <div className="relative flex items-center p-1.5 rounded-2xl"
              style={{ border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.04)", backdropFilter: "blur(16px)", boxShadow: "0 20px 60px rgba(0,0,0,0.5)" }}>
              <Search className="absolute left-5 text-[#7c8fa6] w-4 h-4" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                onFocus={() => results.length > 0 && setShowDropdown(true)}
                onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
                placeholder="Search company — TCS, Infosys, Reliance..."
                className="flex-1 bg-transparent pl-10 pr-4 py-3.5 text-white placeholder-[#3d4f63] text-sm focus:outline-none"
                autoFocus
              />
              <motion.button
                whileHover={{ scale: 1.03, boxShadow: "0 0 30px rgba(0,255,135,0.5)" }}
                whileTap={{ scale: 0.97 }}
                onClick={() => query.trim().length >= 2 && navigate(`/loading/${encodeURIComponent(query.trim())}`)}
                className="flex items-center gap-2 px-6 py-3.5 rounded-xl font-semibold text-sm transition-colors"
                style={{ background: "#00ff87", color: "#040810" }}>
                <Rocket size={16} />
                Analyse Now
              </motion.button>
            </div>

            {/* Autocomplete */}
            {showDropdown && (
              <div className="absolute w-full mt-2 rounded-xl shadow-2xl z-50 overflow-hidden"
                style={{ background: "#070e1a", border: "1px solid rgba(255,255,255,0.08)" }}>
                {results.map((company, idx) => (
                  <button key={company.ticker} type="button"
                    onMouseDown={() => handleSelect(company)}
                    className={cn(
                      "w-full px-4 py-3 text-left flex items-center justify-between transition-colors",
                      idx === selectedIdx ? "bg-white/[0.07]" : "hover:bg-white/[0.05]"
                    )}>
                    <div>
                      <div className="text-white font-medium">{company.name}</div>
                      <div className="text-sm" style={{ color: "#7c8fa6" }}>{company.ticker} · {company.sector}</div>
                    </div>
                    <ChevronRight className="w-4 h-4" style={{ color: "#3d4f63" }} />
                  </button>
                ))}
              </div>
            )}
          </motion.div>

          {/* Quick actions */}
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.45 }}
            className="flex flex-wrap items-center justify-center gap-3 text-sm mb-14">
            <button onClick={() => navigate("/compare")}
              className="flex items-center gap-1.5 px-4 py-2 rounded-full transition-all hover:text-white"
              style={{ background: "rgba(251,146,60,0.12)", border: "1px solid rgba(251,146,60,0.25)", color: "#fb923c" }}>
              <Swords className="w-3.5 h-3.5" /> Battle of Stocks
            </button>
            <button onClick={() => navigate("/portfolio")}
              className="flex items-center gap-1.5 px-4 py-2 rounded-full transition-all hover:text-white"
              style={{ background: "rgba(0,229,255,0.08)", border: "1px solid rgba(0,229,255,0.2)", color: "#00e5ff" }}>
              <Briefcase className="w-3.5 h-3.5" /> Portfolio Analyser
            </button>
            <button onClick={() => navigate("/watchlist")}
              className="flex items-center gap-1.5 px-4 py-2 rounded-full transition-all hover:text-white"
              style={{ background: "rgba(168,85,247,0.08)", border: "1px solid rgba(168,85,247,0.2)", color: "#a855f7" }}>
              <Eye className="w-3.5 h-3.5" /> Watchlist
            </button>
          </motion.div>

          {/* Live ticker */}
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.55 }}
            className="w-full max-w-4xl overflow-hidden relative">
            <div className="absolute left-0 top-0 bottom-0 w-16 z-10 pointer-events-none"
              style={{ background: "linear-gradient(to right, #040810, transparent)" }} />
            <div className="absolute right-0 top-0 bottom-0 w-16 z-10 pointer-events-none"
              style={{ background: "linear-gradient(to left, #040810, transparent)" }} />
            <div className="ticker-track">
              {[...TICKER_STOCKS, ...TICKER_STOCKS].map((s, i) => (
                <div key={i} className="shrink-0 mx-2 flex items-center gap-3 px-4 py-2.5 rounded-xl border border-white/[0.07] cursor-pointer hover:border-[rgba(0,255,135,0.3)] hover:bg-[rgba(0,255,135,0.05)] transition-all"
                  style={{ background: "rgba(255,255,255,0.03)", backdropFilter: "blur(8px)" }}>
                  <span className="font-mono text-xs" style={{ color: "#7c8fa6" }}>{s.name}</span>
                  <span className="font-display font-bold text-white text-sm">{s.score}</span>
                  <span className={cn("font-mono text-xs", s.pos ? "text-[#00ff87]" : "text-red-400")}>{s.change}</span>
                  <div className={cn("w-1.5 h-1.5 rounded-full", s.pos ? "bg-[#00ff87]" : "bg-red-400")} />
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </div>

      <motion.div animate={{ y: [0, 8, 0] }} transition={{ duration: 2, repeat: Infinity }}
        className="absolute bottom-8 left-1/2 -translate-x-1/2" style={{ color: "#3d4f63" }}>
        <ChevronDown size={20} />
      </motion.div>
    </section>
  );
};

// ─── Stats ────────────────────────────────────────────────────────────────────
const StatsSection: React.FC = () => {
  const stats = [
    { label: "Companies Covered", value: 80, suffix: "+", icon: BarChart3 },
    { label: "AI Engines Active", value: 30, suffix: "+", icon: Cpu },
    { label: "Live Data Sources", value: 3, suffix: "", icon: Globe },
    { label: "Avg. Cached Response", value: 2, suffix: "s", icon: Activity },
  ];
  return (
    <section id="proof" className="relative z-10 py-16">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {stats.map((s, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
              transition={{ delay: i * 0.08 }}
              className="glass-card glass-card-hover card-inner-glow border-glow p-6 text-center group">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center mx-auto mb-4 group-hover:bg-[rgba(0,255,135,0.2)] transition-colors"
                style={{ background: "rgba(0,255,135,0.1)" }}>
                <s.icon size={18} style={{ color: "#00ff87" }} />
              </div>
              <div className="font-display text-3xl font-bold text-white mb-1">
                <CountUp end={s.value} suffix={s.suffix} />
              </div>
              <div className="text-sm" style={{ color: "#7c8fa6" }}>{s.label}</div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

// ─── Features ─────────────────────────────────────────────────────────────────
const FeaturesSection: React.FC = () => {
  const features = [
    {
      icon: Zap, tag: "Core",
      title: "30+ Engine CompanyIQ Score",
      desc: "Financial health, promoter integrity, legal exposure, news sentiment — all fused into one composite IQ rating per company.",
      points: ["Altman Z-Score · Piotroski F-Score", "Promoter pledge & insider trading", "Red flag detection (17 categories)"],
    },
    {
      icon: Activity, tag: "Live",
      title: "Live Web Intelligence",
      desc: "TinyFish AI agents scrape Screener.in, BSE India, and news feeds in real time. Every analysis uses fresh data.",
      points: ["Screener.in financial ratios", "BSE announcements & SAST filings", "News NLP sentiment scoring"],
    },
    {
      icon: Shield, tag: "Guard",
      title: "Red Flag Radar",
      desc: "17 red-flag categories detect accounting anomalies, management misconduct, legal overhang, and governance failures.",
      points: ["Related-party transaction alerts", "Audit qualification detection", "Sudden promoter selling signals"],
    },
    {
      icon: Globe, tag: "Macro",
      title: "Peer & Sector Benchmarking",
      desc: "Every score is placed in full sectoral context. Auto-discovers real competitors and compares 10 key metrics.",
      points: ["Dynamic competitor discovery", "Sector-relative valuation", "FII/DII flow indicators"],
    },
    {
      icon: Brain, tag: "AI",
      title: "Annual Report Intelligence",
      desc: "A fifth TinyFish agent reads the actual Annual Report PDF — extracting management commentary, auditor opinion, and contingent liabilities.",
      points: ["Auditor qualification flags", "Contingent liability sizing", "Management tone analysis"],
    },
    {
      icon: Lock, tag: "Deep",
      title: "Insider & Promoter Tracking",
      desc: "Dedicated agent monitors BSE bulk deals, block deals, and SAST filings to surface accumulation or distribution signals.",
      points: ["Bulk & block deal pattern scoring", "Promoter pledge % trends", "Insider confidence signal (0–100)"],
    },
  ];
  return (
    <section id="features" className="relative z-10 py-24">
      <div className="max-w-7xl mx-auto px-6">
        <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
          className="text-center max-w-2xl mx-auto mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs mb-6"
            style={{ border: "1px solid rgba(0,255,135,0.2)", background: "rgba(0,255,135,0.06)", color: "#00ff87" }}>
            <Sparkles size={12} /> Everything you need
          </div>
          <h2 className="font-display text-4xl md:text-5xl font-bold text-white mb-4">Built for serious investors</h2>
          <p className="text-lg" style={{ color: "#7c8fa6" }}>
            Five specialised TinyFish AI agents. Thirty proprietary engines. One unified score.
          </p>
        </motion.div>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
          {features.map((f, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
              transition={{ delay: i * 0.07 }} whileHover={{ y: -6, transition: { duration: 0.25 } }}
              className="glass-card glass-card-hover card-inner-glow p-6 rounded-2xl group relative overflow-hidden">
              <motion.div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
                style={{ background: "linear-gradient(135deg,rgba(0,255,135,0.03) 0%,transparent 50%)" }} />
              <div className="flex items-start justify-between mb-4">
                <div className="w-11 h-11 rounded-xl flex items-center justify-center group-hover:bg-[rgba(0,255,135,0.2)] transition-colors duration-300"
                  style={{ background: "rgba(0,255,135,0.1)" }}>
                  <f.icon size={20} style={{ color: "#00ff87" }} />
                </div>
                <span className="text-[10px] font-mono rounded-full px-2.5 py-1"
                  style={{ color: "rgba(0,255,135,0.7)", border: "1px solid rgba(0,255,135,0.2)" }}>{f.tag}</span>
              </div>
              <h3 className="font-display text-lg font-bold text-white mb-2 group-hover:text-[#00ff87] transition-colors duration-300">{f.title}</h3>
              <p className="text-sm leading-relaxed mb-4" style={{ color: "#7c8fa6" }}>{f.desc}</p>
              <ul className="space-y-1.5">
                {f.points.map((p, j) => (
                  <li key={j} className="flex items-center gap-2 text-xs" style={{ color: "#3d4f63" }}>
                    <div className="w-1 h-1 rounded-full shrink-0" style={{ background: "rgba(0,255,135,0.5)" }} />
                    {p}
                  </li>
                ))}
              </ul>
              <div className="absolute bottom-0 left-6 right-6 h-px bg-gradient-to-r from-transparent via-[rgba(0,255,135,0.3)] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

// ─── Dashboard Preview ────────────────────────────────────────────────────────
const DashboardPreview: React.FC = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState(0);
  const tabs = ["Overview", "Financials", "Risk", "Sentiment"];
  const METRICS = [
    { label: "IQ Score", value: "84", sub: "Top 12% of NSE", color: "#00ff87", bar: 84 },
    { label: "Financial Health", value: "A+", sub: "Altman Z: 4.2", color: "#00e5ff", bar: 91 },
    { label: "Risk Exposure", value: "Low", sub: "3 red flags", color: "#a78bfa", bar: 25 },
    { label: "Sentiment", value: "Bullish", sub: "NLP: +0.72", color: "#fb923c", bar: 72 },
  ];
  return (
    <section className="relative z-10 py-24 overflow-hidden">
      <div className="max-w-7xl mx-auto px-6">
        <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
          className="text-center max-w-2xl mx-auto mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs mb-6"
            style={{ border: "1px solid rgba(0,255,135,0.2)", background: "rgba(0,255,135,0.06)", color: "#00ff87" }}>
            <Gauge size={12} /> Sample Report
          </div>
          <h2 className="font-display text-4xl md:text-5xl font-bold text-white mb-4">See intelligence in action</h2>
          <p className="text-lg" style={{ color: "#7c8fa6" }}>
            A sample CompanyIQ report for <span className="text-white font-medium">TCS</span> — cached reports load instantly.
          </p>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 40 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
          className="relative mx-auto max-w-4xl">
          <div className="rounded-2xl overflow-hidden"
            style={{ border: "1px solid rgba(255,255,255,0.09)", boxShadow: "0 40px 120px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.05)" }}>
            {/* Title bar */}
            <div className="flex items-center gap-2 px-5 py-3 border-b"
              style={{ background: "rgba(255,255,255,0.04)", borderColor: "rgba(255,255,255,0.06)" }}>
              <div className="flex gap-1.5">
                {["#ff5f56","#ffbd2e","#27c93f"].map((c,i) => <div key={i} className="w-3 h-3 rounded-full" style={{ background: c }} />)}
              </div>
              <div className="flex-1 flex justify-center">
                <div className="flex items-center gap-2 px-3 py-1 rounded text-xs"
                  style={{ background: "rgba(255,255,255,0.05)", color: "#7c8fa6" }}>
                  <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: "#00ff87" }} />
                  companyiq.ai/report/TCS
                </div>
              </div>
            </div>
            {/* Body */}
            <div className="p-6" style={{ background: "#070e1a" }}>
              <div className="flex items-start justify-between mb-6">
                <div>
                  <div className="flex items-center gap-3 mb-1">
                    <h3 className="font-display text-2xl font-bold text-white">Tata Consultancy Services</h3>
                    <span className="px-2 py-0.5 rounded text-xs font-mono"
                      style={{ border: "1px solid rgba(0,255,135,0.3)", color: "#00ff87" }}>NSE: TCS</span>
                  </div>
                  <p className="text-sm" style={{ color: "#7c8fa6" }}>IT Services · Large Cap · ₹14.8L Cr Market Cap</p>
                </div>
                <div className="text-right">
                  <div className="font-display text-5xl font-extrabold text-gradient mb-1">84</div>
                  <div className="text-xs" style={{ color: "#7c8fa6" }}>CompanyIQ Score</div>
                  <div className="text-xs mt-0.5" style={{ color: "#00ff87" }}>↑ +2 from last week</div>
                </div>
              </div>
              {/* Tabs */}
              <div className="flex gap-1 mb-6 p-1 rounded-xl w-fit"
                style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)" }}>
                {tabs.map((t, i) => (
                  <button key={i} onClick={() => setActiveTab(i)}
                    className={cn("px-4 py-1.5 rounded-lg text-xs font-medium transition-all",
                      activeTab === i ? "shadow-glow-sm" : "hover:text-white")}
                    style={activeTab === i ? { background: "#00ff87", color: "#040810" } : { color: "#7c8fa6" }}>
                    {t}
                  </button>
                ))}
              </div>
              {/* Metric cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                {METRICS.map((m, i) => (
                  <motion.div key={i} initial={{ opacity: 0, scale: 0.95 }} whileInView={{ opacity: 1, scale: 1 }}
                    viewport={{ once: true }} transition={{ delay: i * 0.06 }}
                    className="p-4 rounded-xl"
                    style={{ border: "1px solid rgba(255,255,255,0.06)", background: "rgba(255,255,255,0.025)" }}>
                    <div className="text-xs mb-2" style={{ color: "#7c8fa6" }}>{m.label}</div>
                    <div className="font-display text-2xl font-bold text-white mb-1">{m.value}</div>
                    <div className="text-xs mb-2" style={{ color: "#3d4f63" }}>{m.sub}</div>
                    <div className="h-1 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
                      <motion.div initial={{ width: 0 }} whileInView={{ width: `${m.bar}%` }} viewport={{ once: true }}
                        transition={{ duration: 1, delay: i * 0.1 }}
                        className="h-full rounded-full" style={{ background: m.color }} />
                    </div>
                  </motion.div>
                ))}
              </div>
              {/* Flags */}
              <div className="grid md:grid-cols-2 gap-3">
                <div className="p-4 rounded-xl" style={{ border: "1px solid rgba(0,255,135,0.2)", background: "rgba(0,255,135,0.04)" }}>
                  <div className="text-xs font-medium mb-2 flex items-center gap-1.5" style={{ color: "#00ff87" }}>
                    <Check size={12} /> 4 Green Signals
                  </div>
                  {["Strong free cash flow (₹45K Cr+)", "Zero promoter pledge", "Consistent dividend growth (15yr)", "No audit qualifications"].map((g, i) => (
                    <div key={i} className="text-xs py-1 flex items-center gap-2" style={{ color: "#7c8fa6" }}>
                      <div className="w-1 h-1 rounded-full shrink-0" style={{ background: "#00ff87" }} /> {g}
                    </div>
                  ))}
                </div>
                <div className="p-4 rounded-xl" style={{ border: "1px solid rgba(239,68,68,0.2)", background: "rgba(239,68,68,0.04)" }}>
                  <div className="text-xs font-medium text-red-400 mb-2">⚠ 2 Watch Points</div>
                  {["Revenue growth decelerating YoY", "US market currency headwinds"].map((r, i) => (
                    <div key={i} className="text-xs py-1 flex items-center gap-2" style={{ color: "#7c8fa6" }}>
                      <div className="w-1 h-1 rounded-full bg-red-400 shrink-0" /> {r}
                    </div>
                  ))}
                </div>
              </div>
              {/* CTA */}
              <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                onClick={() => navigate("/loading/TCS")}
                className="mt-5 w-full py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all"
                style={{ background: "rgba(0,255,135,0.1)", border: "1px solid rgba(0,255,135,0.25)", color: "#00ff87" }}>
                <Rocket size={15} /> Run live analysis for TCS <ArrowRight size={15} />
              </motion.button>
            </div>
          </div>
          {/* Floating badges */}
          <motion.div animate={{ y: [0,-8,0] }} transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
            className="absolute -right-6 top-24 p-3 rounded-xl backdrop-blur-xl shadow-xl hidden lg:block"
            style={{ border: "1px solid rgba(255,255,255,0.1)", background: "rgba(7,14,26,0.9)" }}>
            <div className="text-xs mb-0.5" style={{ color: "#7c8fa6" }}>Cached response</div>
            <div className="font-display text-xl font-bold" style={{ color: "#00ff87" }}>~2s</div>
            <div className="text-[10px]" style={{ color: "#3d4f63" }}>instant results</div>
          </motion.div>
          <motion.div animate={{ y: [0,8,0] }} transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut" }}
            className="absolute -left-6 bottom-24 p-3 rounded-xl backdrop-blur-xl shadow-xl hidden lg:block"
            style={{ border: "1px solid rgba(255,255,255,0.1)", background: "rgba(7,14,26,0.9)" }}>
            <div className="text-xs mb-0.5" style={{ color: "#7c8fa6" }}>Engines run</div>
            <div className="font-display text-xl font-bold text-white">30/30</div>
            <div className="text-[10px]" style={{ color: "#00ff87" }}>All systems go</div>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
};

// ─── Pricing ──────────────────────────────────────────────────────────────────
const PricingSection: React.FC = () => {
  const navigate = useNavigate();
  const plans = [
    {
      name: "Free",
      price: "₹0",
      period: "per report",
      desc: "Basic CompanyIQ score for any company",
      features: [
        "CompanyIQ composite score",
        "Top-level rating (A–F)",
        "Red flag count",
        "Sector & peer comparison",
        "Covers 80+ NSE/BSE companies",
      ],
      cta: "Start Free",
      action: () => navigate("/"),
      highlight: false,
    },
    {
      name: "Quick Scan",
      price: "₹249",
      period: "per report",
      desc: "Full financial, legal & sentiment deep-dive",
      features: [
        "Everything in Free",
        "25 financial ratios (live Screener.in)",
        "Legal & regulatory analysis",
        "News sentiment NLP scoring",
        "Executive summary & investment thesis",
        "PDF export",
      ],
      cta: "Get Quick Scan",
      action: () => navigate("/"),
      highlight: true,
      badge: "Most Popular",
    },
    {
      name: "Deep Analysis",
      price: "₹599",
      period: "per report",
      desc: "Every engine, every signal, maximum intel",
      features: [
        "Everything in Quick Scan",
        "Annual Report agent (PDF parsing)",
        "Insider & promoter tracking (BSE live)",
        "Auto-discovered competitor analysis",
        "Portfolio-level risk scoring",
        "BSE real-time alert monitoring",
      ],
      cta: "Go Deep",
      action: () => navigate("/"),
      highlight: false,
    },
  ];
  return (
    <section id="pricing" className="relative z-10 py-24">
      <div className="max-w-7xl mx-auto px-6">
        <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
          className="text-center max-w-2xl mx-auto mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs mb-6"
            style={{ border: "1px solid rgba(0,255,135,0.2)", background: "rgba(0,255,135,0.06)", color: "#00ff87" }}>
            <Star size={12} /> Simple Pricing
          </div>
          <h2 className="font-display text-4xl md:text-5xl font-bold text-white mb-4">Pay per report. No subscription.</h2>
          <p className="text-lg" style={{ color: "#7c8fa6" }}>No monthly fees. No lock-in. Run an analysis when you need it.</p>
        </motion.div>
        <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {plans.map((p, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
              transition={{ delay: i * 0.1 }} whileHover={{ y: -8, transition: { duration: 0.25 } }}
              className={cn("relative rounded-2xl p-7 flex flex-col transition-all",
                p.highlight ? "border border-[rgba(0,255,135,0.4)] bg-[rgba(0,255,135,0.04)]" : "glass-card glass-card-hover")}
              style={p.highlight ? { boxShadow: "0 0 60px rgba(0,255,135,0.12)" } : {}}>
              {p.badge && (
                <div className="absolute -top-3.5 left-6">
                  <span className="px-3 py-1 rounded-full text-[11px] font-semibold" style={{ background: "#00ff87", color: "#040810" }}>
                    {p.badge}
                  </span>
                </div>
              )}
              <div className="mb-6">
                <h3 className="font-display text-lg font-semibold text-white mb-1">{p.name}</h3>
                <p className="text-xs mb-4" style={{ color: "#7c8fa6" }}>{p.desc}</p>
                <div className="flex items-end gap-1">
                  <span className="font-display text-4xl font-extrabold text-white">{p.price}</span>
                  <span className="text-sm mb-1" style={{ color: "#7c8fa6" }}>{p.period}</span>
                </div>
              </div>
              <div className="h-px mb-6" style={{ background: "rgba(255,255,255,0.06)" }} />
              <ul className="space-y-3 flex-1 mb-8">
                {p.features.map((feat, j) => (
                  <li key={j} className="flex items-center gap-3 text-sm" style={{ color: "#7c8fa6" }}>
                    <div className={cn("w-4 h-4 rounded-full flex items-center justify-center shrink-0")}
                      style={{ background: p.highlight ? "rgba(0,255,135,0.2)" : "rgba(255,255,255,0.07)" }}>
                      <Check size={9} style={{ color: p.highlight ? "#00ff87" : "#fff" }} />
                    </div>
                    {feat}
                  </li>
                ))}
              </ul>
              <motion.button whileHover={{ scale: 1.03, ...(p.highlight ? { boxShadow: "0 0 25px rgba(0,255,135,0.4)" } : {}) }}
                whileTap={{ scale: 0.97 }} onClick={p.action}
                className={cn("w-full py-3.5 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2")}
                style={p.highlight ? { background: "#00ff87", color: "#040810" } : { border: "1px solid rgba(255,255,255,0.15)", color: "#fff" }}>
                {p.cta} <ArrowRight size={15} />
              </motion.button>
            </motion.div>
          ))}
        </div>
        <p className="text-center text-xs mt-8" style={{ color: "#3d4f63" }}>
          Payments via Razorpay · Powered by TinyFish Web Agents + Groq Llama 3.3-70B · Not investment advice
        </p>
      </div>
    </section>
  );
};

// ─── Contact ──────────────────────────────────────────────────────────────────
const ContactSection: React.FC = () => {
  const [sent, setSent] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", company: "", message: "" });
  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    setForm({ ...form, [e.target.name]: e.target.value });
  }
  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    // In production wire to a real form endpoint
    setSent(true);
  }
  return (
    <section id="contact" className="relative z-10 py-24">
      <div className="max-w-7xl mx-auto px-6">
        <div className="rounded-3xl overflow-hidden"
          style={{ border: "1px solid rgba(255,255,255,0.07)", background: "rgba(255,255,255,0.02)", backdropFilter: "blur(24px)" }}>
          <div className="grid lg:grid-cols-2">
            {/* Left */}
            <div className="p-12 lg:p-16 relative">
              <div className="absolute inset-0 opacity-30 pointer-events-none"
                style={{ background: "radial-gradient(circle at 30% 50%,rgba(0,255,135,0.08) 0%,transparent 60%)" }} />
              <div className="relative">
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs mb-8"
                  style={{ border: "1px solid rgba(0,255,135,0.2)", background: "rgba(0,255,135,0.06)", color: "#00ff87" }}>
                  <Mail size={12} /> Get in Touch
                </div>
                <h2 className="font-display text-3xl md:text-4xl font-bold text-white mb-4">Have a question?</h2>
                <p className="leading-relaxed mb-10" style={{ color: "#7c8fa6" }}>
                  Feature requests, feedback, or enterprise access? We'd love to hear from you.
                </p>
                <div className="space-y-5">
                  {[
                    { icon: Mail, label: "Email", val: "hello@companyiq.ai" },
                  ].map((item, i) => (
                    <div key={i} className="flex items-center gap-4 group cursor-pointer">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center group-hover:bg-[rgba(0,255,135,0.2)] transition-colors"
                        style={{ background: "rgba(0,255,135,0.1)" }}>
                        <item.icon size={16} style={{ color: "#00ff87" }} />
                      </div>
                      <div>
                        <div className="text-xs" style={{ color: "#3d4f63" }}>{item.label}</div>
                        <div className="text-sm text-white">{item.val}</div>
                      </div>
                    </div>
                  ))}
                  <div className="flex gap-3 pt-2">
                    {[Twitter, Linkedin].map((Icon, i) => (
                      <a key={i} href="#" className="w-9 h-9 rounded-xl flex items-center justify-center transition-all hover:text-white"
                        style={{ border: "1px solid rgba(255,255,255,0.08)", color: "#7c8fa6" }}>
                        <Icon size={15} />
                      </a>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            {/* Right */}
            <div className="p-12 lg:p-16 border-t lg:border-t-0 lg:border-l"
              style={{ borderColor: "rgba(255,255,255,0.07)", background: "rgba(255,255,255,0.02)" }}>
              {sent ? (
                <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
                  <div className="w-16 h-16 rounded-full flex items-center justify-center"
                    style={{ background: "rgba(0,255,135,0.12)", border: "1px solid rgba(0,255,135,0.3)" }}>
                    <Check size={28} style={{ color: "#00ff87" }} />
                  </div>
                  <h3 className="font-display text-xl font-bold text-white">Message Sent!</h3>
                  <p style={{ color: "#7c8fa6" }}>We'll get back to you shortly.</p>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  {[
                    { ph: "Full Name", name: "name", type: "text" },
                    { ph: "Email Address", name: "email", type: "email" },
                    { ph: "Company (optional)", name: "company", type: "text" },
                  ].map((f) => (
                    <input key={f.name} type={f.type} name={f.name} placeholder={f.ph}
                      value={(form as any)[f.name]} onChange={handleChange}
                      className="w-full px-4 py-3.5 rounded-xl text-white placeholder-[#3d4f63] text-sm focus:outline-none transition-all"
                      style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }} />
                  ))}
                  <textarea name="message" placeholder="How can we help?" rows={4}
                    value={form.message} onChange={handleChange}
                    className="w-full px-4 py-3.5 rounded-xl text-white placeholder-[#3d4f63] text-sm focus:outline-none transition-all resize-none"
                    style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }} />
                  <motion.button type="submit" whileHover={{ scale: 1.02, boxShadow: "0 0 30px rgba(0,255,135,0.3)" }}
                    whileTap={{ scale: 0.98 }}
                    className="w-full py-4 font-semibold rounded-xl transition-all flex items-center justify-center gap-2"
                    style={{ background: "#00ff87", color: "#040810" }}>
                    Send Message <ArrowUpRight size={16} />
                  </motion.button>
                </form>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

// ─── Footer ───────────────────────────────────────────────────────────────────
const FooterSection: React.FC = () => {
  const navigate = useNavigate();
  return (
    <footer className="relative z-10 border-t border-white/[0.06]">
      <div className="max-w-7xl mx-auto px-6 py-14">
        <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-10">
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center gap-2.5 cursor-pointer" onClick={() => navigate("/")}>
              <div className="w-8 h-8 rounded-lg flex items-center justify-center shadow-glow-sm"
                style={{ background: "#00ff87" }}>
                <TrendingUp size={15} style={{ color: "#040810" }} />
              </div>
              <span className="font-display font-extrabold text-lg text-white">
                Company<span className="text-gradient">IQ</span>
              </span>
            </div>
            <p className="text-sm leading-relaxed max-w-xs" style={{ color: "#7c8fa6" }}>
              AI-powered stock due diligence for Indian markets. Know the real story behind every ticker.
            </p>
            <div className="flex gap-3 pt-1">
              {[Twitter, Linkedin].map((Icon, i) => (
                <a key={i} href="#" className="w-9 h-9 rounded-xl flex items-center justify-center transition-all hover:text-white"
                  style={{ border: "1px solid rgba(255,255,255,0.08)", color: "#7c8fa6" }}>
                  <Icon size={15} />
                </a>
              ))}
            </div>
          </div>
          {[
            { title: "Tools", links: [
              { label: "Stock Analyser", action: () => navigate("/") },
              { label: "Battle of Stocks", action: () => navigate("/compare") },
              { label: "Portfolio Analyser", action: () => navigate("/portfolio") },
              { label: "Watchlist", action: () => navigate("/watchlist") },
            ]},
            { title: "Account", links: [
              { label: "Sign In / Register", action: () => navigate("/auth") },
              { label: "My Reports", action: () => navigate("/") },
            ]},
            { title: "Legal", links: [
              { label: "Privacy Policy", action: () => {} },
              { label: "Terms of Use", action: () => {} },
              { label: "SEBI Disclaimer", action: () => {} },
            ]},
          ].map((col, i) => (
            <div key={i}>
              <div className="text-xs font-semibold uppercase tracking-wider mb-4" style={{ color: "#7c8fa6" }}>{col.title}</div>
              <nav className="space-y-2.5">
                {col.links.map((l, j) => (
                  <button key={j} onClick={l.action} className="block text-sm transition-colors hover:text-white text-left w-full"
                    style={{ color: "#7c8fa6" }}>
                    {l.label}
                  </button>
                ))}
              </nav>
            </div>
          ))}
        </div>
        <div className="mt-14 pt-8 border-t border-white/[0.06] flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs" style={{ color: "#3d4f63" }}>© {new Date().getFullYear()} CompanyIQ. Built for TinyFish Hackathon.</p>
          <p className="text-xs" style={{ color: "#3d4f63" }}>Not investment advice · For educational & research purposes only.</p>
        </div>
      </div>
    </footer>
  );
};

// ─── Main Export ──────────────────────────────────────────────────────────────
interface HomePageProps { user?: any; onLogout?: () => void; }

export default function HomePage({ user, onLogout }: HomePageProps) {
  return (
    <div className="relative min-h-screen overflow-x-hidden" style={{ background: "#040810", fontFamily: "Inter, system-ui, sans-serif" }}>
      {/* Animated background layers */}
      <GridBg />
      <GlowOrbs />
      <FishCanvas />
      <ParticleWeb />

      {/* Content */}
      <div className="relative z-10">
        <Nav user={user} onLogout={onLogout} />
        <Hero user={user} onLogout={onLogout} />
        <StatsSection />
        <FeaturesSection />
        <DashboardPreview />
        <PricingSection />
        <ContactSection />
        <FooterSection />
      </div>
    </div>
  );
}



