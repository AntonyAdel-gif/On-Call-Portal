// ============================================================================
// TEAM APPS MODAL
// ----------------------------------------------------------------------------
// Small modal dialog that lists the application names managed by whichever
// team the user clicked on the schedule table (US-02 / FE-02).
// Shows escalation contact line and columns for basicat and cartoo_id.
// ============================================================================

import { useEffect, useState } from 'react';
import { fetchTeamApps } from '../services/api.js';
import { Table, Thead, Tbody, Tr, Th, Td } from './ui/Table.jsx';

export default function TeamAppsModal({ teamId, teamName, onClose }) {
  const [apps, setApps] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // Re-fetch whenever a different team is clicked.
  useEffect(() => {
    let isCancelled = false;

    async function load() {
      setIsLoading(true);
      try {
        const result = await fetchTeamApps(teamId);
        if (!isCancelled) {
          setApps(result || []);
        }
      } catch (err) {
        console.error('Failed to load team apps:', err);
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    }

    load();
    return () => {
      isCancelled = true; // avoids setting state after the modal unmounts
    };
  }, [teamId]);

  const escalationName = apps[0]?.escalation_name || apps[0]?.manager_name;
  const escalationPhone = apps[0]?.escalation_phone || apps[0]?.manager_phone;

  const filteredApps = apps.filter((app) => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    const name = (app.application_name || app.name || '').toLowerCase();
    const cartooId = (app.cartoo_id || app.cartoId || '').toLowerCase();
    const basicat = (app.basicat || '').toLowerCase();
    return name.includes(term) || cartooId.includes(term) || basicat.includes(term);
  });

  return (
    // Clicking the dark overlay closes the modal; clicking inside the card
    // does not (stopPropagation), so clicks on content don't bubble up.
    <div style={styles.overlay} onClick={onClose}>
      <div
        style={styles.card}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={`Applications managed by ${teamName}`}
      >
        <div style={styles.cardHeader}>
          <h3 style={{ margin: 0 }}>{teamName}</h3>
          <button style={styles.closeButton} onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        {escalationName && (
          <p style={{ marginTop: 0, marginBottom: 12, fontSize: 14 }}>
            <strong>Escalation Contact:</strong> {escalationName} ({escalationPhone || '-'})
          </p>
        )}

        {isLoading && <p>Loading applications…</p>}

        {!isLoading && apps.length === 0 && (
          <p>This team has no applications listed yet.</p>
        )}

        {!isLoading && apps.length > 0 && (
          <>
            <input
              type="text"
              placeholder="Search by (name, basicat, cartoo)..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={styles.searchInput}
            />
            {filteredApps.length === 0 ? (
              <p style={{ marginTop: 8 }}>No matching applications found.</p>
            ) : (
              <div style={styles.tableScroll} className="themed-scroll">
                <Table>
                  <Thead>
                    <Tr>
                      <Th style={styles.headerCell}>Application name</Th>
                      <Th style={styles.headerCell}>SLA</Th>
                      <Th style={styles.headerCell}>Basicat</Th>
                      <Th style={styles.headerCell}>Carto ID</Th>
                    </Tr>
                  </Thead>
                  <Tbody>
                    {filteredApps.map((app, idx) => (
                      <Tr key={app.application_id ?? app.id ?? app.application_name ?? idx}>
                        <Td style={{ padding: '8px 4px' }}>{app.application_name || app.name}</Td>
                        <Td style={{ padding: '8px 4px' }}>{app.sla}</Td>
                        <Td style={{ padding: '8px 4px' }}>{app.basicat || '—'}</Td>
                        <Td style={{ padding: '8px 4px' }}>{app.cartoo_id || app.cartoId || '—'}</Td>
                      </Tr>
                    ))}
                  </Tbody>
                </Table>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

const styles = {
  overlay: {
    position: 'fixed',
    inset: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
  },
  card: {
    backgroundColor: 'var(--color-surface)',
    border: '1px solid var(--color-orange)',
    padding: 24,
    width: 'min(650px, 90vw)',
  },
  tableScroll: {
    maxHeight: 400,
    overflowY: 'auto',
  },
  headerCell: {
    padding: '8px 4px',
    color: 'var(--color-orange)',
    position: 'sticky',
    top: 0,
    backgroundColor: 'var(--color-surface)',
  },
  cardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  closeButton: {
    background: 'none',
    border: 'none',
    color: 'var(--color-white)',
    fontSize: 24,
    lineHeight: 1,
  },
  searchInput: {
    width: '100%',
    backgroundColor: 'var(--color-black)',
    border: '1px solid var(--color-grey)',
    color: 'var(--color-white)',
    padding: '8px 12px',
    fontFamily: 'inherit',
    fontSize: 14,
    marginBottom: 12,
    boxSizing: 'border-box',
  },
};
