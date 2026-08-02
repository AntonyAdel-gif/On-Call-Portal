// ============================================================================
// TABLE
// ----------------------------------------------------------------------------
// Every data table in the app (team roster, schedule, static info, team
// apps modal...) used to be a hand-written <table>/<th>/<td> with its own
// copy-pasted header/cell style object. Now there are two looks, defined
// once, that every table picks from:
//
//   "underline" (default) - plain header text with an orange underline.
//                            Used for the admin-y "list with an Edit link"
//                            tables (team roster, teams, employees, static
//                            info, the team-apps modal).
//   "grid"                - solid orange header row, bordered cells.
//                            Used for the on-call schedule tables.
//
// Usage - swap in Table/Thead/Tbody/Tr/Th/Td for the plain HTML tags and
// set the look once on <Table>; every <Th>/<Td> inside picks it up
// automatically, so future developers don't retype header/cell styling
// per table:
//
//   <Table variant="grid">
//     <Thead>
//       <Tr><Th>Team</Th><Th>On call</Th></Tr>
//     </Thead>
//     <Tbody>
//       <Tr><Td>{team.name}</Td><Td>{team.onCall}</Td></Tr>
//     </Tbody>
//   </Table>
//
// A one-off tweak (e.g. highlighting "this week"'s column) still works via
// the normal `style` prop on an individual <Th>/<Td> - it's merged in last.
// ============================================================================

import { createContext, useContext } from 'react';

const TableVariantContext = createContext('underline');

const VARIANTS = {
  underline: {
    header: {
      textAlign: 'left',
      padding: '10px 12px',
      borderBottom: '2px solid var(--color-orange)',
      fontWeight: 'var(--weight-bold)',
    },
    cell: {
      padding: '10px 12px',
      borderBottom: '1px solid var(--color-grey-dark)',
    },
  },
  grid: {
    header: {
      textAlign: 'left',
      padding: '10px 12px',
      backgroundColor: 'var(--color-orange)',
      color: 'var(--color-black)',
      borderBottom: '2px solid var(--color-orange)',
      fontWeight: 'var(--weight-bold)',
    },
    cell: {
      padding: '10px 12px',
      border: '1px solid var(--color-orange)',
    },
  },
};

export function Table({ variant = 'underline', style, children, ...props }) {
  return (
    <TableVariantContext.Provider value={variant}>
      <table style={{ width: '100%', ...style }} {...props}>
        {children}
      </table>
    </TableVariantContext.Provider>
  );
}

export function Thead({ children, ...props }) {
  return <thead {...props}>{children}</thead>;
}

export function Tbody({ children, ...props }) {
  return <tbody {...props}>{children}</tbody>;
}

export function Tr({ children, style, ...props }) {
  return (
    <tr style={style} {...props}>
      {children}
    </tr>
  );
}

export function Th({ children, style, ...props }) {
  const variant = useContext(TableVariantContext);
  return (
    <th style={{ ...VARIANTS[variant].header, ...style }} {...props}>
      {children}
    </th>
  );
}

export function Td({ children, style, ...props }) {
  const variant = useContext(TableVariantContext);
  return (
    <td style={{ ...VARIANTS[variant].cell, ...style }} {...props}>
      {children}
    </td>
  );
}
