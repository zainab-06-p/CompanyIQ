/**
 * Report Diff Engine — Upgrade 21
 *
 * Compares a new report against a cached previous report
 * to show what changed since the last analysis.
 *
 * Diff sections:
 * - Score changes (overall + pillar + deep analysis)
 * - New/resolved red flags
 * - Significant ratio changes
 * - New information (announcements, articles)
 * - Multi-horizon shift
 */

import { getCache, setCache } from "../cache/cacheLayer.js";

const PREVIOUS_REPORT_TTL = 90 * 24 * 3600; // 90 days

/**
 * Generate a diff between current report and the cached previous version.
 * Also stores the current report as the new "previous" for next comparison.
 *
 * @param {string} ticker - Company ticker
 * @param {object} currentReport - Current report from pipeline
 * @returns {object|null} Diff object, or null if no previous report exists
 */
export function generateReportDiff(ticker, currentReport) {
  if (!ticker || !currentReport) return null;

  const cacheKey = `previous_report:${ticker.toUpperCase()}`;
  const previousReport = getCache(cacheKey);

  // Store current as the new "previous" for next comparison
  setCache(cacheKey, {
    report: currentReport,
    timestamp: new Date().toISOString(),
  }, PREVIOUS_REPORT_TTL);

  if (!previousReport?.report) return null;

  const prev = previousReport.report;
  const prevTimestamp = previousReport.timestamp;
  const daysSince = Math.round((Date.now() - new Date(prevTimestamp).getTime()) / (1000 * 60 * 60 * 24));

  const diff = {
    previousAnalysisDate: prevTimestamp,
    daysSinceLastAnalysis: daysSince,
    scoreChanges: diffScores(prev, currentReport),
    pillarChanges: diffPillars(prev, currentReport),
    deepAnalysisChanges: diffDeepAnalysis(prev, currentReport),
    redFlagChanges: diffRedFlags(prev, currentReport),
    multiHorizonChanges: diffMultiHorizon(prev, currentReport),
    summary: null,
  };

  // Generate human-readable summary
  diff.summary = generateDiffSummary(diff, daysSince);

  return diff;
}

/**
 * Diff overall CompanyIQ score.
 */
function diffScores(prev, curr) {
  const prevScore = prev.companyIQ ?? null;
  const currScore = curr.companyIQ ?? null;

  if (prevScore === null || currScore === null) {
    return { previous: prevScore, current: currScore, delta: null, direction: "UNKNOWN" };
  }

  const delta = currScore - prevScore;
  return {
    previous: prevScore,
    current: currScore,
    delta,
    direction: delta > 0 ? "IMPROVED" : delta < 0 ? "DECLINED" : "UNCHANGED",
    previousRating: prev.rating,
    currentRating: curr.rating,
    ratingChanged: prev.rating !== curr.rating,
  };
}

/**
 * Diff pillar scores.
 */
function diffPillars(prev, curr) {
  const pillars = ["financial", "legal", "sentiment"];
  const changes = {};

  for (const p of pillars) {
    const prevVal = prev.pillarScores?.[p] ?? null;
    const currVal = curr.pillarScores?.[p] ?? null;

    if (prevVal === null && currVal === null) continue;

    const delta = (prevVal !== null && currVal !== null) ? currVal - prevVal : null;
    changes[p] = {
      previous: prevVal,
      current: currVal,
      delta,
      direction: delta === null ? "UNKNOWN" : delta > 0 ? "IMPROVED" : delta < 0 ? "DECLINED" : "UNCHANGED",
      significant: delta !== null && Math.abs(delta) >= 5,
    };
  }

  return changes;
}

/**
 * Diff deep analysis module scores.
 */
function diffDeepAnalysis(prev, curr) {
  if (!prev.deepAnalysis && !curr.deepAnalysis) return {};

  const prevDA = prev.deepAnalysis || {};
  const currDA = curr.deepAnalysis || {};
  const allModules = new Set([...Object.keys(prevDA), ...Object.keys(currDA)]);
  const changes = {};

  for (const mod of allModules) {
    const prevScore = prevDA[mod]?.score ?? null;
    const currScore = currDA[mod]?.score ?? null;

    if (prevScore === null && currScore === null) continue;

    const delta = (prevScore !== null && currScore !== null) ? currScore - prevScore : null;
    if (delta === null || Math.abs(delta) >= 3) {
      changes[mod] = {
        previous: prevScore,
        current: currScore,
        delta,
        previousRating: prevDA[mod]?.rating || null,
        currentRating: currDA[mod]?.rating || null,
      };
    }
  }

  return changes;
}

/**
 * Diff red flags — find new and resolved ones.
 */
function diffRedFlags(prev, curr) {
  const prevFlags = (prev.redFlags || []).map(f => f.message);
  const currFlags = (curr.redFlags || []).map(f => f.message);

  const newFlags = (curr.redFlags || []).filter(f => !prevFlags.includes(f.message));
  const resolvedFlags = (prev.redFlags || []).filter(f => !currFlags.includes(f.message));

  return {
    newFlags,
    resolvedFlags,
    previousCount: prevFlags.length,
    currentCount: currFlags.length,
    netChange: currFlags.length - prevFlags.length,
  };
}

/**
 * Diff multi-horizon scores.
 */
function diffMultiHorizon(prev, curr) {
  if (!prev.multiHorizon?.horizons || !curr.multiHorizon?.horizons) return null;

  const changes = {};
  for (const horizon of ["shortTerm", "mediumTerm", "longTerm"]) {
    const prevH = prev.multiHorizon.horizons[horizon];
    const currH = curr.multiHorizon.horizons[horizon];

    if (prevH && currH) {
      changes[horizon] = {
        previous: prevH.score,
        current: currH.score,
        delta: currH.score - prevH.score,
        previousRating: prevH.rating,
        currentRating: currH.rating,
      };
    }
  }

  return changes;
}

/**
 * Generate a human-readable diff summary.
 */
function generateDiffSummary(diff, daysSince) {
  const parts = [];

  // Score change
  if (diff.scoreChanges.delta !== null) {
    const { previous, current, delta } = diff.scoreChanges;
    const dir = delta > 0 ? "improved" : delta < 0 ? "declined" : "unchanged";
    parts.push(`CompanyIQ ${dir}: ${previous} → ${current} (Δ ${delta > 0 ? "+" : ""}${delta})`);

    if (diff.scoreChanges.ratingChanged) {
      parts.push(`Rating changed: ${diff.scoreChanges.previousRating} → ${diff.scoreChanges.currentRating}`);
    }
  }

  // Significant pillar changes
  const sigPillars = Object.entries(diff.pillarChanges)
    .filter(([, v]) => v.significant)
    .map(([k, v]) => `${k}: ${v.previous}→${v.current} (${v.delta > 0 ? "+" : ""}${v.delta})`);
  if (sigPillars.length > 0) {
    parts.push(`Significant pillar changes: ${sigPillars.join(", ")}`);
  }

  // Red flag changes
  if (diff.redFlagChanges.newFlags.length > 0) {
    parts.push(`${diff.redFlagChanges.newFlags.length} new red flag(s) since last analysis`);
  }
  if (diff.redFlagChanges.resolvedFlags.length > 0) {
    parts.push(`${diff.redFlagChanges.resolvedFlags.length} red flag(s) resolved`);
  }

  return {
    daysSince,
    text: parts.length > 0 ? parts.join(". ") + "." : "No significant changes detected.",
    keyChanges: parts,
  };
}

export default { generateReportDiff };
