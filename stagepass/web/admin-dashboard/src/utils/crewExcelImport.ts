import ExcelJS from 'exceljs';
import type { Role } from '@/services/api';

/** Columns for the crew XLSX template (Excel-friendly header labels). */
export const CREW_EXCEL_HEADERS = ['name', 'email', 'password', 'username', 'pin', 'phone', 'roles'] as const;

export type CrewExcelRow = {
  name: string;
  email: string;
  password: string;
  username?: string;
  pin?: string;
  phone?: string;
  roles?: string;
  rowNumber: number;
};

export type CrewExcelParseError = { rowNumber: number; message: string };

const SAMPLE_ROWS: Record<(typeof CREW_EXCEL_HEADERS)[number], string>[] = [
  { name: 'Jane Doe', email: 'jane.doe@example.com', password: 'ChangeMe123', username: 'janedoe', pin: '1234', phone: '+254700000000', roles: 'crew' },
  { name: 'John Smith', email: 'john.smith@example.com', password: 'ChangeMe123', username: 'johnsmith', pin: '5678', phone: '', roles: 'crew' },
];

function normalizeHeader(value: unknown): string {
  return String(value ?? '').trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
}

function cellString(value: unknown): string {
  if (value == null) return '';
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return String(value).trim();
  if (typeof value === 'object') {
    if ('formula' in value || 'sharedFormula' in value) throw new Error('Formula cells are not supported. Replace formulas with values.');
    if ('text' in value && typeof value.text === 'string') return value.text.trim();
    if ('richText' in value && Array.isArray(value.richText)) return value.richText.map((part) => String(part.text ?? '')).join('').trim();
    if ('result' in value) return cellString(value.result);
  }
  return '';
}

function validateRows(rawRows: Record<string, unknown>[]): { rows: CrewExcelRow[]; errors: CrewExcelParseError[] } {
  const rows: CrewExcelRow[] = [];
  const errors: CrewExcelParseError[] = [];
  rawRows.forEach((raw, index) => {
    const rowNumber = index + 2;
    const normalized: Record<string, unknown> = {};
    Object.entries(raw).forEach(([key, value]) => { normalized[normalizeHeader(key)] = value; });
    let name = ''; let email = ''; let password = ''; let username = ''; let pin = ''; let phone = ''; let roles = '';
    try {
      name = cellString(normalized.name);
      email = cellString(normalized.email);
      password = cellString(normalized.password);
      username = cellString(normalized.username);
      pin = cellString(normalized.pin).replace(/\D/g, '');
      phone = cellString(normalized.phone);
      roles = cellString(normalized.roles);
    } catch (error) {
      errors.push({ rowNumber, message: error instanceof Error ? error.message : 'Unsupported cell value.' });
      return;
    }

    if (!name && !email && !password && !username && !pin && !phone && !roles) return;
    if (!name) { errors.push({ rowNumber, message: 'Name is required.' }); return; }
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { errors.push({ rowNumber, message: 'A valid email is required.' }); return; }
    if (!password || password.length < 8) { errors.push({ rowNumber, message: 'Password is required (min 8 characters).' }); return; }
    rows.push({ name, email, password, username: username || undefined, pin: pin || undefined, phone: phone || undefined, roles: roles || undefined, rowNumber });
  });
  return { rows, errors };
}

/** Small RFC 4180 style CSV reader for the supported CSV crew import format. */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (quoted) {
      if (char === '"' && text[index + 1] === '"') { field += '"'; index += 1; }
      else if (char === '"') quoted = false;
      else field += char;
    } else if (char === '"' && field.length === 0) quoted = true;
    else if (char === ',') { row.push(field); field = ''; }
    else if (char === '\n' || char === '\r') {
      if (char === '\r' && text[index + 1] === '\n') index += 1;
      row.push(field); rows.push(row); row = []; field = '';
    } else field += char;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows;
}

function csvRowsToRecords(rows: string[][]): Record<string, unknown>[] {
  const headers = rows[0] ?? [];
  return rows.slice(1).map((cells) => Object.fromEntries(headers.map((header, index) => [normalizeHeader(header), cells[index] ?? ''])));
}

/** Generate a real .xlsx template in the browser. */
export async function downloadCrewExcelTemplate(): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  const crew = workbook.addWorksheet('Crew');
  crew.columns = CREW_EXCEL_HEADERS.map((header, index) => ({ header, key: header, width: [22, 28, 16, 16, 10, 16, 20][index] }));
  crew.addRows(SAMPLE_ROWS);
  const instructions = workbook.addWorksheet('Instructions');
  instructions.getColumn(1).width = 90;
  instructions.addRows([
    ['StagePass crew import instructions'], [''],
    ['1. Fill the "Crew" sheet. Keep the header row as-is.'],
    ['2. Required columns: name, email, password (min 8 characters).'],
    ['3. Optional: username (mobile login), PIN (digits), phone, roles.'],
    ['4. roles: comma-separated role names, e.g. crew or crew,team_leader.'],
    ['5. If roles is blank, the system default crew role is used when available.'],
    ['6. Delete sample rows before uploading, unless those people should be created.'],
    ['7. Save as .xlsx and upload from Crew Management in the web admin.'],
  ]);
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer as BlobPart], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = 'stagepass-crew-import-template.xlsx';
  anchor.click();
  URL.revokeObjectURL(url);
}

/** Parse modern .xlsx or .csv crew sheets; legacy binary .xls is intentionally rejected. */
export async function parseCrewExcelFile(buffer: ArrayBuffer): Promise<{ rows: CrewExcelRow[]; errors: CrewExcelParseError[] }> {
  if (buffer.byteLength > 5 * 1024 * 1024) return { rows: [], errors: [{ rowNumber: 0, message: 'File is too large. Upload a file under 5 MB.' }] };
  const bytes = new Uint8Array(buffer);
  const isXlsx = bytes[0] === 0x50 && bytes[1] === 0x4b;
  if (!isXlsx) {
    const text = new TextDecoder().decode(buffer).replace(/^\uFEFF/, '');
    if (text.includes('\0')) return { rows: [], errors: [{ rowNumber: 0, message: 'Use .xlsx or .csv format. Legacy .xls files are not supported.' }] };
    const csvRows = parseCsv(text);
    if (csvRows.length < 2) return { rows: [], errors: [{ rowNumber: 0, message: 'No data rows found under the header.' }] };
    return validateRows(csvRowsToRecords(csvRows));
  }

  try {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);
    const sheet = workbook.worksheets.find((item) => item.name.trim().toLowerCase() === 'crew') ?? workbook.worksheets[0];
    if (!sheet) return { rows: [], errors: [{ rowNumber: 0, message: 'Spreadsheet has no sheets.' }] };
    const headerRow = sheet.getRow(1);
    const headers = Array.from({ length: headerRow.cellCount }, (_, index) => cellString(headerRow.getCell(index + 1).value));
    if (!headers.some(Boolean)) return { rows: [], errors: [{ rowNumber: 0, message: 'No header row found.' }] };
    const rawRows: Record<string, unknown>[] = [];
    const formulaErrors: CrewExcelParseError[] = [];
    for (let rowNumber = 2; rowNumber <= sheet.rowCount; rowNumber += 1) {
      const row = sheet.getRow(rowNumber);
      const record: Record<string, unknown> = {};
      headers.forEach((header, index) => {
        const value = row.getCell(index + 1).value;
        if (value && typeof value === 'object' && ('formula' in value || 'sharedFormula' in value)) {
          formulaErrors.push({ rowNumber, message: 'Formula cells are not supported. Replace formulas with values.' });
          return;
        }
        record[normalizeHeader(header)] = value;
      });
      rawRows.push(record);
    }
    const parsed = validateRows(rawRows);
    return { rows: parsed.rows, errors: [...parsed.errors, ...formulaErrors] };
  } catch {
    return { rows: [], errors: [{ rowNumber: 0, message: 'This workbook could not be read. Check that it is a valid .xlsx file.' }] };
  }
}

/** Map comma-separated role names to role IDs; defaults to "crew" when blank. */
export function resolveRoleIdsFromCell(rolesCell: string | undefined, allRoles: Role[]): { roleIds: number[]; unknownNames: string[] } {
  const byName = new Map(allRoles.map((role) => [String(role.name || '').trim().toLowerCase(), role.id] as const));
  const crewId = byName.get('crew');
  const parts = (rolesCell ?? '').split(/[,;|/]/).map((part) => part.trim().toLowerCase().replace(/\s+/g, '_')).filter(Boolean);
  if (!parts.length) return { roleIds: crewId != null ? [crewId] : [], unknownNames: [] };
  const roleIds: number[] = [];
  const unknownNames: string[] = [];
  for (const part of parts) {
    let id = byName.get(part);
    if (id == null && part.replace(/_/g, '') === 'teamleader') id = byName.get('team_leader');
    if (id == null) unknownNames.push(part);
    else if (!roleIds.includes(id)) roleIds.push(id);
  }
  if (!roleIds.length && crewId != null) return { roleIds: [crewId], unknownNames };
  return { roleIds, unknownNames };
}
