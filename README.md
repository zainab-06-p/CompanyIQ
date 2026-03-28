# CompanyIQ

CompanyIQ is an AI-powered due diligence platform for Indian listed companies.
It combines parallel web automation agents, a scoring engine, and a report synthesis layer to generate investment-grade company intelligence in minutes.

## Why this project exists

Traditional due diligence is expensive, slow, and often inaccessible to retail investors or small teams. CompanyIQ compresses that process into an automated workflow that can:

- collect financial, legal, and sentiment signals from multiple public sources
- normalize and score those signals through engine modules
- produce a structured report with explainable insights and red flags

## Why TinyFish API is central to CompanyIQ

Most critical data sources in this workflow are dynamic, paginated, login-bound, or rendered through complex browser flows.
TinyFish is used because this project needs real browser automation, not simple static scraping.

TinyFish solves key constraints for this use case:

- Browser-first extraction for dynamic websites
- Multi-step automation (search, navigate, paginate, extract)
- Parallel execution across multiple data domains
- Streaming progress events for real-time UX

### TinyFish integration in this repository

- Core wrapper: `backend/agents/tinyfish.js`
- Financial extraction flow: `backend/agents/financialAgent.js`
- Legal/compliance extraction flow: `backend/agents/legalAgent.js`
- News and sentiment extraction flow: `backend/agents/sentimentAgent.js`
- End-to-end orchestration: `backend/orchestrator/orchestrator.js`

The wrapper uses TinyFish SSE automation endpoints and supports retries, progress callbacks, and budget-aware call limits.

## High-level architecture

1. Frontend starts report generation and subscribes to progress events.
2. Backend resolves company metadata and checks cache.
3. Orchestrator dispatches domain agents in parallel.
4. Agents call TinyFish for web automation + extraction.
5. Engine modules compute ratios, quality checks, risk signals, and composite scores.
6. Synthesis layer generates report narrative (when enabled by tier).
7. Backend stores and serves report output.

## Repository structure

- `backend/` Express API, orchestrator, domain agents, scoring engines, DB/cache
- `frontend/` Vite + React + TypeScript UI
- `PROJECT_BRIEF.md` product and hackathon framing
- `1. foundation of the hackathon and solution.md` problem framing and fit
- `2. implementation plan for critical issues.md` implementation direction
- `3. final execution plan.md` execution and integration details

## Tech stack

- Backend: Node.js (ESM), Express
- Frontend: React, TypeScript, Vite
- Data/storage: SQLite (via `better-sqlite3`), cache layer
- APIs: TinyFish Web Agent API, optional LLM synthesis providers

## Local setup

### 1. Prerequisites

- Node.js 20+
- npm 10+

### 2. Install dependencies

From project root:

```bash
npm install
npm install --prefix backend
npm install --prefix frontend
```

### 3. Configure environment

Create `backend/.env` (or edit existing local file) with values like:

```env
# TinyFish
TINYFISH_API_KEY=your_tinyfish_api_key

# Server
PORT=3001
NODE_ENV=development

# App URL
APP_URL=http://localhost:5173

# TinyFish controls
TINYFISH_RETRIES=1
TINYFISH_TIMEOUT_MS=90000
TINYFISH_BUDGET_ENABLED=true
TINYFISH_BUDGET_FREE_SCORE_CALLS=6
TINYFISH_BUDGET_QUICK_SCAN_CALLS=10
TINYFISH_BUDGET_STANDARD_CALLS=16
```

Do not commit real API keys. Keep secrets in local env files only.

### 4. Run the app

From project root:

```bash
npm run dev
```

This starts:

- backend API from `backend/server.js`
- frontend dev server from `frontend`

## Request flow walkthrough

1. User enters company name/ticker in frontend.
2. Frontend starts generation and listens to SSE progress.
3. Backend `orchestrator` resolves ticker and tier.
4. Financial, legal, and sentiment agents run in parallel.
5. Each agent issues TinyFish browser automation goals for target sites.
6. Extracted outputs are validated and transformed.
7. Scoring engines produce pillar and composite scores.
8. Optional synthesis composes narrative insights.
9. Final report is returned and rendered in UI.

## Tiering model

The pipeline supports multiple report tiers (example: `free_score`, `quick_scan`, `standard`) with different depth and API budget limits.
Tiering is configured in orchestrator logic and affects what data is fetched and synthesized.

## Key backend modules

- `backend/orchestrator/orchestrator.js`: workflow coordinator
- `backend/agents/`: source-specific extraction logic
- `backend/engine/`: scoring and analysis engines
- `backend/cache/cacheLayer.js`: cache and in-flight dedupe
- `backend/db/database.js`: report persistence

## API and progress behavior

The backend emits streaming progress events during report generation to support real-time UI updates.
TinyFish PROGRESS events are mapped to user-facing milestones so users can see extraction progress instead of waiting blindly.

## Security and operational notes

- Keep `backend/.env` private and rotate keys if exposed.
- Enable rate limits and auth middleware in production deployments.
- Use API budget limits to control TinyFish cost.
- Validate external data before scoring or report output.

## Current scope in this first push

This first push is focused on the foundation:

- core backend pipeline and agent orchestration
- frontend app shell and report flow
- TinyFish-centered extraction strategy
- project documentation for setup and architecture

Future upgrades can be pushed incrementally in separate commits/releases.

## License

Add a license file (`LICENSE`) according to your preferred terms before public/commercial distribution.