// ============================================================================
// PUBLIC SCHEDULE PAGE
// ----------------------------------------------------------------------------
// The app's default page (FE-01). No login required. Shows:
//   1. The on-call schedule table (US-01) with clickable team names (US-02)
//   2. The static team info table (US-03)
// ============================================================================

import { useEffect, useState } from 'react';
import { fetchOnCallDashboard, fetchStaticInfo } from '../services/api.js';
import ScheduleTable from '../components/ScheduleTable.jsx';
import TeamAppsModal from '../components/TeamAppsModal.jsx';
import StaticInfoTable from '../components/StaticInfoTable.jsx';

export default function PublicSchedulePage() {
  const [schedule, setSchedule] = useState([]);
  const [staticRows, setStaticRows] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // `selectedTeam` is null when no modal is open, otherwise
  // { teamId, teamName } for whichever team the user clicked.
  const [selectedTeam, setSelectedTeam] = useState(null);

  useEffect(() => {
    async function loadPageData() {
      setIsLoading(true);
      try {
        const [scheduleData, staticData] = await Promise.all([
          fetchOnCallDashboard(),
          fetchStaticInfo(),
        ]);
        setSchedule(scheduleData || []);
        setStaticRows(staticData || []);
      } catch (err) {
        console.error('Failed to load public schedule page:', err);
      } finally {
        setIsLoading(false);
      }
    }

    loadPageData();
  }, []);

  return (
    <main style={styles.main}>
      <section>
        <h1>On-call schedule</h1>
        <p style={styles.subtitle}>
          Who to call, and who's covering them, right now.
        </p>

        {isLoading ? (
          <p>Loading schedule…</p>
        ) : (
          <ScheduleTable
            onCallData={schedule}
            schedule={schedule}
            onTeamClick={(teamId, teamName) => setSelectedTeam({ teamId, teamName })}
          />
        )}
      </section>

      <section style={styles.section}>
        <h2>Static information</h2>
        {isLoading ? (
          <p>Loading team information…</p>
        ) : (
          <StaticInfoTable rows={staticRows} />
        )}
      </section>

      {selectedTeam && (
        <TeamAppsModal
          teamId={selectedTeam.teamId}
          teamName={selectedTeam.teamName}
          onClose={() => setSelectedTeam(null)}
        />
      )}
    </main>
  );
}

const styles = {
  main: {
    padding: '32px 24px',
    maxWidth: 1800,
    margin: '0 auto',
  },
  subtitle: {
    color: 'var(--color-grey-light)',
    marginTop: -8,
    marginBottom: 24,
  },
  section: {
    marginTop: 48,
  },
};