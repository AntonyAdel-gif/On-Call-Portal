import { useRef, useState } from 'react';
import Button from './Button.jsx';
import { downloadXlsxTemplate, parseXlsxFile, validateRows } from '../../utils/excelHelper.js';

// Reusable component rendering template download trigger and hidden file upload input for bulk Excel roster & app imports.
export default function ExcelImportControl({
  templateFilename,
  headers,
  sampleRows = [],
  type,
  onImportRows,
  label = 'data',
}) {
  const fileInputRef = useRef(null);
  const [isImporting, setIsImporting] = useState(false);

  function handleDownload() {
    downloadXlsxTemplate(templateFilename, headers, sampleRows);
  }

  // Handles client-side spreadsheet parsing and strict template validation prior to bulk endpoint submission.
  async function handleFileChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    try {
      const rawRows = await parseXlsxFile(file);
      // Validates headers and data integrity before calling onImportRows to prevent partial upload failure.
      const validRows = validateRows(rawRows, type, headers);
      await onImportRows(validRows);
    } catch (err) {
      console.error('Import validation failed:', err);
      window.alert(err.message || `Failed to import ${label}.`);
    } finally {
      setIsImporting(false);
      // Reset input value so re-uploading the same file triggers onChange correctly.
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  }

  return (
    <div style={styles.container}>
      <Button variant="secondary" size="small" type="button" onClick={handleDownload}>
        📥 Download template (.xlsx)
      </Button>

      <Button
        variant="secondary"
        size="small"
        type="button"
        disabled={isImporting}
        onClick={() => fileInputRef.current?.click()}
      >
        {isImporting ? 'Importing…' : '📤 Upload template (.xlsx)'}
      </Button>

      {/* Hidden native file input element triggered programmatically by the Upload button */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx, .xls, .csv"
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />
    </div>
  );
}

const styles = {
  container: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    marginLeft: 12,
  },
};
