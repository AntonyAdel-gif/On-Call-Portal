// src/controllers/scheduleController.js
import * as Schedule from '../models/scheduleModel.js';
import * as Teams from '../models/teamsModel.js';

// GET /api/schedule/:teamId
export const getTeamSchedule = async (req, res) => {
  try {
    const { teamId } = req.params;

    const team = await Teams.getById(teamId);
    if (!team) return res.status(404).json({ error: 'Team not found' });

    // Returns all generated shifts for a single team for the team schedule view.
    const schedule = await Schedule.getByTeamId(teamId);
    res.json(schedule);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch schedule' });
  }
};

// GET /api/schedule
// Provides upcoming shifts across all teams partitioned by team_id for the multi-team matrix view.
export const getFullScheduleMatrix = async (req, res) => {
  try {
    const rows = await Schedule.getFullScheduleAllTeams();
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch full schedule' });
  }
};

// GET /api/schedule/past/history
export const getPastSchedule = async (req, res) => {
  try {
    const { teamId } = req.query;
    let targetTeamId = teamId ? Number(teamId) : null;

    // Forces team admin callers to view historical logs for their own team only, preventing cross-team history leaks.
    if (req.user.role === 'admin') {
<<<<<<< Updated upstream
      const adminTeamId = req.user.team_id ?? await Teams.getAdminTeamId(req.user.emp_id);
      if (!adminTeamId) {
        return res.status(403).json({ error: 'No team is assigned to this admin' });
=======
      const adminTeamId = await Teams.getAdminTeamId(req.user.emp_id);
      if (!adminTeamId) {
        return res.json([]);
>>>>>>> Stashed changes
      }
      targetTeamId = adminTeamId;
    }

    const pastRows = await Schedule.getPastSchedules({ teamId: targetTeamId });
    res.json(pastRows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch past schedules' });
  }
};

// POST /api/schedule/:teamId/extend
// Allows super_admin to manually push schedule generation further out on demand without waiting for monthly cron execution.
export const triggerRotationExtend = async (req, res) => {
  try {
    const { teamId } = req.params;
    const { cyclesToAdd } = req.body;

    const team = await Teams.getById(teamId);
    if (!team) return res.status(404).json({ error: 'Team not found' });

    const newRows = await Schedule.extendRotation(teamId, cyclesToAdd || undefined);
    res.status(201).json(newRows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to extend rotation' });
  }
};
