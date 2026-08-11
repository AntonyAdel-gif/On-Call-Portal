import { createContext, useContext, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { login as apiLogin, fetchMe } from '../services/api.js';
import {
  expireSession,
  SESSION_EXPIRED_EVENT,
  TOKEN_KEY,
} from '../services/apiClient.js';

const AuthContext = createContext(null);

function getTokenExpiration(token) {
  try {
    const payload = token.split('.')[1];
    if (!payload) return null;

    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    const decoded = JSON.parse(atob(base64));
    return typeof decoded.exp === 'number' ? decoded.exp * 1000 : null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }) {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY));

  // Keep React auth state aligned with both same-tab expiry/401 events and
  // token removals made by another open tab.
  useEffect(() => {
    function clearSessionState() {
      setToken(null);
      setUser(null);
      setIsLoading(false);
      navigate('/', { replace: true });
    }

    async function handleStorage(event) {
      if (event.key !== TOKEN_KEY) return;

      if (event.newValue === null) {
        clearSessionState();
        return;
      }

      // If another tab logs in again, adopt its replacement token so an older
      // timer in this tab cannot later invalidate the new session.
      setToken(event.newValue);
      setIsLoading(true);
      try {
        const profile = await fetchMe();
        if (localStorage.getItem(TOKEN_KEY) === event.newValue) {
          setUser(profile);
        }
      } catch (err) {
        console.error('Failed to synchronize session:', err);
        expireSession(event.newValue);
      } finally {
        setIsLoading(false);
      }
    }

    window.addEventListener(SESSION_EXPIRED_EVENT, clearSessionState);
    window.addEventListener('storage', handleStorage);
    return () => {
      window.removeEventListener(SESSION_EXPIRED_EVENT, clearSessionState);
      window.removeEventListener('storage', handleStorage);
    };
  }, [navigate]);

  // Proactively end the session at the JWT's exp time. Rechecking when the tab
  // becomes visible handles browsers that throttle background-tab timers.
  useEffect(() => {
    if (!token) return undefined;

    const expiresAt = getTokenExpiration(token);
    if (!expiresAt) return undefined;

    function expireIfNeeded() {
      if (Date.now() >= expiresAt) {
        expireSession(token);
      }
    }

    const remaining = expiresAt - Date.now();
    if (remaining <= 0) {
      expireSession(token);
      return undefined;
    }

    const timer = window.setTimeout(() => expireSession(token), remaining);
    document.addEventListener('visibilitychange', expireIfNeeded);
    window.addEventListener('focus', expireIfNeeded);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener('visibilitychange', expireIfNeeded);
      window.removeEventListener('focus', expireIfNeeded);
    };
  }, [token]);

  // Restore authenticated session on page refresh by re-validating stored JWT against GET /api/auth/me,
  // preventing stale profile rendering if permissions or roles changed on the server.
  useEffect(() => {
    async function restoreSession() {
      setIsLoading(true);
      try {
        const storedToken = localStorage.getItem(TOKEN_KEY);
        if (storedToken) {
          const profile = await fetchMe();
          setUser(profile);
        } else {
          setUser(null);
        }
      } catch (err) {
        // If JWT token is expired or revoked by server, purge stale key to return user to clean unauthenticated state.
        console.error('Failed to restore session:', err);
        localStorage.removeItem(TOKEN_KEY);
        setToken(null);
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    }

    restoreSession();
  }, []);

  async function login(username, password) {
    setIsLoading(true);
    try {
      const res = await apiLogin(username, password);
      if (res && res.token) {
        localStorage.setItem(TOKEN_KEY, res.token);
        setToken(res.token);
        // Immediately load verified profile details (emp_id, role, team_id) from database after successful LDAP authentication.
        const profile = await fetchMe();
        setUser(profile);
        return profile;
      }
    } catch (err) {
      localStorage.removeItem(TOKEN_KEY);
      setToken(null);
      setUser(null);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }

  function logout() {
    setUser(null);
    setToken(null);
    localStorage.removeItem(TOKEN_KEY);
  }

  const value = { user, isLoading, login, logout };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used inside an <AuthProvider>.');
  }
  return context;
}
