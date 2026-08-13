// ============================================================================
// HEADER
// ----------------------------------------------------------------------------
// Persistent top bar shown on every page. Shows user.emp_name when logged in.
// ============================================================================

import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import OrangeLogo from './OrangeLogo.jsx';
import Button from './ui/Button.jsx';

export default function Header() {
  const { user, logout } = useAuth();

  return (
    <header style={styles.header}>
      <Link to="/" style={styles.brand}>
        <OrangeLogo size={28} />
        <span style={styles.title}>On-call schedule</span>
      </Link>

      <nav style={styles.nav}>
        {!user && (
          <Button as={Link} to="/login">
            Log in
          </Button>
        )}

        {user && user.role === 'user' && (
          <Link to="/my-schedule" style={styles.navLink}>
            My schedule
          </Link>
        )}

        {user && user.role === 'admin' && (
          <Link to="/admin" style={styles.navLink}>
            Admin dashboard
          </Link>
        )}

        {user && user.role === 'super_admin' && (
          <Link to="/super-admin" style={styles.navLink}>
            Super admin dashboard
          </Link>
        )}

        {user && (
          <>
            <span style={styles.userName}>{user.emp_name || user.name}</span>
           <Button
  variant="outline"
  size="small"
  onClick={() => {
    const confirmLogout = window.confirm("Are you sure you want to log out?");
    if (confirmLogout) logout();
  }}
>

              Log out
            </Button>
          </>
        )}
      </nav>
    </header>
  );
}

const styles = {
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '16px 24px',
    borderBottom: '1px solid var(--color-grey-dark)',
  },
  brand: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    color: 'var(--color-white)',
  },
  title: {
    fontWeight: 'var(--weight-bold)',
    fontSize: 18,
  },
  nav: {
    display: 'flex',
    alignItems: 'center',
    gap: 16,
  },
  navLink: {
    color: 'var(--color-white)',
    fontWeight: 'var(--weight-bold)',
  },
  userName: {
    color: 'var(--color-grey-light)',
    fontSize: 14,
  },
};
