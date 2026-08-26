// src/controllers/employeeController.js
import pool from '../db.js';
import * as Employee from '../models/employeeModel.js';
import * as Schedule from '../models/scheduleModel.js';

// ===== HELPER =====
// Dynamically resolves team ownership for team managers (admin role) by checking teams.manager_emp_id,
// ensuring admins remain strictly scoped to their assigned team even if employee.team_id differs.
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

// Employee notifications must use an Orange corporate mailbox.
const normalizeEmployeeEmail = (value) => {
  const email = String(value ?? '').trim();
  return /^[^\s@]+@orange\.com$/i.test(email) ? email : null;
};

// ===== READ =====

// GET /api/employees
export const getEmployees = async (req, res) => {
  try {
    const { role } = req.user;
    const team_id = await getAdminTeamId(req.user);

    // Enforce data boundaries: Super admin views global employee directory; team admin views own team roster only.
    const employees =
      role === 'super_admin'
        ? await Employee.getAll()
        : await Employee.getAll(team_id);

    res.json(employees);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch employees' });
  }
};

// GET /api/employees/:id
export const getEmployeeById = async (req, res) => {
  try {
    const { role } = req.user;
    const requesterTeamId = await getAdminTeamId(req.user);
    const employee = await Employee.getById(req.params.id);

    if (!employee) return res.status(404).json({ error: 'Employee not found' });

    // Prevent team managers from inspecting employee profiles belonging to other engineering teams.
    if (role === 'admin' && Number(employee.team_id) !== Number(requesterTeamId)) {
      return res.status(403).json({ error: 'Not authorized to view this employee' });
    }

    res.json(employee);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch employee' });
  }
};

// GET /api/employees/teammates — returns simplified list of teammate names for dropdowns
export const getTeammates = async (req, res) => {
  try {
    const teamId = await getAdminTeamId(req.user);
    const teammates = await Employee.getTeammates(teamId);
    res.json(teammates);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch teammates' });
  }
};

// ===== CREATE =====

// POST /api/employees
export const createEmployee = async (req, res) => {
  try {
    const requesterRole = req.user.role;
    const adminTeamId = await getAdminTeamId(req.user);
    const { emp_name, name, phone1, phone, phone2, emp_mail, email, ftid, bk_emp_id, team_id, role, active_flg, active } = req.body;
    const employeeEmail = normalizeEmployeeEmail(emp_mail ?? email);

    if (!employeeEmail) {
      return res.status(400).json({ error: 'Employee email must end in @orange.com' });
    }

    // Forces newly created employee into team manager's team when caller is admin; super admin can explicitly assign team_id.
    const targetTeamId = requesterRole === 'super_admin' ? (team_id || adminTeamId) : adminTeamId;

    // Restrict non-super_admin callers from elevating permissions during creation.
    let newEmployeeRole = 'user';
    if (requesterRole === 'super_admin' && role) {
      if (!['user', 'admin', 'super_admin'].includes(role)) {
        return res.status(400).json({ error: 'Invalid role' });
      }
      newEmployeeRole = role;
    }

    // Super admin accounts are global system administrators and are excluded from team rotation slots (team_id = null, def_oncall_ord = null).
    if (newEmployeeRole === 'super_admin') {
      const newEmployee = await Employee.create({
        emp_name: emp_name || name,
        phone1: phone1 || phone,
        phone2: phone2 || null,
        emp_mail: employeeEmail,
        team_id: null,
        ftid,
        def_oncall_ord: null,
        role: 'super_admin',
        bk_emp_id: null,
        active_flg: active_flg !== undefined ? Boolean(active_flg) : (active !== undefined ? Boolean(active) : true),
      });
      return res.status(201).json(newEmployee);
    }

    // Normalize empty strings/zeros/literals from UI forms to SQL NULL for proper FK constraints.
    let normalizedBkEmpId = bk_emp_id;
    if (normalizedBkEmpId === '' || normalizedBkEmpId === 0 || normalizedBkEmpId === undefined || normalizedBkEmpId === 'none' || normalizedBkEmpId === null) {
      normalizedBkEmpId = null;
    } else {
      normalizedBkEmpId = Number(normalizedBkEmpId);
    }

    // Validate that backup coverage exists on the same team and is not assigned to the team manager (who is excluded from shifts).
    if (normalizedBkEmpId !== null) {
      const backup = await Employee.getById(normalizedBkEmpId);
      if (!backup || backup.team_id !== targetTeamId) {
        return res.status(400).json({ error: 'Backup employee must be on the same team' });
      }
      if (backup.active_flg !== true) {
        return res.status(400).json({ error: 'Backup employee must be active' });
      }
      const teamRes = await pool.query('SELECT manager_emp_id FROM teams WHERE team_id = $1', [targetTeamId]);
      const managerEmpId = teamRes.rows[0]?.manager_emp_id;
      if (managerEmpId && Number(normalizedBkEmpId) === Number(managerEmpId)) {
        return res.status(400).json({ error: 'Team manager cannot be assigned as a backup employee' });
      }
    }

    // Automatically assign next sequential rotation index (max + 1) to maintain 1-indexed order.
    const nextOrder = await Employee.getNextOrder(targetTeamId);

    const newEmployee = await Employee.create({
      emp_name: emp_name || name,
      phone1: phone1 || phone,
      phone2: phone2 || null,
      emp_mail: employeeEmail,
      team_id: targetTeamId,
      ftid,
      def_oncall_ord: nextOrder,
      role: newEmployeeRole,
      bk_emp_id: normalizedBkEmpId,
      active_flg: active_flg !== undefined ? Boolean(active_flg) : (active !== undefined ? Boolean(active) : true),
    });

    // Re-generate future rotation buffer so new team member is included in upcoming shift cycles.
    await Schedule.regenerateFutureRotation(targetTeamId);

    res.status(201).json(newEmployee);
  } catch (err) {
    console.error(err);
    if (err.code === '23502') return res.status(400).json({ error: 'FTID is required' });
    res.status(500).json({ error: 'Failed to create employee' });
  }
};

// PUT /api/employees/:id
export const updateEmployee = async (req, res) => {
  try {
    const { id } = req.params;
    const requesterRole = req.user.role;
    const requesterTeamId = await getAdminTeamId(req.user);
    const fields = req.body;

    const existing = await Employee.getById(id);
    if (!existing) return res.status(404).json({ error: 'Employee not found' });

    // Block team managers from modifying employee records outside their team.
    if (requesterRole === 'admin' && Number(existing.team_id) !== Number(requesterTeamId)) {
      return res.status(403).json({ error: 'Not authorized to edit this employee' });
    }

    const submittedEmail = fields.emp_mail ?? fields.email;
    const employeeEmail = submittedEmail === undefined
      ? existing.emp_mail
      : normalizeEmployeeEmail(submittedEmail);
    if (!employeeEmail) {
      return res.status(400).json({ error: 'Employee email must end in @orange.com' });
    }

    // Strip unauthorized role/team updates if caller is admin.
    if (requesterRole === 'admin') {
      delete fields.team_id;
      if (fields.role === 'super_admin') {
        return res.status(403).json({ error: 'Admins cannot grant super_admin role' });
      }
    } else if (requesterRole !== 'super_admin') {
      delete fields.role;
      delete fields.team_id;
    }

    const isPromotingToSuperAdmin = existing.role !== 'super_admin' && fields.role === 'super_admin';
    const targetRole = fields.role || existing.role;

    // Super admin accounts do not participate in rotations or hold team assignments.
    if (targetRole === 'super_admin') {
      fields.team_id = null;
      fields.def_oncall_ord = null;
      fields.bk_emp_id = null;
    }

    // Handles cleanup when promoting user/admin to super_admin:
    // Vacates their team rotation slot, clears manager reference, and renumbers remaining teammates to close the order gap.
    if (isPromotingToSuperAdmin) {
      const oldTeamId = existing.team_id;
      const oldOrd = existing.def_oncall_ord;

      const updated = await Employee.update(id, {
        emp_name: fields.emp_name || fields.name || existing.emp_name,
        phone1: fields.phone1 || fields.phone || existing.phone1,
        phone2: fields.phone2 || existing.phone2 || null,
        emp_mail: employeeEmail,
        team_id: null,
        def_oncall_ord: null,
        active_flg: fields.active_flg !== undefined ? Boolean(fields.active_flg) : existing.active_flg,
        role: 'super_admin',
        bk_emp_id: null,
        ftid: fields.ftid || existing.ftid,
      });

      if (oldTeamId) {
        await pool.query('UPDATE teams SET manager_emp_id = NULL WHERE manager_emp_id = $1', [id]);
      }

      await pool.query('UPDATE employee SET bk_emp_id = NULL WHERE bk_emp_id = $1', [id]);

      if (oldTeamId && oldOrd !== null && oldOrd !== undefined) {
        await pool.query(
          'UPDATE employee SET def_oncall_ord = def_oncall_ord - 1 WHERE team_id = $1 AND def_oncall_ord > $2',
          [oldTeamId, oldOrd]
        );
      }

      if (oldTeamId) {
        const hasProgressed = await Schedule.hasCycleProgressedPastOrderSwap(oldTeamId, Number(id), null);
        if (!hasProgressed) {
          await Schedule.regenerateFutureRotation(oldTeamId);
        }
      }

      return res.json(updated);
    }

    // Normalize empty values for backup employee ID.
    let bkEmpId = fields.bk_emp_id;
    if (bkEmpId === '' || bkEmpId === 0 || bkEmpId === undefined || bkEmpId === 'none' || bkEmpId === null) {
      bkEmpId = null;
    } else {
      bkEmpId = Number(bkEmpId);
    }
    fields.bk_emp_id = bkEmpId;

    // Enforce backup invariants (same team, not self, not team manager).
    if (fields.bk_emp_id !== null) {
      if (fields.bk_emp_id === Number(id)) {
        return res.status(400).json({ error: 'An employee cannot be their own backup' });
      }
      const backup = await Employee.getById(fields.bk_emp_id);
      const relevantTeamId = fields.team_id || existing.team_id;
      if (!backup || backup.team_id !== relevantTeamId) {
        return res.status(400).json({ error: 'Backup employee must be on the same team' });
      }
      if (backup.active_flg !== true) {
        return res.status(400).json({ error: 'Backup employee must be active' });
      }
      const teamRes = await pool.query('SELECT manager_emp_id FROM teams WHERE team_id = $1', [relevantTeamId]);
      const managerEmpId = teamRes.rows[0]?.manager_emp_id;
      if (managerEmpId && Number(fields.bk_emp_id) === Number(managerEmpId)) {
        return res.status(400).json({ error: 'Team manager cannot be assigned as a backup employee' });
      }
    }

    // Trigger double schedule regeneration if employee transfers across teams.
    if (fields.team_id && fields.team_id !== existing.team_id) {
      const updated = await Employee.changeTeam(id, fields.team_id);
      await Schedule.regenerateFutureRotation(existing.team_id);
      await Schedule.regenerateFutureRotation(fields.team_id);
      return res.json(updated);
    }

    const newActiveFlg = fields.active_flg !== undefined ? Boolean(fields.active_flg) : (fields.active !== undefined ? Boolean(fields.active) : existing.active_flg);
    const isDeactivating = existing.active_flg === true && newActiveFlg === false;
    const isReactivating = existing.active_flg === false && newActiveFlg === true;

    const teamRes = await pool.query('SELECT manager_emp_id FROM teams WHERE team_id = $1', [existing.team_id]);
    const isManager = teamRes.rows[0]?.manager_emp_id && Number(teamRes.rows[0].manager_emp_id) === Number(id);

    const oldOrder = existing.def_oncall_ord;
    let targetOrder = existing.def_oncall_ord;

    // Team managers and inactive members must have def_oncall_ord = null so schedule generator skips them.
    if (isManager || !newActiveFlg) {
      targetOrder = null;
    } else if (isReactivating) {
      targetOrder = await Employee.getNextOrder(existing.team_id);
    } else if (fields.def_oncall_ord !== undefined && fields.def_oncall_ord !== null && fields.def_oncall_ord !== '') {
      targetOrder = Number(fields.def_oncall_ord);
    }

    const orderChanged = !isManager && newActiveFlg && oldOrder !== null && targetOrder !== null && Number(targetOrder) !== Number(oldOrder);

    let updated = await Employee.update(id, {
      emp_name: fields.emp_name || fields.name || existing.emp_name,
      phone1: fields.phone1 || fields.phone || existing.phone1,
      phone2: fields.phone2 || existing.phone2 || null,
      emp_mail: employeeEmail,
      team_id: fields.team_id || existing.team_id,
      def_oncall_ord: orderChanged ? existing.def_oncall_ord : targetOrder,
      active_flg: newActiveFlg,
      role: fields.role || existing.role,
      bk_emp_id: fields.bk_emp_id,
      ftid: fields.ftid || existing.ftid,
    });

    if (isDeactivating) {
      // Renumber team members to close order gap when employee is deactivated.
      if (oldOrder !== null) {
        await pool.query(
          'UPDATE employee SET def_oncall_ord = def_oncall_ord - 1 WHERE team_id = $1 AND active_flg = TRUE AND def_oncall_ord > $2',
          [existing.team_id, oldOrder]
        );
      }
      const hasProgressed = await Schedule.hasCycleProgressedPastOrderSwap(existing.team_id, Number(id), null);
      if (!hasProgressed) {
        await Schedule.regenerateFutureRotation(existing.team_id);
      }
    } else if (isReactivating) {
      await Schedule.regenerateFutureRotation(existing.team_id);
    } else if (orderChanged) {
      const targetHolder = await Employee.getByTeamAndOrder(existing.team_id, targetOrder);
      const targetEmpId = targetHolder ? targetHolder.emp_id : null;

      // Current Cycle Lock: Reject order swap if shift in active cycle has already started to prevent modifying ongoing schedule.
      const hasProgressed = await Schedule.hasCycleProgressedPastOrderSwap(
        existing.team_id,
        Number(id),
        targetEmpId ? Number(targetEmpId) : null
      );

      if (hasProgressed) {
        return res.status(400).json({
          error: 'Cannot change rotation order: a scheduled shift in the current cycle has already started for one or both employees.',
        });
      }

      updated = await Employee.updateOrder(existing.team_id, id, targetOrder);
      await Schedule.regenerateFutureRotation(existing.team_id);
    }

    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update employee' });
  }
};

// DELETE /api/employees/:id
export const removeEmployee = async (req, res) => {
  try {
    const { id } = req.params;
    const role = req.user.role;
    const requesterTeamId = await getAdminTeamId(req.user);

    const existing = await Employee.getById(id);
    if (!existing) return res.status(404).json({ error: 'Employee not found' });

    if (role === 'admin' && Number(existing.team_id) !== Number(requesterTeamId)) {
      return res.status(403).json({ error: 'Not authorized to remove this employee' });
    }

    await Employee.remove(id);
    res.status(204).send();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to remove employee' });
  }
};
