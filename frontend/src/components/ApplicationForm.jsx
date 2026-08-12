// ============================================================================
// APPLICATION FORM
// ----------------------------------------------------------------------------
// Inline form letting an Admin or Super Admin add or edit an application.
// ============================================================================

import { useState } from 'react';
import Button from './ui/Button.jsx';

export default function ApplicationForm({ initialValues, onSubmit, onCancel, teams = [], showTeamSelect = false }) {
  // Normalize initial form values to handle variations in prop naming conventions across endpoints.
  const [values, setValues] = useState(
    initialValues
      ? {
          application_name: initialValues.application_name || initialValues.name || '',
          sla: initialValues.sla || '',
          basicat: initialValues.basicat || '',
          cartoo_id: initialValues.cartoo_id || initialValues.cartoId || '',
          support: initialValues.support || '',
          team_id: initialValues.team_id || initialValues.teamId || '',
        }
      : {
  application_name: '',
  sla: '',
  basicat: '',
  cartoo_id: '',
  support: '',
  team_id: '',
}
  );

  function handleChange(field, value) {
    setValues((prev) => ({ ...prev, [field]: value }));
  }

  // Restricts CARTOO ID client-side to numeric digits max 5 chars to pass PostgreSQL check constraint CHECK (LENGTH(cartoo_id) = 5).
  function handleCartooIdChange(value) {
    const digitsOnly = value.replace(/\D/g, '').slice(0, 5);
    handleChange('cartoo_id', digitsOnly);
  }

  function handleSubmit(e) {
    e.preventDefault();
    onSubmit(values);
    if (!initialValues) {
      setValues({
        application_name: '',
        sla: '',
        basicat: '',
        cartoo_id: '',
        support: '',
        team_id: '',
      });
    }
  }

  return (
    <form onSubmit={handleSubmit} style={styles.form}>
      <input
        style={styles.input}
        placeholder="Application name"
        value={values.application_name}
        onChange={(e) => handleChange('application_name', e.target.value)}
        required
      />
      <input
        style={styles.input}
        placeholder="SLA (e.g. 99.9% / 30 min response)"
        value={values.sla}
        onChange={(e) => handleChange('sla', e.target.value)}
      />
      <input
        style={styles.input}
        placeholder="Basicat"
        value={values.basicat}
        onChange={(e) => handleChange('basicat', e.target.value)}
      />
      <input
        style={styles.input}
        placeholder="Carto ID (max 5 digits)"
        value={values.cartoo_id}
        onChange={(e) => handleCartooIdChange(e.target.value)}
        inputMode="numeric"
        pattern="\d{1,5}"
        maxLength={5}
        title="Up to 5 digits"
      />
      <select
  style={styles.input}
  value={values.support}
  onChange={(e) => handleChange('support', e.target.value)}
  required
>
  <option value="">Select support</option>
  <option value="Infra">Infra</option>
  <option value="Ops">Ops</option>
  <option value="Both">Both</option>
</select>
      {showTeamSelect && (
        <select
          style={styles.input}
          value={values.team_id}
          onChange={(e) => handleChange('team_id', e.target.value)}
          required
        >
          <option value="">Select team</option>
          {teams.map((team) => {
            const teamId = team.team_id ?? team.id;
            return (
              <option key={teamId} value={teamId}>
                {team.team_name || team.name}
              </option>
            );
          })}
        </select>
      )}
      <Button type="submit">{initialValues ? 'Save application' : 'Add application'}</Button>
      {onCancel && (
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
      )}
    </form>
  );
}

const styles = {
  form: { display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' },
  input: {
    backgroundColor: 'var(--color-black)',
    border: '1px solid var(--color-grey)',
    color: 'var(--color-white)',
    padding: '10px 12px',
    fontFamily: 'inherit',
    fontSize: 14,
  },
};
