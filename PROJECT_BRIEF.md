# CompanyIQ — AI-Powered Stock Intelligence Platform

## Project Overview

**CompanyIQ** is a hackathon project that generates comprehensive stock intelligence reports for Indian listed companies. It uses the **TinyFish API** as its primary data source to fetch financial statements, legal filings, corporate announcements, and sentiment data from BSE/NSE, then runs them through 30+ proprietary analysis engines to produce a final scored report.

**Tech Stack:** Node.js (ESM) + Vite React (TypeScript) + SQLite + TinyFish API

---

## Architecture

```
┌────────────────────────────────────────────────────────┐
│                    FRONTEND (Vite + React + TS)        │
│   HomePage → LoadingPage (SSE) → ReportPage (PDF)     │
└──────────────────────┬─────────────────────────────────┘
                       │ SSE Stream (/api/progress/:ticker)
┌──────────────────────▼─────────────────────────────────┐
│                   BACKEND (Node.js ESM)                │
│                                                        │
│  ┌─────────────────────────────────────────────────┐   │
│  │              ORCHESTRATOR (orchestrator.js)      │   │
│  │  Central pipeline: resolve → fetch → score →    │   │
│  │  synthesize → cache → respond                   │   │
│  └────┬──────────┬──────────┬──────────────────────┘   │
│       │          │          │                           │
│  ┌────▼────┐ ┌───▼────┐ ┌──▼─────┐ ┌──────────┐      │
│  │Financial│ │ Legal  │ │Sentim. │ │ Insider  │      │
│  │ Agent   │ │ Agent  │ │ Agent  │ │  Agent   │      │
│  └────┬────┘ └───┬────┘ └──┬─────┘ └──┬───────┘      │
│       └──────────┴─────────┴──────────┘               │
│                   TinyFish API                         │
│                                                        │
│  ┌─────────────────────────────────────────────────┐   │
│  │           ENGINE LAYER (30+ modules)             │   │
│  │                                                  │   │
│  │  ── SCORING PIPELINE ──                          │   │
│  │  ratioEngine → financialScorer → legalScorer     │   │
│  │  → sentimentScorer → compositeScorer             │   │
│  │  → redFlagEngine → contextEngine                 │   │
│  │                                                  │   │
│  │  ── 12 DEEP ANALYSIS MODULES ──                  │   │
│  │  1.  Accounting Quality (F-Score, M-Score)       │   │
│  │  2.  Capital Allocation (ROIC, WACC, Capex)      │   │
│  │  3.  Management Quality (RPT, Track Record)      │   │
│  │  4.  Economic Moat (5 Sources + Porter's 5)      │   │
│  │  5.  ESG & BRSR (Governance, Social, Env)        │   │
│  │  6.  Shareholding (Ownership, Velocity, HHI)     │   │
│  │  7.  Credit Quality (DSCR, Synthetic Rating)     │   │
│  │  8.  Tech & Innovation (R&D, Patents, Digital)   │   │
│  │  9.  Supply Chain Risk (Concentration, Input)    │   │
│  │  10. Valuation (DCF, EPV, Relative)              │   │
│  │  11. Insider Tracking (Insider, Institutional)   │   │
│  │  12. Industry KPIs (Sector-specific metrics)     │   │
│  │                                                  │   │
│  │  ── ADVANCED ENGINES ──                          │   │
│  │  multiHorizon, anomalyDetector, adversarial,     │   │
│  │  peerBenchmark, scoreTrend, waterfallEngine,     │   │
│  │  governancePatterns, qualityGates, reportDiff     │   │
│  └─────────────────────────────────────────────────┘   │
│                                                        │
│  ┌──────────┐  ┌──────────┐  ┌──────────────────┐     │
│  │  Cache   │  │ SQLite   │  │ LLM Synthesis    │     │
│  │  Layer   │  │   DB     │  │ (Groq/Gemini)    │     │
│  └──────────┘  └──────────┘  └──────────────────┘     │
└────────────────────────────────────────────────────────┘
```

---

## Data Pipeline (Step by Step)

### Step 1: Company Resolution
- User types company name in search bar
- `companyResolver.js` checks a built-in list of 200+ NSE/BSE companies
- Returns `{ name, ticker, exchange, bseCode, sector }`

### Step 2: Cache Check
- `cacheLayer.js` checks in-memory (node-cache, 24h TTL) and SQLite DB
- If `force=true` (current default), bypasses all caches

### Step 3: Parallel Agent Dispatch
Three TinyFish-powered agents run in parallel:

| Agent | Data Fetched | Source |
|-------|-------------|--------|
| **Financial Agent** | P&L (5yr annual + quarterly), Balance Sheet, Cash Flow, Ratios | TinyFish → BSE/Screener |
| **Legal Agent** | Shareholding, Directors, Announcements, Penalties | TinyFish → BSE Corporate Filings |
| **Sentiment Agent** | News headlines, sentiment scores | TinyFish → Google News/RSS |
| **Insider Agent** | Insider transactions, bulk/block deals | TinyFish → BSE SAST filings |

### Step 4: Ratio Engine
`ratioEngine.js` computes 50+ financial ratios across categories:
- **Profitability:** ROE, ROA, ROIC, OPM, NPM, EPS growth
- **Leverage:** D/E, Interest Coverage, Debt/Assets
- **Liquidity:** Current Ratio, Quick Ratio
- **Efficiency:** Asset Turnover, Receivable Days, Inventory Days
- **Growth:** Revenue CAGR (3yr, 5yr), Profit CAGR
- **Valuation:** PE, PB, EV/EBITDA, Dividend Yield

### Step 5: Three-Pillar Scoring

| Pillar | Weight | Engine | Score Range |
|--------|--------|--------|-------------|
| **Financial** | 45% | `financialScorer.js` | 0–100 |
| **Legal & Governance** | 30% | `legalScorer.js` | 0–100 |
| **Sentiment** | 25% | `sentimentScorer.js` | 0–100 |

### Step 6: Context-Aware Composite
- `contextEngine.js` adjusts pillar weights based on sector context
- `redFlagEngine.js` applies deductions for critical red flags
- `compositeScorer.js` produces the final **CompanyIQ Score** (0–100)

### Step 7: 12 Deep Analysis Modules
Each module runs independently with its own try/catch isolation:

| # | Module | Key Algorithms | Output |
|---|--------|---------------|--------|
| 1 | **Accounting Quality** | Piotroski F-Score (9 signals), Beneish M-Score (8 variables) | Score + F-Score + M-Score |
| 2 | **Capital Allocation** | ROIC vs WACC spread, Capex payback, Dividend sustainability, Beta estimation | Score + ROIC-WACC analysis |
| 3 | **Management Quality** | RPT detection, Promoter risk, Revenue consistency, Margin stability | Score + Track record |
| 4 | **Economic Moat** | 5 Moat Sources (Switching Costs, Network Effects, Cost Advantage, Intangibles, Scale) + Porter's 5 Forces + Trajectory | Score + Moat type |
| 5 | **ESG & BRSR** | Board independence (SEBI minimum fallback), CEO-Chair separation, CSR spend, Carbon exposure | Score + Governance details |
| 6 | **Shareholding** | Ownership structure, QoQ velocity, HHI concentration, Bulk deal detection | Score + Ownership analysis |
| 7 | **Credit Quality** | Debt structure, DSCR, Interest coverage, Working capital, Synthetic credit rating, Debt-free detection | Score + Rating (AAA–CCC or DEBT_FREE) |
| 8 | **Tech & Innovation** | R&D intensity, Patent signals, Digital transformation indicators, Sector-adaptive weighting | Score + Innovation rating |
| 9 | **Supply Chain Risk** | Revenue concentration (CV), Input cost dependency, Regulatory risk, Operational efficiency | Score + Risk level |
| 10 | **Valuation** | DCF (3 scenarios), EPV (Earnings Power Value), Relative PE/PB/EV, Margin of Safety | Score + Valuation verdict |
| 11 | **Insider Tracking** | Insider buy/sell ratios, Cluster detection, Institutional quality, Pledge risk, F&O proxy | Score + Smart money signal |
| 12 | **Industry KPIs** | Auto-detected sector-specific KPIs (Banking: NIM/GNPA, IT: utilization, Pharma: ANDA, FMCG: volume growth) | Score + Sector-specific metrics |

### Step 8: Advanced Analysis
- **Multi-Horizon Scoring** — Short/Medium/Long-term outlook
- **Anomaly Detection** — Z-score based outlier flagging
- **Adversarial Detection** — Pump-and-dump / governance manipulation patterns
- **Peer Benchmark** — Cross-company scoring comparison
- **Score Trend** — Historical score trajectory
- **Waterfall Explainer** — Component-by-component score breakdown
- **Data Quality Gates** — Validates data completeness (0–100 confidence)

### Step 9: LLM Synthesis
- `llmSynthesis.js` generates an AI executive summary using Groq/Gemini
- Headlines classified into bullish/bearish/neutral buckets

### Step 10: Report Assembly & Storage
- Full report object assembled in orchestrator
- Saved to SQLite DB for 24h caching
- Streamed to frontend via SSE events

---

## Report Parameters

### Overall Rating Scale
| Score | Rating | Color |
|-------|--------|-------|
| 75–100 | STRONG BUY | 🟢 Green |
| 60–74 | MODERATE | 🟡 Yellow |
| 40–59 | CAUTION | 🟠 Orange |
| 0–39 | HIGH RISK | 🔴 Red |

### Report Sections
1. **CompanyIQ Score** — Overall 0–100 with rating
2. **Three Pillar Breakdown** — Financial, Legal, Sentiment
3. **Waterfall Charts** — Component-by-component score explanation
4. **Red Flags** — Critical risk signals with severity
5. **Multi-Horizon Outlook** — Short/Medium/Long term scores
6. **Data Integrity** — Quality gates score and checks
7. **12 Deep Analysis Modules** — Each with individual score and rating
8. **AI Executive Summary** — LLM-generated narrative

---

## Directory Structure

```
companyiq/
├── backend/
│   ├── agents/           # TinyFish-powered data fetchers (7 agents)
│   ├── cache/            # In-memory + in-flight deduplication
│   ├── config/           # Company resolver, env config
│   ├── db/               # SQLite database layer
│   ├── engine/           # 30 analysis engines (core IP)
│   ├── jobs/             # Background processing
│   ├── middleware/        # Express middleware
│   ├── models/           # Data models
│   ├── orchestrator/     # Central pipeline coordinator
│   ├── routes/           # API routes (progress SSE, admin)
│   ├── services/         # Service layer
│   ├── synthesis/        # LLM narrative generation
│   └── server.js         # Express server entry point
├── frontend/
│   ├── src/
│   │   ├── components/   # React components (Report, Score, Charts)
│   │   ├── pages/        # HomePage, LoadingPage, ReportPage
│   │   ├── hooks/        # Custom React hooks
│   │   └── utils/        # API client, helpers
│   └── index.html
└── PROJECT_BRIEF.md      # This file
```

---

## Key Technical Decisions

1. **Per-module isolation** — Each of the 12 deep analysis modules runs in its own `try/catch` wrapper. If one module fails (e.g., missing data), the remaining 11 still complete.

2. **Force-fresh analysis** — Every search request now bypasses all caches (`force=true`) to ensure the latest code produces the latest results.

3. **TinyFish value wrapper handling** — TinyFish returns data as `{value, state}` objects. Every engine has a `safe()` utility that unwraps these correctly.

4. **Sector-aware computation** — `companyResolver.js` maintains a `SECTOR_MAP` for ticker-to-sector mapping. Multiple engines use sector context for beta estimation, KPI selection, and benchmark comparison.

5. **SEBI compliance fallback** — When TinyFish fails to return board director categories, the system applies SEBI minimum (1/3 independent) as a conservative estimate rather than showing 0.

6. **Debt-free detection** — Companies with zero borrowings are classified as `DEBT_FREE` rather than being penalized by division-by-zero in credit metrics.

---

## Known Issues & Limitations

| Issue | Status | Notes |
|-------|--------|-------|
| Board director count inconsistent (5-14) | 🟡 Open | BSE page structure varies across runs |
| Independent director count shows 0 | 🟡 Open | Category parser needs refinement |
| Shareholding data sometimes null | 🟡 Open | TinyFish agent may not return shareholding |
| Credit quality for debt-free companies | ✅ Fixed | Now returns DEBT_FREE rating |
| 11/12 modules missing | ✅ Fixed | Root cause: missing `sector` param in `computeROICAnalysis` + single try/catch block |
| Cache returning stale data | ✅ Fixed | Force-refresh now default |
| Financial score showing 0 | ✅ Fixed | Ratio engine value wrapper handling |
| NaN propagation in horizons | ✅ Fixed | Safe() utility applied consistently |

---

## Changelog (Latest Fixes)

### 2026-03-24 (Session 3)
- **CRITICAL FIX:** Added `sector` parameter to `computeROICAnalysis()` — was causing a `ReferenceError` that killed all 11 modules after Accounting Quality
- **CRITICAL FIX:** Refactored deep analysis from single shared `try/catch` to per-module `runModule()` wrappers — any single module failure is now isolated
- **Added:** `SECTOR_MAP` in companyResolver for ticker-to-sector mapping
- **Added:** Debt-free detection in creditAnalysis
- **Added:** Sector-specific beta estimation in capitalAllocation
- **Added:** SEBI-minimum fallback for board independence in esgAnalysis
- **Added:** Cache admin endpoints (`/api/cache/clear/:ticker`, `/clear-all`, `/stats`)
- **Added:** `forceRefresh` parameter through entire pipeline
- **Added:** Per-module console logging (`[Orchestrator] Deep analysis: X/12 modules completed.`)

---

*Last updated: 2026-03-24*
