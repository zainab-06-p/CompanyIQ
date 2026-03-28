/**
 * Input Validation & Sanitization Middleware
 *
 * Validates and sanitizes user input to prevent injection attacks.
 */

/**
 * Sanitize a company name/ticker string.
 * - Trims whitespace
 * - Removes control characters
 * - Removes HTML tags
 * - Limits length
 * - Only allows alphanumeric, spaces, dots, hyphens, ampersand, parentheses
 */
export function sanitizeCompany(raw) {
  if (!raw || typeof raw !== "string") return "";

  return raw
    .trim()
    .replace(/[\x00-\x1f\x7f]/g, "") // remove control chars
    .replace(/<[^>]*>/g, "") // strip HTML tags
    .replace(/[^a-zA-Z0-9\s.\-&()]/g, "") // allow only safe chars
    .substring(0, 100); // max 100 chars
}

/**
 * Validate company name/ticker.
 * Returns error message if invalid, null if valid.
 */
export function validateCompany(name) {
  if (!name || name.length < 2) {
    return "Company name must be at least 2 characters.";
  }
  if (name.length > 100) {
    return "Company name is too long (max 100 characters).";
  }
  // Check for obvious injection patterns
  if (/[<>{}$`\\]/.test(name)) {
    return "Company name contains invalid characters.";
  }
  return null;
}

/**
 * Express middleware: sanitize req.params.company and req.query.q
 */
export function sanitizeInput(req, _res, next) {
  if (req.params.company) {
    req.params.company = sanitizeCompany(req.params.company);
  }
  if (req.query.q) {
    req.query.q = sanitizeCompany(req.query.q);
  }
  if (req.query.a) {
    req.query.a = sanitizeCompany(req.query.a);
  }
  if (req.query.b) {
    req.query.b = sanitizeCompany(req.query.b);
  }
  if (req.body?.company) {
    req.body.company = sanitizeCompany(req.body.company);
  }
  next();
}

export default { sanitizeCompany, validateCompany, sanitizeInput };
