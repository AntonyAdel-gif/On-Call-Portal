// ============================================================================
// LOGIN PAGE
// ----------------------------------------------------------------------------
// FE-03: a login page reachable via the header's top-right button. On
// success it redirects to the correct dashboard for the user's role.
// ============================================================================

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import Button from '../components/ui/Button.jsx';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      const session = await login(username, password);
      // Send the user straight to the dashboard that matches their role.
      const destination =
        session.role === 'super_admin'
          ? '/super-admin'
          : session.role === 'admin'
          ? '/admin'
          : '/my-schedule';
      navigate(destination);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main style={styles.main}>
      <form onSubmit={handleSubmit} style={styles.form}>
        <h1>Log in</h1>

        <label style={styles.label}>
          Username
          <input
            style={styles.input}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoFocus
            required
          />
        </label>

        <label style={styles.label}>
          Password
          <input
            type="password"
            style={styles.input}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </label>

        {error && <p style={styles.error}>{error}</p>}

        <Button type="submit" style={{ marginTop: 8 }} disabled={isSubmitting}>
          {isSubmitting ? 'Logging in…' : 'Log in'}
        </Button>
      </form>
    </main>
  );
}

const styles = {
  main: {
    display: 'flex',
    justifyContent: 'center',
    padding: '64px 24px',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
    width: '100%',
    maxWidth: 360,
  },
  label: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    fontSize: 14,
    color: 'var(--color-grey-light)',
  },
  input: {
    backgroundColor: 'var(--color-black)',
    border: '1px solid var(--color-grey)',
    color: 'var(--color-white)',
    padding: '10px 12px',
    fontFamily: 'inherit',
    fontSize: 14,
  },
  error: {
    color: 'var(--color-support-pink)',
    margin: 0,
  },
};
