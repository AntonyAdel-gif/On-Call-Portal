// src/utils/jwt.js
import jwt from 'jsonwebtoken';

const SECRET = process.env.JWT_SECRET;
// Set token TTL to standard 8-hour shift duration to enforce daily session renewal.
const EXPIRES_IN = '8h';

// Signs JWT with essential user claims ({ emp_id, role, team_id }) to avoid database hits on every middleware check.
export const signToken = (payload) => {
  return jwt.sign(payload, SECRET, { expiresIn: EXPIRES_IN });
};

// Verifies token signature and expiration; throws JsonWebTokenError / TokenExpiredError to trigger 401 response in authMiddleware.
export const verifyToken = (token) => {
  return jwt.verify(token, SECRET);
};