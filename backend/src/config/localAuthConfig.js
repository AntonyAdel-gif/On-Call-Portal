import { timingSafeEqual } from 'node:crypto';

// Small set of local fallback accounts for development/demo environments.
// The login resolver prefers a matching employee.ftid, then falls back to an
// active employee with the requested role for its employee/team identity.
export const localCredentials = Object.freeze({
  superadmin: Object.freeze({ password: 'super123', role: 'super_admin' }),
  admin: Object.freeze({ password: 'admin123', role: 'admin' }),
  user: Object.freeze({ password: 'user123', role: 'user' }),
});

const passwordsMatch = (providedPassword, expectedPassword) => {
  const provided = Buffer.from(String(providedPassword));
  const expected = Buffer.from(expectedPassword);

  return provided.length === expected.length && timingSafeEqual(provided, expected);
};

export const isLocalUsername = (username) => {
  const normalizedUsername = String(username).trim().toLowerCase();
  return Object.hasOwn(localCredentials, normalizedUsername);
};

export const authenticateLocalUser = (username, password) => {
  const normalizedUsername = String(username).trim().toLowerCase();
  const credential = Object.hasOwn(localCredentials, normalizedUsername)
    ? localCredentials[normalizedUsername]
    : null;

  if (!credential || !passwordsMatch(password, credential.password)) {
    return null;
  }

  return {
    username: normalizedUsername,
    role: credential.role,
  };
};
