// src/middlewares/requireRole.js

// Higher-order RBAC middleware enforcing role permissions on routes (e.g. admin or super_admin only).
export default function requireRole(...allowedRoles) {
  return (req, res, next) => {
    // Blocks requests where caller's JWT role does not match one of the permitted roles for this endpoint.
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Not authorized for this action' });
    }
    next();
  };
}