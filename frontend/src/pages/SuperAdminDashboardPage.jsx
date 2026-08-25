// ============================================================================
// SUPER ADMIN DASHBOARD
// ----------------------------------------------------------------------------
// FE-05. Super admin capabilities across ALL teams:
//   US-08: Create and edit teams (name, manager, apps)
//   US-09: Assign/remove apps to/from teams
//   US-10: Global employee management across all teams
//   US-11: Global static info management
// ============================================================================

import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import {
  fetchAllTeams,
  createTeam,
  updateTeam,
  deleteTeam,
  fetchAllEmployees,
  addEmployee,
  updateEmployee,
  deleteEmployee,
  fetchAvailableAdmins,
  fetchAllApplications,
  addApplication,
  updateApplication,
  deleteApplication,
  addTeamApp,
  updateTeamApp,
  deleteTeamApp,
  fetchStaticInfo,
  addStaticInfoRow,
  updateStaticInfoRow,
  deleteStaticInfoRow,
} from '../services/api.js';
import TeamForm from '../components/TeamForm.jsx';
import EmployeeForm from '../components/EmployeeForm.jsx';
import ApplicationForm from '../components/ApplicationForm.jsx';
import StaticRowForm from '../components/StaticRowForm.jsx';
import Button from '../components/ui/Button.jsx';
import { Table, Thead, Tbody, Tr, Th, Td } from '../components/ui/Table.jsx';
import Pagination from '../components/ui/Pagination.jsx';
import ExcelImportControl from '../components/ui/ExcelImportControl.jsx';
import PastSchedulesSection from '../components/PastSchedulesSection.jsx';

export default function SuperAdminDashboardPage() {
  const { user } = useAuth();

  const [teams, setTeams] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [availableAdmins, setAvailableAdmins] = useState([]);
  const [allApplications, setAllApplications] = useState([]);
  const [staticRows, setStaticRows] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // Search state
  const [appSearchTerm, setAppSearchTerm] = useState('');

  // Pagination states
  const [teamsPage, setTeamsPage] = useState(1);
  const [appsPage, setAppsPage] = useState(1);
  const [empPage, setEmpPage] = useState(1);

  // Active edit states
  const [editingTeam, setEditingTeam] = useState(null);
  const [editingEmployee, setEditingEmployee] = useState(null);
  const [editingApp, setEditingApp] = useState(null);
  const [editingStaticRow, setEditingStaticRow] = useState(null);

  // Which team's inline app manager is expanded
  const [managingAppsForTeam, setManagingAppsForTeam] = useState(null);

  async function reload() {
    setIsLoading(true);
    try {
      const [teamsData, employeesData, appsData, staticData] = await Promise.all([
        fetchAllTeams().catch(() => []),
        fetchAllEmployees().catch(() => []),
        fetchAllApplications().catch(() => []),
        fetchStaticInfo().catch(() => []),
      ]);
      setTeams(teamsData || []);
      setEmployees(employeesData || []);
      setAllApplications(appsData || []);
      setStaticRows(staticData || []);
    } catch (err) {
      console.error('Failed to reload super admin dashboard:', err);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    reload();
  }, []);

  useEffect(() => {
    if (editingTeam) {
      const excludeId = editingTeam !== 'new-team' ? (editingTeam.team_id || editingTeam.id) : null;
      fetchAvailableAdmins(excludeId)
        .then((admins) => setAvailableAdmins(admins || []))
        .catch(() => setAvailableAdmins([]));
    }
  }, [editingTeam]);

  // Bulk import handlers
  async function handleImportTeams(rows) {
    let successCount = 0;
    let failCount = 0;
    for (const row of rows) {
      if (!row.team_name) continue;
      try {
        let managerEmpId = null;
        if (row.manager_ftid || row.manager_emp_id || row.manager) {
          const mgrTerm = String(row.manager_ftid || row.manager_emp_id || row.manager).toLowerCase().trim();
          const mgrEmp = employees.find(
            (e) =>
              (e.ftid && String(e.ftid).toLowerCase().trim() === mgrTerm) ||
              (e.emp_name && String(e.emp_name).toLowerCase().trim() === mgrTerm) ||
              String(e.emp_id || e.id) === mgrTerm
          );
          if (mgrEmp) {
            managerEmpId = Number(mgrEmp.emp_id || mgrEmp.id);
          }
        }

        const rawStDate = row.cycle_st_day || row['cycle_st_day_(dd/mm/yyyy)'] || row.cycle_st_date || row.start_date || new Date().toISOString().split('T')[0];

        await createTeam({
          team_name: row.team_name,
          email: row.email || row.team_email || null,
          cycle_day: Number(row.cycle_day || 7),
          cycle_st_day: rawStDate,
          manager_emp_id: managerEmpId,
        });
        successCount++;
      } catch (err) {
        console.error('Failed to import team row:', row, err);
        failCount++;
      }
    }
    window.alert(`Teams import complete. Success: ${successCount}, Failed: ${failCount}`);
    reload();
  }

  async function handleImportApplications(rows) {
    let successCount = 0;
    let failCount = 0;
    for (const row of rows) {
      if (!row.application_name) continue;
      try {
        let teamIdVal = null;
        if (row.team_name || row.team) {
          const matchTeam = teams.find(
            (t) =>
              (t.name || t.team_name || '').toLowerCase() === (row.team_name || row.team || '').toLowerCase()
          );
          if (matchTeam) teamIdVal = matchTeam.id || matchTeam.team_id;
        }

        await addApplication({
          application_name: row.application_name,
          sla: row.sla || '',
          basicat: row.basicat || '',
          cartoo_id: row.cartoo_id || row.cartoid || '',
          support: row.support || '',
          team_id: teamIdVal,
        });
        successCount++;
      } catch (err) {
        console.error('Failed to import application row:', row, err);
        failCount++;
      }
    }
    window.alert(`Applications import complete. Success: ${successCount}, Failed: ${failCount}`);
    reload();
  }

  async function handleImportEmployees(rows) {
    let successCount = 0;
    let failCount = 0;
    for (const row of rows) {
      if (!row.emp_name || !row.ftid) continue;
      try {
        let teamIdVal = null;
        if (row.team_name || row.team) {
          const matchTeam = teams.find(
            (t) =>
              (t.name || t.team_name || '').toLowerCase() === (row.team_name || row.team || '').toLowerCase()
          );
          if (matchTeam) teamIdVal = matchTeam.id || matchTeam.team_id;
        }

        await addEmployee(
          {
            emp_name: row.emp_name,
            emp_mail: row.emp_mail || row.email || '',
            phone1: row.phone1 || row.phone || '',
            phone2: row.phone2 || null,
            ftid: row.ftid,
            team_id: teamIdVal,
            role: row.role || 'user',
            active_flg: String(row.active_flg).toLowerCase() !== 'false',
          },
          teamIdVal,
          user.role
        );
        successCount++;
      } catch (err) {
        failCount++;
      }
    }
    window.alert(`Employees import complete. Success: ${successCount}, Failed: ${failCount}`);
    reload();
  }

  async function handleTeamSubmit(values) {
    if (editingTeam === 'new-team') {
      await createTeam(values);
    } else {
      await updateTeam({ ...values, id: editingTeam.id || editingTeam.team_id });
    }
    setEditingTeam(null);
    reload();
  }

  async function handleRemoveTeam(team) {
    const confirmed = window.confirm(
      `Remove ${team.name || team.team_name}? Employees on this team will be left unassigned. This can't be undone.`
    );
    if (!confirmed) return;

    await deleteTeam(team.id || team.team_id);
    if (managingAppsForTeam === (team.id || team.team_id)) setManagingAppsForTeam(null);
    reload();
  }

  async function handleEmployeeSubmit(values) {
    if (editingEmployee === 'new') {
      await addEmployee(values, null, user.role);
    } else {
      await updateEmployee({ ...values, id: editingEmployee.id || editingEmployee.emp_id }, null, user.role);
    }
    setEditingEmployee(null);
    reload();
  }

  async function handleToggleActiveEmployee(employee) {
    const empId = employee.id || employee.emp_id;
    const empName = employee.emp_name || employee.name;
    const empTeamId = employee.team_id || employee.teamId;
    const isActive = employee.active_flg ?? employee.active ?? true;
    const actionText = isActive ? 'deactivate' : 'activate';
    const confirmed = window.confirm(
      `Are you sure you want to ${actionText} ${empName}?`
    );
    if (!confirmed) return;

    try {
      await updateEmployee(
        { ...employee, id: empId, active_flg: !isActive },
        empTeamId,
        user.role
      );
      reload();
    } catch (err) {
      window.alert(err.message || `Failed to ${actionText} employee.`);
    }
  }

  async function handleAppSubmit(values) {
    try {
      const teamValues = { ...values, team_id: managingAppsForTeam };
      if (editingApp === 'new') {
        await addTeamApp(teamValues);
      } else {
        await updateTeamApp(managingAppsForTeam, {
          ...teamValues,
          id: editingApp.id || editingApp.application_id,
        });
      }
      setEditingApp(null);
      reload();
    } catch (err) {
      window.alert(err.message);
    }
  }

  async function handleGlobalAppSubmit(values) {
    try {
      if (editingApp === 'new-global') {
        await addApplication(values);
      } else {
        await updateApplication({ ...values, id: editingApp.id || editingApp.application_id });
      }
      setEditingApp(null);
      reload();
    } catch (err) {
      window.alert(err.message);
    }
  }

  async function handleRemoveApp(team, app) {
    const confirmed = window.confirm(
      `Remove ${app.name || app.application_name} from ${team.name || team.team_name}? This can't be undone.`
    );
    if (!confirmed) return;

    await deleteTeamApp(team.id || team.team_id, app.id || app.application_id);
    reload();
  }

  async function handleRemoveGlobalApp(app) {
    const confirmed = window.confirm(
      `Remove application ${app.application_name || app.name}? This can't be undone.`
    );
    if (!confirmed) return;

    await deleteApplication(app.id || app.application_id);
    reload();
  }

  async function handleStaticRowSubmit(row) {
    if (editingStaticRow === 'new') {
      await addStaticInfoRow(row);
    } else {
      await updateStaticInfoRow({ ...row, id: editingStaticRow.id || editingStaticRow.info_id });
    }
    setEditingStaticRow(null);
    reload();
  }

  async function handleRemoveStaticRow(row) {
    const confirmed = window.confirm(`Remove static info row for ${row.team_name || row.teamName}?`);
    if (!confirmed) return;

    await deleteStaticInfoRow(row.id || row.info_id);
    reload();
  }

  const teamsWithApps = teams.map((team) => {
    const teamId = team.team_id || team.id;
    const teamApps = (allApplications || []).filter(
      (app) => (app.team_id || app.teamId) === teamId
    );
    return {
      ...team,
      id: teamId,
      name: team.team_name || team.name,
      apps: team.apps || teamApps,
    };
  });

  const managingTeam = teamsWithApps.find((t) => t.id === managingAppsForTeam);

  const sortedEmployees = [...employees].sort((a, b) => {
    const teamDiff = (a.team_id || 0) - (b.team_id || 0);
    if (teamDiff !== 0) return teamDiff;
    return (a.def_oncall_ord ?? a.order ?? 0) - (b.def_oncall_ord ?? b.order ?? 0);
  });

  return (
    <main style={styles.main}>
      <h1>Super admin dashboard</h1>
      <p style={styles.subtitle}>
        Global controls across all teams, employees, applications, and static information.
      </p>

      {/* ---------------- Teams section (US-08) ---------------- */}
      <section style={styles.section}>
        <h2>Teams</h2>

        {!editingTeam && (
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: 16 }}>
            <Button onClick={() => setEditingTeam('new-team')}>
              + Create new team
            </Button>
            <ExcelImportControl
              templateFilename="teams_template.xlsx"
              headers={['Team Name', 'Team Email', 'Manager FTID (or N/A)', 'Rotation Cycle (Days)', 'Cycle Start Date (DD/MM/YYYY)']}
              sampleRows={[
                {
                  'Team Name': 'Core Operations',
                  'Team Email': 'core.operations@orange.com',
                  'Manager FTID (or N/A)': 'FT001',
                  'Rotation Cycle (Days)': '7',
                  'Cycle Start Date (DD/MM/YYYY)': '01/08/2026',
                },
                {
                  'Team Name': 'Infrastructure',
                  'Team Email': 'infrastructure@orange.com',
                  'Manager FTID (or N/A)': 'N/A',
                  'Rotation Cycle (Days)': '14',
                  'Cycle Start Date (DD/MM/YYYY)': '01/08/2026',
                },
              ]}
              type="team"
              onImportRows={handleImportTeams}
              label="teams"
            />
          </div>
        )}

        {editingTeam && (
          <div style={styles.formCard}>
            <h3>{editingTeam === 'new-team' ? 'Create team' : 'Edit team'}</h3>
            <TeamForm
              initialValues={editingTeam === 'new-team' ? null : editingTeam}
              availableAdmins={availableAdmins}
              allApplications={allApplications}
              onSubmit={handleTeamSubmit}
              onCancel={() => setEditingTeam(null)}
            />
          </div>
        )}

        <Table>
          <Thead>
            <Tr>
              <Th>Team name</Th>
              <Th>Team email</Th>
              <Th>Manager name</Th>
              <Th></Th>
            </Tr>
          </Thead>
          <Tbody>
            {teamsWithApps
              .slice((teamsPage - 1) * 10, teamsPage * 10)
              .map((team) => {
                const managerObj = employees.find(
                  (emp) => Number(emp.emp_id || emp.id) === Number(team.manager_emp_id)
                );
                const managerName = team.manager_name || managerObj?.emp_name || managerObj?.name || '—';
                return (
                  <Tr key={team.id}>
                    <Td>{team.name}</Td>
                    <Td>{team.email || '—'}</Td>
                    <Td>{managerName}</Td>
                    <Td>
                      <Button variant="link" onClick={() => setEditingTeam(team)}>
                        Edit
                      </Button>
                      <Button
                        variant="link"
                        style={{ marginLeft: 16 }}
                        onClick={() =>
                          setManagingAppsForTeam(
                            managingAppsForTeam === team.id ? null : team.id
                          )
                        }
                      >
                        {managingAppsForTeam === team.id ? 'Hide apps' : 'Manage apps'}
                      </Button>
                      <Button
                        variant="link"
                        tone="muted"
                        style={{ marginLeft: 16 }}
                        onClick={() => handleRemoveTeam(team)}
                      >
                        Remove
                      </Button>
                    </Td>
                  </Tr>
                );
              })}
          </Tbody>
        </Table>
        <Pagination
          currentPage={teamsPage}
          totalPages={Math.ceil(teamsWithApps.length / 10)}
          onPageChange={setTeamsPage}
        />

        {/* Expanded application manager for whichever team's "Manage apps" was clicked */}
        {managingTeam && (
          <div style={styles.formCard}>
            <h3>Applications - {managingTeam.name}</h3>

            {!editingApp && (
              <Button style={{ marginBottom: 16 }} onClick={() => setEditingApp('new')}>
                + Add application
              </Button>
            )}

            {editingApp && (
              <div style={{ marginBottom: 16 }}>
                <ApplicationForm
                  initialValues={editingApp === 'new' ? null : editingApp}
                  onSubmit={handleAppSubmit}
                  onCancel={() => setEditingApp(null)}
                />
              </div>
            )}

            {(managingTeam.apps || []).length === 0 ? (
              <p>No applications added yet.</p>
            ) : (
              <Table>
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
                  {managingTeam.apps.map((app, idx) => (
                    <Tr key={app.id || app.application_id || idx}>
                      <Td>{app.application_name || app.name}</Td>
                      <Td>{app.sla || '—'}</Td>
                      <Td>{app.basicat || '—'}</Td>
                      <Td>{app.cartoo_id || app.cartoId || '—'}</Td>
                      <Td>{app.support || '—'}</Td>
                      <Td>
                        <Button variant="link" onClick={() => setEditingApp(app)}>
                          Edit
                        </Button>
                        <Button
                          variant="link"
                          tone="muted"
                          style={{ marginLeft: 16 }}
                          onClick={() => handleRemoveApp(managingTeam, app)}
                        >
                          Remove
                        </Button>
                      </Td>
                    </Tr>
                  ))}
                </Tbody>
              </Table>
            )}
          </div>
        )}
      </section>

      {/* ---------------- Applications section ---------------- */}
      <section style={styles.section}>
        <h2>All applications</h2>
        {!editingApp && (
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: 16 }}>
            <Button onClick={() => setEditingApp('new-global')}>
              + Create new application
            </Button>
            <ExcelImportControl
              templateFilename="applications_template.xlsx"
              headers={[
                'Application Name',
                'SLA',
                'Basicat',
                'Cartoo ID (5 chars)',
                'Support',
                'Team Name (or N/A)',
              ]}
              sampleRows={[
                {
                  'Application Name': 'Customer Portal',
                  'SLA': '99.9%',
                  'Basicat': 'CAT01',
                  'Cartoo ID (5 chars)': '12345',
                  'Support': 'Infra',
                  'Team Name (or N/A)': 'Core Operations',
                },
                {
                  'Application Name': 'Billing Engine',
                  'SLA': '99.5%',
                  'Basicat': 'N/A',
                  'Cartoo ID (5 chars)': '67890',
                  'Support': 'Ops',
                  'Team Name (or N/A)': 'N/A',
                },
              ]}
              type="application"
              onImportRows={handleImportApplications}
              label="applications"
            />
          </div>
        )}

        {editingApp && (
          <div style={styles.formCard}>
            <h3>{editingApp === 'new-global' ? 'Create application' : 'Edit application'}</h3>
            <ApplicationForm
              initialValues={editingApp === 'new-global' ? null : editingApp}
              onSubmit={handleGlobalAppSubmit}
              onCancel={() => setEditingApp(null)}
              teams={teams}
              showTeamSelect
            />
          </div>
        )}

        <input
          type="text"
          placeholder="Search by (name, basicat, cartoo, support)..."
          value={appSearchTerm}
          onChange={(e) => {
            setAppSearchTerm(e.target.value);
            setAppsPage(1);
          }}
          style={styles.searchInput}
        />

        {(() => {
          const filteredGlobalApps = allApplications.filter((app) => {
            if (!appSearchTerm.trim()) return true;
            const term = appSearchTerm.toLowerCase();
            const name = (app.application_name || app.name || '').toLowerCase();
            const cartooId = (app.cartoo_id || app.cartoId || '').toLowerCase();
            const basicat = (app.basicat || '').toLowerCase();
            const support = (app.support || '').toLowerCase();
            return (
  name.includes(term) ||
  cartooId.includes(term) ||
  basicat.includes(term) ||
  support.includes(term)
);

          });
          const totalAppsPages = Math.ceil(filteredGlobalApps.length / 10);
          const paginatedApps = filteredGlobalApps.slice((appsPage - 1) * 10, appsPage * 10);

          if (filteredGlobalApps.length === 0) {
            return <p style={{ marginTop: 12 }}>No matching applications found.</p>;
          }

          return (
            <>
              <Table>
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
                  {paginatedApps.map((app, idx) => (
                    <Tr key={app.application_id || app.id || idx}>
                      <Td>{app.application_name || app.name}</Td>
                      <Td>{app.sla || '—'}</Td>
                      <Td>{app.basicat || '—'}</Td>
                      <Td>{app.cartoo_id || app.cartoId || '—'}</Td>
                      <Td>{app.support || '—'}</Td>
                      <Td>
                        <Button variant="link" onClick={() => setEditingApp(app)}>
                          Edit
                        </Button>
                        <Button
                          variant="link"
                          tone="muted"
                          style={{ marginLeft: 16 }}
                          onClick={() => handleRemoveGlobalApp(app)}
                        >
                          Remove
                        </Button>
                      </Td>
                    </Tr>
                  ))}
                </Tbody>
              </Table>
              <Pagination
                currentPage={appsPage}
                totalPages={totalAppsPages}
                onPageChange={setAppsPage}
              />
            </>
          );
        })()}
      </section>

      {/* ---------------- Employees section (US-10) ---------------- */}
      <section style={styles.section}>
        <h2>Employees across all teams</h2>

        {!editingEmployee && (
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: 16 }}>
            <Button onClick={() => setEditingEmployee('new')}>
              + Add employee
            </Button>
            <ExcelImportControl
              templateFilename="employees_template.xlsx"
              headers={[
                'Employee Name',
                'Email',
                'Phone 1',
                'Phone 2 (or N/A)',
                'FTID',
                'Role (user/admin/super_admin)',
                'Active in Rotation (true/false)',
              ]}
              sampleRows={[
                {
                  'Employee Name': 'Jane Doe',
                  'Email': 'jane@company.com',
                  'Phone 1': '01012345678',
                  'Phone 2 (or N/A)': 'N/A',
                  'FTID': 'FT9001',
                  'Role (user/admin/super_admin)': 'user',
                  'Active in Rotation (true/false)': 'true',
                },
              ]}
              type="employee"
              onImportRows={handleImportEmployees}
              label="employees"
            />
          </div>
        )}

        {editingEmployee && (
          <div style={styles.formCard}>
            <h3>{editingEmployee === 'new' ? 'Add employee' : 'Edit employee'}</h3>
            <EmployeeForm
              initialValues={editingEmployee === 'new' ? null : editingEmployee}
              teams={teamsWithApps}
              lockTeam={false}
              userRole={user?.role}
              teammates={employees}
              onSubmit={handleEmployeeSubmit}
              onCancel={() => setEditingEmployee(null)}
            />
          </div>
        )}

        <Table>
          <Thead>
            <Tr>
              <Th>Order</Th>
              <Th>Name</Th>
              <Th>Team</Th>
              <Th>Role</Th>
              <Th>Active</Th>
              <Th></Th>
            </Tr>
          </Thead>
          <Tbody>
            {sortedEmployees
              .slice((empPage - 1) * 10, empPage * 10)
              .map((employee, idx) => {
                const empId = employee.emp_id ?? employee.id ?? idx;
                const empName = employee.emp_name ?? employee.name;
                const empTeamId = employee.team_id ?? employee.teamId;
                const order = employee.def_oncall_ord ?? employee.order;
                const teamObj =
                  teamsWithApps.find((t) => Number(t.id) === Number(empTeamId)) ||
                  teamsWithApps.find((t) => Number(t.manager_emp_id) === Number(empId));
                const isActive = employee.active_flg ?? employee.active;
                const isManager = Boolean(
                  teamObj?.manager_emp_id && Number(teamObj.manager_emp_id) === Number(empId)
                );
                const isUnassignedOrInactive = (!empTeamId && !isManager) || !isActive;
                return (
                  <Tr key={empId}>
                    <Td>
                      {employee.role === 'super_admin' ? (
                        <span style={{ color: 'var(--color-grey-light)', fontSize: 13 }}>Super admin (N/A)</span>
                      ) : isManager ? (
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
                            const sameTeamEmployees = employees.filter(
                              (emp) => (emp.team_id ?? emp.teamId) === empTeamId
                            );
                            const targetSwapEmp = sameTeamEmployees.find(
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
                                empTeamId,
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
                    <Td>{teamObj?.name ?? '—'}</Td>
                    <Td>{employee.role}</Td>
                    <Td>{isActive ? 'Yes' : 'No'}</Td>
                    <Td>
                      <Button variant="link" onClick={() => setEditingEmployee(employee)}>
                        Edit
                      </Button>
                      <Button
                        variant="link"
                        tone={isActive ? 'muted' : 'default'}
                        style={{ marginLeft: 16 }}
                        onClick={() => handleToggleActiveEmployee(employee)}
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
          currentPage={empPage}
          totalPages={Math.ceil(sortedEmployees.length / 10)}
          onPageChange={setEmpPage}
        />
      </section>

      <PastSchedulesSection isSuperAdmin teams={teamsWithApps} />

      {/* ---------------- Static info row section (US-11) ---------------- */}
      <section style={styles.section}>
        <h2>Static team information</h2>

        {!editingStaticRow && (
          <Button style={{ marginBottom: 16 }} onClick={() => setEditingStaticRow('new')}>
            + Add info link
          </Button>
        )}

        {editingStaticRow && (
          <div style={styles.formCard}>
            <h3>{editingStaticRow === 'new' ? 'Add static info link' : 'Edit static info link'}</h3>
            <StaticRowForm
              initialValues={editingStaticRow === 'new' ? null : editingStaticRow}
              onSubmit={handleStaticRowSubmit}
              onCancel={() => setEditingStaticRow(null)}
            />
          </div>
        )}

        <Table>
          <Thead>
            <Tr>
              <Th>Team name</Th>
              <Th>URL</Th>
              <Th></Th>
            </Tr>
          </Thead>
          <Tbody>
            {staticRows.map((row, idx) => {
              const urlStr = row.url ? String(row.url).trim() : '';
              const href = urlStr ? (/^https?:\/\//i.test(urlStr) ? urlStr : `https://${urlStr}`) : null;
              return (
                <Tr key={row.info_id || row.id || idx}>
                  <Td>{row.team_name || row.teamName}</Td>
                  <Td>
                    {href ? (
                      <a
                        href={href}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ color: 'var(--color-orange)', textDecoration: 'underline' }}
                      >
                        {urlStr}
                      </a>
                    ) : (
                      '—'
                    )}
                  </Td>
                  <Td>
                    <Button variant="link" onClick={() => setEditingStaticRow(row)}>
                      Edit
                    </Button>
                    <Button
                      variant="link"
                      tone="muted"
                      style={{ marginLeft: 16 }}
                      onClick={() => handleRemoveStaticRow(row)}
                    >
                      Remove
                    </Button>
                  </Td>
                </Tr>
              );
            })}
          </Tbody>
        </Table>
      </section>
    </main>
  );
}

const styles = {
  main: { padding: '32px 24px', maxWidth: 1200, margin: '0 auto' },
  subtitle: { color: 'var(--color-grey-light)', marginTop: -8, marginBottom: 24 },
  section: { marginTop: 48 },
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
    marginBottom: 16,
    boxSizing: 'border-box',
  },
};
