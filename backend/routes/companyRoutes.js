/**
 * Company Routes — GET /api/companies
 *
 * Search / autocomplete endpoint and full company list.
 */

import { Router } from "express";
import { searchCompaniesExpanded, getAllCompanies, resolveCompany } from "../config/companyResolver.js";

const router = Router();

/**
 * GET /api/companies/search?q=reliance&limit=5
 *
 * Autocomplete / fuzzy search for companies.
 */
router.get("/search", async (req, res) => {
  const q = req.query.q || "";
  const limit = parseInt(req.query.limit, 10) || 5;

  if (q.length < 1) {
    return res.json({ results: [] });
  }

  const results = await searchCompaniesExpanded(q, limit);
  return res.json({
    results: results.map((c) => ({
      name: c.name,
      ticker: c.ticker,
      sector: c.sector,
      industry: c.industry,
      source: c.source || "seed",
    })),
  });
});

/**
 * GET /api/companies/all
 *
 * Returns full list of supported companies (for dropdown / validation).
 */
router.get("/all", (req, res) => {
  const companies = getAllCompanies();
  return res.json({
    count: companies.length,
    companies: companies.map((c) => ({
      name: c.name,
      ticker: c.ticker,
      sector: c.sector,
    })),
  });
});

/**
 * GET /api/companies/resolve/:input
 *
 * Resolve a company from any input (ticker, alias, name).
 */
router.get("/resolve/:input", (req, res) => {
  const company = resolveCompany(req.params.input);
  if (!company) {
    return res.status(404).json({
      error: true,
      message: `Could not resolve "${req.params.input}" to a known company.`,
    });
  }
  return res.json({
    name: company.name,
    ticker: company.ticker,
    sector: company.sector,
    industry: company.industry,
    bseCode: company.bseCode,
    nseSymbol: company.nseSymbol,
  });
});

export default router;
