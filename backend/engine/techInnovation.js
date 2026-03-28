/**
 * Module 8 — Technology & Innovation Analysis
 *
 * Evaluates a company's innovation capacity:
 *   - R&D intensity (R&D as % of revenue)
 *   - Patent & IP signals from announcements
 *   - Digital transformation indicators
 *   - Sector-adjusted innovation score
 *
 * Input: financialData, legalData, sector
 * Output: { rdAnalysis, patentSignals, digitalSignals, score, rating }
 */

// ─── R&D Intensity Analysis ────────────────────────────────────────────

export function analyzeRD(financialData, sector) {
  const pl = financialData?.profitAndLoss?.annual || [];

  // Look for R&D expense directly, or approximate from 'other expenses' ratio
  const rdEntries = pl.map((y) => {
    const rd = safe(y.researchAndDevelopment || y.rdExpense);
    const revenue = safe(y.revenue);
    return { rd, revenue, intensity: revenue > 0 ? (rd / revenue * 100) : 0 };
  });

  const latestIntensity = rdEntries[0]?.intensity || 0;
  const avgIntensity = average(rdEntries.map((e) => e.intensity));

  // R&D growth trend
  let rdTrend = "STABLE";
  if (rdEntries.length >= 2 && rdEntries[0].rd > 0 && rdEntries[1].rd > 0) {
    const growth = (rdEntries[0].rd - rdEntries[1].rd) / rdEntries[1].rd * 100;
    if (growth > 15) rdTrend = "INCREASING";
    else if (growth < -10) rdTrend = "DECLINING";
  }

  // Sector-specific thresholds
  const highRDSectors = /^(pharma|biotech|software|saas|semiconductor|auto|defence)/i;
  const isHighRD = highRDSectors.test(sector);
  const benchmark = isHighRD ? 8 : 3;

  let rdScore;
  if (latestIntensity > benchmark * 2) rdScore = 90;
  else if (latestIntensity > benchmark) rdScore = 75;
  else if (latestIntensity > benchmark * 0.5) rdScore = 55;
  else if (latestIntensity > 0) rdScore = 35;
  else rdScore = 20; // No R&D data

  return {
    latestIntensity: round2(latestIntensity),
    avgIntensity: round2(avgIntensity),
    rdTrend,
    rdScore,
    sectorBenchmark: benchmark,
  };
}

// ─── Patent & IP Signals ───────────────────────────────────────────────

export function analyzePatentSignals(legalData) {
  const announcements = legalData?.announcements || [];

  const patentAnnouncements = announcements.filter((a) =>
    /patent|intellectual property|trademark|copyright|invention|R&D|innovation/i.test(a.subject || "")
  );

  const patentFilings = patentAnnouncements.filter((a) =>
    /patent.*filed|patent.*granted|new patent|patent.*application/i.test(a.subject || "")
  );

  const ipLitigation = patentAnnouncements.filter((a) =>
    /infringement|ip dispute|patent.*litigation|ip.*violation/i.test(a.subject || "")
  );

  let patentScore;
  if (patentFilings.length >= 5) patentScore = 85;
  else if (patentFilings.length >= 2) patentScore = 65;
  else if (patentAnnouncements.length > 0) patentScore = 45;
  else patentScore = 25;

  if (ipLitigation.length > 0) patentScore = Math.max(10, patentScore - 15);

  return {
    totalPatentSignals: patentAnnouncements.length,
    patentFilings: patentFilings.length,
    ipLitigation: ipLitigation.length,
    patentScore,
  };
}

// ─── Digital Transformation Signals ─────────────────────────────────────

export function analyzeDigitalSignals(legalData, financialData) {
  const announcements = legalData?.announcements || [];

  const digitalAnnouncements = announcements.filter((a) =>
    /digital|cloud|AI|artificial intelligence|machine learning|automation|blockchain|IoT|data analytics|cyber|saas|platform/i.test(a.subject || "")
  );

  const techPartnerships = announcements.filter((a) =>
    /partnership|collaboration|joint venture|strategic alliance|technology tie-up/i.test(a.subject || "")
  );

  const techAcquisitions = announcements.filter((a) =>
    /acqui.*tech|tech.*acqui|digital.*acqui|startup.*acqui/i.test(a.subject || "")
  );

  let digitalScore;
  if (digitalAnnouncements.length >= 5 || techAcquisitions.length >= 1) digitalScore = 80;
  else if (digitalAnnouncements.length >= 2) digitalScore = 60;
  else if (digitalAnnouncements.length >= 1 || techPartnerships.length >= 1) digitalScore = 40;
  else digitalScore = 20;

  return {
    digitalMentions: digitalAnnouncements.length,
    techPartnerships: techPartnerships.length,
    techAcquisitions: techAcquisitions.length,
    digitalScore,
  };
}

// ─── Composite Innovation Score ─────────────────────────────────────────

export function computeTechInnovation(financialData, legalData, sector) {
  const rdAnalysis = analyzeRD(financialData, sector);
  const patentSignals = analyzePatentSignals(legalData);
  const digitalSignals = analyzeDigitalSignals(legalData, financialData);

  // Sector-adaptive weighting
  const highRDSectors = /^(pharma|biotech|software|saas|semiconductor)/i;
  const isHighRD = highRDSectors.test(sector);

  let score;
  if (isHighRD) {
    // R&D-intensive sectors: weight R&D and patents more
    score = Math.round(
      rdAnalysis.rdScore * 0.45 +
      patentSignals.patentScore * 0.30 +
      digitalSignals.digitalScore * 0.25
    );
  } else {
    // Non-R&D sectors: digital transformation matters more
    score = Math.round(
      rdAnalysis.rdScore * 0.25 +
      patentSignals.patentScore * 0.25 +
      digitalSignals.digitalScore * 0.50
    );
  }

  score = clamp(score, 0, 100);

  let rating;
  if (score >= 75) rating = "INNOVATOR";
  else if (score >= 55) rating = "ADAPTIVE";
  else if (score >= 35) rating = "FOLLOWER";
  else rating = "LAGGARD";

  // Generate commentary
  const parts = [];
  if (rdAnalysis.latestIntensity > 5) {
    parts.push(`R&D investment at ${rdAnalysis.latestIntensity}% of revenue demonstrates strong commitment to innovation.`);
  } else if (rdAnalysis.latestIntensity > 0) {
    parts.push(`R&D spending at ${rdAnalysis.latestIntensity}% of revenue is modest — innovation investment could be increased.`);
  }
  if (patentSignals.totalPatentSignals > 0) {
    parts.push(`${patentSignals.totalPatentSignals} patent-related signal(s) detected, indicating active IP development.`);
  }
  if (score >= 70) {
    parts.push(`The company maintains a strong innovation posture that should support long-term competitiveness.`);
  } else if (score < 40) {
    parts.push(`Limited innovation signals — the company may face challenges staying competitive in a technology-driven market.`);
  }
  const commentary = parts.join(" ");

  return { score, rating, commentary, rdAnalysis, patentSignals, digitalSignals };
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
function round2(v) { return v !== null && v !== undefined ? Math.round(v * 100) / 100 : null; }
function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

function average(arr) {
  const valid = arr.filter((v) => typeof v === "number" && !isNaN(v));
  return valid.length > 0 ? valid.reduce((s, v) => s + v, 0) / valid.length : 0;
}
