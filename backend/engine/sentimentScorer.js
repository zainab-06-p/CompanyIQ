/**
 * Sentiment Scorer
 *
 * Converts LLM-classified news articles into a weighted 0–100 sentiment score.
 *
 * Weighting:
 *   Article <7 days old  → weight 3
 *   Article 8–15 days    → weight 2
 *   Article 16–30 days   → weight 1
 *
 * Positive = +1, Neutral = 0, Negative = -1
 * Score = ((weighted_avg + 1) / 2) × 100
 */

import { parseDaysAgo } from "../agents/sentimentAgent.js";

const SENTIMENT_VALUES = {
  POSITIVE: 1,
  NEUTRAL: 0,
  NEGATIVE: -1,
};

/**
 * Compute sentiment score from classified articles.
 *
 * @param {Array} classifiedArticles - Array of { headline, sentiment, topic, date }
 * @returns {{ score: number, positive: number, negative: number, neutral: number, total: number, topThemes: Array, flags: Array }}
 */
export function computeSentimentScore(classifiedArticles) {
  if (!classifiedArticles || classifiedArticles.length === 0) {
    return {
      score: 50,
      positive: 0,
      negative: 0,
      neutral: 0,
      total: 0,
      topThemes: [],
      flags: [{ severity: "INFO", message: "No news articles available for sentiment analysis" }],
    };
  }

  let weightedSum = 0;
  let weightTotal = 0;

  for (const article of classifiedArticles) {
    // Determine recency weight
    const daysAgo = parseDaysAgo(article.date);
    let weight;
    if (daysAgo <= 7) weight = 3;
    else if (daysAgo <= 15) weight = 2;
    else weight = 1;

    const sentimentValue = SENTIMENT_VALUES[article.sentiment] || 0;
    weightedSum += sentimentValue * weight;
    weightTotal += weight;
  }

  // Normalize to 0–100
  const normalizedScore =
    weightTotal > 0 ? ((weightedSum / weightTotal + 1) / 2) * 100 : 50;

  // Count sentiments
  const positive = classifiedArticles.filter((a) => a.sentiment === "POSITIVE").length;
  const negative = classifiedArticles.filter((a) => a.sentiment === "NEGATIVE").length;
  const neutral = classifiedArticles.filter((a) => a.sentiment === "NEUTRAL").length;
  const total = classifiedArticles.length;

  // Compute top themes
  const themeCounts = {};
  for (const article of classifiedArticles) {
    const topic = article.topic || "Other";
    themeCounts[topic] = (themeCounts[topic] || 0) + 1;
  }
  const topThemes = Object.entries(themeCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([theme, count]) => ({ theme, count }));

  // Generate flags
  const flags = [];
  const negativeRatio = negative / total;

  if (negativeRatio > 0.5) {
    flags.push({
      severity: "HIGH",
      message: `${Math.round(negativeRatio * 100)}% negative news sentiment in last 30 days`,
    });
  } else if (negativeRatio > 0.3) {
    flags.push({
      severity: "WATCH",
      message: `Negative news narrative building (${Math.round(negativeRatio * 100)}% negative)`,
    });
  }

  const positiveRatio = positive / total;
  if (positiveRatio > 0.7) {
    flags.push({
      severity: "POSITIVE",
      message: `Strong positive news sentiment (${Math.round(positiveRatio * 100)}% positive)`,
    });
  }

  return {
    score: Math.round(Math.max(0, Math.min(100, normalizedScore))),
    positive,
    negative,
    neutral,
    total,
    topThemes,
    flags,
  };
}

export default { computeSentimentScore };
