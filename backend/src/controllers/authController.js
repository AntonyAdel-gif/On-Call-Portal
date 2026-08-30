// src/controllers/authController.js
import ldap from 'ldapjs';
import { ldapConfig } from '../config/ldapConfig.js';
import { authenticateLocalUser, isLocalUsername } from '../config/localAuthConfig.js';
import { signToken } from '../utils/jwt.js';
import * as Employee from '../models/employeeModel.js';


// GET /api/auth/me — returns the logged-in employee's own profile
export const getMe = async (req, res) => {
  try {
    // req.user is populated by authMiddleware after verifying Bearer JWT token signature.
    const employee = await Employee.getById(req.user.emp_id);
    if (!employee) return res.status(404).json({ error: 'Employee not found' });
    // Keep the profile consistent with the permissions encoded in the current
    // JWT. This matters for local fallback accounts, whose roles are fixed by
    // localAuthConfig rather than by LDAP or the employee row.
    res.json({
      ...employee,
      role: req.user.role,
      team_id: req.user.team_id,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
};


// POST /api/auth/login
export const login = async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  const completeLogin = async (employeeUsername, roleOverride = null) => {
    try {
      const employee = roleOverride
        ? await Employee.getLocalAuthCandidate(employeeUsername, roleOverride)
        : await Employee.getByFtid(employeeUsername);

      if (!employee) {
        return res.status(403).json({ error: 'No matching employee record found. Contact an admin.' });
      }

      if (!employee.active_flg) {
        return res.status(403).json({ error: 'This account is inactive' });
      }

      const token = signToken({
        emp_id: employee.emp_id,
        role: roleOverride || employee.role,
        team_id: employee.team_id,
      });

      return res.json({ token });
    } catch (dbErr) {
      console.error(dbErr);
      return res.status(500).json({ error: 'Login failed' });
    }
  };

  // Local demo accounts bypass LDAP but still resolve to real employee rows,
  // keeping employee-, team-, and schedule-based APIs fully functional. An
  // exact FTID match is preferred; otherwise an active employee with the
  // credential's fixed role is used as the local demo identity.
  const localUser = authenticateLocalUser(username, password);
  if (localUser) {
    return completeLogin(localUser.username, localUser.role);
  }

  // Local accounts must never fall through to LDAP after a wrong password.
  // Otherwise an LDAP account with the same name could bypass the fixed local role.
  if (isLocalUsername(username)) {
    return res.status(401).json({ error: 'Invalid username or password' });
  }

  if (!ldapConfig.url || !ldapConfig.baseDN) {
    return res.status(401).json({ error: 'Invalid username or password' });
  }

  const client = ldap.createClient({ url: ldapConfig.url });
  const userDN = `uid=${username},${ldapConfig.baseDN}`;

  // Step 1: Bind against Active Directory / LDAP to verify password against corporate directory.
  return client.bind(userDN, password, async (err) => {
    // Always release LDAP socket connection immediately regardless of outcome to avoid connection pool exhaustion.
    client.unbind();

    if (err) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    // AD bind succeeded — match the corporate FTID to its portal employee.
    return completeLogin(username);
  });
};
