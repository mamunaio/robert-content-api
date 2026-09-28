import type { SheetRow } from './types';

/**
 * Parses standard RFC 4180 CSV text into 2D string array.
 * Handles quoted strings, escaped quotes (""), multi-line values, and commas inside quotes.
 */
export function parseCSV(csvText: string): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = '';
  let inQuotes = false;

  for (let i = 0; i < csvText.length; i++) {
    const char = csvText[i];
    const nextChar = csvText[i + 1];

    if (inQuotes) {
      if (char === '"') {
        if (nextChar === '"') {
          currentField += '"';
          i++; // Skip escaped quote
        } else {
          inQuotes = false;
        }
      } else {
        currentField += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ',') {
        currentRow.push(currentField);
        currentField = '';
      } else if (char === '\r') {
        if (nextChar === '\n') {
          i++;
        }
        currentRow.push(currentField);
        rows.push(currentRow);
        currentRow = [];
        currentField = '';
      } else if (char === '\n') {
        currentRow.push(currentField);
        rows.push(currentRow);
        currentRow = [];
        currentField = '';
      } else {
        currentField += char;
      }
    }
  }

  if (currentField || currentRow.length > 0) {
    currentRow.push(currentField);
    rows.push(currentRow);
  }

  return rows;
}

/**
 * Converts parsed CSV rows into typed SheetRow array using header-based column mapping.
 * Identifies column indices for 'section_id', 'field', 'type', and 'value' from the header row.
 * Throws an Error if required headers are missing or duplicated.
 * Skips headers and blank rows.
 */
export function extractSheetRows(matrix: string[][]): SheetRow[] {
  if (!matrix || matrix.length === 0) {
    return [];
  }

  // Find the header row (the first non-empty row)
  let headerRowIndex = -1;
  let sectionIdIdx = -1;
  let fieldIdx = -1;
  let typeIdx = -1;
  let valueIdx = -1;

  for (let i = 0; i < matrix.length; i++) {
    const row = matrix[i];
    if (!row || row.length === 0 || row.every((c) => !c || c.trim() === '')) {
      continue;
    }

    // Check if this row contains the required headers
    const normalizedCols = row.map((c) => (c ?? '').trim().toLowerCase());
    const seenHeaders = new Set<string>();

    for (let colIdx = 0; colIdx < normalizedCols.length; colIdx++) {
      const colName = normalizedCols[colIdx];
      if (!colName) continue;

      if (['section_id', 'field', 'type', 'value'].includes(colName)) {
        if (seenHeaders.has(colName)) {
          throw new Error(`Duplicate header detected in CSV: "${colName}"`);
        }
        seenHeaders.add(colName);
      }

      if (colName === 'section_id') sectionIdIdx = colIdx;
      else if (colName === 'field') fieldIdx = colIdx;
      else if (colName === 'type') typeIdx = colIdx;
      else if (colName === 'value') valueIdx = colIdx;
    }

    headerRowIndex = i;
    break;
  }

  if (headerRowIndex === -1) {
    return [];
  }

  // Validate all required headers exist
  const missingHeaders: string[] = [];
  if (sectionIdIdx === -1) missingHeaders.push('section_id');
  if (fieldIdx === -1) missingHeaders.push('field');
  if (typeIdx === -1) missingHeaders.push('type');
  if (valueIdx === -1) missingHeaders.push('value');

  if (missingHeaders.length > 0) {
    throw new Error(`Missing required CSV header(s): ${missingHeaders.join(', ')}`);
  }

  const sheetRows: SheetRow[] = [];

  for (let i = headerRowIndex + 1; i < matrix.length; i++) {
    const row = matrix[i];
    if (!row || row.length === 0) continue;

    const section_id = (row[sectionIdIdx] ?? '').trim();
    const field = (row[fieldIdx] ?? '').trim();
    const type = (row[typeIdx] ?? '').trim().toLowerCase();
    const value = row[valueIdx] ?? '';

    // Skip completely blank rows
    if (!section_id && !field && !value.trim() && !type) {
      continue;
    }

    // Skip rows without section_id or field
    if (!section_id || !field) {
      continue;
    }

    sheetRows.push({
      section_id,
      field,
      value,
      type,
    });
  }

  return sheetRows;
}

/**
 * Transforms SheetRow array into structured JSON grouped by section_id.
 * Applies type casting according to column D (type).
 */
export function transformSheetRows(rows: SheetRow[]): Record<string, Record<string, any>> {
  const content: Record<string, Record<string, any>> = {};

  for (const row of rows) {
    const { section_id, field, value, type } = row;

    if (!content[section_id]) {
      content[section_id] = {};
    }

    let parsedValue: any = value;

    switch (type) {
      case 'number': {
        const num = Number(value.trim());
        parsedValue = isNaN(num) ? value : num;
        break;
      }
      case 'boolean': {
        parsedValue = value.trim().toLowerCase() === 'true';
        break;
      }
      case 'text':
      case 'richtext':
      case 'seo':
      case 'slug':
      default:
        parsedValue = value;
        break;
    }

    content[section_id][field] = parsedValue;
  }

  return content;
}
