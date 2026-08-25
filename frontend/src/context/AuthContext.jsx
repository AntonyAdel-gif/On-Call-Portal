import { createContext, useContext, useState, useEffect } from 'react';
import { login as apiLogin, fetchMe } from '../services/api.js';
import { TOKEN_KEY } from '../services/apiClient.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  // Restore authenticated session on page refresh by re-validating stored JWT against GET /api/auth/me,
  // preventing stale profile rendering if permissions or roles changed on the server.
  
  useEffect(() => {
    async function restoreSession() {
      setIsLoading(true);
      try {
        const token = localStorage.getItem(TOKEN_KEY);
        if (token) {
          const profile = await fetchMe();
          setUser(profile);
        } else {
          setUser(null);
        }
      } catch (err) {
        // If JWT token is expired or revoked by server, purge stale key to return user to clean unauthenticated state.
        console.error('Failed to restore session:', err);
        localStorage.removeItem(TOKEN_KEY);
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
        // Immediately load verified profile details (emp_id, role, team_id) from database after successful LDAP authentication.
        const profile = await fetchMe();
        setUser(profile);
        return profile;
      }
    } catch (err) {
      localStorage.removeItem(TOKEN_KEY);
      setUser(null);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }

  function logout() {
    setUser(null);
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
