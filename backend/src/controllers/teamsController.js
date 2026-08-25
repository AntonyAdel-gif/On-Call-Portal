// src/controllers/teamsController.js
import pool from '../db.js';
import * as Teams from '../models/teamsModel.js';
import * as Employee from '../models/employeeModel.js';
import * as Applications from '../models/applicationsModel.js';
import * as Schedule from '../models/scheduleModel.js';

// GET /api/teams
export const getTeams = async (req, res) => {
  try {
    const teams = await Teams.getAll();
    res.json(teams);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch teams' });
  }
};

// GET /api/teams/:id
export const getTeamById = async (req, res) => {
  try {
    const team = await Teams.getById(req.params.id);
    if (!team) return res.status(404).json({ error: 'Team not found' });
    res.json(team);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch team' });
  }
};

// GET /api/teams/available-admins
// Filters admin candidates to ensure team dropdowns only display managers not already assigned to another team.
export const getAvailableAdmins = async (req, res) => {
  try {
    const { excludeTeamId } = req.query;
    const admins = await Teams.getAvailableAdmins(excludeTeamId ? Number(excludeTeamId) : null);
    res.json(admins);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch available admins' });
  }
};

// Normalizes various incoming date string formats (YYYY-MM-DD or DD/MM/YYYY) into ISO YYYY-MM-DD for PostgreSQL DATE type.
function parseDateToISO(dateStr) {
  if (!dateStr) return new Date().toISOString().split('T')[0];
  if (typeof dateStr === 'string') {
    const trimmed = dateStr.trim();
    if (trimmed.includes('/') || trimmed.includes('-')) {
      const parts = trimmed.split(/[/-]/);
      if (parts.length === 3) {
        if (parts[0].length === 4) {
          return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
        } else if (parts[2].length === 4) {
          return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
        }
      }
    }
  }
  const d = new Date(dateStr);
  return !isNaN(d.getTime()) ? d.toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
}

function normalizeTeamEmail(value) {
  if (value === undefined || value === null || value === '') return null;
  const email = String(value).trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : false;
}

// POST /api/teams
export const createTeam = async (req, res) => {
  try {
    const { team_name, cycle_day, cycle_st_day, manager_emp_id, app_ids, email } = req.body;
    const teamEmail = normalizeTeamEmail(email);
    if (teamEmail === false) {
      return res.status(400).json({ error: 'email must be a valid team email address' });
    }

    let managerId = manager_emp_id ? Number(manager_emp_id) : null;
    if (managerId) {
      const manager = await Employee.getById(managerId);
      // Enforce business rule: team manager must possess role = admin.
      if (!manager || manager.role !== 'admin') {
        return res.status(400).json({ error: 'manager_emp_id must belong to an employee with role admin' });
      }

      // Enforce 1-admin-1-team constraint: prevent assigning an admin who already manages a different team.
      const isAssigned = await Teams.isManagerAssignedToAnotherTeam(managerId);
      if (isAssigned) {
        return res.status(400).json({ error: 'An admin can only manage one team at a time' });
      }
    }

    const newTeam = await Teams.create({
      team_name,
      cycle_day: cycle_day ? Number(cycle_day) : 7,
      cycle_st_day: parseDateToISO(cycle_st_day),
      manager_emp_id: managerId,
      email: teamEmail,
    });

    // Exclude assigned team manager from active on-call rotation slots (def_oncall_ord = null)
    // and renumber remaining members on their previous team if transferring.
    if (managerId) {
      const mgr = await Employee.getById(managerId);
      if (mgr) {
        const oldOrd = mgr.def_oncall_ord;
        const oldTeamId = mgr.team_id;
        await pool.query('UPDATE employee SET team_id = $1, def_oncall_ord = NULL WHERE emp_id = $2', [newTeam.team_id, managerId]);
        if (oldOrd !== null && oldTeamId) {
          await pool.query(
            'UPDATE employee SET def_oncall_ord = def_oncall_ord - 1 WHERE team_id = $1 AND def_oncall_ord > $2',
            [oldTeamId, oldOrd]
          );
          await Schedule.regenerateFutureRotation(oldTeamId);
        }
      }
    }

    // Assign application IDs to this team record.
    if (Array.isArray(app_ids) && app_ids.length > 0) {
      await Applications.assignToTeam(newTeam.team_id, app_ids);
    }

    res.status(201).json(newTeam);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create team' });
  }
};

// PUT /api/teams/:id
export const updateTeam = async (req, res) => {
  try {
    const { id } = req.params;
    const { team_name, cycle_day, cycle_st_day, manager_emp_id, app_ids, email } = req.body;

    const existing = await Teams.getById(id);
    if (!existing) return res.status(404).json({ error: 'Team not found' });

    const teamEmail = email !== undefined ? normalizeTeamEmail(email) : existing.email;
    if (teamEmail === false) {
      return res.status(400).json({ error: 'email must be a valid team email address' });
    }

    let managerId = manager_emp_id !== undefined ? (manager_emp_id ? Number(manager_emp_id) : null) : existing.manager_emp_id;

    if (managerId) {
      const manager = await Employee.getById(managerId);
      if (!manager || manager.role !== 'admin') {
        return res.status(400).json({ error: 'manager_emp_id must belong to an employee with role admin' });
      }

      const isAssigned = await Teams.isManagerAssignedToAnotherTeam(managerId, id);
      if (isAssigned) {
        return res.status(400).json({ error: 'An admin can only manage one team at a time' });
      }
    }

    const updated = await Teams.update(id, {
      team_name: team_name ?? existing.team_name,
      cycle_day: cycle_day ? Number(cycle_day) : existing.cycle_day,
      cycle_st_day: cycle_st_day ? parseDateToISO(cycle_st_day) : existing.cycle_st_day,
      manager_emp_id: managerId,
      email: teamEmail,
    });

    if (managerId) {
      const mgr = await Employee.getById(managerId);
      if (mgr) {
        const oldOrd = mgr.def_oncall_ord;
        const oldTeamId = mgr.team_id;
        await pool.query('UPDATE employee SET team_id = $1, def_oncall_ord = NULL WHERE emp_id = $2', [id, managerId]);
        if (oldOrd !== null && oldTeamId && Number(oldTeamId) !== Number(id)) {
          await pool.query(
            'UPDATE employee SET def_oncall_ord = def_oncall_ord - 1 WHERE team_id = $1 AND def_oncall_ord > $2',
            [oldTeamId, oldOrd]
          );
          await Schedule.regenerateFutureRotation(oldTeamId);
        }
      }
    }

    // Sync application assignments: clear removed apps and set team_id on new ones.
    if (Array.isArray(app_ids)) {
      await Applications.unassignFromTeam(id, app_ids);
      if (app_ids.length > 0) {
        await Applications.assignToTeam(id, app_ids);
      }
    }

    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update team' });
  }
};

// DELETE /api/teams/:id
export const deleteTeam = async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await Teams.getById(id);
    if (!existing) return res.status(404).json({ error: 'Team not found' });

    await Teams.remove(id);
    res.status(204).send();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete team' });
  }
};
