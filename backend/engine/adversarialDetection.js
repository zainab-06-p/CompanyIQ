/**
 * Adversarial Data Detection Engine (Upgrade 20)
 *
 * Detects manipulated news, sentiment gaming, coordinated campaigns,
 * and suspicious data patterns that could distort analysis.
 *
 * Detection layers:
 *   1. Sentiment Anomaly  — statistical outliers in news distribution
 *   2. Source Credibility  — cross-source consistency checks
 *   3. Temporal Clustering — burst detection for coordinated campaigns
 *   4. Content Patterns    — repetitive headlines, PR-style language
 *   5. Financial-Sentiment Divergence — score gap that signals manipulation
 */

// ─── Known low-credibility domains / PR wire patterns ────────────────

const PR_WIRE_PATTERNS = [
  "prnewswire", "businesswire", "globenewswire", "prnews",
  "prweb", "openpr", "newswire", "accesswire", "einpresswire",
];

const PROMOTIONAL_PHRASES = [
  "revolutionary", "breakthrough", "game-changing", "industry-leading",
  "best-in-class", "world-class", "disruptive", "unprecedented growth",
  "massive opportunity", "10x", "100x", "multibagger", "hidden gem",
  "next big thing", "explosive growth", "rocket", "moon", "skyrocket",
  "guaranteed returns", "once in a lifetime", "can't miss",
];

const FEAR_PHRASES = [
  "scam", "fraud", "crash imminent", "bubble burst", "ponzi",
  "total collapse", "worthless", "bankrupt soon", "dump it",
  "run away", "avoid at all costs", "exit immediately",
];

// ─── 1. Sentiment Distribution Anomaly ──────────────────────────────

function detectSentimentAnomaly(classifiedArticles) {
  if (!classifiedArticles || classifiedArticles.length < 5) {
    return { detected: false, flags: [], reason: "Insufficient articles for anomaly detection" };
  }

  const total = classifiedArticles.length;
  const positive = classifiedArticles.filter(a => (a.sentiment || "").toUpperCase() === "POSITIVE").length;
  const negative = classifiedArticles.filter(a => (a.sentiment || "").toUpperCase() === "NEGATIVE").length;
  const neutral = classifiedArticles.filter(a => (a.sentiment || "").toUpperCase() === "NEUTRAL").length;

  const posRatio = positive / total;
  const negRatio = negative / total;
  const neutralRatio = neutral / total;

  const flags = [];

  // Extreme skew: >85% one direction is suspicious unless it's a genuine event
  if (posRatio > 0.85) {
    flags.push({
      type: "SENTIMENT_SKEW",
      severity: "HIGH",
      message: `Abnormally positive sentiment (${Math.round(posRatio * 100)}%) — possible PR campaign or sentiment gaming`,
      confidence: Math.min(95, 60 + (posRatio - 0.85) * 200),
    });
  }

  if (negRatio > 0.85) {
    flags.push({
      type: "SENTIMENT_SKEW",
      severity: "HIGH",
      message: `Abnormally negative sentiment (${Math.round(negRatio * 100)}%) — possible short-seller campaign or FUD`,
      confidence: Math.min(95, 60 + (negRatio - 0.85) * 200),
    });
  }

  // Zero neutral is suspicious in any large sample
  if (total >= 8 && neutralRatio === 0) {
    flags.push({
      type: "NO_NEUTRAL",
      severity: "WATCH",
      message: "Zero neutral articles in sample — natural news usually has some neutral coverage",
      confidence: 50,
    });
  }

  return {
    detected: flags.length > 0,
    distribution: { positive: posRatio, negative: negRatio, neutral: neutralRatio },
    flags,
  };
}

// ─── 2. Source Credibility Analysis ─────────────────────────────────

function analyzeSourceCredibility(articles) {
  if (!articles || articles.length === 0) {
    return { detected: false, flags: [] };
  }

  const flags = [];
  let prWireCount = 0;

  for (const article of articles) {
    const source = (article.source || article.url || "").toLowerCase();
    if (PR_WIRE_PATTERNS.some(p => source.includes(p))) {
      prWireCount++;
    }
  }

  const prRatio = prWireCount / articles.length;
  if (prRatio > 0.4) {
    flags.push({
      type: "PR_WIRE_HEAVY",
      severity: "WATCH",
      message: `${Math.round(prRatio * 100)}% of articles from PR wire services — company-controlled narrative`,
      confidence: 55 + prRatio * 30,
    });
  }

  // Check for source diversity — all from one source is suspicious
  const sources = new Set();
  for (const article of articles) {
    const src = (article.source || "unknown").toLowerCase().split(".")[0];
    sources.add(src);
  }

  if (articles.length >= 6 && sources.size <= 2) {
    flags.push({
      type: "LOW_SOURCE_DIVERSITY",
      severity: "WATCH",
      message: `Only ${sources.size} unique sources for ${articles.length} articles — limited information diversity`,
      confidence: 60,
    });
  }

  return { detected: flags.length > 0, prWireRatio: prRatio, sourceDiversity: sources.size, flags };
}

// ─── 3. Temporal Clustering Detection ───────────────────────────────

function detectTemporalClustering(articles) {
  if (!articles || articles.length < 4) {
    return { detected: false, flags: [] };
  }

  const flags = [];

  // Parse dates and bucket by day
  const dayBuckets = {};
  for (const article of articles) {
    const dateStr = article.date || "";
    // Handle various date formats: "2 days ago", "March 5, 2026", ISO strings
    let dayKey = "unknown";
    if (dateStr.includes("ago")) {
      const match = dateStr.match(/(\d+)\s*(day|hour|minute)/i);
      if (match) {
        const num = parseInt(match[1]);
        const unit = match[2].toLowerCase();
        const daysAgo = unit === "day" ? num : unit === "hour" ? 0 : 0;
        dayKey = `day_${daysAgo}`;
      } else {
        dayKey = "day_0"; // "just now", "moments ago"
      }
    } else {
      dayKey = dateStr.slice(0, 10); // ISO date or similar
    }
    dayBuckets[dayKey] = (dayBuckets[dayKey] || 0) + 1;
  }

  // Check for bursts: any single day with >50% of total articles
  const total = articles.length;
  for (const [day, count] of Object.entries(dayBuckets)) {
    if (count / total > 0.5 && count >= 4) {
      flags.push({
        type: "TEMPORAL_BURST",
        severity: "WATCH",
        message: `${count}/${total} articles clustered on ${day} — possible coordinated release`,
        confidence: 50 + (count / total) * 30,
      });
      break; // only flag the biggest burst
    }
  }

  // Check for same-sentiment burst: all articles on one day have same sentiment
  const sentimentByDay = {};
  for (const article of articles) {
    const dateStr = article.date || "";
    let dayKey = "unknown";
    if (dateStr.includes("ago")) {
      const match = dateStr.match(/(\d+)\s*day/i);
      dayKey = match ? `day_${match[1]}` : "day_0";
    } else {
      dayKey = dateStr.slice(0, 10);
    }
    if (!sentimentByDay[dayKey]) sentimentByDay[dayKey] = [];
    sentimentByDay[dayKey].push(article.sentiment);
  }

  for (const [day, sentiments] of Object.entries(sentimentByDay)) {
    if (sentiments.length >= 3 && new Set(sentiments).size === 1) {
      flags.push({
        type: "SYNCHRONIZED_SENTIMENT",
        severity: "HIGH",
        message: `${sentiments.length} articles on ${day} all ${sentiments[0]} — coordinated campaign likely`,
        confidence: 65 + sentiments.length * 3,
      });
      break;
    }
  }

  return { detected: flags.length > 0, dayDistribution: dayBuckets, flags };
}

// ─── 4. Content Pattern Analysis ────────────────────────────────────

function analyzeContentPatterns(articles) {
  if (!articles || articles.length === 0) {
    return { detected: false, flags: [] };
  }

  const flags = [];
  let promotionalCount = 0;
  let fearCount = 0;

  for (const article of articles) {
    const headline = (article.headline || article.title || "").toLowerCase();

    if (PROMOTIONAL_PHRASES.some(p => headline.includes(p))) {
      promotionalCount++;
    }
    if (FEAR_PHRASES.some(p => headline.includes(p))) {
      fearCount++;
    }
  }

  const total = articles.length;

  if (promotionalCount > 0 && promotionalCount / total > 0.3) {
    flags.push({
      type: "PROMOTIONAL_LANGUAGE",
      severity: "HIGH",
      message: `${promotionalCount}/${total} articles use promotional/hype language — possible pump campaign`,
      confidence: 60 + (promotionalCount / total) * 30,
    });
  }

  if (fearCount > 0 && fearCount / total > 0.3) {
    flags.push({
      type: "FEAR_LANGUAGE",
      severity: "HIGH",
      message: `${fearCount}/${total} articles use fear/panic language — possible short-seller attack`,
      confidence: 60 + (fearCount / total) * 30,
    });
  }

  // Check for duplicate/near-duplicate headlines
  const normalizedHeadlines = articles.map(a =>
    (a.headline || a.title || "").toLowerCase().replace(/[^a-z0-9\s]/g, "").trim()
  );

  const headlineCounts = {};
  for (const h of normalizedHeadlines) {
    if (h.length < 10) continue;
    headlineCounts[h] = (headlineCounts[h] || 0) + 1;
  }

  const duplicates = Object.entries(headlineCounts).filter(([, c]) => c > 1);
  if (duplicates.length > 0) {
    const totalDups = duplicates.reduce((s, [, c]) => s + c, 0);
    flags.push({
      type: "DUPLICATE_HEADLINES",
      severity: "WATCH",
      message: `${totalDups} duplicate/near-duplicate headlines detected — syndicated or bot-generated content`,
      confidence: 55 + totalDups * 5,
    });
  }

  return {
    detected: flags.length > 0,
    promotionalCount,
    fearCount,
    duplicateGroups: duplicates.length,
    flags,
  };
}

// ─── 5. Financial-Sentiment Divergence ──────────────────────────────

function detectFinancialSentimentDivergence(financialScore, sentimentScore) {
  if (typeof financialScore !== "number" || typeof sentimentScore !== "number") {
    return { detected: false, flags: [] };
  }

  const flags = [];
  const gap = Math.abs(financialScore - sentimentScore);

  // Large divergence between financial fundamentals and news sentiment
  // suggests either manipulated sentiment or uninformed market
  if (gap >= 35) {
    const direction = sentimentScore > financialScore
      ? "Sentiment much higher than fundamentals — possible hype/pump"
      : "Sentiment much lower than fundamentals — possible FUD/short attack";

    flags.push({
      type: "FINANCIAL_SENTIMENT_DIVERGENCE",
      severity: gap >= 45 ? "HIGH" : "WATCH",
      message: `${gap}-point gap between financial (${financialScore}) and sentiment (${sentimentScore}) scores. ${direction}`,
      confidence: 50 + gap,
    });
  }

  return { detected: flags.length > 0, gap, flags };
}

// ─── Main Export: Run All Adversarial Checks ────────────────────────

/**
 * Run comprehensive adversarial data detection.
 *
 * @param {Array} classifiedArticles - LLM-classified news articles
 * @param {Array} rawArticles - Unclassified articles (for source/content analysis)
 * @param {number|null} financialScore - Financial pillar score
 * @param {number|null} sentimentScore - Sentiment pillar score
 * @returns {{ score: number, rating: string, riskLevel: string, checks: object, flags: Array }}
 */
export function detectAdversarialPatterns(classifiedArticles = [], rawArticles = [], financialScore = null, sentimentScore = null) {
  // Run all 5 detection layers
  const sentimentAnomaly = detectSentimentAnomaly(classifiedArticles);
  const sourceCredibility = analyzeSourceCredibility(rawArticles.length > 0 ? rawArticles : classifiedArticles);
  const temporalClustering = detectTemporalClustering(classifiedArticles);
  const contentPatterns = analyzeContentPatterns(rawArticles.length > 0 ? rawArticles : classifiedArticles);
  const divergence = detectFinancialSentimentDivergence(financialScore, sentimentScore);

  // Collect all flags
  const allFlags = [
    ...sentimentAnomaly.flags,
    ...sourceCredibility.flags,
    ...temporalClustering.flags,
    ...contentPatterns.flags,
    ...divergence.flags,
  ];

  // Compute adversarial risk score: 100 = clean, 0 = highly manipulated
  // Start at 100, deduct per flag by severity and confidence
  let integrityScore = 100;

  for (const flag of allFlags) {
    const severityPenalty = flag.severity === "HIGH" ? 15 : flag.severity === "WATCH" ? 8 : 3;
    const confidenceMultiplier = (flag.confidence || 50) / 100;
    integrityScore -= severityPenalty * confidenceMultiplier;
  }

  integrityScore = Math.max(0, Math.min(100, Math.round(integrityScore)));

  // Determine risk level
  let riskLevel, rating;
  if (integrityScore >= 80) { riskLevel = "LOW"; rating = "CLEAN"; }
  else if (integrityScore >= 60) { riskLevel = "MODERATE"; rating = "SUSPICIOUS"; }
  else if (integrityScore >= 40) { riskLevel = "HIGH"; rating = "LIKELY MANIPULATED"; }
  else { riskLevel = "CRITICAL"; rating = "HEAVILY MANIPULATED"; }

  return {
    score: integrityScore,
    rating,
    riskLevel,
    checks: {
      sentimentAnomaly: { detected: sentimentAnomaly.detected, distribution: sentimentAnomaly.distribution },
      sourceCredibility: { detected: sourceCredibility.detected, prWireRatio: sourceCredibility.prWireRatio, sourceDiversity: sourceCredibility.sourceDiversity },
      temporalClustering: { detected: temporalClustering.detected },
      contentPatterns: { detected: contentPatterns.detected, promotionalCount: contentPatterns.promotionalCount, fearCount: contentPatterns.fearCount },
      divergence: { detected: divergence.detected, gap: divergence.gap },
    },
    flags: allFlags,
  };
}

export default { detectAdversarialPatterns };
