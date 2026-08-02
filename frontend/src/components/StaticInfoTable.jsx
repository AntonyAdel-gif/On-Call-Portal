// ============================================================================
// STATIC INFO TABLE
// ----------------------------------------------------------------------------
// Renders the "static table containing information about different teams"
// from US-03. The Super Admin can add new rows to this via US-11 - those
// rows show up here automatically because both pages read from the same
// mock "database" in services/api.js.
// ============================================================================

import { Table, Thead, Tbody, Tr, Th, Td } from './ui/Table.jsx';

export default function StaticInfoTable({ rows }) {
  if (rows.length === 0) {
    return <p>No information has been added yet.</p>;
  }

  // Columns are derived from every row, not just the first one, so a row
  // added later with extra or differently-shaped fields still shows up.
  // Matching is case-insensitive (first row wins the display casing) so
  // "team" and "Team" land in the same column instead of splitting in two.
  const columns = [];
  const seenLower = new Set();
  for (const row of rows) {
    for (const key of Object.keys(row)) {
      if (key === 'id') continue;
      const lower = key.toLowerCase();
      if (!seenLower.has(lower)) {
        seenLower.add(lower);
        columns.push(key);
      }
    }
  }

  function cellValue(row, col) {
    const match = Object.keys(row).find((key) => key.toLowerCase() === col.toLowerCase());
    return match ? row[match] : undefined;
  }

  function renderCell(val, col) {
    if (!val) return '—';
    const isUrl = col.toLowerCase() === 'url' || (typeof val === 'string' && (/^https?:\/\//i.test(val) || /^www\./i.test(val)));
    if (!isUrl) return val;

    const str = String(val).trim();
    const href = /^https?:\/\//i.test(str) ? str : `https://${str}`;
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        style={{ color: 'var(--color-orange)', textDecoration: 'underline' }}
      >
        {str}
      </a>
    );
  }

  return (
    <Table>
      <Thead>
        <Tr>
          {columns.map((col) => (
            <Th key={col} style={{ textTransform: 'capitalize' }}>
              {col}
            </Th>
          ))}
        </Tr>
      </Thead>
      <Tbody>
        {rows.map((row, idx) => (
          <Tr key={row.info_id ?? row.id ?? idx}>
            {columns.map((col) => (
              <Td key={col}>{renderCell(cellValue(row, col), col)}</Td>
            ))}
          </Tr>
        ))}
      </Tbody>
    </Table>
  );
}
