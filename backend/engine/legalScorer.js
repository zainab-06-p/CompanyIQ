/**
 * Legal Scorer
 *
 * Converts legal/governance data into a 0–100 score.
 * Starts from 100 (perfect) and deducts for issues.
 *
 * Deduction rules:
 * - Director changes: 2–3 → -8 each, 4+ → -25 (critical)
 * - Promoter pledging: >75% → -35, >50% → -25, >30% → -15, >10% → -5
 * - Promoter holding decline: >3% in 4Q → -10
 * - SEBI notices: -10 each
 * - Positive signals: FII increase +5, zero pledge +5
 */

/**
 * Compute legal/governance score.
 *
 * @param {object} legalData - Output from runLegalAgent()
 * @returns {{ score: number, flags: Array<{severity: string, message: string}> }}
 */
export function computeLegalScore(legalData) {
  let score = 100;
  const flags = [];

  if (!legalData) {
    return { score: null, dataAvailable: false, flags: [{ severity: "INFO", message: "Legal data unavailable — agent failed" }] };
  }

  const { announcements = [], shareholding = {} } = legalData;

  // Check if legal data is effectively empty (agent returned structure but no content)
  const hasAnnouncements = announcements.length > 0;
  const hasShareholding = shareholding.latest || (shareholding.trend && shareholding.trend.length > 0);

  if (!hasAnnouncements && !hasShareholding) {
    return { score: null, dataAvailable: false, flags: [{ severity: "INFO", message: "Legal data empty — insufficient governance information" }] };
  }

  // Partial data: start from 70 instead of 100 if only one source available
  // DAMPENER: Also track whether data is partial so we can cap the output later
  const isPartialData = !hasAnnouncements || !hasShareholding;
  if (isPartialData) {
    score = 70;  // Data collection failure shouldn't penalize governance 30 points
    flags.push({ severity: "INFO", message: `Partial legal data — ${hasAnnouncements ? "announcements" : "shareholding"} only` });
  }

  // ─── Director Changes ──────────────────────────────────────────────
  const directorChanges = announcements.filter(
    (a) => a.category === "Director Change"
  ).length;

  if (directorChanges >= 4) {
    score -= 25;
    flags.push({
      severity: "CRITICAL",
      message: `${directorChanges} director changes in 12 months — governance instability`,
    });
  } else if (directorChanges >= 2) {
    score -= 8 * directorChanges;
    flags.push({
      severity: "WATCH",
      message: `${directorChanges} director changes in 12 months`,
    });
  }

  // ─── Promoter Pledging ─────────────────────────────────────────────
  const pledge = shareholding.latest?.pledgedPercent || 0;

  if (pledge > 75) {
    score -= 35;
    flags.push({
      severity: "CRITICAL",
      message: `Promoter pledging at ${pledge}% — extreme financial stress signal`,
    });
  } else if (pledge > 50) {
    score -= 25;
    flags.push({
      severity: "HIGH",
      message: `Promoter pledging at ${pledge}% — significant pledge risk`,
    });
  } else if (pledge > 30) {
    score -= 15;
    flags.push({
      severity: "WATCH",
      message: `Promoter pledging at ${pledge}% — monitor closely`,
    });
  } else if (pledge > 10) {
    score -= 5;
    flags.push({
      severity: "INFO",
      message: `Promoter pledging at ${pledge}%`,
    });
  } else if (pledge === 0) {
    score += 5; // Positive signal
    flags.push({
      severity: "POSITIVE",
      message: "Zero promoter pledging — clean governance",
    });
  }

  // ─── Promoter Holding Trend ────────────────────────────────────────
  const trend = shareholding.trend;
  if (trend && trend.length >= 4) {
    const latestPromoter = trend[0].promoterHolding;
    const oldestPromoter = trend[trend.length - 1].promoterHolding;

    if (latestPromoter !== null && oldestPromoter !== null) {
      const promoterDecline = latestPromoter - oldestPromoter;

      if (promoterDecline < -3) {
        score -= 10;
        flags.push({
          severity: "WATCH",
          message: `Promoter holding declined ${Math.abs(promoterDecline).toFixed(1)}% over ${trend.length} quarters`,
        });
      } else if (promoterDecline > 2) {
        score += 3;
        flags.push({
          severity: "POSITIVE",
          message: `Promoter holding increased ${promoterDecline.toFixed(1)}% — insider confidence`,
        });
      }
    }
  }

  // ─── FII Trend ─────────────────────────────────────────────────────
  if (trend && trend.length >= 2) {
    const latestFII = trend[0].fiiHolding;
    const oldestFII = trend[trend.length - 1].fiiHolding;

    if (latestFII !== null && oldestFII !== null) {
      const fiiChange = latestFII - oldestFII;

      if (fiiChange > 2) {
        score += 5;
        flags.push({
          severity: "POSITIVE",
          message: `FII holding increased ${fiiChange.toFixed(1)}% — institutional confidence`,
        });
      } else if (fiiChange < -3) {
        score -= 5;
        flags.push({
          severity: "WATCH",
          message: `FII holding declined ${Math.abs(fiiChange).toFixed(1)}% — institutions selling`,
        });
      }
    }
  }

  // ─── SEBI / Regulatory Notices ─────────────────────────────────────
  const sebiNotices = announcements.filter(
    (a) =>
      a.category === "SEBI" ||
      (a.subject && a.subject.toLowerCase().includes("sebi"))
  ).length;

  if (sebiNotices > 0) {
    score -= 10 * sebiNotices;
    flags.push({
      severity: "HIGH",
      message: `${sebiNotices} SEBI-related notice(s) in 12 months`,
    });
  }

  // ─── Pledge Invocation (critical event) ────────────────────────────
  const pledgeInvocation = announcements.filter(
    (a) =>
      a.subject &&
      (a.subject.toLowerCase().includes("invocation") ||
        a.subject.toLowerCase().includes("pledge invoked"))
  ).length;

  if (pledgeInvocation > 0) {
    score -= 20;
    flags.push({
      severity: "CRITICAL",
      message: `${pledgeInvocation} pledge invocation notice(s) — lenders seizing shares`,
    });
  }

  // Clamp final score
  // VARIANCE DAMPENER: Partial data should never produce scores above 80
  // This prevents the 70→100 jump between runs that get different data subsets
  let finalScore = Math.max(0, Math.min(100, score));
  if (isPartialData) {
    finalScore = Math.min(finalScore, 80);
    console.log(`[Legal] Partial data dampener applied: score capped at 80 (was ${score})`);
  }

  return {
    score: finalScore,
    dataAvailable: true,
    isPartialData,
    flags,
  };
}

export default { computeLegalScore };
