/**
 * Sentiment Agent
 *
 * Extracts news sentiment data using TinyFish browser automation.
 * Sources: Google News + Economic Times
 * Makes 2 TinyFish calls, then 1 Groq/Llama API call for classification.
 *
 * Expected steps: 16–24 total
 * Expected time: 25–40 seconds
 */

import { callTinyFish } from "./tinyfish.js";
import config from "../config/env.js";

/**
 * Run the Sentiment Agent for a company.
 *
 * @param {object} company - Company object from companies.json
 * @param {function} [onProgress] - Progress callback: (message) => void
 * @returns {Promise<object>} - { articles, metadata }
 */
export async function runSentimentAgent(company, onProgress) {
  const { name, ticker } = company;

  onProgress?.(`Starting sentiment analysis for ${name}...`);

  // Run both news calls in parallel
  const [googleResult, etResult] = await Promise.allSettled([
    // Call 1: Google News
    callTinyFish(
      `https://news.google.com/search?q=${encodeURIComponent(name + " stock")}&hl=en-IN&gl=IN`,
      buildGoogleNewsGoal(name),
      {
        browserProfile: "lite",
        retries: config.tinyfish.defaultRetries,
        onProgress: (msg) => onProgress?.(`[Google News] ${msg}`),
      }
    ),

    // Call 2: Economic Times
    callTinyFish(
      `https://economictimes.indiatimes.com/topic/${encodeURIComponent(name)}`,
      buildETGoal(name),
      {
        browserProfile: "lite",
        retries: config.tinyfish.defaultRetries,
        onProgress: (msg) => onProgress?.(`[Economic Times] ${msg}`),
      }
    ),
  ]);

  // Process results
  const googleArticles = extractArticles(googleResult, "Google News");
  const etArticles = extractArticles(etResult, "Economic Times");

  // Merge and deduplicate
  const allArticles = mergeArticles(googleArticles, etArticles);

  // Metadata
  const totalSteps =
    (googleResult.value?.stepCount || 0) +
    (etResult.value?.stepCount || 0);

  const totalDuration = Math.max(
    googleResult.value?.durationMs || 0,
    etResult.value?.durationMs || 0
  );

  onProgress?.(
    `Sentiment extraction complete — ${allArticles.length} articles, ${totalSteps} steps in ${(totalDuration / 1000).toFixed(1)}s`
  );

  return {
    articles: allArticles,
    metadata: {
      agent: "sentiment",
      company: ticker,
      articleCount: allArticles.length,
      totalSteps,
      totalDurationMs: totalDuration,
      callResults: {
        google: { steps: googleResult.value?.stepCount, error: googleResult.value?.error || googleResult.reason?.message },
        et: { steps: etResult.value?.stepCount, error: etResult.value?.error || etResult.reason?.message },
      },
    },
  };
}

// ─── TinyFish Goal Prompts ──────────────────────────────────────────────

function buildGoogleNewsGoal(companyName) {
  return `Extract the top 15 news articles about "${companyName}" from this Google News search results page.

For each article, extract:
- headline: the full headline text
- source: the name of the publication (e.g., "Economic Times", "Moneycontrol", "LiveMint")
- date: the relative date as shown (e.g., "2 hours ago", "3 days ago", "1 week ago")
- snippet: any preview/description text visible below the headline

Return as JSON:
{
  "articles": [
    { "headline": "Zomato Q3 profit surges 57% YoY to Rs 59 crore", "source": "Economic Times", "date": "2 days ago", "snippet": "Food delivery giant Zomato reported..." }
  ]
}

Get at least 10 articles. If fewer are visible, get as many as you can see.`;
}

function buildETGoal(companyName) {
  return `Extract the 10 most recent articles from this Economic Times topic page about "${companyName}".

For each article, extract:
- headline: the full headline text
- date: the date or relative time shown (e.g., "Mar 5, 2026" or "2 days ago")
- snippet: the first sentence or summary text visible

Return as JSON:
{
  "articles": [
    { "headline": "Zomato shares rise 3% on strong Blinkit growth", "date": "Mar 5, 2026", "snippet": "Shares of Zomato rose 3% on..." }
  ]
}`;
}

// ─── Result Extraction & Normalization ──────────────────────────────────

function extractArticles(settledResult, source) {
  if (settledResult.status === "fulfilled") {
    const { resultJson, error } = settledResult.value;
    if (error) {
      console.warn(`[SentimentAgent] ${source} returned with error: ${error}`);
      return [];
    }
    if (!resultJson) return [];

    const articles = Array.isArray(resultJson.articles)
      ? resultJson.articles
      : Array.isArray(resultJson)
        ? resultJson
        : [];

    return articles.map((a) => ({
      headline: a.headline || a.title || "",
      source: a.source || a.publication || source,
      date: a.date || a.time || "Unknown",
      snippet: a.snippet || a.description || a.summary || "",
      originalSource: source,
    }));
  }

  console.error(`[SentimentAgent] ${source} call rejected:`, settledResult.reason?.message);
  return [];
}

/**
 * Merge articles from multiple sources, deduplicating by headline similarity.
 */
function mergeArticles(googleArticles, etArticles) {
  const merged = [...googleArticles];

  for (const etArticle of etArticles) {
    // Simple dedup: check if a similar headline already exists
    const isDuplicate = merged.some((existing) => {
      const similarity = calculateSimilarity(
        existing.headline.toLowerCase(),
        etArticle.headline.toLowerCase()
      );
      return similarity > 0.7; // 70% similar → consider duplicate
    });

    if (!isDuplicate) {
      merged.push(etArticle);
    }
  }

  // Keep the most useful subset for downstream scoring/classification cost control.
  return merged.slice(0, 14);
}

/**
 * Simple Jaccard similarity for deduplication.
 */
function calculateSimilarity(str1, str2) {
  const words1 = new Set(str1.split(/\s+/).filter((w) => w.length > 3));
  const words2 = new Set(str2.split(/\s+/).filter((w) => w.length > 3));

  if (words1.size === 0 && words2.size === 0) return 1;

  const intersection = new Set([...words1].filter((w) => words2.has(w)));
  const union = new Set([...words1, ...words2]);

  return intersection.size / union.size;
}

/**
 * Parse relative date string to days ago (approximate).
 * Used by the sentiment scorer for recency weighting.
 *
 * @param {string} dateStr - e.g., "2 hours ago", "3 days ago", "1 week ago", "Mar 5, 2026"
 * @returns {number} - Approximate days ago
 */
export function parseDaysAgo(dateStr) {
  if (!dateStr || typeof dateStr !== "string") return 15; // Default to mid-range

  const str = dateStr.toLowerCase().trim();

  // Relative patterns
  const hourMatch = str.match(/(\d+)\s*hours?\s*ago/);
  if (hourMatch) return 0;

  const dayMatch = str.match(/(\d+)\s*days?\s*ago/);
  if (dayMatch) return parseInt(dayMatch[1]);

  const weekMatch = str.match(/(\d+)\s*weeks?\s*ago/);
  if (weekMatch) return parseInt(weekMatch[1]) * 7;

  const monthMatch = str.match(/(\d+)\s*months?\s*ago/);
  if (monthMatch) return parseInt(monthMatch[1]) * 30;

  if (str.includes("yesterday")) return 1;
  if (str.includes("today") || str.includes("just now")) return 0;

  // Try parsing as an actual date
  try {
    const parsed = new Date(dateStr);
    if (!isNaN(parsed.getTime())) {
      const diffMs = Date.now() - parsed.getTime();
      return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
    }
  } catch {
    // ignore
  }

  return 15; // Default fallback
}

export default { runSentimentAgent, parseDaysAgo };
