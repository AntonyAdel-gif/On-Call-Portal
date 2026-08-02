// ============================================================================
// EXCEL / XLSX HELPER UTILS WITH ATOMIC PRE-VALIDATION & STRICT HEADER CHECKS
// ============================================================================

import * as XLSX from 'xlsx';

// Client-side utility generating standard downloadable .xlsx templates with pre-filled headers and sample rows.
export function downloadXlsxTemplate(filename, headers, sampleRows = []) {
  const wsData = [headers];
  for (const row of sampleRows) {
    wsData.push(headers.map((h) => row[h] ?? ''));
  }
  const ws = XLSX.utils.aoa_to_sheet(wsData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Template');

  // Generate binary XLSX array buffer for browser download trigger without server side rendering.
  const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([wbout], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });

  const finalFilename = filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = finalFilename;
  document.body.appendChild(a);
  a.click();
  // Revoke object URL after click to release browser memory.
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 100);
}

// Client-side promise wrapper parsing uploaded binary .xlsx files into raw JSON row objects using FileReader.
export function parseXlsxFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const rawJson = XLSX.utils.sheet_to_json(worksheet, { defval: '' });
        resolve(rawJson);
      } catch (err) {
        reject(new Error('Invalid or corrupted Excel file format.'));
      }
    };
    reader.onerror = () => reject(new Error('Failed to read file.'));
    reader.readAsArrayBuffer(file);
  });
}

// Maps user header variations (e.g. "E-Mail Address", "Email", "e_mail") to standardized database property keys.
export function normalizeHeaderKey(key) {
  const k = String(key).toLowerCase().trim();

  // Application fields
  if (k.includes('app') && k.includes('name')) return 'application_name';
  if (k.includes('carto')) return 'cartoo_id';
  if (k.includes('basicat')) return 'basicat';
  if (k.includes('sla')) return 'sla';

  // Team fields
  if (k.includes('team') && k.includes('name')) return 'team_name';
  if (k.includes('manager')) return 'manager_ftid';
  if (k.includes('cycle') && k.includes('start')) return 'cycle_st_day';
  if (k.includes('cycle') || k.includes('rotation')) return 'cycle_day';

  // Employee fields
  if (k.includes('emp') && k.includes('name')) return 'emp_name';
  if (k.includes('mail') || k.includes('email')) return 'emp_mail';
  if (k.includes('phone') && (k.includes('2') || k.includes('sec'))) return 'phone2';
  if (k.includes('phone')) return 'phone1';
  if (k.includes('backup')) return 'bk_ftid';
  if (k.includes('ftid')) return 'ftid';
  if (k.includes('role')) return 'role';
  if (k.includes('active')) return 'active_flg';
  if (k.includes('name')) return 'emp_name';

  return k.replace(/[^a-z0-9_]/g, '_');
}

// Cleans empty strings and converts literal "N/A" text into empty string values prior to server submission.
export function cleanValue(val) {
  if (val === undefined || val === null) return '';
  const str = String(val).trim();
  if (/^n\/?a$/i.test(str)) return '';
  return str;
}

// Performs atomic validation across all rows before submitting import requests to prevent partial bulk creation failures.
export function validateRows(rawRows, type, expectedHeaders = []) {
  if (!Array.isArray(rawRows) || rawRows.length === 0) {
    throw new Error('The uploaded file is empty or contains no data rows.');
  }

  // 1. Strict Template Header Check: verifies user didn't select wrong template file (e.g. uploading employee template to apps).
  const rawHeaders = Object.keys(rawRows[0] || {});
  const normalizedActualKeys = rawHeaders.map(normalizeHeaderKey);

  if (type === 'team') {
    if (normalizedActualKeys.includes('application_name') || normalizedActualKeys.includes('cartoo_id')) {
      throw new Error('Template Error: You uploaded an Application template into the Teams section. Please upload the Teams template.');
    }
    if (normalizedActualKeys.includes('ftid') && !normalizedActualKeys.includes('team_name')) {
      throw new Error('Template Error: You uploaded an Employee template into the Teams section. Please upload the Teams template.');
    }
    if (!normalizedActualKeys.includes('team_name')) {
      throw new Error(`Template Error: Uploaded sheet is missing required Teams header 'Team Name'.`);
    }
  } else if (type === 'application') {
    if (normalizedActualKeys.includes('team_name') && !normalizedActualKeys.includes('application_name')) {
      throw new Error('Template Error: You uploaded a Teams template into the Applications section. Please upload the Applications template.');
    }
    if (normalizedActualKeys.includes('ftid') && !normalizedActualKeys.includes('application_name')) {
      throw new Error('Template Error: You uploaded an Employee template into the Applications section. Please upload the Applications template.');
    }
    if (!normalizedActualKeys.includes('application_name') || !normalizedActualKeys.includes('cartoo_id')) {
      throw new Error(`Template Error: Uploaded sheet is missing required Application headers ('Application Name' and 'Cartoo ID (5 chars)').`);
    }
  } else if (type === 'employee') {
    if (normalizedActualKeys.includes('application_name') || normalizedActualKeys.includes('cartoo_id')) {
      throw new Error('Template Error: You uploaded an Application template into the Employees section. Please upload the Employees template.');
    }
    if (normalizedActualKeys.includes('team_name') && !normalizedActualKeys.includes('emp_name') && !normalizedActualKeys.includes('ftid')) {
      throw new Error('Template Error: You uploaded a Teams template into the Employees section. Please upload the Employees template.');
    }
    if (!normalizedActualKeys.includes('emp_name') || !normalizedActualKeys.includes('ftid')) {
      throw new Error(`Template Error: Uploaded sheet is missing required Employee headers ('Employee Name' and 'FTID').`);
    }
  }

  // 2. Row Data Validation: collects all row errors into a single actionable error report before throwing.
  const normalizedRows = [];
  const errors = [];

  rawRows.forEach((rawRow, index) => {
    const rowNum = index + 2; // Row 1 is header
    const rowObj = {};
    Object.keys(rawRow).forEach((key) => {
      const normKey = normalizeHeaderKey(key);
      rowObj[normKey] = cleanValue(rawRow[key]);
    });

    if (type === 'application') {
      const name = rowObj.application_name;
      const cartooId = rowObj.cartoo_id;

      if (!name) {
        errors.push(`Row ${rowNum}: Application Name is required.`);
      }
      if (!cartooId) {
        errors.push(`Row ${rowNum}: Cartoo ID is required.`);
      } else if (cartooId.length !== 5) {
        errors.push(
          `Row ${rowNum}: Cartoo ID must be exactly 5 characters (got "${cartooId}" with length ${cartooId.length}).`
        );
      }
    } else if (type === 'employee') {
      const name = rowObj.emp_name;
      const ftid = rowObj.ftid;

      if (!name) {
        errors.push(`Row ${rowNum}: Employee Name is required.`);
      }
      if (!ftid) {
        errors.push(`Row ${rowNum}: FTID is required.`);
      }
      if (rowObj.role && !['user', 'admin', 'super_admin'].includes(rowObj.role.toLowerCase())) {
        errors.push(`Row ${rowNum}: Role must be 'user', 'admin', or 'super_admin' (got "${rowObj.role}").`);
      }
    } else if (type === 'team') {
      const name = rowObj.team_name;
      if (!name) {
        errors.push(`Row ${rowNum}: Team Name is required.`);
      }
      if (rowObj.cycle_day && (isNaN(Number(rowObj.cycle_day)) || Number(rowObj.cycle_day) <= 0)) {
        errors.push(`Row ${rowNum}: Rotation Cycle must be a positive number.`);
      }
    }

    normalizedRows.push(rowObj);
  });

  if (errors.length > 0) {
    throw new Error(`Excel validation failed — NO data was imported:\n\n` + errors.join('\n'));
  }

  return normalizedRows;
}
