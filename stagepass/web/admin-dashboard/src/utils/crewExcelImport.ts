import * as XLSX from 'xlsx';
import type { Role } from '@/services/api';

/** Columns for the crew Excel template (Excel-friendly header labels). */
export const CREW_EXCEL_HEADERS = [
  'name',
  'email',
  'password',
  'username',
  'pin',
  'phone',
  'roles',
] as const;

export type CrewExcelRow = {
  name: string;
  email: string;
  password: string;
  username?: string;
  pin?: string;
  phone?: string;
  /** Comma-separated role names, e.g. "crew" or "crew,team_leader" */
  roles?: string;
  rowNumber: number;
};

export type CrewExcelParseError = {
  rowNumber: number;
  message: string;
};

const SAMPLE_ROWS: Record<(typeof CREW_EXCEL_HEADERS)[number], string>[] = [
  {
    name: 'Jane Doe',
    email: 'jane.doe@example.com',
    password: 'ChangeMe123',
    username: 'janedoe',
    pin: '1234',
    phone: '+254700000000',
    roles: 'crew',
  },
  {
    name: 'John Smith',
    email: 'john.smith@example.com',
    password: 'ChangeMe123',
    username: 'johnsmith',
    pin: '5678',
    phone: '',
    roles: 'crew',
  },
];

function normalizeHeader(value: unknown): string {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '');
}

function cellStr(row: Record<string, unknown>, key: string): string {
  const raw = row[key];
  if (raw == null) return '';
  return String(raw).trim();
}

/** Download a .xlsx template users can fill and upload. */
export function downloadCrewExcelTemplate(): void {
  const sheet = XLSX.utils.json_to_sheet(SAMPLE_ROWS, { header: [...CREW_EXCEL_HEADERS] });
  sheet['!cols'] = [
    { wch: 22 },
    { wch: 28 },
    { wch: 16 },
    { wch: 16 },
    { wch: 10 },
    { wch: 16 },
    { wch: 20 },
  ];

  const instructions = XLSX.utils.aoa_to_sheet([
    ['StagePass crew import instructions'],
    [''],
    ['1. Fill the "Crew" sheet. Keep the header row as-is.'],
    ['2. Required columns: name, email, password (min 8 characters).'],
    ['3. Optional: username (mobile login), pin (digits), phone, roles.'],
    ['4. roles: comma-separated role names, e.g. crew or crew,team_leader.'],
    ['5. If roles is blank, each person is assigned the "crew" role when available.'],
    ['6. Delete the sample rows before uploading, or leave them if those people should be created.'],
    ['7. Save as .xlsx and upload from Crew Management in the web admin.'],
  ]);
  instructions['!cols'] = [{ wch: 90 }];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, 'Crew');
  XLSX.utils.book_append_sheet(workbook, instructions, 'Instructions');
  XLSX.writeFile(workbook, 'stagepass-crew-import-template.xlsx');
}

/**
 * Parse an uploaded .xlsx / .xls / .csv file into crew rows.
 * Validates required fields; role names are resolved later against live roles.
 */
export function parseCrewExcelFile(
  buffer: ArrayBuffer
): { rows: CrewExcelRow[]; errors: CrewExcelParseError[] } {
  const workbook = XLSX.read(buffer, { type: 'array' });
  const sheetName =
    workbook.SheetNames.find((n) => n.trim().toLowerCase() === 'crew') ?? workbook.SheetNames[0];
  if (!sheetName) {
    return { rows: [], errors: [{ rowNumber: 0, message: 'Spreadsheet has no sheets.' }] };
  }

  const sheet = workbook.Sheets[sheetName];
  const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: '',
    raw: false,
  });

  if (rawRows.length === 0) {
    return { rows: [], errors: [{ rowNumber: 0, message: 'No data rows found under the header.' }] };
  }

  const rows: CrewExcelRow[] = [];
  const errors: CrewExcelParseError[] = [];

  rawRows.forEach((raw, index) => {
    const rowNumber = index + 2; // header is row 1
    const normalized: Record<string, unknown> = {};
    Object.entries(raw).forEach(([key, value]) => {
      normalized[normalizeHeader(key)] = value;
    });

    const name = cellStr(normalized, 'name');
    const email = cellStr(normalized, 'email');
    const password = cellStr(normalized, 'password');
    const username = cellStr(normalized, 'username');
    const pin = cellStr(normalized, 'pin').replace(/\D/g, '');
    const phone = cellStr(normalized, 'phone');
    const roles = cellStr(normalized, 'roles');

    if (!name && !email && !password && !username && !pin && !phone && !roles) {
      return; // skip blank rows
    }

    if (!name) {
      errors.push({ rowNumber, message: 'Name is required.' });
      return;
    }
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.push({ rowNumber, message: 'A valid email is required.' });
      return;
    }
    if (!password || password.length < 8) {
      errors.push({ rowNumber, message: 'Password is required (min 8 characters).' });
      return;
    }

    rows.push({
      name,
      email,
      password,
      username: username || undefined,
      pin: pin || undefined,
      phone: phone || undefined,
      roles: roles || undefined,
      rowNumber,
    });
  });

  return { rows, errors };
}

/** Map comma-separated role names to role IDs; defaults to "crew" when blank. */
export function resolveRoleIdsFromCell(
  rolesCell: string | undefined,
  allRoles: Role[]
): { roleIds: number[]; unknownNames: string[] } {
  const byName = new Map(
    allRoles.map((r) => [String(r.name || '').trim().toLowerCase(), r.id] as const)
  );
  const crewId = byName.get('crew');

  const parts = (rolesCell ?? '')
    .split(/[,;|/]/)
    .map((p) => p.trim().toLowerCase().replace(/\s+/g, '_'))
    .filter(Boolean);

  if (parts.length === 0) {
    return { roleIds: crewId != null ? [crewId] : [], unknownNames: [] };
  }

  const roleIds: number[] = [];
  const unknownNames: string[] = [];
  for (const part of parts) {
    const compact = part.replace(/_/g, '');
    let id = byName.get(part);
    if (id == null && compact === 'teamleader') id = byName.get('team_leader');
    if (id == null) {
      unknownNames.push(part);
      continue;
    }
    if (!roleIds.includes(id)) roleIds.push(id);
  }

  if (roleIds.length === 0 && crewId != null) {
    return { roleIds: [crewId], unknownNames };
  }
  return { roleIds, unknownNames };
}
