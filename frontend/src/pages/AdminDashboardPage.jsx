// ============================================================================
// ADMIN DASHBOARD
// ----------------------------------------------------------------------------
// FE-04. Covers:
//   US-05: manage current employees in my team, set active status + order
//   US-06: add a new employee to my team (name, email, phone, FTID, rotation number)
//   US-07: modify name/contact/email of an employee on my team
//   US-06b: add a new application to my team
// ============================================================================

import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import {
  fetchTeamEmployees,
  addEmployee,
  updateEmployee,
  deleteEmployee,
  fetchAllTeams,
  fetchSchedule,
  fetchOnCallDashboard,
  fetchTeamApps,
  addTeamApp,
  updateTeamApp,
  deleteTeamApp,
} from '../services/api.js';
import EmployeeForm from '../components/EmployeeForm.jsx';
import ApplicationForm from '../components/ApplicationForm.jsx';
import ScheduleTable from '../components/ScheduleTable.jsx';
import TeamAppsModal from '../components/TeamAppsModal.jsx';
import Button from '../components/ui/Button.jsx';
import { Table, Thead, Tbody, Tr, Th, Td } from '../components/ui/Table.jsx';
import Pagination from '../components/ui/Pagination.jsx';
import ExcelImportControl from '../components/ui/ExcelImportControl.jsx';
import PastSchedulesSection from '../components/PastSchedulesSection.jsx';

export default function AdminDashboardPage() {
  const { user } = useAuth();

  const [employees, setEmployees] = useState([]);
  const [teamApps, setTeamApps] = useState([]);
  const [teamName, setTeamName] = useState('');
  const [teamObj, setTeamObj] = useState(null);
  const [schedule, setSchedule] = useState({ onCallData: [], upcomingData: [] });
  const [isLoading, setIsLoading] = useState(true);

  const [editingEmployee, setEditingEmployee] = useState(null);
  const [editingApp, setEditingApp] = useState(null);
  const [appSearchTerm, setAppSearchTerm] = useState('');
  const [supportFilter, setSupportFilter] = useState('');

  const [rosterPage, setRosterPage] = useState(1);
  const [isTablesLoading, setIsTablesLoading] = useState(true);
  const [selectedTeam, setSelectedTeam] = useState(null);

  const userTeamId = user?.team_id ?? user?.teamId;
  const currentTeamId = userTeamId || teamObj?.team_id || teamObj?.id;

  // Bulk import handlers processing spreadsheet rows sequentially and counting outcomes for user feedback.
  async function handleImportTeamEmployees(rows) {
    let successCount = 0;
    let failCount = 0;
    for (const row of rows) {
      if (!row.emp_name || !row.ftid) continue;
      try {
        await addEmployee(
          {
            emp_name: row.emp_name,
            emp_mail: row.emp_mail || row.email || '',
            phone1: row.phone1 || row.phone || '',
            phone2: row.phone2 || null,
            ftid: row.ftid,
            teamId: currentTeamId,
            active_flg: String(row.active_flg).toLowerCase() !== 'false',
          },
          currentTeamId,
          user.role
        );
        successCount++;
      } catch (err) {
        failCount++;
      }
    }
    window.alert(`Team employees import complete. Success: ${successCount}, Failed: ${failCount}`);
    reload();
  }

  async function handleImportTeamApps(rows) {
    let successCount = 0;
    let failCount = 0;
    for (const row of rows) {
      if (!row.application_name) continue;
      try {
        await addTeamApp(
          {
            application_name: row.application_name,
            sla: row.sla || '',
            basicat: row.basicat || '',
            cartoo_id: row.cartoo_id || row.cartoid || '',
          },
          currentTeamId
        );
        successCount++;
      } catch (err) {
        failCount++;
      }
    }
    window.alert(`Team applications import complete. Success: ${successCount}, Failed: ${failCount}`);
    reload();
  }

  // Reloads team data by dynamically matching team manager ID if user.team_id is not directly set on profile.
  async function reload() {
    setIsLoading(true);
    try {
      const allTeams = await fetchAllTeams().catch(() => []);
      let myTeam = null;
      if (userTeamId) {
        myTeam = (allTeams || []).find((t) => Number(t.team_id ?? t.id) === Number(userTeamId));
      }
      if (!myTeam && user?.emp_id) {
        myTeam = (allTeams || []).find((t) => Number(t.manager_emp_id) === Number(user.emp_id));
      }

      setTeamObj(myTeam || null);
      setTeamName(myTeam?.team_name ?? myTeam?.name ?? '');

      const targetId = userTeamId || myTeam?.team_id || myTeam?.id;

      if (targetId) {
        const [teamEmployees, appsData] = await Promise.all([
          fetchTeamEmployees(targetId).catch(() => []),
          fetchTeamApps(targetId).catch(() => []),
        ]);
        setEmployees(teamEmployees || []);
        setTeamApps(appsData || myTeam?.apps || []);
      } else {
        setEmployees([]);
        setTeamApps([]);
      }
      await loadTables(targetId);
    } catch (err) {
      console.error('Failed to reload admin dashboard:', err);
    } finally {
      setIsLoading(false);
    }
  }

  async function loadTables(targetId) {
    setIsTablesLoading(true);
    try {
      const [onCallData, upcomingData] = await Promise.all([
        fetchOnCallDashboard().catch(() => []),
        fetchSchedule().catch(() => []),
      ]);
      const filterId = targetId || currentTeamId;
      const filteredOnCall = filterId
        ? (onCallData || []).filter((item) => Number(item.team_id ?? item.teamId) === Number(filterId))
        : (onCallData || []);
      const filteredUpcoming = filterId
        ? (upcomingData || []).filter((item) => Number(item.team_id ?? item.teamId) === Number(filterId))
        : (upcomingData || []);

      setSchedule({
        onCallData: filteredOnCall,
        upcomingData: filteredUpcoming,
      });
    } catch (err) {
      console.error('Failed to load admin schedule table:', err);
    } finally {
      setIsTablesLoading(false);
    }
  }

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userTeamId, user?.emp_id]);

  async function handleSubmit(values) {
    if (editingEmployee === 'new') {
      await addEmployee({ ...values, teamId: currentTeamId }, currentTeamId, user.role);
    } else {
      await updateEmployee(
        { ...values, id: editingEmployee.id || editingEmployee.emp_id },
        currentTeamId,
        user.role
      );
    }
    setEditingEmployee(null);
    reload();
  }

  async function handleToggleActive(employee) {
    const empId = employee.id || employee.emp_id;
    const empName = employee.emp_name || employee.name;
    const isActive = employee.active_flg ?? employee.active ?? true;
    const actionText = isActive ? 'deactivate' : 'activate';
    const confirmed = window.confirm(
      `Are you sure you want to ${actionText} ${empName}?`
    );
    if (!confirmed) return;

    try {
      await updateEmployee(
        { ...employee, id: empId, active_flg: !isActive },
        currentTeamId,
        user.role
      );
      reload();
    } catch (err) {
      window.alert(err.message || `Failed to ${actionText} employee.`);
    }
  }

  async function handleAppSubmit(values) {
    try {
      if (editingApp === 'new') {
        await addTeamApp(values, currentTeamId);
      } else {
        await updateTeamApp(currentTeamId, { ...values, id: editingApp.id || editingApp.application_id });
      }
      setEditingApp(null);
      reload();
    } catch (err) {
      window.alert(err.message);
    }
  }

  async function handleRemoveApp(app) {
    const appName = app.application_name || app.name;
    const confirmed = window.confirm(
      `Remove ${appName} from the team? This can't be undone.`
    );
    if (!confirmed) return;

    await deleteTeamApp(currentTeamId, app.application_id || app.id);
    reload();
  }

  const sortedEmployees = [...employees].sort(
    (a, b) => (a.def_oncall_ord ?? a.order ?? 0) - (b.def_oncall_ord ?? b.order ?? 0)
  );

  const searchTerm = appSearchTerm.trim().toLowerCase();
  const selectedSupport = supportFilter.toLowerCase();
  const filteredTeamApps = teamApps.filter((app) => {
    const searchableValues = [
      app.application_name || app.name,
      app.cartoo_id || app.cartoId,
      app.basicat,
      app.support,
    ].map((value) => String(value || '').toLowerCase());
    const appSupport = String(app.support || '').toLowerCase();
    const matchesSearch =
      !searchTerm || searchableValues.some((value) => value.includes(searchTerm));
    const matchesSupport = !selectedSupport || appSupport === selectedSupport;

    return matchesSearch && matchesSupport;
  });

  return (
    <main style={styles.main}>
      <h1>Admin dashboard</h1>
      <p style={styles.subtitle}>
        Managing roster, applications, and schedule for{' '}
        <strong>{teamName || 'your team'}</strong>.
      </p>

      {!editingEmployee && (
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 16 }}>
          <Button onClick={() => setEditingEmployee('new')}>+ Add employee</Button>
          <ExcelImportControl
            templateFilename="team_employees_template.xlsx"
            headers={[
              'Employee Name',
              'Email',
              'Phone 1',
              'Phone 2 (or N/A)',
              'FTID',
              'Active in Rotation (true/false)',
            ]}
            sampleRows={[
              {
                'Employee Name': 'Jane Doe',
                'Email': 'jane@company.com',
                'Phone 1': '01087654321',
                'Phone 2 (or N/A)': 'N/A',
                'FTID': 'FT9002',
                'Active in Rotation (true/false)': 'true',
              },
            ]}
            type="employee"
            onImportRows={handleImportTeamEmployees}
            label="team employees"
          />
        </div>
      )}

      {editingEmployee && (
        <div style={styles.formCard}>
          <h3>{editingEmployee === 'new' ? 'Add employee' : 'Edit employee'}</h3>
          <EmployeeForm
            initialValues={editingEmployee === 'new' ? null : editingEmployee}
            teams={[{ id: currentTeamId, name: teamName || 'My Team' }]}
            lockTeam
            userRole="admin"
            teammates={employees}
            onSubmit={handleSubmit}
            onCancel={() => setEditingEmployee(null)}
          />
        </div>
      )}

      <h2 style={{ marginTop: 32 }}>Team roster</h2>
      {isLoading ? (
        <p>Loading…</p>
      ) : (
        <>
          <Table>
            <Thead>
              <Tr>
                <Th>Order</Th>
                <Th>Name</Th>
                <Th>FTID</Th>
                <Th>Email</Th>
                <Th>Phone</Th>
                <Th>Active</Th>
                <Th></Th>
              </Tr>
            </Thead>
            <Tbody>
              {sortedEmployees.slice((rosterPage - 1) * 10, rosterPage * 10).map((employee, idx) => {
                const empId = employee.emp_id ?? employee.id ?? idx;
                const order = employee.def_oncall_ord ?? employee.order;
                const empName = employee.emp_name ?? employee.name;
                const email = employee.emp_mail ?? employee.email ?? '—';
                const phone = employee.phone1 ?? employee.phone ?? '—';
                const isActive = employee.active_flg ?? employee.active;
                const isManager = Boolean(
                  teamObj?.manager_emp_id && Number(teamObj.manager_emp_id) === Number(empId)
                );
                const empTeamId = employee.team_id ?? employee.teamId;
                const isUnassignedOrInactive = (!empTeamId && !isManager) || !isActive;
                return (
                  <Tr key={empId}>
                    <Td>
                      {isManager ? (
                        <span style={{ color: 'var(--color-grey-light)', fontSize: 13 }}>Manager (N/A)</span>
                      ) : isUnassignedOrInactive ? (
                        <span style={{ color: 'var(--color-grey-light)', fontSize: 13 }}>N/A</span>
                      ) : (
                        <input
                          type="number"
                          min="1"
                          style={styles.orderInput}
                          defaultValue={order ?? idx + 1}
                          onBlur={async (e) => {
                            const newOrder = Number(e.target.value);
                            if (isNaN(newOrder) || newOrder === order || newOrder < 1) {
                              e.target.value = order ?? idx + 1;
                              return;
                            }
                            const targetSwapEmp = sortedEmployees.find(
                              (emp) => Number(emp.def_oncall_ord ?? emp.order) === newOrder
                            );
                            const swapName = targetSwapEmp
                              ? (targetSwapEmp.emp_name || targetSwapEmp.name)
                              : `position ${newOrder}`;
                            const confirmed = window.confirm(
                              targetSwapEmp
                                ? `Change rotation order for ${empName} to ${newOrder}? This will swap order positions with ${swapName}.`
                                : `Change rotation order for ${empName} to ${newOrder}?`
                            );
                            if (!confirmed) {
                              e.target.value = order ?? idx + 1;
                              return;
                            }
                            try {
                              await updateEmployee(
                                { ...employee, id: empId, def_oncall_ord: newOrder },
                                currentTeamId,
                                user.role
                              );
                              reload();
                            } catch (err) {
                              window.alert(err.message || 'Failed to update rotation order.');
                              e.target.value = order ?? idx + 1;
                            }
                          }}
                        />
                      )}
                    </Td>
                    <Td>{empName}</Td>
                    <Td>{employee.ftid || '—'}</Td>
                    <Td>{email}</Td>
                    <Td>{phone}</Td>
                    <Td>{isActive ? 'Yes' : 'No'}</Td>
                    <Td>
                      <Button variant="link" onClick={() => setEditingEmployee(employee)}>
                        Edit
                      </Button>
                      <Button
                        variant="link"
                        tone={isActive ? 'muted' : 'default'}
                        style={{ marginLeft: 16 }}
                        onClick={() => handleToggleActive(employee)}
                      >
                        {isActive ? 'Deactivate' : 'Activate'}
                      </Button>
                    </Td>
                  </Tr>
                );
              })}
            </Tbody>
          </Table>
          <Pagination
            currentPage={rosterPage}
            totalPages={Math.ceil(sortedEmployees.length / 10)}
            onPageChange={setRosterPage}
          />
        </>
      )}

      <h2 style={{ marginTop: 40 }}>Applications</h2>
      <p style={styles.subtitle}>Applications managed by {teamName || 'your team'}.</p>

      {!editingApp && (
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 16 }}>
          <Button onClick={() => setEditingApp('new')}>
            + Add application
          </Button>
          <ExcelImportControl
            templateFilename="team_applications_template.xlsx"
            headers={['Application Name', 'SLA', 'Basicat', 'Cartoo ID (5 chars)']}
            sampleRows={[
              {
                'Application Name': 'Team App',
                'SLA': '99.9%',
                'Basicat': 'CAT01',
                'Cartoo ID (5 chars)': '12345',
              },
            ]}
            type="application"
            onImportRows={handleImportTeamApps}
            label="team applications"
          />
        </div>
      )}

      {editingApp && (
        <div style={styles.formCard}>
          <h3>{editingApp === 'new' ? 'Add application' : 'Edit application'}</h3>
          <ApplicationForm
            initialValues={editingApp === 'new' ? null : editingApp}
            onSubmit={handleAppSubmit}
            onCancel={() => setEditingApp(null)}
          />
        </div>
      )}

      {teamApps.length === 0 ? (
        <p style={{ marginTop: 12 }}>No applications added yet.</p>
      ) : (
        <>
          <input
            type="text"
            placeholder="Search by (name, basicat, cartoo, support)..."
            value={appSearchTerm}
            onChange={(e) => setAppSearchTerm(e.target.value)}
            style={styles.searchInput}
          />



<select

  value={supportFilter}

  onChange={(e) => setSupportFilter(e.target.value)}

>

  <option value="">All Support</option>

  <option value="Infra">Infra</option>

  <option value="Ops">Ops</option>

  <option value="Both">Both</option>

</select>
          {filteredTeamApps.length === 0 ? (
            <p style={{ marginTop: 12 }}>No matching applications found.</p>
          ) : (
            <Table style={{ marginTop: 12 }}>
              <Thead>
                <Tr>
                  <Th>Application name</Th>
                  <Th>SLA</Th>
                  <Th>Basicat</Th>
                  <Th>Carto ID</Th>
                  <Th>Support</Th>
                  <Th></Th>
                </Tr>
              </Thead>
              <Tbody>
                {filteredTeamApps.map((app, idx) => {
                    const appId = app.application_id ?? app.id ?? idx;
                    const appName = app.application_name ?? app.name;
                    const cartoId = app.cartoo_id ?? app.cartoId;
                    return (
                      <Tr key={appId}>
                        <Td>{appName}</Td>
                        <Td>{app.sla || '—'}</Td>
                        <Td>{app.basicat || '—'}</Td>
                        <Td>{cartoId || '—'}</Td>
                        <Td>{app.support || '—'}</Td>
                        <Td>
                          <Button variant="link" onClick={() => setEditingApp(app)}>
                            Edit
                          </Button>
                          <Button
                            variant="link"
                            tone="muted"
                            style={{ marginLeft: 16 }}
                            onClick={() => handleRemoveApp(app)}
                          >
                            Remove
                          </Button>
                        </Td>
                      </Tr>
                    );
                  })}
              </Tbody>
            </Table>
          )}
        </>
      )}

      <PastSchedulesSection isSuperAdmin={false} currentTeamId={currentTeamId} />

      <h2 style={{ marginTop: 40 }}>On-call summary &amp; full rotation</h2>
      {isTablesLoading ? (
        <p>Loading schedule…</p>
      ) : (
        <ScheduleTable
          onCallData={schedule?.onCallData}
          upcomingSchedule={schedule?.upcomingData}
          schedule={schedule}
          onTeamClick={(teamId, teamName) => setSelectedTeam({ teamId, teamName })}
          canViewFullRotation
        />
      )}

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
  main: { padding: '32px 24px', maxWidth: 1200, margin: '0 auto' },
  subtitle: { color: 'var(--color-grey-light)', marginTop: -8, marginBottom: 24 },
  formCard: {
    backgroundColor: 'var(--color-surface)',
    border: '1px solid var(--color-orange)',
    padding: 24,
    marginBottom: 24,
  },
  orderInput: {
    width: 60,
    backgroundColor: 'var(--color-black)',
    border: '1px solid var(--color-grey)',
    color: 'var(--color-white)',
    padding: '4px 6px',
    fontFamily: 'inherit',
    fontSize: 14,
  },
  searchInput: {
    width: '100%',
    backgroundColor: 'var(--color-black)',
    border: '1px solid var(--color-grey)',
    color: 'var(--color-white)',
    padding: '8px 12px',
    fontFamily: 'inherit',
    fontSize: 14,
    marginTop: 12,
    marginBottom: 16,
    boxSizing: 'border-box',
  },
};
