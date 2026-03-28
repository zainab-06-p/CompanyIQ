import { runPipeline } from '../orchestrator/orchestrator.js';
import { db } from '../db/database.js';
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const companiesList = require("../config/companies.json");

export async function computeSectorBenchmarks() {
  console.log("[Job] Starting overnight benchmark generation for Top 200...");
  const top200 = companiesList.slice(0, 200);
  
  for (const company of top200) {
    try {
      if (!company.ticker) continue;
      
      const result = await runPipeline(company.ticker, "free_score", null);
      if(result && result.error) continue;

      db.prepare(`
        INSERT INTO sector_benchmarks (ticker, name, sector, score, rev_growth, net_margin) 
        VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(ticker) DO UPDATE SET score=excluded.score
      `).run(
        company.ticker, 
        company.name, 
        company.sector, 
        result?.overallScore || 0, 
        result?.financial?.ratios?.revenueCAGR3yr || 0, 
        result?.financial?.ratios?.netProfitMargin || 0
      );
      
    } catch(err) {
       console.error(`[Job] Failed benchmarking ${company.ticker}`, err.message);
    }
  }
}
