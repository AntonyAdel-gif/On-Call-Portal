// src/controllers/authController.js
import ldap from 'ldapjs';
import { ldapConfig } from '../config/ldapConfig.js';
import { signToken } from '../utils/jwt.js';
import * as Employee from '../models/employeeModel.js';


// GET /api/auth/me — returns the logged-in employee's own profile
export const getMe = async (req, res) => {
  try {
    // req.user is populated by authMiddleware after verifying Bearer JWT token signature.
    const employee = await Employee.getById(req.user.emp_id);
    if (!employee) return res.status(404).json({ error: 'Employee not found' });
    res.json(employee);
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

  const client = ldap.createClient({ url: ldapConfig.url });
  const userDN = `uid=${username},${ldapConfig.baseDN}`;

  // Step 1: Bind against Active Directory / LDAP to verify password against corporate directory.
  client.bind(userDN, password, async (err) => {
    // Always release LDAP socket connection immediately regardless of outcome to avoid connection pool exhaustion.
    client.unbind();

    if (err) {
      return res.status(401).json({ error: 'Invalid company credentials' });
    }

    // Step 2: AD bind succeeded — match corporate FTID to local application database record.
    try {
      const employee = await Employee.getByFtid(username);

      if (!employee) {
        // Prevent access if user exists in AD but has not been onboarded into portal database yet.
        return res.status(403).json({ error: 'No matching employee record found. Contact an admin.' });
      }

      if (!employee.active_flg) {
        // Block access for deactivated employees even if corporate LDAP credentials are valid.
        return res.status(403).json({ error: 'This account is inactive' });
      }

      // Step 3: Issue application JWT encoding portal permissions (emp_id, role, team_id).
      const token = signToken({
        emp_id: employee.emp_id,
        role: employee.role,
        team_id: employee.team_id,
      });

      res.json({ token });
    } catch (dbErr) {
      console.error(dbErr);
      res.status(500).json({ error: 'Login failed' });
    }
  });
};