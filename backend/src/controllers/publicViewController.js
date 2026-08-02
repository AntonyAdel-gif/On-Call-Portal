// src/controllers/publicViewController.js
import * as PublicView from '../models/publicViewModel.js';

// GET /api/public/oncall
// The default dashboard — no login required
export const getOnCallDashboard = async (req, res) => {
  try {
    const data = await PublicView.getCurrentOnCallDashboard();
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load on-call dashboard' });
  }
};

// GET /api/public/teams/:teamId/apps
// Triggered when a user clicks a team name on the dashboard
export const getTeamAppsAndEscalation = async (req, res) => {
  try {
    const { teamId } = req.params;
    const data = await PublicView.getTeamAppsAndEscalation(teamId);
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load team applications' });
  }
};