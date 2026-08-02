import { apiFetch } from './apiClient.js';

// ---------------------------------------------------------------------------
// AUTH
// ---------------------------------------------------------------------------
export async function login(username, password) {
  return apiFetch('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });
}

export async function fetchMe() {
  return apiFetch('/auth/me');
}

// ---------------------------------------------------------------------------
// PUBLIC / SCHEDULE ENDPOINTS
// ---------------------------------------------------------------------------
export async function fetchOnCallDashboard() {
  return apiFetch('/public/oncall');
}

export async function fetchTeamApps(teamId) {
  return apiFetch(`/public/teams/${teamId}/apps`);
}

export async function fetchStaticInfo() {
  return apiFetch('/public/static-info');
}

export async function fetchSchedule(teamId) {
  if (teamId) {
    return apiFetch(`/schedule/${teamId}`);
  }
  return apiFetch('/schedule');
}

export async function extendSchedule(teamId) {
  return apiFetch(`/schedule/${teamId}/extend`, { method: 'POST' });
}

// ---------------------------------------------------------------------------
// EMPLOYEES ENDPOINTS
// ---------------------------------------------------------------------------
export async function fetchEmployees() {
  return apiFetch('/employees');
}

export async function fetchAllEmployees() {
  return apiFetch('/employees');
}

export async function fetchTeamEmployees(teamId, role = null) {
  if (role === 'user') {
    return fetchTeammates();
  }
  try {
    const all = await apiFetch('/employees');
    if (Array.isArray(all)) {
      return all.filter((e) => e.team_id === Number(teamId) || e.team_id === teamId);
    }
    return all;
  } catch (err) {
    return fetchTeammates();
  }
}

export async function fetchTeammates() {
  return apiFetch('/employees/teammates');
}

export async function fetchEmployeeById(id) {
  return apiFetch(`/employees/${id}`);
}

export async function addEmployee(employeeData) {
  return apiFetch('/employees', {
    method: 'POST',
    body: JSON.stringify(employeeData),
  });
}

export async function updateEmployee(idOrObj, updatedData) {
  const id = typeof idOrObj === 'object' ? idOrObj.emp_id || idOrObj.id : idOrObj;
  const data = typeof idOrObj === 'object' ? idOrObj : updatedData;
  return apiFetch(`/employees/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function deleteEmployee(id) {
  return apiFetch(`/employees/${id}`, { method: 'DELETE' });
}

// ---------------------------------------------------------------------------
// TEAMS ENDPOINTS
// ---------------------------------------------------------------------------
export async function fetchAllTeams() {
  return apiFetch('/teams');
}

export async function fetchAvailableAdmins(excludeTeamId = null) {
  const query = excludeTeamId ? `?excludeTeamId=${excludeTeamId}` : '';
  return apiFetch(`/teams/available-admins${query}`);
}

export async function fetchTeamById(id) {
  return apiFetch(`/teams/${id}`);
}

export async function createTeam(teamData) {
  return apiFetch('/teams', {
    method: 'POST',
    body: JSON.stringify(teamData),
  });
}

export async function updateTeam(idOrObj, updatedData) {
  const id = typeof idOrObj === 'object' ? idOrObj.team_id || idOrObj.id : idOrObj;
  const data = typeof idOrObj === 'object' ? idOrObj : updatedData;
  return apiFetch(`/teams/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function deleteTeam(teamId) {
  return apiFetch(`/teams/${teamId}`, { method: 'DELETE' });
}

// ---------------------------------------------------------------------------
// APPLICATIONS ENDPOINTS
// ---------------------------------------------------------------------------
export async function fetchApplications() {
  return apiFetch('/applications');
}

export async function fetchAllApplications() {
  return fetchApplications();
}

export async function addApplication(appData) {
  return apiFetch('/applications', {
    method: 'POST',
    body: JSON.stringify(appData),
  });
}

export async function addTeamApp(appData) {
  return addApplication(appData);
}

export async function updateApplication(idOrObj, updatedData) {
  const id = typeof idOrObj === 'object' ? idOrObj.application_id || idOrObj.id : idOrObj;
  const data = typeof idOrObj === 'object' ? idOrObj : updatedData;
  return apiFetch(`/applications/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function updateTeamApp(requestingTeamId, updatedApp) {
  return updateApplication(updatedApp);
}

export async function deleteApplication(id) {
  return apiFetch(`/applications/${id}`, { method: 'DELETE' });
}

export async function deleteTeamApp(requestingTeamId, appId) {
  return deleteApplication(appId);
}

// ---------------------------------------------------------------------------
// STATIC INFO ENDPOINTS
// ---------------------------------------------------------------------------
export async function addStaticInfoRow(data) {
  return apiFetch('/static-info', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateStaticInfoRow(idOrObj, updatedData) {
  const id = typeof idOrObj === 'object' ? idOrObj.info_id || idOrObj.id : idOrObj;
  const data = typeof idOrObj === 'object' ? idOrObj : updatedData;
  return apiFetch(`/static-info/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function deleteStaticInfoRow(id) {
  return apiFetch(`/static-info/${id}`, { method: 'DELETE' });
}

// ---------------------------------------------------------------------------
// SWAP REQUESTS ENDPOINTS
// ---------------------------------------------------------------------------
export async function fetchSwapRequestsSent() {
  return apiFetch('/swap-requests/sent');
}

export async function fetchSwapRequestsPending() {
  return apiFetch('/swap-requests/pending');
}

export async function fetchSwapRequests() {
  const [sent, pending] = await Promise.all([
    fetchSwapRequestsSent().catch(() => []),
    fetchSwapRequestsPending().catch(() => []),
  ]);
  return { sent, pending };
}

export async function createSwapRequest(swapData) {
  return apiFetch('/swap-requests', {
    method: 'POST',
    body: JSON.stringify(swapData),
  });
}

export async function respondToSwapRequest(id, status) {
  const body = typeof status === 'object' ? status : { status };
  return apiFetch(`/swap-requests/${id}/respond`, {
    method: 'PUT',
    body: JSON.stringify(body),
  });
}

export async function cancelSwapRequest(id) {
  return apiFetch(`/swap-requests/${id}`, {
    method: 'DELETE',
  });
}

export async function fetchPastSchedules(teamId = null) {
  const query = teamId ? `?teamId=${teamId}` : '';
  return apiFetch(`/schedule/past/history${query}`);
}
