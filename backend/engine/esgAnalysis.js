/**
 * Module 5 — ESG & BRSR Analysis
 *
 * Evaluates Environmental, Social, and Governance quality:
 *   - Governance: Board structure, Audit quality, CEO-Chair separation
 *   - Social: Employee metrics, CSR compliance, Litigation density
 *   - Environmental: Sector-based carbon risk, Compliance signals
 *
 * Input: financialData, legalData, sector
 * Output: { governance, social, environmental, score, rating }
 */

// ─── Governance Analysis ────────────────────────────────────────────────

export function analyzeGovernance(legalData, financialData) {
  const directors = legalData?.directors || [];
  const announcements = legalData?.announcements || [];

  let govScore = 50;

  // Board independence
  const independentDirs = directors.filter((d) => {
    const designation = (d.designation || d.category || "").toLowerCase();
    return designation.includes("independent") || designation.includes("non-executive");
  });
  const totalDirs = directors.length;

  // ── SEBI Compliance Fallback ──────────────────────────────────────────────
  // SEBI LODR mandates at least 1/3 of board must be independent for listed companies.
  // If TinyFish failed to return director categories (shows 0 independent) but the
  // board has ANY members, this is a parse failure — not a governance failure.
  let effectiveIndependentCount = independentDirs.length;
  let usedSEBIFallback = false;
  let parseFailure = false;
  if (effectiveIndependentCount === 0 && totalDirs > 0) {
    // Director list present but no categories parsed — use SEBI minimum as conservative estimate
    effectiveIndependentCount = Math.ceil(totalDirs / 3);
    usedSEBIFallback = true;
    parseFailure = true;
    console.log(`[ESG] SEBI-minimum fallback activated: assuming ${effectiveIndependentCount}/${totalDirs} independent directors (parse failure — designations missing)`);
  }

  const independenceRatio = totalDirs > 0 ? effectiveIndependentCount / totalDirs : 0;

  // Don't penalize heavily when using SEBI fallback — it's a data issue, not governance
  if (parseFailure) {
    govScore += 5; // Conservative neutral — SEBI minimum assumed
  } else if (independenceRatio >= 0.5) govScore += 15;
  else if (independenceRatio >= 0.33) govScore += 8;  // SEBI minimum bracket
  else if (independenceRatio < 0.25 && totalDirs > 0) govScore -= 10;

  // Board size (too small = groupthink, too large = inefficient)
  if (totalDirs >= 6 && totalDirs <= 12) govScore += 5;
  else if (totalDirs < 4 && totalDirs > 0) govScore -= 5;
  else if (totalDirs > 15) govScore -= 3;

  // CEO-Chair separation check (from director list)
  const ceo = directors.find((d) => /\b(ceo|managing director|md)\b/i.test(d.designation || ""));
  const chair = directors.find((d) => /\b(chairm|chair\b)/i.test(d.designation || ""));
  if (ceo && chair && ceo.name !== chair.name) govScore += 8;
  else if (ceo && chair && ceo.name === chair.name) govScore -= 5;

  // Audit committee-related announcements
  const auditAnnouncements = announcements.filter((a) =>
    /audit|qualified opinion|disclaimer|adverse/i.test(a.subject || "")
  );
  const qualifiedOpinion = auditAnnouncements.some((a) =>
    /qualified|adverse|disclaimer/i.test(a.subject || "")
  );
  if (qualifiedOpinion) govScore -= 20;
  else if (auditAnnouncements.length === 0) govScore += 3;

  // Board diversity (gender — check for female names heuristic)
  const femaleDirectors = directors.filter((d) =>
    /\b(mrs|ms|smt)\b/i.test(d.name || "")
  );
  if (femaleDirectors.length >= 2) govScore += 5;
  else if (femaleDirectors.length === 1) govScore += 2;

  govScore = clamp(govScore, 0, 100);

  return {
    score: govScore,
    boardSize: totalDirs,
    independentDirectors: effectiveIndependentCount,
    independenceRatio: round2(independenceRatio * 100),
    usedSEBIFallback,
    parseFailure,
    parseFailureNote: parseFailure
      ? "Board composition data partially available — director categories could not be determined from the data source. SEBI minimum independence ratio (1/3) has been assumed as a conservative estimate."
      : null,
    ceoChairSeparated: ceo && chair ? ceo.name !== chair.name : null,
    qualifiedAuditOpinion: qualifiedOpinion,
    femaleBoardMembers: femaleDirectors.length,
  };
}

// ─── Social Analysis ────────────────────────────────────────────────────

export function analyzeSocial(financialData, legalData) {
  const pl = financialData?.profitAndLoss?.annual || [];
  const announcements = legalData?.announcements || [];
  let socialScore = 50;

  // Employee cost ratio (proxy for employee investment)
  const latestRevenue = safe(pl[0]?.revenue);
  const employeeCost = safe(pl[0]?.employeeCost || pl[0]?.staffCost);
  const empCostRatio = latestRevenue > 0 ? (employeeCost / latestRevenue * 100) : 0;

  if (empCostRatio > 30) socialScore += 10; // People-centric business
  else if (empCostRatio > 15) socialScore += 5;
  else if (empCostRatio < 5 && empCostRatio > 0) socialScore -= 3;

  // Employee cost growth (investing in people)
  if (pl.length >= 2) {
    const prevEmpCost = safe(pl[1]?.employeeCost || pl[1]?.staffCost);
    if (prevEmpCost > 0 && employeeCost > prevEmpCost) socialScore += 5;
    else if (prevEmpCost > 0 && employeeCost < prevEmpCost * 0.9) socialScore -= 5;
  }

  // CSR spend (2% mandate for qualifying companies in India)
  const csrAnnouncements = announcements.filter((a) =>
    /csr|corporate social|social responsibility/i.test(a.subject || "")
  );
  if (csrAnnouncements.length > 0) socialScore += 5;

  // Litigation/complaints
  const litigationAnnouncements = announcements.filter((a) =>
    /litigation|penalty|sebi|fine|fraud|complaint|violation/i.test(a.subject || "")
  );
  if (litigationAnnouncements.length > 3) socialScore -= 15;
  else if (litigationAnnouncements.length > 1) socialScore -= 8;
  else if (litigationAnnouncements.length === 0) socialScore += 5;

  socialScore = clamp(socialScore, 0, 100);

  return {
    score: socialScore,
    employeeCostRatio: round2(empCostRatio),
    csrMentions: csrAnnouncements.length,
    litigationCount: litigationAnnouncements.length,
  };
}

// ─── Environmental Analysis ─────────────────────────────────────────────

export function analyzeEnvironmental(financialData, legalData, sector) {
  const announcements = legalData?.announcements || [];
  let envScore = 50;

  // Sector-based carbon risk profile
  const highCarbonSectors = /^(mining|metals|cement|power|energy|oil|gas|chemicals|steel|coal)/i;
  const mediumCarbonSectors = /^(auto|manufacturing|textile|construction|real estate|tyres|rubber)/i;
  const lowCarbonSectors = /^(it|software|banking|financial|pharma|healthcare|fmcg)/i;

  if (highCarbonSectors.test(sector)) {
    envScore -= 15;
  } else if (mediumCarbonSectors.test(sector)) {
    envScore -= 5;
  } else if (lowCarbonSectors.test(sector)) {
    envScore += 10;
  }

  // BRSR / Sustainability reporting signals
  const brsrAnnouncements = announcements.filter((a) =>
    /brsr|sustainability|esg|carbon|emission|green|renewable|environment|biodiversity|water|waste|energy efficiency/i.test(a.subject || "")
  );
  if (brsrAnnouncements.length >= 3) envScore += 15;
  else if (brsrAnnouncements.length >= 2) envScore += 10;
  else if (brsrAnnouncements.length >= 1) envScore += 6;

  // Environmental violations
  const envViolations = announcements.filter((a) =>
    /pollution|environmental fine|pcb|ngt|hazard/i.test(a.subject || "")
  );
  if (envViolations.length > 0) envScore -= 15;

  envScore = clamp(envScore, 0, 100);

  return {
    score: envScore,
    sectorCarbonRisk: highCarbonSectors.test(sector) ? "HIGH"
      : mediumCarbonSectors.test(sector) ? "MEDIUM" : "LOW",
    brsrReportingSignals: brsrAnnouncements.length,
    environmentalViolations: envViolations.length,
  };
}

// ─── Composite ESG Score ────────────────────────────────────────────────

export function computeESGAnalysis(financialData, legalData, sector) {
  const governance = analyzeGovernance(legalData, financialData);
  const social = analyzeSocial(financialData, legalData);
  const environmental = analyzeEnvironmental(financialData, legalData, sector);

  // Governance 45%, Social 30%, Environmental 25%
  const score = Math.round(
    governance.score * 0.45 + social.score * 0.30 + environmental.score * 0.25
  );

  // ── Data availability check ───────────────────────────────
  // If most ESG inputs are missing, show ESG_UNRATED instead of ESG_LAGGARD
  const directors = legalData?.directors || [];
  const dataPoints = [
    directors.length > 0,                           // Board data available
    social.csrMentions > 0,                         // CSR data available
    environmental.brsrReportingSignals > 0,         // BRSR data available
    social.employeeCostRatio > 0,                   // Employee cost data
  ];
  const availableRatio = dataPoints.filter(Boolean).length / dataPoints.length;
  const hasInsufficientData = availableRatio < 0.5;

  let rating;
  if (hasInsufficientData) {
    rating = "ESG_UNRATED";  // Not enough data to rate, don't default to worst
  } else if (score >= 75) rating = "ESG_LEADER";
  else if (score >= 55) rating = "ESG_COMPLIANT";
  else if (score >= 35) rating = "ESG_LAGGARD";
  else rating = "ESG_RISK";

  // ── Narrative commentary ──────────────────────────────────
  const commentary = generateESGCommentary(score, rating, governance, social, environmental, hasInsufficientData, sector);

  return { score: clamp(score, 0, 100), rating, commentary, governance, social, environmental, hasInsufficientData };
}

// ─── Commentary Generation ──────────────────────────────────────────────

function generateESGCommentary(score, rating, governance, social, environmental, hasInsufficientData, sector) {
  const parts = [];

  if (hasInsufficientData) {
    parts.push(`ESG data availability is limited, so this assessment should be treated as preliminary.`);
  }

  // Governance commentary
  if (governance.parseFailure) {
    parts.push(`Board composition data was partially available — director designations could not be fully parsed, so SEBI minimum independence standards have been assumed.`);
  } else if (governance.independenceRatio >= 50) {
    parts.push(`Board governance is strong with ${governance.independenceRatio}% independent directors, exceeding the SEBI minimum of 33%.`);
  } else if (governance.independenceRatio >= 33) {
    parts.push(`Board independence meets SEBI minimum requirements at ${governance.independenceRatio}%.`);
  } else if (governance.boardSize > 0) {
    parts.push(`Board independence at ${governance.independenceRatio}% is below SEBI recommended levels, which warrants monitoring.`);
  }

  if (governance.ceoChairSeparated === true) {
    parts.push(`CEO and Chairman roles are separated, which is a positive governance practice.`);
  } else if (governance.ceoChairSeparated === false) {
    parts.push(`CEO and Chairman roles are held by the same person, which concentrates decision-making power.`);
  }

  // Environmental commentary
  if (environmental.sectorCarbonRisk === "HIGH") {
    parts.push(`As a ${sector || 'high-carbon'} sector company, the environmental risk profile is elevated.`);
  } else if (environmental.sectorCarbonRisk === "LOW") {
    parts.push(`The ${sector || 'low-carbon'} sector inherently carries lower environmental risk.`);
  }

  // Overall assessment
  if (score >= 75) {
    parts.push(`Overall, the company demonstrates strong ESG practices and is well-positioned for sustainable operations.`);
  } else if (score >= 55) {
    parts.push(`The company meets basic ESG compliance standards but has room for improvement in sustainability disclosures.`);
  } else if (score >= 35) {
    parts.push(`ESG practices are below industry standards and investors should monitor governance and sustainability developments.`);
  } else {
    parts.push(`Significant ESG risks are present that could affect long-term investment value.`);
  }

  return parts.join(" ");
}

// ─── Utilities ──────────────────────────────────────────────────────────

function safe(v) {
  // Handle {value, state} wrapper objects from TinyFish agent
  if (v && typeof v === "object" && "value" in v && "state" in v) {
    return v.state === "FETCHED" ? v.value : null;
  }
  if (v && typeof v === "object" && "value" in v) {
    return v.value;
  }
  return (typeof v === "number" && !isNaN(v)) ? v : null;
}
function round2(v) { return Math.round((v || 0) * 100) / 100; }
function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }
