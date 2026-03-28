# CompanyIQ

CompanyIQ is an AI-powered company due diligence platform for Indian equities.
It uses parallel agents, deep scoring engines, and browser automation to generate clear, explainable investment intelligence in minutes instead of weeks.

## Public Repository

GitHub: https://github.com/zainab-06-p/CompanyIQ

## Team

- Zainab Pirjade - https://github.com/zainab-06-p
- Adi Inamdar - https://github.com/Adi-Evolve

## Problem Statement

High-quality company due diligence is still difficult for most investors and operators.

- Manual research is slow and fragmented across many websites.
- Critical sources are dynamic, paginated, and often hard to extract reliably.
- Professional-grade analysis is expensive, making it inaccessible to many users.
- Raw data alone is not enough; users need explainable scoring and decision support.

In short, users need a single system that can discover, structure, score, and explain company risk/opportunity from live web sources.

## Our Solution

CompanyIQ provides a full-stack due diligence workflow:

1. Collects live data using specialized domain agents.
2. Runs quality checks and computes financial/legal/sentiment signals.
3. Produces composite scores, red flags, and context-aware insights.
4. Streams progress to the frontend in real time.
5. Returns a structured report ready for decision-making.

## Why TinyFish API is mission-critical

TinyFish is not an optional integration in this project. It is the core data access layer that makes the product feasible.

### Why standard scraping is not enough

- Important pages are JavaScript-rendered.
- Data is spread across multi-step workflows (search, navigation, pagination, filtering).
- Some workflows require browser-like interaction patterns.

### What TinyFish enables for CompanyIQ

- Real browser automation for dynamic financial/legal data paths.
- Multi-step extraction with reliable structured output.
- Parallel runs across multiple sources and agent types.
- Streaming events (SSE) that power the real-time progress UI.
- Better reliability for production-like extraction workflows.

### TinyFish in this codebase

- Core integration wrapper: backend/agents/tinyfish.js
- Financial agent integration: backend/agents/financialAgent.js
- Legal agent integration: backend/agents/legalAgent.js
- Sentiment agent integration: backend/agents/sentimentAgent.js
- Orchestration and budget control: backend/orchestrator/orchestrator.js

Without TinyFish, the platform would lose real-time browser automation and much of the live-source extraction depth required by the problem.

## Core Features

- Parallel agent execution for faster report generation.
- Financial, legal, sentiment, insider, and annual report analysis modules.
- 30+ analysis and scoring engines across quality, risk, valuation, and context.
- Composite CompanyIQ score with red flag detection.
- Tiered report modes (free_score, quick_scan, standard).
- SSE-based progress events for transparent long-running workflows.
- Caching and in-flight request handling for performance.
- Frontend report views for analysis, trends, and comparisons.

## High-level Architecture

1. Frontend triggers report generation and subscribes to progress updates.
2. Backend resolves company identity and checks cache.
3. Orchestrator runs selected agents in parallel.
4. Agents call TinyFish to execute browser automation goals.
5. Engine layer computes scores, anomalies, and red flags.
6. Optional synthesis generates narrative insights.
7. Report is persisted and returned to UI.

## Repository Structure

- backend/: Express API, orchestrator, agents, engine modules, cache, DB
- frontend/: Vite + React + TypeScript application
- render.yaml: Render blueprint for backend deployment
- DEPLOY_RENDER_BACKEND.md: backend deployment and frontend cutover steps

## Recommended Production Deployment

Because TinyFish browser automation can run longer than typical serverless request windows, deploy as:

- Frontend on Vercel
- Backend on Render (always-on web service)

Then set Vercel env variable:

`VITE_API_BASE=https://<your-render-service>.onrender.com/api`

Detailed steps are in `DEPLOY_RENDER_BACKEND.md`.

## Tech Stack

- Backend: Node.js (ESM), Express
- Frontend: React, TypeScript, Vite
- Storage: SQLite (better-sqlite3)
- Data orchestration: TinyFish API + local scoring pipeline

## Local Development Setup

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

Copy backend/.env.example to backend/.env and fill your keys.

Minimum required values:

```env
TINYFISH_API_KEY=your_tinyfish_api_key
PORT=3001
NODE_ENV=development
APP_URL=http://localhost:5173
TINYFISH_RETRIES=1
TINYFISH_TIMEOUT_MS=90000
TINYFISH_BUDGET_ENABLED=true
TINYFISH_BUDGET_FREE_SCORE_CALLS=6
TINYFISH_BUDGET_QUICK_SCAN_CALLS=10
TINYFISH_BUDGET_STANDARD_CALLS=16
```

Security note: Never commit real API keys.

### 4. Run locally

From project root:

```bash
npm run dev
```

This command starts both:

- backend API (backend/server.js)
- frontend Vite app (frontend)

## Request Flow Walkthrough

1. User submits a company name/ticker.
2. Frontend opens a live progress stream.
3. Orchestrator resolves entity and tier configuration.
4. Financial/legal/sentiment (and tier-enabled) agents execute in parallel.
5. TinyFish performs browser automation and extraction per source goal.
6. Engine layer validates and scores extracted signals.
7. System produces composite output, red flags, and narrative insights.
8. Final report is returned and displayed.

## Security and Operations Notes

- Keep backend/.env private.
- Rotate API keys immediately if exposed.
- Use budget controls to cap TinyFish cost per tier.
- Enable auth/rate-limit middleware for production deployments.

## Documentation Index

- README.md - primary project walkthrough
- DEPLOY_RENDER_BACKEND.md - production deployment with Render backend

## License

This project is licensed under the MIT License.
See LICENSE for full text.