import { SheetRow } from './types';

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
 * Converts parsed CSV rows into typed SheetRow array.
 * Skips headers and blank rows.
 */
export function extractSheetRows(matrix: string[][]): SheetRow[] {
  if (!matrix || matrix.length === 0) {
    return [];
  }

  const sheetRows: SheetRow[] = [];

  for (let i = 0; i < matrix.length; i++) {
    const row = matrix[i];
    if (!row || row.length === 0) continue;

    const section_id = (row[0] ?? '').trim();
    const field = (row[1] ?? '').trim();
    const value = row[2] ?? '';
    const type = (row[3] ?? '').trim().toLowerCase();

    // Check if this is the header row
    if (
      i === 0 &&
      section_id.toLowerCase() === 'section_id' &&
      field.toLowerCase() === 'field'
    ) {
      continue;
    }

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
