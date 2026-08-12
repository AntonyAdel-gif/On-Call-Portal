// ============================================================================
// STATIC ROW FORM
// ----------------------------------------------------------------------------
// Form letting Super Admin add a new row or edit an existing row in the static
// info table. Fixed fields supported by backend: team_name and url.
// ============================================================================

import { useState } from 'react';
import Button from './ui/Button.jsx';
import RequiredIndicator from './ui/RequiredIndicator.jsx';

export default function StaticRowForm({ initialValues, onSubmit, onCancel }) {
  // Normalize initial Values for static info directory link editing.
  const [values, setValues] = useState(
    initialValues
      ? {
          team_name: initialValues.team_name || initialValues.team || '',
          url: initialValues.url || '',
        }
      : { team_name: '', url: '' }
  );

  function handleChange(field, value) {
    setValues((prev) => ({ ...prev, [field]: value }));
  }

  function handleSubmit(e) {
    e.preventDefault();
    // Trim whitespace to prevent database rows with leading/trailing spaces.
    onSubmit({ team_name: values.team_name.trim(), url: values.url.trim() });
    if (!initialValues) {
      setValues({ team_name: '', url: '' });
    }
  }

  return (
    <form onSubmit={handleSubmit} style={styles.form}>
      <label style={styles.label}>
        <span>Team name<RequiredIndicator /></span>
        <input
          style={styles.input}
          placeholder="e.g. Network Operations"
          value={values.team_name}
          onChange={(e) => handleChange('team_name', e.target.value)}
          required
        />
      </label>

      <label style={styles.label}>
        <span>URL<RequiredIndicator /></span>
        <input
          style={styles.input}
          placeholder="e.g. https://status.orange.com/network-operations"
          value={values.url}
          onChange={(e) => handleChange('url', e.target.value)}
          required
        />
      </label>

      <div style={styles.buttonRow}>
        <Button type="submit">{initialValues ? 'Save row' : 'Add row'}</Button>
        {onCancel && (
          <Button type="button" variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
        )}
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
  buttonRow: { display: 'flex', gap: 12, marginTop: 8 },
};
