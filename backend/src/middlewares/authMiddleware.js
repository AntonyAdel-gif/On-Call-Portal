// src/middlewares/authMiddleware.js
import { verifyToken } from '../utils/jwt.js';

// Verifies Bearer JWT signature on incoming HTTP requests and attaches decoded session payload to req.user for downstream RBAC checks.
export default function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization; // expects "Bearer <token>"

  // Rejects unauthenticated requests missing standard Authorization header before hitting controller logic.
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = verifyToken(token); // throws if invalid/expired
    // Store decoded claims ({ emp_id, role, team_id }) on req object to make caller identity available to controllers.
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}