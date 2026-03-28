/**
 * Auth Middleware — JWT verification
 *
 * Verifies JWT token from Authorization header.
 * Attaches user data to req.user on success.
 */

import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "companyiq-dev-secret-change-in-prod";

/**
 * Generate a JWT token for a user.
 */
export function generateToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email },
    JWT_SECRET,
    { expiresIn: "7d" }
  );
}

/**
 * Middleware: Require authentication.
 * Rejects with 401 if no valid token.
 */
export function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: true, message: "Authentication required" });
  }

  const token = authHeader.slice(7);
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch {
    return res.status(401).json({ error: true, message: "Invalid or expired token" });
  }
}

/**
 * Middleware: Optional authentication.
 * Attaches user if token present, but doesn't reject.
 */
export function optionalAuth(req, _res, next) {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.slice(7);
    try {
      req.user = jwt.verify(token, JWT_SECRET);
    } catch {
      // Token invalid — proceed without user
    }
  }
  next();
}

export default { generateToken, requireAuth, optionalAuth };
