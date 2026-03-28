/**
 * Formatting utilities for the UI
 */

export function formatScore(score: number | null | undefined | string): string {
  if (score == null) return "—";
  const num = typeof score === "string" ? parseFloat(score) : score;
  if (isNaN(num)) return "—";
  return Math.round(num).toString();
}

export function getRatingColor(rating: string): string {
  switch (rating?.toUpperCase()) {
    case "STRONG":
      return "#16a34a";
    case "MODERATE":
      return "#ca8a04";
    case "CAUTION":
      return "#ea580c";
    case "HIGH RISK":
      return "#dc2626";
    default:
      return "#64748b";
  }
}

export function getRatingBg(rating: string): string {
  switch (rating?.toUpperCase()) {
    case "STRONG":
      return "bg-green-900/30 border-green-700";
    case "MODERATE":
      return "bg-yellow-900/30 border-yellow-700";
    case "CAUTION":
      return "bg-orange-900/30 border-orange-700";
    case "HIGH RISK":
      return "bg-red-900/30 border-red-700";
    default:
      return "bg-slate-800 border-slate-600";
  }
}

export function getSeverityBadge(severity: string): string {
  switch (severity?.toUpperCase()) {
    case "CRITICAL":
      return "badge-critical";
    case "HIGH":
      return "badge-high";
    case "WATCH":
      return "badge-watch";
    case "POSITIVE":
      return "badge-positive";
    default:
      return "bg-slate-700 text-slate-300";
  }
}

export function formatNumber(n: number | null | undefined | string): string {
  if (n == null) return "—";
  const num = typeof n === "string" ? parseFloat(n) : n;
  if (isNaN(num)) return "—";
  const abs = Math.abs(num);
  if (abs >= 1e7) return (num / 1e7).toFixed(2) + " Cr";
  if (abs >= 1e5) return (num / 1e5).toFixed(2) + " L";
  return num.toLocaleString("en-IN", { maximumFractionDigits: 2 });
}

export function formatPercent(n: number | null | undefined | string): string {
  if (n == null) return "—";
  const num = typeof n === "string" ? parseFloat(n) : n;
  if (isNaN(num)) return "—";
  return num.toFixed(1) + "%";
}

export function timeAgo(isoDate: string): string {
  const diff = Date.now() - new Date(isoDate).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}
