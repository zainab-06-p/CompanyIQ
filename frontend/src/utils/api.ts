/**
 * API Client — centralized HTTP calls + SSE streaming
 */

const BASE = "/api";

export interface CompanyResult {
  name: string;
  ticker: string;
  sector: string;
  industry?: string;
}

export interface DeepAnalysisModule {
  score: number;
  rating: string;
  [key: string]: any;
}

export interface DeepAnalysisSummary {
  [module: string]: { score: number; rating: string };
}

export interface ScoreResult {
  company: CompanyResult;
  companyIQ: number;
  rating: string;
  ratingColor: string;
  pillarScores: {
    financial: number | null;
    legal: number | null;
    sentiment: number | null;
    deepAnalysis?: number;
  };
  redFlagCount: number;
  redFlags?: Array<{ severity: string; message: string }>;
  deepAnalysisSummary?: DeepAnalysisSummary;
  deepAnalysis?: Record<string, DeepAnalysisModule>;
  deepAnalysisScore?: number | null;
  metadata: {
    generatedAt: string;
    durationMs: number;
    totalSteps: number;
    agentSteps?: { financial: number; legal: number; sentiment: number };
    agentHealth?: { financial: boolean; legal: boolean; sentiment: boolean };
  };
  // Paid tier fields
  financial?: any;
  legal?: any;
  sentiment?: any;
  synthesis?: any;
  waterfall?: any;
  anomalies?: any;
  // Upgrade 20 + Future Scope
  adversarialAnalysis?: any;
  peerBenchmark?: any;
  scoreTrend?: any;
  multiHorizon?: any;
  relationshipGraph?: any;
  diff?: any;
}

export interface ProgressEvent {
  phase: string;
  message: string;
  pct: number;
  ts?: number;
  report?: any;
}

// ─── Company Search ─────────────────────────────────────────────────

export async function searchCompanies(q: string): Promise<CompanyResult[]> {
  const res = await fetch(`${BASE}/companies/search?q=${encodeURIComponent(q)}&limit=6`);
  const data = await res.json();
  return data.results || [];
}

export async function getAllCompanies(): Promise<CompanyResult[]> {
  const res = await fetch(`${BASE}/companies/all`);
  const data = await res.json();
  return data.companies || [];
}

// ─── Free Score ─────────────────────────────────────────────────────

export async function getFreeScore(company: string): Promise<ScoreResult> {
  const res = await fetch(`${BASE}/score/${encodeURIComponent(company)}`);
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.message || "Failed to get score");
  }
  return res.json();
}

export async function getLatestReport(company: string): Promise<{ ready: boolean; partial: boolean; report: any }> {
  const res = await fetch(`${BASE}/score/latest/${encodeURIComponent(company)}`);
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.message || "Failed to get latest report");
  }
  return res.json();
}

// ─── SSE Progress Stream ────────────────────────────────────────────

export function connectSSE(
  company: string,
  tier: string,
  onEvent: (event: ProgressEvent) => void,
  onError: (error: string) => void,
  options?: { forceRefresh?: boolean }
): () => void {
  const forceRefresh = options?.forceRefresh === true;
  const url = `${BASE}/progress/${encodeURIComponent(company)}?tier=${tier}${forceRefresh ? "&force=true" : ""}`;

  const eventSource = new EventSource(url);

  eventSource.onmessage = (e) => {
    try {
      const data: ProgressEvent = JSON.parse(e.data);
      onEvent(data);

      if (data.phase === "complete" || data.phase === "error") {
        eventSource.close();
      }
    } catch {
      // ignore parse errors
    }
  };

  eventSource.onerror = () => {
    // EventSource reconnects automatically on transient errors.
    // Don't treat every onerror as fatal — only close if readyState is CLOSED.
    if (eventSource.readyState === EventSource.CLOSED) {
      onError("Connection lost. Please try again.");
      eventSource.close();
    }
  };

  // Return cleanup function
  return () => eventSource.close();
}

// ─── Paid Report ────────────────────────────────────────────────────

export async function createOrder(company: string, tier: string) {
  const res = await fetch(`${BASE}/report/create-order`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ company, tier }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.message || "Failed to create order");
  }
  return res.json();
}

export async function generateReport(payload: {
  company: string;
  tier: string;
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}) {
  const res = await fetch(`${BASE}/report/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.message || "Failed to generate report");
  }
  return res.json();
}

// ─── Health Check ───────────────────────────────────────────────────

export async function healthCheck() {
  const res = await fetch(`${BASE}/health`);
  return res.json();
}

// ─── Company Comparison ─────────────────────────────────────────────

export async function compareCompanies(a: string, b: string) {
  const res = await fetch(
    `${BASE}/compare?a=${encodeURIComponent(a)}&b=${encodeURIComponent(b)}`
  );
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.message || "Comparison failed");
  }
  return res.json();
}

// ─── Auth ───────────────────────────────────────────────────────────

function authHeaders() {
  const token = localStorage.getItem("token");
  const h: Record<string, string> = { "Content-Type": "application/json" };
  if (token) h.Authorization = `Bearer ${token}`;
  return h;
}

export async function register(email: string, password: string, name: string) {
  const res = await fetch(`${BASE}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, name }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || "Registration failed");
  return data;
}

export async function login(email: string, password: string) {
  const res = await fetch(`${BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || "Login failed");
  return data;
}

export async function getMe() {
  const res = await fetch(`${BASE}/auth/me`, { headers: authHeaders() });
  if (!res.ok) throw new Error("Not authenticated");
  return res.json();
}

// ─── Watchlist ──────────────────────────────────────────────────────

export async function getWatchlist() {
  const res = await fetch(`${BASE}/watchlist`, { headers: authHeaders() });
  if (!res.ok) throw new Error("Failed to load watchlist");
  return res.json();
}

export async function addToWatchlist(company: string, alertThreshold?: number) {
  const res = await fetch(`${BASE}/watchlist/add`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ company, alertThreshold }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || "Failed to add");
  return data;
}

export async function removeFromWatchlist(ticker: string) {
  const res = await fetch(`${BASE}/watchlist/${ticker}`, {
    method: "DELETE",
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error("Failed to remove");
  return res.json();
}

export async function checkAlerts() {
  const res = await fetch(`${BASE}/watchlist/check-alerts`, {
    method: "POST",
    headers: authHeaders(),
  });
  return res.json();
}

// ─── Portfolio Analysis ─────────────────────────────────────────────────────

export interface PortfolioHolding {
  ticker: string;
  shares: number;
  buyPrice: number;
  currentPrice: number;
}

export async function analyzePortfolio(holdings: PortfolioHolding[]) {
  const res = await fetch(`${BASE}/portfolio/analyze`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ holdings }),
  });
  if (!res.ok) throw new Error("Portfolio analysis failed");
  return res.json();
}

// ─── BSE Alerts ─────────────────────────────────────────────────────────────

export async function setupAlert(
  ticker: string,
  webhookUrl?: string,
  email?: string,
  threshold: "all" | "high" = "high"
) {
  const res = await fetch(`${BASE}/alerts/setup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ticker, webhookUrl, email, threshold }),
  });
  if (!res.ok) throw new Error("Alert setup failed");
  return res.json();
}

export async function getAlerts() {
  const res = await fetch(`${BASE}/alerts`);
  if (!res.ok) throw new Error("Failed to fetch alerts");
  return res.json();
}

export async function deleteAlert(ticker: string) {
  const res = await fetch(`${BASE}/alerts/${encodeURIComponent(ticker)}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error("Failed to delete alert");
  return res.json();
}

export async function getAlertHistory(ticker: string) {
  const res = await fetch(`${BASE}/alerts/history/${encodeURIComponent(ticker)}`);
  if (!res.ok) throw new Error("Failed to fetch alert history");
  return res.json();
}
