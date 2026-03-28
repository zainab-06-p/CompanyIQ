import fetch from 'node-fetch';
import { parse } from 'csv-parse/sync';
import stringSimilarity from 'string-similarity';

let masterList = [];
let nseEnriched = false;

// ─── Sector Map — ticker → actual industry sector ───────────────────────────────
// This replaces the generic "EQ" series code with meaningful industry names
const SECTOR_MAP = {
  // Information Technology
  'TCS': 'Information Technology', 'INFY': 'Information Technology',
  'WIPRO': 'Information Technology', 'HCLTECH': 'Information Technology',
  'TECHM': 'Information Technology', 'LTIM': 'Information Technology',
  'LTTS': 'Information Technology', 'MPHASIS': 'Information Technology',
  'COFORGE': 'Information Technology', 'PERSISTENT': 'Information Technology',
  // Banking & Financial Services
  'HDFCBANK': 'Banking', 'ICICIBANK': 'Banking', 'SBIN': 'Banking',
  'KOTAKBANK': 'Banking', 'AXISBANK': 'Banking', 'INDUSINDBK': 'Banking',
  'BANKBARODA': 'Banking', 'PNB': 'Banking', 'CANBK': 'Banking',
  'BAJFINANCE': 'Financial Services', 'BAJAJFINSV': 'Financial Services',
  'SHRIRAMFIN': 'Financial Services', 'SBILIFE': 'Insurance',
  'HDFCLIFE': 'Insurance', 'POLICYBZR': 'Financial Services',
  // Oil & Gas / Energy
  'RELIANCE': 'Oil & Gas', 'ONGC': 'Oil & Gas', 'BPCL': 'Oil & Gas',
  'IOC': 'Oil & Gas', 'COALINDIA': 'Mining', 'TATAPOWER': 'Power',
  'NTPC': 'Power', 'POWERGRID': 'Power', 'ADANIGREEN': 'Renewable Energy',
  // Automobile
  'MARUTI': 'Automobile', 'TATAMOTORS': 'Automobile', 'M&M': 'Automobile',
  'BAJAJ-AUTO': 'Automobile', 'HEROMOTOCO': 'Automobile', 'EICHERMOT': 'Automobile',
  // Tyres
  'MRF': 'Tyres',
  // Pharma & Healthcare
  'SUNPHARMA': 'Pharma', 'DRREDDY': 'Pharma', 'CIPLA': 'Pharma',
  'DIVISLAB': 'Pharma', 'TORNTPHARM': 'Pharma', 'APOLLOHOSP': 'Healthcare',
  // FMCG
  'HINDUNILVR': 'FMCG', 'ITC': 'FMCG', 'NESTLEIND': 'FMCG',
  'BRITANNIA': 'FMCG', 'DABUR': 'FMCG', 'MARICO': 'FMCG',
  'GODREJCP': 'FMCG', 'TATACONSUM': 'FMCG',
  // Metals & Materials
  'TATASTEEL': 'Metals', 'JSWSTEEL': 'Metals', 'HINDALCO': 'Metals',
  'VEDL': 'Metals', 'ULTRACEMCO': 'Cement', 'AMBUJACEM': 'Cement',
  'ACC': 'Cement', 'GRASIM': 'Diversified',
  // Consumer Discretionary
  'TITAN': 'Consumer Goods', 'ASIANPAINT': 'Paints', 'PIDILITIND': 'Chemicals',
  'HAVELLS': 'Consumer Electronics', 'VOLTAS': 'Consumer Electronics',
  'TRENT': 'Retail',
  // Infrastructure & Capital Goods
  'LT': 'Infrastructure', 'SIEMENS': 'Capital Goods', 'ABB': 'Capital Goods',
  'HAL': 'Defence', 'BEL': 'Defence',
  // Conglomerates & Others
  'ADANIENT': 'Diversified', 'ADANIPORTS': 'Infrastructure',
  'BHARTIARTL': 'Telecom', 'DLF': 'Real Estate',
  'ZOMATO': 'Internet & E-Commerce', 'PAYTM': 'Fintech',
  'NYKAA': 'Internet & E-Commerce', 'IRCTC': 'Travel & Tourism',
};

// ─── Helper: get sector for a ticker ───────────────────────────────────────────
function getSectorForTicker(ticker) {
  return SECTOR_MAP[ticker] || 'General';
}

// ─── Seed list — 80+ popular Indian companies ──────────────────────────────────
// This ensures search works INSTANTLY without waiting for the NSE CSV
const SEED_COMPANIES = [
  { ticker: 'RELIANCE', name: 'Reliance Industries Ltd', screenerSlug: 'RELIANCE/consolidated' },
  { ticker: 'TCS', name: 'Tata Consultancy Services Ltd', screenerSlug: 'TCS/consolidated' },
  { ticker: 'HDFCBANK', name: 'HDFC Bank Ltd', screenerSlug: 'HDFCBANK/consolidated' },
  { ticker: 'INFY', name: 'Infosys Ltd', screenerSlug: 'INFY/consolidated' },
  { ticker: 'ICICIBANK', name: 'ICICI Bank Ltd', screenerSlug: 'ICICIBANK/consolidated' },
  { ticker: 'HINDUNILVR', name: 'Hindustan Unilever Ltd', screenerSlug: 'HINDUNILVR/consolidated' },
  { ticker: 'SBIN', name: 'State Bank of India', screenerSlug: 'SBIN/consolidated' },
  { ticker: 'BHARTIARTL', name: 'Bharti Airtel Ltd', screenerSlug: 'BHARTIARTL/consolidated' },
  { ticker: 'ITC', name: 'ITC Ltd', screenerSlug: 'ITC/consolidated' },
  { ticker: 'KOTAKBANK', name: 'Kotak Mahindra Bank Ltd', screenerSlug: 'KOTAKBANK/consolidated' },
  { ticker: 'LT', name: 'Larsen & Toubro Ltd', screenerSlug: 'LT/consolidated' },
  { ticker: 'AXISBANK', name: 'Axis Bank Ltd', screenerSlug: 'AXISBANK/consolidated' },
  { ticker: 'BAJFINANCE', name: 'Bajaj Finance Ltd', screenerSlug: 'BAJFINANCE/consolidated' },
  { ticker: 'ASIANPAINT', name: 'Asian Paints Ltd', screenerSlug: 'ASIANPAINT/consolidated' },
  { ticker: 'MARUTI', name: 'Maruti Suzuki India Ltd', screenerSlug: 'MARUTI/consolidated' },
  { ticker: 'M&M', name: 'Mahindra & Mahindra Ltd', screenerSlug: 'M&M/consolidated' },
  { ticker: 'TATAMOTORS', name: 'Tata Motors Ltd', screenerSlug: 'TATAMOTORS/consolidated' },
  { ticker: 'SUNPHARMA', name: 'Sun Pharmaceutical Industries Ltd', screenerSlug: 'SUNPHARMA/consolidated' },
  { ticker: 'TITAN', name: 'Titan Company Ltd', screenerSlug: 'TITAN/consolidated' },
  { ticker: 'NESTLEIND', name: 'Nestle India Ltd', screenerSlug: 'NESTLEIND/consolidated' },
  { ticker: 'WIPRO', name: 'Wipro Ltd', screenerSlug: 'WIPRO/consolidated' },
  { ticker: 'ULTRACEMCO', name: 'UltraTech Cement Ltd', screenerSlug: 'ULTRACEMCO/consolidated' },
  { ticker: 'POWERGRID', name: 'Power Grid Corporation of India Ltd', screenerSlug: 'POWERGRID/consolidated' },
  { ticker: 'NTPC', name: 'NTPC Ltd', screenerSlug: 'NTPC/consolidated' },
  { ticker: 'ONGC', name: 'Oil & Natural Gas Corporation Ltd', screenerSlug: 'ONGC/consolidated' },
  { ticker: 'TATASTEEL', name: 'Tata Steel Ltd', screenerSlug: 'TATASTEEL/consolidated' },
  { ticker: 'JSWSTEEL', name: 'JSW Steel Ltd', screenerSlug: 'JSWSTEEL/consolidated' },
  { ticker: 'HCLTECH', name: 'HCL Technologies Ltd', screenerSlug: 'HCLTECH/consolidated' },
  { ticker: 'TECHM', name: 'Tech Mahindra Ltd', screenerSlug: 'TECHM/consolidated' },
  { ticker: 'BAJAJ-AUTO', name: 'Bajaj Auto Ltd', screenerSlug: 'BAJAJ-AUTO/consolidated' },
  { ticker: 'BAJAJFINSV', name: 'Bajaj Finserv Ltd', screenerSlug: 'BAJAJFINSV/consolidated' },
  { ticker: 'ADANIENT', name: 'Adani Enterprises Ltd', screenerSlug: 'ADANIENT/consolidated' },
  { ticker: 'ADANIPORTS', name: 'Adani Ports & SEZ Ltd', screenerSlug: 'ADANIPORTS/consolidated' },
  { ticker: 'ADANIGREEN', name: 'Adani Green Energy Ltd', screenerSlug: 'ADANIGREEN/consolidated' },
  { ticker: 'DIVISLAB', name: "Divi's Laboratories Ltd", screenerSlug: 'DIVISLAB/consolidated' },
  { ticker: 'DRREDDY', name: "Dr. Reddy's Laboratories Ltd", screenerSlug: 'DRREDDY/consolidated' },
  { ticker: 'CIPLA', name: 'Cipla Ltd', screenerSlug: 'CIPLA/consolidated' },
  { ticker: 'EICHERMOT', name: 'Eicher Motors Ltd', screenerSlug: 'EICHERMOT/consolidated' },
  { ticker: 'HEROMOTOCO', name: 'Hero MotoCorp Ltd', screenerSlug: 'HEROMOTOCO/consolidated' },
  { ticker: 'BRITANNIA', name: 'Britannia Industries Ltd', screenerSlug: 'BRITANNIA/consolidated' },
  { ticker: 'GRASIM', name: 'Grasim Industries Ltd', screenerSlug: 'GRASIM/consolidated' },
  { ticker: 'INDUSINDBK', name: 'IndusInd Bank Ltd', screenerSlug: 'INDUSINDBK/consolidated' },
  { ticker: 'GODREJCP', name: 'Godrej Consumer Products Ltd', screenerSlug: 'GODREJCP/consolidated' },
  { ticker: 'MRF', name: 'MRF Ltd', bseCode: '500290', screenerSlug: 'MRF/consolidated' },
  { ticker: 'COALINDIA', name: 'Coal India Ltd', screenerSlug: 'COALINDIA/consolidated' },
  { ticker: 'BPCL', name: 'Bharat Petroleum Corporation Ltd', screenerSlug: 'BPCL/consolidated' },
  { ticker: 'IOC', name: 'Indian Oil Corporation Ltd', screenerSlug: 'IOC/consolidated' },
  { ticker: 'HINDALCO', name: 'Hindalco Industries Ltd', screenerSlug: 'HINDALCO/consolidated' },
  { ticker: 'SHRIRAMFIN', name: 'Shriram Finance Ltd', screenerSlug: 'SHRIRAMFIN/consolidated' },
  { ticker: 'SBILIFE', name: 'SBI Life Insurance Company Ltd', screenerSlug: 'SBILIFE/consolidated' },
  { ticker: 'HDFCLIFE', name: 'HDFC Life Insurance Company Ltd', screenerSlug: 'HDFCLIFE/consolidated' },
  { ticker: 'DABUR', name: 'Dabur India Ltd', screenerSlug: 'DABUR/consolidated' },
  { ticker: 'HAVELLS', name: 'Havells India Ltd', screenerSlug: 'HAVELLS/consolidated' },
  { ticker: 'PIDILITIND', name: 'Pidilite Industries Ltd', screenerSlug: 'PIDILITIND/consolidated' },
  { ticker: 'SIEMENS', name: 'Siemens Ltd' },
  { ticker: 'ABB', name: 'ABB India Ltd' },
  { ticker: 'AMBUJACEM', name: 'Ambuja Cements Ltd' },
  { ticker: 'ACC', name: 'ACC Ltd' },
  { ticker: 'DLF', name: 'DLF Ltd' },
  { ticker: 'TRENT', name: 'Trent Ltd' },
  { ticker: 'ZOMATO', name: 'Zomato Ltd' },
  { ticker: 'PAYTM', name: 'One 97 Communications Ltd' },
  { ticker: 'NYKAA', name: 'FSN E-Commerce Ventures Ltd' },
  { ticker: 'POLICYBZR', name: 'PB Fintech Ltd' },
  { ticker: 'IRCTC', name: 'Indian Railway Catering & Tourism Corporation Ltd' },
  { ticker: 'VEDL', name: 'Vedanta Ltd' },
  { ticker: 'TATAPOWER', name: 'Tata Power Company Ltd' },
  { ticker: 'TATACONSUM', name: 'Tata Consumer Products Ltd' },
  { ticker: 'TORNTPHARM', name: 'Torrent Pharmaceuticals Ltd' },
  { ticker: 'APOLLOHOSP', name: 'Apollo Hospitals Enterprise Ltd' },
  { ticker: 'BANKBARODA', name: 'Bank of Baroda' },
  { ticker: 'PNB', name: 'Punjab National Bank' },
  { ticker: 'CANBK', name: 'Canara Bank' },
  { ticker: 'MARICO', name: 'Marico Ltd' },
  { ticker: 'VOLTAS', name: 'Voltas Ltd' },
  { ticker: 'PERSISTENT', name: 'Persistent Systems Ltd' },
  { ticker: 'LTIM', name: 'LTIMindtree Ltd' },
  { ticker: 'LTTS', name: 'L&T Technology Services Ltd' },
  { ticker: 'MPHASIS', name: 'Mphasis Ltd' },
  { ticker: 'COFORGE', name: 'Coforge Ltd' },
  { ticker: 'HAL', name: 'Hindustan Aeronautics Ltd' },
  { ticker: 'BEL', name: 'Bharat Electronics Ltd' },
].map(c => ({
  ...c,
  nseSymbol: c.ticker,
  screenerSlug: c.screenerSlug || (c.ticker + '/consolidated'),
  sector: getSectorForTicker(c.ticker),  // Use real industry sector, not NSE series
}));

// ─── Alias map ─────────────────────────────────────────────────────────────────
// Maps common names / abbreviations → canonical NSE ticker
const ALIAS_MAP = {
  // Mahindra
  'mahindra': 'M&M',
  'mahindra and mahindra': 'M&M',
  'mahindra & mahindra': 'M&M',
  'm&m': 'M&M',
  'mm': 'M&M',
  // TCS
  'tcs': 'TCS',
  'tata consultancy': 'TCS',
  'tata consultancy services': 'TCS',
  // Infosys
  'infy': 'INFY',
  'infosys': 'INFY',
  // Reliance
  'reliance': 'RELIANCE',
  'ril': 'RELIANCE',
  'reliance industries': 'RELIANCE',
  // Wipro
  'wipro': 'WIPRO',
  // HDFC Bank
  'hdfc bank': 'HDFCBANK',
  'hdfcbank': 'HDFCBANK',
  // ICICI Bank
  'icici bank': 'ICICIBANK',
  'icicibank': 'ICICIBANK',
  // SBI
  'sbi': 'SBIN',
  'state bank': 'SBIN',
  'state bank of india': 'SBIN',
  // Axis Bank
  'axis bank': 'AXISBANK',
  'axisbank': 'AXISBANK',
  // Tata Motors
  'tata motors': 'TATAMOTORS',
  // HUL
  'hul': 'HINDUNILVR',
  'hindustan unilever': 'HINDUNILVR',
  // Bajaj Finance
  'bajaj finance': 'BAJFINANCE',
  // Maruti
  'maruti': 'MARUTI',
  'maruti suzuki': 'MARUTI',
  // Larsen & Toubro
  'l&t': 'LT',
  'larsen': 'LT',
  'larsen and toubro': 'LT',
  'larsen & toubro': 'LT',
  // Sun Pharma
  'sun pharma': 'SUNPHARMA',
  'sunpharma': 'SUNPHARMA',
  // ITC
  'itc': 'ITC',
  // Adani
  'adani enterprises': 'ADANIENT',
  'adanient': 'ADANIENT',
  // MRF
  'mrf': 'MRF',
  // Kotak
  'kotak': 'KOTAKBANK',
  'kotak mahindra bank': 'KOTAKBANK',
  // Asian Paints
  'asian paints': 'ASIANPAINT',
  'asianpaint': 'ASIANPAINT',
  // ONGC
  'ongc': 'ONGC',
  'oil and natural gas': 'ONGC',
  // NTPC
  'ntpc': 'NTPC',
  // Power Grid
  'powergrid': 'POWERGRID',
  // Ultratech Cement
  'ultratech': 'ULTRACEMCO',
  'ultratech cement': 'ULTRACEMCO',
  // Tech Mahindra
  'tech mahindra': 'TECHM',
  'techm': 'TECHM',
  // HCL Tech
  'hcl tech': 'HCLTECH',
  'hcltech': 'HCLTECH',
  // HDFC (pre-merger reference)
  'hdfc': 'HDFCBANK',
  // Dr Reddy's
  "dr reddy": 'DRREDDY',
  "dr reddy's": 'DRREDDY',
  // Cipla
  'cipla': 'CIPLA',
  // JSW Steel
  'jsw steel': 'JSWSTEEL',
  'jswsteel': 'JSWSTEEL',
  // Tata Steel
  'tata steel': 'TATASTEEL',
  // Hindalco
  'hindalco': 'HINDALCO',
  // Bajaj Auto
  'bajaj auto': 'BAJAJ-AUTO',
  'bajaj': 'BAJAJ-AUTO',
  // Hero MotoCorp
  'hero moto': 'HEROMOTOCO',
  'hero motocorp': 'HEROMOTOCO',
  // Britannia
  'britannia': 'BRITANNIA',
  // Nestle
  'nestle': 'NESTLEIND',
  'maggi': 'NESTLEIND',
  // Titan
  'titan': 'TITAN',
  // Divis Labs
  'divis': 'DIVISLAB',
  // Godrej
  'godrej consumer': 'GODREJCP',
  // Grasim
  'grasim': 'GRASIM',
  // Eicher
  'eicher': 'EICHERMOT',
  'royal enfield': 'EICHERMOT',
  // Indusind Bank
  'indusind': 'INDUSINDBK',
};

// ─── Init ───────────────────────────────────────────────────────────────────────
export async function initResolver() {
  // If already enriched from NSE, skip
  if (nseEnriched) return;

  // Immediately populate with seed list so search works right away
  if (masterList.length === 0) {
    masterList = [...SEED_COMPANIES];
    console.log(`[Resolver] Loaded ${masterList.length} seed companies (instant)`);
  }

  // Try to enrich from NSE in the background (with timeout)
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000); // 5s timeout

    const response = await fetch('https://nsearchives.nseindia.com/content/equities/EQUITY_L.csv', {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/csv,text/plain,*/*',
      },
    });
    clearTimeout(timeout);

    const text = await response.text();
    const records = parse(text, {
      columns: true,
      skip_empty_lines: true
    });
    const nseList = records.map(r => ({
      nseSymbol: r.SYMBOL,
      name: r['NAME OF COMPANY'],
      ticker: r.SYMBOL,
      isin: r[' ISIN NUMBER'] || r.ISIN,
      sector: r.SERIES,
      screenerSlug: r.SYMBOL + '/consolidated'
    }));

    if (nseList.length > 100) {
      // Merge: NSE data + seed entries that might not be in NSE
      const nseTickers = new Set(nseList.map(c => c.ticker));
      const seedOnly = SEED_COMPANIES.filter(c => !nseTickers.has(c.ticker));
      masterList = [...nseList, ...seedOnly];
      nseEnriched = true;
      console.log(`[Resolver] Enriched with ${nseList.length} companies from NSE (total: ${masterList.length})`);
    }
  } catch (error) {
    // NSE fetch failed — seed list already loaded, so search still works
    console.warn(`[Resolver] NSE fetch failed (using ${masterList.length} seed companies):`, error.message || error.code);
  }
}

// ─── Resolve ticker via alias map ───────────────────────────────────────────────
function resolveAlias(query) {
  const q = query.trim().toLowerCase();
  const ticker = ALIAS_MAP[q];
  if (!ticker) return null;
  return masterList.find(c => c.ticker === ticker) || null;
}

// ─── Score a company against a query ───────────────────────────────────────────
function scoreCompany(company, query) {
  const q = query.toLowerCase();
  const nameSim = stringSimilarity.compareTwoStrings(q, company.name.toLowerCase());
  const tickerSim = stringSimilarity.compareTwoStrings(q, company.ticker.toLowerCase());
  // Bonus for exact ticker match
  const tickerExact = company.ticker.toLowerCase() === q ? 1.0 : 0;
  // Bonus for starts-with match on name
  const nameStartsWith = company.name.toLowerCase().startsWith(q) ? 0.3 : 0;
  return Math.max(nameSim, tickerSim, tickerExact) + nameStartsWith;
}

// ─── Search (autocomplete) ──────────────────────────────────────────────────────
export async function searchCompaniesExpanded(query, limit = 6) {
  if (masterList.length === 0) await initResolver();
  if (!query) return [];

  const q = query.trim();
  if (q.length === 0) return [];

  // Check alias map first — if we get a match, pin it at the top
  const aliasMatch = resolveAlias(q);

  // Score all companies
  const scored = masterList.map(c => ({
    ...c,
    _score: scoreCompany(c, q),
  }));

  // Sort by score descending, filter out very-low matches
  const MIN_SCORE = 0.2;
  let sorted = scored
    .filter(c => c._score >= MIN_SCORE)
    .sort((a, b) => b._score - a._score)
    .slice(0, limit);

  // If alias match exists and isn't already first, inject it at the top
  if (aliasMatch) {
    const alreadyFirst = sorted.length > 0 && sorted[0].ticker === aliasMatch.ticker;
    if (!alreadyFirst) {
      sorted = [aliasMatch, ...sorted.filter(c => c.ticker !== aliasMatch.ticker)].slice(0, limit);
    }
  }

  // Clean up internal score field before returning
  return sorted.map(({ _score, ...rest }) => rest);
}

export function getAllCompanies() { return masterList; }

// ─── Resolve company (single best match) ───────────────────────────────────────
export async function resolveCompany(input) {
  if (masterList.length === 0) await initResolver();
  if (!input) return null;

  const q = input.trim();

  // 1. Check alias map (handles M&M, TCS, etc.)
  const aliasMatch = resolveAlias(q);
  if (aliasMatch) return aliasMatch;

  // 2. Exact ticker match (case-insensitive)
  const exactTicker = masterList.find(c => c.ticker.toLowerCase() === q.toLowerCase());
  if (exactTicker) return exactTicker;

  // 3. Fuzzy match — pick best if score is high enough
  const scored = masterList.map(c => ({
    ...c,
    _score: scoreCompany(c, q),
  })).sort((a, b) => b._score - a._score);

  const best = scored[0];
  if (best && best._score >= 0.5) {
    const { _score, ...company } = best;
    return company;
  }

  // 4. No confident match — return null (do NOT fall back to masterList[0])
  return null;
}

// ─── Enhanced resolve (returns status + suggestions) ───────────────────────────
export async function resolveCompanyEnhanced(input) {
  if (masterList.length === 0) await initResolver();
  if (!input) return { status: 'AMBIGUOUS', company: null, suggestions: [] };

  const q = input.trim();

  // Check alias map first
  const aliasMatch = resolveAlias(q);
  if (aliasMatch) {
    return { status: 'RESOLVED', company: aliasMatch, suggestions: [] };
  }

  // Score all companies
  const scored = masterList.map(c => ({
    ...c,
    _score: scoreCompany(c, q),
  })).sort((a, b) => b._score - a._score).slice(0, 5);

  const best = scored[0];
  if (!best) return { status: 'AMBIGUOUS', company: null, suggestions: [] };

  // Auto-resolve if score is very high (> 0.85)
  if (best._score > 0.85) {
    const { _score, ...company } = best;
    const suggestions = scored.slice(1, 3).map(({ _score: s, ...c }) => c);
    return { status: 'RESOLVED', company, suggestions };
  }

  // Otherwise return top candidates for disambiguation
  const suggestions = scored.slice(0, 3).map(({ _score, ...c }) => c);
  return { status: 'AMBIGUOUS', company: null, suggestions };
}

// ─── Post-fetch name verification ──────────────────────────────────────────────
export function verifyFetchedName(expectedName, fetchedName) {
  if (!expectedName || !fetchedName) return true;
  const sim = stringSimilarity.compareTwoStrings(
    expectedName.toLowerCase(),
    fetchedName.toLowerCase()
  );
  if (sim < 0.75) {
    throw new Error(
      `Data mismatch: expected "${expectedName}" but data source returned "${fetchedName}". ` +
      `Similarity: ${(sim * 100).toFixed(0)}%. Please retry or select a different match.`
    );
  }
  return true;
}

export function getSuggestions() { return []; }