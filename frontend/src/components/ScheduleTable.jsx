// ============================================================================
// SCHEDULE TABLE
// ----------------------------------------------------------------------------
// Covers US-01 (view schedule/backups/escalation points) and US-02 (clicking
// a team name shows that team's application list).
//
// Supports data from two endpoints:
//   - GET /public/oncall: Summary table (one row per team, right now only)
//   - GET /schedule: Upcoming rotation matrix (flat rows across all teams,
//     grouped by team_id client-side)
// ============================================================================

import Button from './ui/Button.jsx';
import { Table, Thead, Tbody, Tr, Th, Td } from './ui/Table.jsx';

const onCallCellStyle = {
  color: 'var(--color-orange)',
  fontWeight: 'var(--weight-bold)',
};

function formatDateStr(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// Extract summary rows from GET /public/oncall
function getSummaryTeams(onCallData, schedule) {
  const data = Array.isArray(onCallData) && onCallData.length > 0
    ? onCallData
    : (Array.isArray(schedule?.onCallData) ? schedule.onCallData : (Array.isArray(schedule) ? schedule : []));

  if (data.length === 0) return [];

  return data.map((item, idx) => ({
    teamId: item.team_id || item.teamId || `team-${idx}`,
    teamName: item.team_name || item.team || item.teamName || 'Team',
    onCallName: item.on_call_name || item.on_call_person || item.onCallName || 'Unassigned',
    onCallPhone: item.on_call_phone || item.onCallPhone || '-',
    backup: item.backup_name || item.on_call_backup || item.backup || '-',
    backupPhone: item.backup_phone || item.on_call_backup_phone || item.backupPhone || '-',
    escalation: item.manager_name || item.escalation || '-',
    escalationPhone: item.manager_phone || item.escalationPhone || '-',
  }));
}

// Extract upcoming rotation matrix rows from GET /schedule (grouped by team_id client-side)
function getUpcomingRotationTeams(upcomingSchedule, schedule) {
  const data = Array.isArray(upcomingSchedule) && upcomingSchedule.length > 0
    ? upcomingSchedule
    : (Array.isArray(schedule?.upcomingData) ? schedule.upcomingData : (Array.isArray(schedule) ? schedule : []));

  if (data.length === 0) return [];

  // Group flat rows by team_id
  const teamsMap = new Map();
  for (const row of data) {
    const tId = row.team_id || row.teamId || 'default';
    const tName = row.team_name || row.teamName || row.team || 'Team';

    if (!teamsMap.has(tId)) {
      teamsMap.set(tId, {
        teamId: tId,
        teamName: tName,
        weeks: [],
      });
    }

    const team = teamsMap.get(tId);
    const startStr = formatDateStr(row.start_dt);
    const endStr = formatDateStr(row.end_dt);
    const label = startStr && endStr
      ? `${startStr} - ${endStr}`
      : `Shift ${row.rn || (team.weeks.length + 1)}`;

    team.weeks.push({
      weekIndex: team.weeks.length,
      weekLabel: label,
      onCallName: row.on_call_name || row.onCallName || 'Unassigned',
      onCallPhone: row.on_call_phone || row.onCallPhone || '-',
    });
  }

  return Array.from(teamsMap.values());
}

export default function ScheduleTable({
  onCallData,
  upcomingSchedule,
  schedule,
  onTeamClick,
  canViewFullRotation,
}) {
  const summaryTeams = getSummaryTeams(onCallData, schedule);
  const rotationTeams = getUpcomingRotationTeams(upcomingSchedule, schedule);

  if (summaryTeams.length === 0 && rotationTeams.length === 0) {
    return <p>No teams have been configured yet.</p>;
  }

  const maxWeeks = rotationTeams.reduce((max, t) => Math.max(max, t.weeks.length), 0);
  const headerWeeks = rotationTeams.find((t) => t.weeks.length === maxWeeks)?.weeks || [];

  return (
    <div>
      <Table variant="grid">
        <Thead>
          <Tr>
            <Th style={{ whiteSpace: 'nowrap' }}>Team</Th>
            <Th style={{ whiteSpace: 'nowrap' }}>On call this week</Th>
            <Th style={{ whiteSpace: 'nowrap' }}>Contact</Th>
            <Th style={{ whiteSpace: 'nowrap' }}>Backup</Th>
            <Th style={{ whiteSpace: 'nowrap' }}>Contact</Th>
            <Th style={{ whiteSpace: 'nowrap' }}>Escalation</Th>
            <Th style={{ whiteSpace: 'nowrap' }}>Contact</Th>
          </Tr>
        </Thead>
        <Tbody>
          {summaryTeams.map((team, index) => (
            <Tr key={team.teamId || index} style={{ borderBottom: '1px solid var(--color-orange)' }}>
              <Td style={{ whiteSpace: 'nowrap' }}>
                <Button
                  variant="link"
                  onClick={() => onTeamClick && onTeamClick(team.teamId, team.teamName)}
                >
                  {team.teamName}
                </Button>
              </Td>
              <Td style={{ whiteSpace: 'nowrap', ...onCallCellStyle }}>
                {team.onCallName}
              </Td>
              <Td style={{ whiteSpace: 'nowrap' }}>{team.onCallPhone}</Td>
              <Td style={{ whiteSpace: 'nowrap' }}>{team.backup}</Td>
              <Td style={{ whiteSpace: 'nowrap' }}>{team.backupPhone}</Td>
              <Td style={{ whiteSpace: 'nowrap' }}>{team.escalation}</Td>
              <Td style={{ whiteSpace: 'nowrap' }}>{team.escalationPhone}</Td>
            </Tr>
          ))}
        </Tbody>
      </Table>

      {canViewFullRotation && rotationTeams.length > 0 && (
        <>
          <h3 style={{ marginTop: 32 }}>Upcoming rotation</h3>
          <Table variant="grid">
            <Thead>
              <Tr>
                <Th style={{ whiteSpace: 'nowrap' }}>Team</Th>
                {headerWeeks.map((week, i) => (
                  <Th
                    key={week.weekIndex ?? i}
                    style={{
                      whiteSpace: 'nowrap',
                      color: i === 0 ? 'var(--color-black)' : undefined,
                    }}
                  >
                    {week.weekLabel}
                  </Th>
                ))}
              </Tr>
            </Thead>
            <Tbody>
              {rotationTeams.map((team, index) => (
                <Tr key={team.teamId || index}>
                  <Td style={{ whiteSpace: 'nowrap' }}>{team.teamName}</Td>
                  {team.weeks.map((week, i) => (
                    <Td
                      key={week.weekIndex ?? i}
                      style={{
                        whiteSpace: 'nowrap',
                        ...(i === 0 ? onCallCellStyle : {}),
                      }}
                    >
                      {week.onCallName}
                    </Td>
                  ))}
                </Tr>
              ))}
            </Tbody>
          </Table>
        </>
      )}
    </div>
  );
}
