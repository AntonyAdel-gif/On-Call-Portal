// src/controllers/applicationsController.js
import pool from '../db.js';
import * as Applications from '../models/applicationsModel.js';

const getAdminTeamId = async (user) => {
  if (!user) return null;
  if (user.role === 'admin') {
    const teamRes = await pool.query('SELECT team_id FROM teams WHERE manager_emp_id = $1', [user.emp_id]);
    if (teamRes.rows.length > 0) {
      return teamRes.rows[0].team_id;
    }
  }
  return user.team_id;
};

// GET /api/applications
// Super admin only — the full application list feature
export const getApplications = async (req, res) => {
  try {
    const apps = await Applications.getAll();
    res.json(apps);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch applications' });
  }
};

//for admins to create applications
export const createApplication = async (req, res) => {
  try {
    const { role } = req.user;
    const {
  application_name,
  sla,
  basicat,
  cartoo_id,
  support,
  team_id,
} = req.body;


if (!['Infra', 'Ops', 'Both'].includes(support)) {
  return res.status(400).json({
    error: 'Support must be Infra, Ops, or Both'
  });
}

    if (!application_name) {
      return res.status(400).json({ error: 'application_name is required' });
    }

    if (role === 'super_admin' && !team_id) {
      return res.status(400).json({ error: 'team_id is required for super admin applications' });
    }

    const adminTeamId = await getAdminTeamId(req.user);

    // Admin's app always belongs to their own team; super admin can choose freely (or leave N/A)
    const targetTeamId = role === 'super_admin' ? team_id : adminTeamId;

   const newApp = await Applications.create({
  application_name,
  sla,
  basicat,
  cartoo_id,
  support,
  team_id: targetTeamId,
});

    res.status(201).json(newApp);
  } catch (err) {
    console.error(err);
    if (err.code === '23514') {
      return res.status(400).json({ error: 'Cartoo ID must be exactly 5 characters' });
    }
    res.status(500).json({ error: 'Failed to create application' });
  }
};

// PUT /api/applications/:id
// Admins may remove applications belonging to their team; super admins may remove any application.
export const updateApplication = async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await Applications.getById(id);
    if (!existing) return res.status(404).json({ error: 'Application not found' });
    if (req.user.role === 'admin') {
  const adminTeamId = await getAdminTeamId(req.user);

  if (Number(existing.team_id) !== Number(adminTeamId)) {
    return res.status(403).json({
      error: 'You can only edit applications belonging to your team'
    });
  }
}

    const {
  application_name,
  sla,
  basicat,
  cartoo_id,
  support,
  team_id,
} = req.body;


if (
  support !== undefined &&
  !['Infra', 'Ops', 'Both'].includes(support)
) {
  return res.status(400).json({
    error: 'Support must be Infra, Ops, or Both'
  });
}


const updated = await Applications.update(id, {
  application_name: application_name ?? existing.application_name,
  sla: sla ?? existing.sla,
  basicat: basicat ?? existing.basicat,
  cartoo_id: cartoo_id ?? existing.cartoo_id,
  support: support ?? existing.support,
  team_id: team_id !== undefined ? team_id : existing.team_id,
});

    res.json(updated);
  } catch (err) {
    console.error(err);
    if (err.code === '23514') {
      return res.status(400).json({ error: 'Cartoo ID must be exactly 5 characters' });
    }
    res.status(500).json({ error: 'Failed to update application' });
  }
};

// DELETE /api/applications/:id
// Super admin only
export const removeApplication = async (req, res) => {
  try {
    const existing = await Applications.getById(req.params.id);

    if (!existing) {
      return res.status(404).json({
        error: 'Application not found'
      });
    }

    if (req.user.role === 'admin') {
      const adminTeamId = await getAdminTeamId(req.user);

      if (Number(existing.team_id) !== Number(adminTeamId)) {
        return res.status(403).json({
          error: 'You can only remove applications belonging to your team'
        });
      }
    }

    await Applications.remove(req.params.id);

    res.status(204).send();
  } catch (err) {
    console.error(err);
    res.status(500).json({
      error: 'Failed to remove application'
    });
  }
};
