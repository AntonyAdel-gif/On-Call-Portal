// ============================================================================
// TEAM FORM
// ----------------------------------------------------------------------------
// Used by Super Admin dashboard to create or edit team details.
// ============================================================================

import { useState } from 'react';
import Button from './ui/Button.jsx';

export default function TeamForm({
  initialValues,
  availableAdmins = [],
  allApplications = [],
  onSubmit,
  onCancel,
}) {
  // Normalize initial form values across different backend API payload shapes.
  const [values, setValues] = useState(() => {
    if (!initialValues) {
      return {
        team_name: '',
        email: '',
        manager_emp_id: '',
        cycle_day: 7,
        cycle_st_day: new Date().toISOString().split('T')[0],
        app_ids: [],
      };
    }

    const stDate = initialValues.cycle_st_day
      ? new Date(initialValues.cycle_st_day).toISOString().split('T')[0]
      : '';

    const initialAppIds = initialValues.app_ids
      ? initialValues.app_ids
      : initialValues.apps
      ? initialValues.apps.map((a) => a.application_id || a.id)
      : [];

    return {
      team_name: initialValues.team_name || initialValues.name || '',
      email: initialValues.email || initialValues.team_email || '',
      manager_emp_id: initialValues.manager_emp_id ?? '',
      cycle_day: initialValues.cycle_day || 7,
      cycle_st_day: stDate,
      app_ids: initialAppIds,
    };
  });

  const [appSearchTerm, setAppSearchTerm] = useState('');

  function handleChange(field, value) {
    setValues((prev) => ({ ...prev, [field]: value }));
  }

  // Toggles application ID in app_ids array for batch team-to-application assignment.
  function handleAppToggle(appId) {
    setValues((prev) => {
      const exists = prev.app_ids.includes(appId);
      const updated = exists
        ? prev.app_ids.filter((id) => id !== appId)
        : [...prev.app_ids, appId];
      return { ...prev, app_ids: updated };
    });
  }

  function handleSubmit(e) {
    e.preventDefault();
    onSubmit({
      ...values,
      manager_emp_id: values.manager_emp_id ? Number(values.manager_emp_id) : null,
      cycle_day: Number(values.cycle_day),
    });
  }

  // Filters application checkbox list by name, BASICAT, or 5-char CARTOO ID to easily manage large app catalogs.
  const filteredApplications = allApplications.filter((app) => {
    if (!appSearchTerm.trim()) return true;
    const term = appSearchTerm.toLowerCase();
    const name = (app.application_name || app.name || '').toLowerCase();
    const cartooId = (app.cartoo_id || app.cartoId || '').toLowerCase();
    const basicat = (app.basicat || '').toLowerCase();
    return name.includes(term) || cartooId.includes(term) || basicat.includes(term);
  });

  const MONTH_NAMES = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const dateObj = values.cycle_st_day ? new Date(values.cycle_st_day) : new Date();
  const validDate = isNaN(dateObj.getTime()) ? new Date() : dateObj;
  const currentYear = validDate.getFullYear();
  const currentMonth = validDate.getMonth() + 1; // 1-12
  const currentDay = validDate.getDate();
  const daysInMonth = new Date(currentYear, currentMonth, 0).getDate();

  // Custom date dropdown handler clamping days to valid month limits (e.g. Feb 28/29).
  function handleDateSelectChange(year, month, day) {
    const maxDays = new Date(year, month, 0).getDate();
    const safeDay = Math.min(day, maxDays);
    const formatted = `${year}-${String(month).padStart(2, '0')}-${String(safeDay).padStart(2, '0')}`;
    handleChange('cycle_st_day', formatted);
  }

  return (
    <form onSubmit={handleSubmit} style={styles.form}>
      <label style={styles.label}>
        Team name
        <input
          style={styles.input}
          value={values.team_name}
          onChange={(e) => handleChange('team_name', e.target.value)}
          required
        />
      </label>

      <label style={styles.label}>
        Team email (CC for Monday reminders)
        <input
          type="email"
          style={styles.input}
          value={values.email}
          onChange={(e) => handleChange('email', e.target.value)}
          placeholder="team-name@orange.com"
        />
      </label>

      {/* Team Manager selection: populated from GET /teams/available-admins to enforce 1-admin-1-team rule */}
      <label style={styles.label}>
        Team manager
        <select
          style={styles.input}
          value={values.manager_emp_id}
          onChange={(e) => handleChange('manager_emp_id', e.target.value)}
        >
          <option value="">Select manager (optional)</option>
          {availableAdmins.map((admin) => (
            <option key={admin.emp_id || admin.id} value={admin.emp_id || admin.id}>
              {admin.emp_name || admin.name}
            </option>
          ))}
        </select>
      </label>

      <label style={styles.label}>
        Rotation cycle (days)
        <input
          type="number"
          min="1"
          style={styles.input}
          value={values.cycle_day}
          onChange={(e) => handleChange('cycle_day', e.target.value)}
          required
        />
      </label>

      {/* Custom Date Picker Controls */}
      <label style={styles.label}>
        Cycle start date (DD/MM/YYYY)
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {/* Day (DD) */}
          <select
            style={{ ...styles.input, flex: 1, minWidth: 65 }}
            value={Math.min(currentDay, daysInMonth)}
            onChange={(e) => handleDateSelectChange(currentYear, currentMonth, Number(e.target.value))}
          >
            {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((d) => (
              <option key={d} value={d}>
                {String(d).padStart(2, '0')}
              </option>
            ))}
          </select>

          {/* Month (MM) */}
          <select
            style={{ ...styles.input, flex: 2, minWidth: 110 }}
            value={currentMonth}
            onChange={(e) => handleDateSelectChange(currentYear, Number(e.target.value), currentDay)}
          >
            {MONTH_NAMES.map((monthName, idx) => (
              <option key={idx + 1} value={idx + 1}>
                {String(idx + 1).padStart(2, '0')} - {monthName}
              </option>
            ))}
          </select>

          {/* Year (YYYY) */}
          <select
            style={{ ...styles.input, flex: 1.2, minWidth: 80 }}
            value={currentYear}
            onChange={(e) => handleDateSelectChange(Number(e.target.value), currentMonth, currentDay)}
          >
            {Array.from({ length: 16 }, (_, i) => 2020 + i).map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
          <input
            type="text"
            placeholder="DD/MM/YYYY"
            style={{ ...styles.input, padding: '8px 12px', fontSize: 13, flex: 1 }}
            value={
              values.cycle_st_day
                ? (values.cycle_st_day.includes('-') && values.cycle_st_day.split('-')[0].length === 4
                    ? `${values.cycle_st_day.split('-')[2].padStart(2, '0')}/${values.cycle_st_day.split('-')[1].padStart(2, '0')}/${values.cycle_st_day.split('-')[0]}`
                    : values.cycle_st_day)
                : `${String(currentDay).padStart(2, '0')}/${String(currentMonth).padStart(2, '0')}/${currentYear}`
            }
            onChange={(e) => handleChange('cycle_st_day', e.target.value)}
            required
          />
          <Button
            type="button"
            variant="secondary"
            size="small"
            onClick={() => {
              const today = new Date();
              const dd = String(today.getDate()).padStart(2, '0');
              const mm = String(today.getMonth() + 1).padStart(2, '0');
              const yyyy = today.getFullYear();
              handleChange('cycle_st_day', `${dd}/${mm}/${yyyy}`);
            }}
          >
            Today
          </Button>
        </div>
      </label>

      {/* Application Checkbox List */}
      <label style={styles.label}>
        Assigned applications
        {allApplications.length > 0 && (
          <input
            type="text"
            placeholder="Search by (name, basicat, cartoo)..."
            value={appSearchTerm}
            onChange={(e) => setAppSearchTerm(e.target.value)}
            style={styles.searchInput}
          />
        )}
        <div style={styles.appListContainer}>
          {allApplications.length === 0 ? (
            <span style={{ fontSize: 13, color: 'var(--color-grey-light)' }}>No applications available</span>
          ) : filteredApplications.length === 0 ? (
            <span style={{ fontSize: 13, color: 'var(--color-grey-light)' }}>No matching applications found</span>
          ) : (
            filteredApplications.map((app) => {
              const appId = app.application_id || app.id;
              const isChecked = values.app_ids.includes(appId);
              return (
                <label key={appId} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => handleAppToggle(appId)}
                  />
                  {app.application_name || app.name} ({app.cartoo_id || app.cartoId || 'No Carto ID'})
                </label>
              );
            })
          )}
        </div>
      </label>

      <div style={styles.buttonRow}>
        <Button type="submit">Save team</Button>
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

const styles = {
  form: { display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 360 },
  label: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    fontSize: 14,
    color: 'var(--color-grey-light)',
  },
  input: {
    backgroundColor: 'var(--color-black)',
    border: '1px solid var(--color-grey)',
    color: 'var(--color-white)',
    padding: '10px 12px',
    fontFamily: 'inherit',
    fontSize: 14,
  },
  searchInput: {
    backgroundColor: 'var(--color-black)',
    border: '1px solid var(--color-grey)',
    color: 'var(--color-white)',
    padding: '8px 10px',
    fontFamily: 'inherit',
    fontSize: 13,
    marginTop: 4,
    marginBottom: 6,
  },
  appListContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    marginTop: 4,
    maxHeight: 200,
    overflowY: 'auto',
  },
  buttonRow: { display: 'flex', gap: 12, marginTop: 8 },
};
