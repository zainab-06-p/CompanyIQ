/**
 * CompetitorSection — Auto-Discovered Competitors
 *
 * Shows peers discovered live from Screener.in with key metrics for comparison.
 */

import { Target, ExternalLink, CheckCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface Competitor {
  name: string;
  ticker: string;
  marketCap: number | null;
  pe: number | null;
  roce: number | null;
  salesGrowth: number | null;
  currentPrice: number | null;
  inDatabase: boolean;
}

interface Props {
  data: {
    sourceCompany: string;
    sector: string;
    competitors: Competitor[];
    totalFound: number;
  };
}

function fmtCap(n: number | null) {
  if (n == null) return "—";
  if (n >= 1_00_000) return `₹${(n / 1_00_000).toFixed(0)}K Cr`;
  if (n >= 1_000) return `₹${(n / 1_000).toFixed(0)} Cr`;
  return `₹${n} Cr`;
}

function fmtNum(n: number | null, decimals = 1, suffix = "") {
  if (n == null) return "—";
  return `${n.toFixed(decimals)}${suffix}`;
}

export default function CompetitorSection({ data }: Props) {
  const navigate = useNavigate();

  if (!data?.competitors || data.competitors.length === 0) {
    return null;
  }

  return (
    <section className="rounded-2xl glass-card p-6 mt-8">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 rounded-lg bg-cyan-500/10 border border-cyan-500/20">
          <Target className="w-5 h-5 text-cyan-400" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-white">Competitors</h2>
          <p className="text-xs text-white/40">
            Auto-discovered from Screener.in — {data.totalFound} peers in{" "}
            <span className="text-cyan-400">{data.sector}</span>
          </p>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-white/[0.06]">
        <table className="w-full text-sm">
          <thead>
            <tr style={{ background: "rgba(0,0,0,0.4)" }} className="border-b border-white/[0.06]">
              <th className="px-4 py-3 text-left text-white/35 font-medium">Company</th>
              <th className="px-4 py-3 text-right text-white/35 font-medium">Market Cap</th>
              <th className="px-4 py-3 text-right text-white/35 font-medium">P/E</th>
              <th className="px-4 py-3 text-right text-white/35 font-medium">ROCE %</th>
              <th className="px-4 py-3 text-right text-white/35 font-medium">Sales CAGR</th>
              <th className="px-4 py-3 text-right text-white/35 font-medium">CMP</th>
              <th className="px-4 py-3 text-center text-white/35 font-medium">Analyse</th>
            </tr>
          </thead>
          <tbody>
            {data.competitors.map((c, i) => (
              <tr
                key={i}
                className="border-b border-white/[0.04] hover:bg-white/[0.03] transition-colors"
              >
                {/* Company name */}
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-white font-medium">{c.name}</span>
                        {c.inDatabase && (
                          <span title="In CompanyIQ database"><CheckCircle className="w-3 h-3 text-green-400 flex-shrink-0" /></span>
                        )}
                      </div>
                      <span className="text-xs text-white/35 font-mono">{c.ticker}</span>
                    </div>
                  </div>
                </td>

                {/* Market Cap */}
                <td className="px-4 py-3 text-right text-white/70">
                  {fmtCap(c.marketCap)}
                </td>

                {/* P/E */}
                <td className="px-4 py-3 text-right">
                  <span
                    className={
                      c.pe == null
                        ? "text-white/35"
                        : c.pe > 50
                        ? "text-red-400"
                        : c.pe < 15
                        ? "text-green-400"
                        : "text-white/70"
                    }
                  >
                    {fmtNum(c.pe)}
                  </span>
                </td>

                {/* ROCE */}
                <td className="px-4 py-3 text-right">
                  <span
                    className={
                      c.roce == null
                        ? "text-white/35"
                        : c.roce >= 20
                        ? "text-green-400"
                        : c.roce >= 10
                        ? "text-yellow-400"
                        : "text-red-400"
                    }
                  >
                    {fmtNum(c.roce, 1, "%")}
                  </span>
                </td>

                {/* Sales Growth */}
                <td className="px-4 py-3 text-right">
                  <span
                    className={
                      c.salesGrowth == null
                        ? "text-white/35"
                        : c.salesGrowth >= 15
                        ? "text-green-400"
                        : c.salesGrowth >= 5
                        ? "text-yellow-400"
                        : "text-red-400"
                    }
                  >
                    {fmtNum(c.salesGrowth, 1, "%")}
                  </span>
                </td>

                {/* CMP */}
                <td className="px-4 py-3 text-right text-white/70">
                  {c.currentPrice != null ? `₹${c.currentPrice.toFixed(2)}` : "—"}
                </td>

                {/* Analyse button */}
                <td className="px-4 py-3 text-center">
                  {c.inDatabase ? (
                    <button
                      onClick={() =>
                        navigate(`/loading/${encodeURIComponent(c.ticker)}`)
                      }
                      className="inline-flex items-center gap-1 px-2.5 py-1 text-xs bg-cyan-600/20 hover:bg-cyan-600/40 text-cyan-400 border border-cyan-700/40 rounded-lg transition-colors"
                    >
                      <ExternalLink className="w-3 h-3" />
                      Analyse
                    </button>
                  ) : (
                    <span className="text-xs text-white/30">Not in DB</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-white/25 mt-3">
        ✓ = available for deep analysis in CompanyIQ · Metrics sourced from Screener.in
      </p>
    </section>
  );
}
