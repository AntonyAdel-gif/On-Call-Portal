// src/controllers/staticInfoController.js
import * as StaticInfo from '../models/staticInfoModel.js';

// GET /api/public/static-info
// Public read — no login required
export const getStaticInfo = async (req, res) => {
  try {
    const data = await StaticInfo.getAll();
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load static info' });
  }
};

// POST /api/static-info
// Super admin only — restriction will be enforced by authMiddleware + a role check once auth is built
export const createStaticInfo = async (req, res) => {
  try {
    // NOTE: req.user doesn't exist yet — this assumes authMiddleware will set it later
    const { emp_id } = req.user;
    const { team_name, url } = req.body;

    if (!team_name) {
      return res.status(400).json({ error: 'team_name is required' });
    }

    const newRow = await StaticInfo.create({
      team_name,
      url,
      created_by: emp_id,
    });

    res.status(201).json(newRow);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to add static info row' });
  }
};

export const updateStaticInfo = async (req, res) => {
  try {
    const { id } = req.params;
    const { team_name, url } = req.body;
    const updated = await StaticInfo.update(id, { team_name, url });
    if (!updated) return res.status(404).json({ error: 'Static info row not found' });
    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update static info row' });
  }
};

export const deleteStaticInfo = async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await StaticInfo.remove(id);
    if (!deleted) return res.status(404).json({ error: 'Static info row not found' });
    res.status(204).send();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete static info row' });
  }
};