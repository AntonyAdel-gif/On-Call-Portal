// ============================================================================
// PAST SCHEDULES SECTION
// ----------------------------------------------------------------------------
// Displays past generated schedules up to 1 year back for Super Admin & Admin.
// ============================================================================

import { useState, useEffect } from 'react';
import { fetchPastSchedules } from '../services/api.js';
import Button from './ui/Button.jsx';
import { Table, Thead, Tbody, Tr, Th, Td } from './ui/Table.jsx';

export default function PastSchedulesSection({ isSuperAdmin = false, teams = [], currentTeamId = null }) {
  const [pastRows, setPastRows] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filters
  const [selectedTeamId, setSelectedTeamId] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [presetRange, setPresetRange] = useState('1m'); // 'all', '1m', '6m', '1y'
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  // Initial row limit prevents rendering massive historical DOM trees on initial load.
  const [visibleCount, setVisibleCount] = useState(10);

  // Fetch past schedules filtered to current team for Admin callers or all/selected team for Super Admin callers.
  useEffect(() => {
    async function loadPast() {
      setIsLoading(true);
      try {
        const teamFilter = isSuperAdmin ? (selectedTeamId || null) : currentTeamId;
        const data = await fetchPastSchedules(teamFilter);
        setPastRows(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error('Failed to load past schedules:', err);
        setPastRows([]);
      } finally {
        setIsLoading(false);
      }
    }

    loadPast();
  }, [isSuperAdmin, selectedTeamId, currentTeamId]);

  // Parses user date input formatted as DD/MM/YYYY into a JavaScript Date instance for range comparison.
  function parseDateInput(str) {
    if (!str) return null;
    const trimmed = str.trim();
    if (trimmed.includes('/')) {
      const parts = trimmed.split('/');
      if (parts.length === 3) {
        const d = Number(parts[0]);
        const m = Number(parts[1]) - 1;
        const y = Number(parts[2]);
        const dateObj = new Date(y, m, d);
        return !isNaN(dateObj.getTime()) ? dateObj : null;
      }
    }
    const d = new Date(trimmed);
    return !isNaN(d.getTime()) ? d : null;
  }

  // Client-side multi-tier filtering logic applying search text, preset duration, and custom date bounds.
  const now = new Date();
  const filteredRows = pastRows.filter((row) => {
    // 1. Team filter (Super Admin)
    if (isSuperAdmin && selectedTeamId) {
      if (String(row.team_id) !== String(selectedTeamId)) return false;
    }

    // 2. Search term (Name, FTID, Phone, Backup, Manager)
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase().trim();
      const name = (row.on_call_name || '').toLowerCase();
      const ftid = (row.on_call_ftid || '').toLowerCase();
      const phone = (row.on_call_phone || '').toLowerCase();
      const bkName = (row.backup_name || '').toLowerCase();
      const bkPhone = (row.backup_phone || '').toLowerCase();
      const mgrName = (row.manager_name || '').toLowerCase();
      const mgrPhone = (row.manager_phone || '').toLowerCase();

      const matchesSearch =
        name.includes(term) ||
        ftid.includes(term) ||
        phone.includes(term) ||
        bkName.includes(term) ||
        bkPhone.includes(term) ||
        mgrName.includes(term) ||
        mgrPhone.includes(term);

      if (!matchesSearch) return false;
    }

    // 3. Preset Range Filter (1 month, 6 months, 1 year)
    const shiftStart = new Date(row.start_dt);
    if (presetRange === '1m') {
      const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      if (shiftStart < oneMonthAgo) return false;
    } else if (presetRange === '6m') {
      const sixMonthsAgo = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);
      if (shiftStart < sixMonthsAgo) return false;
    } else if (presetRange === '1y') {
      const oneYearAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
      if (shiftStart < oneYearAgo) return false;
    }

    // 4. Custom Date Range Filter
    if (fromDate.trim()) {
      const parsedFrom = parseDateInput(fromDate);
      if (parsedFrom && shiftStart < parsedFrom) return false;
    }
    if (toDate.trim()) {
      const parsedTo = parseDateInput(toDate);
      if (parsedTo) {
        // Clamp end of day to 23:59:59 to include all shifts starting on that day.
        const endOfDayTo = new Date(parsedTo.getFullYear(), parsedTo.getMonth(), parsedTo.getDate(), 23, 59, 59);
        if (shiftStart > endOfDayTo) return false;
      }
    }

    return true;
  });

  const visibleRows = filteredRows.slice(0, visibleCount);

  function formatDateRange(startDt, endDt) {
    if (!startDt) return '—';
    const sDate = new Date(startDt);
    const sStr = `${String(sDate.getDate()).padStart(2, '0')}/${String(sDate.getMonth() + 1).padStart(2, '0')}/${sDate.getFullYear()}`;
    if (!endDt) return sStr;
    const eDate = new Date(endDt);
    const eStr = `${String(eDate.getDate()).padStart(2, '0')}/${String(eDate.getMonth() + 1).padStart(2, '0')}/${eDate.getFullYear()}`;
    return `${sStr} - ${eStr}`;
  }

  return (
    <div style={{ marginTop: 40 }}>
      <h2>Past schedules</h2>
      <p style={{ color: 'var(--color-grey-light)', marginTop: -8, marginBottom: 16 }}>
        History of generated rotation schedules for up to 1 year back.
      </p>

      {/* Filter Controls Bar */}
      <div style={styles.filterCard}>
        <div style={styles.filterRow}>
          {/* Super Admin Team Filter */}
          {isSuperAdmin && (
            <label style={styles.label}>
              Team
              <select
                style={styles.select}
                value={selectedTeamId}
                onChange={(e) => {
                  setSelectedTeamId(e.target.value);
                  setVisibleCount(10);
                }}
              >
                <option value="">All Teams</option>
                {teams.map((t) => (
                  <option key={t.id || t.team_id} value={t.id || t.team_id}>
                    {t.name || t.team_name}
                  </option>
                ))}
              </select>
            </label>
          )}

          {/* Search input */}
          <label style={{ ...styles.label, flex: 2 }}>
            Search employee / phone / FTID
            <input
              type="text"
              placeholder="Search by name, FTID, or phone..."
              style={styles.input}
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setVisibleCount(10);
              }}
            />
          </label>

          {/* Range preset */}
          <label style={styles.label}>
            Past duration
            <select
              style={styles.select}
              value={presetRange}
              onChange={(e) => {
                setPresetRange(e.target.value);
                setVisibleCount(10);
              }}
            >
              <option value="all">All past (1 year)</option>
              <option value="1m">Last 1 Month</option>
              <option value="6m">Last 6 Months</option>
              <option value="1y">Last 1 Year</option>
            </select>
          </label>
        </div>

        {/* Date Range inputs */}
        <div style={{ ...styles.filterRow, marginTop: 8 }}>
          <label style={styles.label}>
            From (DD/MM/YYYY)
            <input
              type="text"
              placeholder="DD/MM/YYYY"
              style={styles.input}
              value={fromDate}
              onChange={(e) => {
                setFromDate(e.target.value);
                setVisibleCount(10);
              }}
            />
          </label>
          <label style={styles.label}>
            To (DD/MM/YYYY)
            <input
              type="text"
              placeholder="DD/MM/YYYY"
              style={styles.input}
              value={toDate}
              onChange={(e) => {
                setToDate(e.target.value);
                setVisibleCount(10);
              }}
            />
          </label>
          {(fromDate || toDate || searchTerm || presetRange !== '1m' || selectedTeamId) && (
            <Button
              variant="secondary"
              size="small"
              style={{ alignSelf: 'flex-end', marginBottom: 2 }}
              onClick={() => {
                setSelectedTeamId('');
                setSearchTerm('');
                setPresetRange('1m');
                setFromDate('');
                setToDate('');
                setVisibleCount(10);
              }}
            >
              Reset filters
            </Button>
          )}
        </div>
      </div>

      {isLoading ? (
        <p style={{ marginTop: 16 }}>Loading past schedules…</p>
      ) : filteredRows.length === 0 ? (
        <p style={{ marginTop: 16, color: 'var(--color-grey-light)' }}>
          No past schedules found matching the selected filters.
        </p>
      ) : (
        <>
          <Table style={{ marginTop: 16 }}>
            <Thead>
              <Tr>
                <Th>Shift Dates</Th>
                {isSuperAdmin && <Th>Team</Th>}
                <Th>On Call Employee &amp; Number</Th>
                <Th>Backup &amp; Number</Th>
                <Th>Escalation Contact &amp; Number</Th>
              </Tr>
            </Thead>
            <Tbody>
              {visibleRows.map((row, idx) => {
                const shiftDates = formatDateRange(row.start_dt, row.end_dt);
                const onCallText = row.on_call_name ? `${row.on_call_name} (${row.on_call_phone || '—'})` : '—';
                const backupText = row.backup_name ? `${row.backup_name} (${row.backup_phone || '—'})` : '—';
                const managerText = row.manager_name ? `${row.manager_name} (${row.manager_phone || '—'})` : '—';

                return (
                  <Tr key={idx}>
                    <Td>{shiftDates}</Td>
                    {isSuperAdmin && <Td>{row.team_name || '—'}</Td>}
                    <Td>{onCallText}</Td>
                    <Td>{backupText}</Td>
                    <Td>{managerText}</Td>
                  </Tr>
                );
              })}
            </Tbody>
          </Table>

          {/* Show More pagination button: appends +10 rows per click without re-fetching API data */}
          {filteredRows.length > visibleCount && (
            <div style={{ marginTop: 16, display: 'flex', justifyContent: 'center' }}>
              <Button onClick={() => setVisibleCount((prev) => prev + 10)}>
                Show more ({filteredRows.length - visibleCount} remaining)
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

const styles = {
  filterCard: {
    backgroundColor: 'var(--color-surface)',
    border: '1px solid var(--color-grey)',
    padding: 16,
    marginBottom: 16,
  },
  filterRow: {
    display: 'flex',
    gap: 12,
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  label: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    fontSize: 13,
    color: 'var(--color-grey-light)',
    minWidth: 140,
  },
  input: {
    backgroundColor: 'var(--color-black)',
    border: '1px solid var(--color-grey)',
    color: 'var(--color-white)',
    padding: '8px 10px',
    fontFamily: 'inherit',
    fontSize: 13,
  },
  select: {
    backgroundColor: 'var(--color-black)',
    border: '1px solid var(--color-grey)',
    color: 'var(--color-white)',
    padding: '8px 10px',
    fontFamily: 'inherit',
    fontSize: 13,
  },
};
