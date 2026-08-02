// ============================================================================
// EMPLOYEE DASHBOARD ("My schedule")
// ----------------------------------------------------------------------------
// For regular ('user' role) employees. Lets them:
//   - See their team's upcoming rotation and spot which weeks are theirs.
//   - Ask a teammate to cover one of their on-call weeks ("request swap").
//   - Accept or decline swap requests a teammate has sent them.
// ============================================================================

import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import {
  fetchSchedule,
  fetchTeammates,
  fetchSwapRequests,
  createSwapRequest,
  cancelSwapRequest,
  respondToSwapRequest,
} from '../services/api.js';
import Button from '../components/ui/Button.jsx';
import { Table, Thead, Tbody, Tr, Th, Td } from '../components/ui/Table.jsx';

export default function EmployeeDashboardPage() {
  const { user } = useAuth();

  const [teamSchedule, setTeamSchedule] = useState(null);
  const [rawScheduleRows, setRawScheduleRows] = useState([]);
  const [teammates, setTeammates] = useState([]);
  const [requests, setRequests] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // Which week's "request swap" mini-form is open
  const [openWeekIndex, setOpenWeekIndex] = useState(null);
  const [selectedTargetId, setSelectedTargetId] = useState('');
  const [selectedTargetStartDt, setSelectedTargetStartDt] = useState('');
  const [targetScheduleWeeks, setTargetScheduleWeeks] = useState([]);
  const [isLoadingTargetSchedule, setIsLoadingTargetSchedule] = useState(false);

  const teamId = user?.team_id ?? user?.teamId;
  const empId = user?.emp_id ?? user?.employeeId ?? user?.id;
  const userName = user?.emp_name ?? user?.name;

  async function reload() {
    setIsLoading(true);
    try {
      if (!teamId) {
        setTeamSchedule(null);
        setRawScheduleRows([]);
        setTeammates([]);
        setRequests([]);
        return;
      }

      const [scheduleData, teamEmployees, swapData] = await Promise.all([
        fetchSchedule(teamId).catch(() => []),
        fetchTeammates().catch(() => []),
        fetchSwapRequests().catch(() => ({ sent: [], pending: [] })),
      ]);

      const rawRows = Array.isArray(scheduleData)
        ? scheduleData
        : scheduleData?.weeks || [];

      setRawScheduleRows(rawRows);

      const weeks = rawRows.map((row, idx) => {
        const startStr = row.start_dt
          ? new Date(row.start_dt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
          : '';
        const endStr = row.end_dt
          ? new Date(row.end_dt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
          : '';
        return {
          weekIndex: row.weekIndex ?? idx,
          startDt: row.start_dt,
          endDt: row.end_dt,
          weekLabel: row.weekLabel || (startStr && endStr ? `${startStr} - ${endStr}` : `Shift ${idx + 1}`),
          onCallName: row.on_call_name || row.onCallName || 'Unassigned',
          onCallPhone: row.on_call_phone || row.onCallPhone || '-',
          backupName: row.backup_name || row.backup || '-',
          bkEmpId: row.bk_emp_id || row.bkEmpId,
          empId: row.emp_id || row.empId,
        };
      });

      setTeamSchedule(weeks.length > 0 ? { weeks } : null);

      if (Array.isArray(teamEmployees)) {
        const list = teamEmployees.map((e) => ({
          id: e.emp_id || e.id,
          name: e.emp_name || e.name,
        }));
        setTeammates(list.filter((t) => String(t.id) !== String(empId)));
      }

      const sentList = Array.isArray(swapData?.sent) ? swapData.sent : [];
      const pendingList = Array.isArray(swapData?.pending) ? swapData.pending : [];
      setRequests([...sentList, ...pendingList]);
    } catch (err) {
      console.error('Failed to load employee dashboard:', err);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    reload();
  }, [teamId, empId]);

  // When a target teammate is selected, check if they are the designated backup for this week or load their schedule weeks
  async function handleTargetSelect(targetIdVal, currentWeek) {
    setSelectedTargetId(targetIdVal);
    setSelectedTargetStartDt('');
    setTargetScheduleWeeks([]);

    if (!targetIdVal) return;

    const target = teammates.find((t) => String(t.id) === String(targetIdVal));
    if (!target) return;

    // Check if target is designated backup for this specific week or user's default backup
    const isDesignatedBackup =
      (currentWeek.bkEmpId && String(currentWeek.bkEmpId) === String(target.id)) ||
      (currentWeek.backupName && target.name && currentWeek.backupName.toLowerCase() === target.name.toLowerCase()) ||
      (user?.bk_emp_id && String(user.bk_emp_id) === String(target.id));

    if (isDesignatedBackup) {
      // Same-week swap: target_schedule_start equals requester_schedule_start
      setSelectedTargetStartDt(currentWeek.startDt);
    } else {
      // Cross-week trade: load target employee's shifts on this team
      setIsLoadingTargetSchedule(true);
      try {
        const targetShifts = rawScheduleRows.filter(
          (row) =>
            String(row.emp_id) === String(target.id) ||
            (row.on_call_name && target.name && row.on_call_name.toLowerCase() === target.name.toLowerCase()) ||
            (row.onCallName && target.name && row.onCallName.toLowerCase() === target.name.toLowerCase())
        ).map((row, idx) => {
          const startStr = row.start_dt
            ? new Date(row.start_dt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
            : '';
          const endStr = row.end_dt
            ? new Date(row.end_dt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
            : '';
          return {
            startDt: row.start_dt,
            label: startStr && endStr ? `${startStr} - ${endStr}` : `Shift ${idx + 1}`,
          };
        });
        setTargetScheduleWeeks(targetShifts);
        setSelectedTargetStartDt(targetShifts.length > 0 ? targetShifts[0].startDt : currentWeek.startDt);
      } catch (err) {
        console.error('Failed to load target schedule:', err);
        setSelectedTargetStartDt(currentWeek.startDt);
      } finally {
        setIsLoadingTargetSchedule(false);
      }
    }
  }

  async function handleSendRequest(week) {
    if (!selectedTargetId) return;

    const target = teammates.find((t) => String(t.id) === String(selectedTargetId));
    if (!target) return;

    const targetStart = selectedTargetStartDt || week.startDt;

    try {
      await createSwapRequest({
        target_emp_id: Number(target.id),
        requester_schedule_start: week.startDt,
        target_schedule_start: targetStart,
      });

      setOpenWeekIndex(null);
      setSelectedTargetId('');
      setSelectedTargetStartDt('');
      setTargetScheduleWeeks([]);
      reload();
    } catch (err) {
      window.alert(err.message);
    }
  }

  async function handleRespond(requestId, decision) {
    const status = decision === 'declined' ? 'rejected' : decision;
    try {
      await respondToSwapRequest(requestId, status);
      reload();
    } catch (err) {
      window.alert(err.message);
    }
  }

  async function handleCancel(requestId) {
    const confirmed = window.confirm('Are you sure you want to cancel this swap request?');
    if (!confirmed) return;
    try {
      await cancelSwapRequest(requestId);
      reload();
    } catch (err) {
      window.alert(err.message);
    }
  }

  if (isLoading) {
    return (
      <main style={styles.main}>
        <p>Loading your schedule…</p>
      </main>
    );
  }

  const incoming = requests.filter(
    (r) => String(r.target_emp_id ?? r.targetId) === String(empId) && r.status === 'pending'
  );
  const sent = requests.filter(
    (r) => String(r.requester_emp_id ?? r.requesterId) === String(empId)
  );
  const hasPendingSentRequest = sent.some((r) => r.status === 'pending');

  const weekLabelFor = (startDt) => {
    if (!startDt) return '';
    const match = teamSchedule?.weeks.find(
      (w) => new Date(w.startDt).getTime() === new Date(startDt).getTime()
    );
    return match?.weekLabel ?? new Date(startDt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  return (
    <main style={styles.main}>
      <h1>My schedule</h1>
      <p style={styles.subtitle}>
        Your team's upcoming rotation. Ask a teammate to cover one of your
        weeks if you need to swap.
      </p>

      {!teamSchedule ? (
        <p>Your team's schedule isn't available yet.</p>
      ) : (
        <Table variant="grid" style={{ marginTop: 16 }}>
          <Thead>
            <Tr>
              <Th style={{ borderBottom: 'none' }}>Date</Th>
              <Th style={{ borderBottom: 'none' }}>On call</Th>
              <Th style={{ borderBottom: 'none' }}>Number</Th>
              <Th style={{ borderBottom: 'none' }}></Th>
            </Tr>
          </Thead>
          <Tbody>
            {teamSchedule.weeks.map((week) => {
              const isMine =
                week.onCallName === userName ||
                String(week.empId) === String(empId);
              const isOpen = openWeekIndex === week.weekIndex;
              const selectedTarget = teammates.find(
                (t) => String(t.id) === String(selectedTargetId)
              );
              const isBackupSwap =
                selectedTarget &&
                ((week.bkEmpId && String(week.bkEmpId) === String(selectedTarget.id)) ||
                  (week.backupName && selectedTarget.name && week.backupName.toLowerCase() === selectedTarget.name.toLowerCase()) ||
                  (user?.bk_emp_id && String(user.bk_emp_id) === String(selectedTarget.id)));

              return (
                <Tr key={week.weekIndex}>
                  <Td style={{ border: '1px solid var(--color-grey-dark)', verticalAlign: 'top' }}>
                    {week.weekLabel}
                  </Td>
                  <Td style={{ border: '1px solid var(--color-grey-dark)', verticalAlign: 'top' }}>
                    <span style={isMine ? styles.myDayName : undefined}>
                      {week.onCallName}
                    </span>
                  </Td>
                  <Td style={{ border: '1px solid var(--color-grey-dark)', verticalAlign: 'top' }}>
                    {week.onCallPhone}
                  </Td>
                  <Td style={{ border: '1px solid var(--color-grey-dark)', verticalAlign: 'top' }}>
                    {isMine && !isOpen && (
                      hasPendingSentRequest ? (
                        <p style={{ margin: '8px 0 0 0', fontSize: 12, color: 'var(--color-grey-light)' }}>
                          Pending request active
                        </p>
                      ) : (
                        <Button
                          variant="link"
                          style={{ marginTop: 8, fontSize: 13 }}
                          onClick={() => {
                            setOpenWeekIndex(week.weekIndex);
                            setSelectedTargetId('');
                            setSelectedTargetStartDt('');
                            setTargetScheduleWeeks([]);
                          }}
                        >
                          Request swap
                        </Button>
                      )
                    )}

                    {isMine && isOpen && (
                      <div style={styles.swapForm}>
                        <select
                          style={styles.select}
                          value={selectedTargetId}
                          onChange={(e) => handleTargetSelect(e.target.value, week)}
                        >
                          <option value="">Ask who?</option>
                          {teammates.map((t) => (
                            <option key={t.id} value={t.id}>
                              {t.name}
                            </option>
                          ))}
                        </select>

                        {selectedTargetId && isBackupSwap && (
                          <p style={{ margin: '4px 0', fontSize: 12, color: 'var(--color-support-green)' }}>
                            Same-week backup swap (same shift)
                          </p>
                        )}

                        {selectedTargetId && !isBackupSwap && (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                            <p style={{ margin: '4px 0 0 0', fontSize: 12, color: 'var(--color-grey-light)' }}>
                              Trade for which of {selectedTarget?.name}'s weeks?
                            </p>
                            {isLoadingTargetSchedule ? (
                              <p style={{ fontSize: 12 }}>Loading shifts…</p>
                            ) : targetScheduleWeeks.length === 0 ? (
                              <p style={{ fontSize: 12, color: 'var(--color-support-pink)' }}>
                                No future shifts found for {selectedTarget?.name}.
                              </p>
                            ) : (
                              <select
                                style={styles.select}
                                value={selectedTargetStartDt}
                                onChange={(e) => setSelectedTargetStartDt(e.target.value)}
                              >
                                {targetScheduleWeeks.map((tWeek, idx) => (
                                  <option key={tWeek.startDt || idx} value={tWeek.startDt}>
                                    {tWeek.label}
                                  </option>
                                ))}
                              </select>
                            )}
                          </div>
                        )}

                        <div style={styles.swapFormButtons}>
                          <Button
                            size="small"
                            disabled={!selectedTargetId || (!isBackupSwap && !selectedTargetStartDt)}
                            onClick={() => handleSendRequest(week)}
                          >
                            Send
                          </Button>
                          <Button
                            variant="secondary"
                            size="small"
                            onClick={() => {
                              setOpenWeekIndex(null);
                              setSelectedTargetId('');
                              setSelectedTargetStartDt('');
                            }}
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    )}
                  </Td>
                </Tr>
              );
            })}
          </Tbody>
        </Table>
      )}

      <h2 style={{ marginTop: 40 }}>Requests waiting for your response</h2>
      {incoming.length === 0 ? (
        <p style={styles.subtitle}>No pending requests right now.</p>
      ) : (
        <ul style={styles.requestList}>
          {incoming.map((r) => (
            <li key={r.id || r.request_id} style={styles.requestItem}>
              <span>
                <strong>{r.requester_name || r.requesterName || 'Teammate'}</strong> asked you to swap{' '}
                <strong>{weekLabelFor(r.requester_schedule_start || r.start_dt)}</strong> for{' '}
                <strong>{weekLabelFor(r.target_schedule_start)}</strong>
              </span>
              <span style={styles.requestButtons}>
                <Button size="small" onClick={() => handleRespond(r.id || r.request_id, 'accepted')}>
                  Accept
                </Button>
                <Button
                  variant="secondary"
                  size="small"
                  onClick={() => handleRespond(r.id || r.request_id, 'rejected')}
                >
                  Decline
                </Button>
              </span>
            </li>
          ))}
        </ul>
      )}

      <h2 style={{ marginTop: 40 }}>Your sent requests</h2>
      {sent.length === 0 ? (
        <p style={styles.subtitle}>You haven't requested any swaps yet.</p>
      ) : (
        <ul style={styles.requestList}>
          {sent.map((r) => (
            <li key={r.id || r.request_id} style={styles.requestItem}>
              <span>
                Asked <strong>{r.target_name || r.targetName || 'Teammate'}</strong> for{' '}
                <strong>{weekLabelFor(r.requester_schedule_start || r.start_dt)}</strong>
              </span>
              <span style={styles.requestButtons}>
                <span style={styles.statusBadge(r.status)}>{r.status}</span>
                {r.status === 'pending' && (
                  <Button
                    variant="secondary"
                    size="small"
                    onClick={() => handleCancel(r.id || r.request_id)}
                  >
                    Cancel request
                  </Button>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

const styles = {
  main: { padding: '32px 24px', maxWidth: 900, margin: '0 auto' },
  subtitle: { color: 'var(--color-grey-light)', marginTop: -8 },
  myDayName: {
    color: 'var(--color-orange)',
    fontWeight: 'var(--weight-bold)',
  },
  swapForm: {
    marginTop: 8,
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  select: {
    backgroundColor: 'var(--color-black)',
    border: '1px solid var(--color-grey)',
    color: 'var(--color-white)',
    padding: '6px 8px',
    fontSize: 13,
  },
  swapFormButtons: {
    display: 'flex',
    gap: 8,
    marginTop: 4,
  },
  requestList: {
    listStyle: 'none',
    margin: 0,
    padding: 0,
  },
  requestItem: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '12px 0',
    borderBottom: '1px solid var(--color-grey-dark)',
  },
  requestButtons: {
    display: 'flex',
    gap: 8,
  },
  statusBadge: (status) => ({
    fontWeight: 'var(--weight-bold)',
    color:
      status === 'accepted'
        ? 'var(--color-support-green)'
        : status === 'rejected' || status === 'declined'
        ? 'var(--color-grey-light)'
        : 'var(--color-orange)',
  }),
};
