// ============================================================================
// EMPLOYEE FORM
// ----------------------------------------------------------------------------
// Reusable form for both Admin and Super Admin to add or edit an employee.
// ============================================================================

import { useState } from 'react';
import Button from './ui/Button.jsx';

export default function EmployeeForm({
  initialValues,
  teams = [],
  lockTeam = false,
  userRole = 'user',
  teammates = [],
  onSubmit,
  onCancel,
}) {
  // Normalize initial form state handling different prop naming conventions across backend and frontend.
  const [values, setValues] = useState(
    initialValues
      ? {
        emp_name: initialValues.emp_name || initialValues.name || '',
        emp_mail: initialValues.emp_mail || initialValues.email || '',
        phone1: initialValues.phone1 || initialValues.phone || '',
        ftid: initialValues.ftid || '',
        def_oncall_ord: initialValues.def_oncall_ord || initialValues.order || 1,
        team_id: initialValues.team_id || initialValues.teamId || '',
        role: initialValues.role || 'user',
        active_flg: initialValues.active_flg !== undefined ? initialValues.active_flg : (initialValues.active !== undefined ? initialValues.active : true),
        bk_emp_id: initialValues.bk_emp_id ?? '',
      }
      : {
        emp_name: '',
        emp_mail: '',
        phone1: '',
        ftid: '',
        def_oncall_ord: 1,
        team_id: lockTeam && teams[0] ? (teams[0].id || teams[0].team_id || '') : '',
        role: 'user',
        active_flg: true,
        bk_emp_id: '',
      }
  );

  function handleChange(field, value) {
    setValues((prev) => ({ ...prev, [field]: value }));
  }

  const selfId = initialValues?.emp_id || initialValues?.id;
  const currentTeamObj =
    teams.find((t) => String(t.team_id || t.id) === String(values.team_id)) ||
    teams.find((t) => selfId && String(t.manager_emp_id || t.managerEmpId) === String(selfId));
  const teamManagerId = currentTeamObj?.manager_emp_id || currentTeamObj?.managerEmpId;
  const isManager = Boolean(teamManagerId && String(selfId) === String(teamManagerId));

  function handleSubmit(e) {
    e.preventDefault();
    const isSuper = values.role === 'super_admin';
    // Automatically nullify rotation slot, team assignment, and backup fields if employee is super_admin or team manager,
    // since both roles are excluded from rotation schedule generation.
    onSubmit({
      ...values,
      team_id: isSuper ? null : (values.team_id ? Number(values.team_id) : null),
      def_oncall_ord: (isSuper || isManager) ? null : values.def_oncall_ord,
      bk_emp_id: (isSuper || isManager) ? null : (values.bk_emp_id ? Number(values.bk_emp_id) : null),
    });
  }

  // Filter backup options to exclude self and the team manager (manager cannot serve as backup).
  const backupOptions = teammates.filter((emp) => {
    const empIdVal = emp.emp_id || emp.id;
    if (String(empIdVal) === String(selfId)) return false;
    if (teamManagerId && String(empIdVal) === String(teamManagerId)) return false;
    return true;
  });

  // Displays inline warning if chosen rotation order matches an existing teammate's order number.
  const isEditing = Boolean(initialValues);
  const swapTarget = isEditing
    ? teammates.find(
      (emp) =>
        Number(emp.def_oncall_ord || emp.order) === Number(values.def_oncall_ord) &&
        String(emp.emp_id || emp.id) !== String(selfId)
    )
    : null;

  const isSuperAdmin = userRole === 'super_admin' || !lockTeam;
  const isAdmin = userRole === 'admin' || lockTeam;

  return (
    <form onSubmit={handleSubmit} style={styles.form}>
      <label style={styles.label}>
        Full name
        <input
          style={styles.input}
          value={values.emp_name}
          onChange={(e) => handleChange('emp_name', e.target.value)}
          required
        />
      </label>

      <label style={styles.label}>
        Email
        <input
          type="email"
          style={styles.input}
          value={values.emp_mail}
          onChange={(e) => handleChange('emp_mail', e.target.value)}
          required
        />
      </label>

      <label style={styles.label}>
        Phone number
        <input
          style={styles.input}
          value={values.phone1}
          onChange={(e) => handleChange('phone1', e.target.value)}
          required
        />
      </label>

      <label style={styles.label}>
        FTID
        <input
          style={styles.input}
          value={values.ftid}
          onChange={(e) => handleChange('ftid', e.target.value)}
          placeholder="e.g. FT1234"
          required
        />
      </label>

      {/* Backup employee dropdown: disabled for super admin and manager since both are excluded from shifts */}
      <label style={styles.label}>
        Backup employee
        {values.role === 'super_admin' ? (
          <span style={{ color: 'var(--color-grey-light)', fontSize: 13, marginTop: 4 }}>
            Super admin (Excluded from backup)
          </span>
        ) : isManager ? (
          <span style={{ color: 'var(--color-grey-light)', fontSize: 13, marginTop: 4 }}>
            Manager (Excluded from backup)
          </span>
        ) : (
          <select
            style={styles.input}
            value={values.bk_emp_id}
            onChange={(e) => handleChange('bk_emp_id', e.target.value ? Number(e.target.value) : '')}
          >
            <option value="">None</option>
            {backupOptions.map((emp) => (
              <option key={emp.emp_id || emp.id} value={emp.emp_id || emp.id}>
                {emp.emp_name || emp.name}
              </option>
            ))}
          </select>
        )}
      </label>

      {/* Rotation number input: shown when editing non-manager employee assigned to a team */}
      {isEditing && (
        <label style={styles.label}>
          Rotation number
          {values.role === 'super_admin' ? (
            <span style={{ color: 'var(--color-grey-light)', fontSize: 13, marginTop: 4 }}>
              Super admin (Excluded from rotation)
            </span>
          ) : !values.team_id ? (
            <span style={{ color: 'var(--color-grey-light)', fontSize: 13, marginTop: 4 }}>
              N/A (Employee is not assigned to a team)
            </span>
          ) : teamManagerId && String(selfId) === String(teamManagerId) ? (
            <span style={{ color: 'var(--color-grey-light)', fontSize: 13, marginTop: 4 }}>
              Manager (Excluded from rotation)
            </span>
          ) : (
            <>
              <input
                type="number"
                min="1"
                style={styles.input}
                value={values.def_oncall_ord || ''}
                onChange={(e) => handleChange('def_oncall_ord', Number(e.target.value))}
              />
              {swapTarget && (
                <span style={{ color: 'var(--color-orange)', fontSize: 12, marginTop: 4 }}>
                  (this will swap with {swapTarget.emp_name || swapTarget.name})
                </span>
              )}
            </>
          )}
        </label>
      )}

      {/* Team selection dropdown: visible to super_admin only */}
      {isSuperAdmin && (
        <label style={styles.label}>
          Team
          {values.role === 'super_admin' ? (
            <span style={{ color: 'var(--color-grey-light)', fontSize: 13, marginTop: 4 }}>
              Super admin (Global / No team assigned)
            </span>
          ) : (
            <select
              style={styles.input}
              value={values.team_id}
              onChange={(e) => handleChange('team_id', e.target.value)}
            >
              <option value="">Unassigned (No team)</option>
              {teams.map((team) => (
                <option key={team.team_id || team.id} value={team.team_id || team.id}>
                  {team.team_name || team.name}
                </option>
              ))}
            </select>
          )}
        </label>
      )}

      {/* Role selection dropdown: super_admin can assign any role; team admin can promote/demote between user/admin only */}
      {isSuperAdmin && (
        <label style={styles.label}>
          Role
          <select
            style={styles.input}
            value={values.role}
            onChange={(e) => handleChange('role', e.target.value)}
          >
            <option value="user">Employee</option>
            <option value="admin">Admin</option>
            <option value="super_admin">Super admin</option>
          </select>
        </label>
      )}

      {isAdmin && isEditing && (
        <label style={styles.label}>
          Role
          <select
            style={styles.input}
            value={values.role}
            onChange={(e) => handleChange('role', e.target.value)}
          >
            <option value="user">Employee</option>
            <option value="admin">Admin</option>
          </select>
        </label>
      )}

      <div style={styles.checkboxRow}>
        <label style={styles.checkboxLabel}>
          <input
            type="checkbox"
            checked={values.active_flg}
            onChange={(e) => handleChange('active_flg', e.target.checked)}
          />
          Active in the on-call rotation
        </label>
      </div>

      <div style={styles.buttonRow}>
        <Button type="submit">Save employee</Button>
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

const styles = {
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: 14,
    maxWidth: 360,
  },
  label: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    fontSize: 14,
    color: 'var(--color-grey-light)',
  },
  checkboxRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 20,
  },
  checkboxLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    fontSize: 14,
  },
  input: {
    backgroundColor: 'var(--color-black)',
    border: '1px solid var(--color-grey)',
    color: 'var(--color-white)',
    padding: '10px 12px',
    fontFamily: 'inherit',
    fontSize: 14,
  },
  buttonRow: {
    display: 'flex',
    gap: 12,
    marginTop: 8,
  },
};
