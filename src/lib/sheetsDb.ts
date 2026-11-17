import {
  ActiveSheetConfig,
  ActivityLogAction,
  ActivityLogEntry,
  ActivityLogTargetType,
  COMPETITION_LEVELS,
  CompetitionItem,
  CompetitionLevel,
  DEFAULT_CATEGORY_GROUPS,
  DEFAULT_SITE_SETTINGS,
  RegistrationRecord,
  SheetLinkEntry,
  SiteSettings,
  StudentEntry,
  UserAccount,
} from '../types';
import {
  INITIAL_COMPETITIONS,
  INITIAL_REGISTRATIONS,
  INITIAL_USERS,
} from './seedData';

export const DEFAULT_SPREADSHEET_ID = '1RauGo4xOfKS9xG17azBQpPbi-IgPBaBeUKEjU1Qg9NE';
export const DEFAULT_APPS_SCRIPT_URL = (
  (import.meta as any).env?.VITE_APPS_SCRIPT_URL || ''
).trim();
export const CATEGORY_GROUPS_ROW_ID = '__CATEGORY_GROUPS__';
export const SITE_SETTINGS_ROW_ID = '__SITE_SETTINGS__';
export const GAS_URL_ROW_ID = '__GAS_URL__';
export const ACTIVE_SHEET_LINK_ROW_ID = '__ACTIVE_SHEET_LINK__';
export const SHEET_LINKS_ROW_ID = '__SHEET_LINKS__';
export const LOG_ROW_PREFIX = '__LOG__';
export const LOG_ROW_MARKER = '__LOG__';

export const SHEET_NAMES = {
  USERS: 'user',
  COMPETITIONS: 'รายการ',
  REGISTRATIONS: 'ลงทะเบียน',
} as const;

export type SheetTabName = (typeof SHEET_NAMES)[keyof typeof SHEET_NAMES];

export interface SheetDatabaseState {
  users: UserAccount[];
  competitions: CompetitionItem[];
  registrations: RegistrationRecord[];
  categoryGroups: string[];
  siteSettings: SiteSettings;
  logs: ActivityLogEntry[];
  discoveredGasUrl?: string;
  activeSheetLink?: ActiveSheetConfig | null;
  sheetLinks?: SheetLinkEntry[];
  spreadsheetId?: string;
  spreadsheetTitle?: string;
  sheets?: string[];
}

export function serializeUserRow(u: UserAccount): string[] {
  return [u.id, u.username, u.password, u.role, u.schoolName, u.createdAt];
}

export function serializeCompetitionRow(c: CompetitionItem): string[] {
  return [
    c.id,
    c.categoryGroup,
    c.mainActivity,
    c.subActivity || '',
    c.competitionDate || '',
    c.competitionTime || '',
    c.venue || '',
    c.updatedAt,
    c.level || '',
  ];
}

export function serializeRegistrationRow(r: RegistrationRecord): string[] {
  return [
    r.id,
    r.competitionId,
    r.categoryGroup,
    r.mainActivity,
    r.subActivity || '',
    r.level,
    r.schoolName,
    JSON.stringify(r.advisors),
    JSON.stringify(r.students),
    r.submittedBy,
    r.createdAt,
    r.updatedAt,
  ];
}

function parseUsers(rows: any[][]): UserAccount[] {
  if (!Array.isArray(rows) || rows.length <= 1) return [];
  return rows
    .slice(1)
    .filter((row) => row[0] && row[1])
    .map((row) => ({
      id: String(row[0] || ''),
      username: String(row[1] || ''),
      password: String(row[2] || ''),
      role: String(row[3]) === 'admin' ? 'admin' : 'school',
      schoolName: String(row[4] || row[1] || ''),
      createdAt: String(row[5] || ''),
    }));
}

export function serializeCategoryGroupsRow(groups: string[]): string[] {
  return [
    CATEGORY_GROUPS_ROW_ID,
    '__CONFIG__',
    '',
    JSON.stringify(groups),
    '',
    '',
    '',
    new Date().toISOString(),
  ];
}

export function serializeGasUrlRow(gasUrl: string): string[] {
  return [
    GAS_URL_ROW_ID,
    '__CONFIG__',
    '',
    gasUrl.trim(),
    '',
    '',
    '',
    new Date().toISOString(),
  ];
}

export function serializeSiteSettingsRow(settings: SiteSettings): string[] {
  return [
    SITE_SETTINGS_ROW_ID,
    '__CONFIG__',
    '',
    JSON.stringify(settings),
    '',
    '',
    '',
    new Date().toISOString(),
  ];
}

export function serializeActiveSheetLinkRow(config: ActiveSheetConfig): string[] {
  return [
    ACTIVE_SHEET_LINK_ROW_ID,
    '__CONFIG__',
    '',
    JSON.stringify(config),
    '',
    '',
    '',
    new Date(config.lastActivatedAt || Date.now()).toISOString(),
  ];
}

export function serializeSheetLinksRow(links: SheetLinkEntry[]): string[] {
  return [
    SHEET_LINKS_ROW_ID,
    '__CONFIG__',
    '',
    JSON.stringify(links),
    '',
    '',
    '',
    new Date().toISOString(),
  ];
}

export function serializeLogRow(log: ActivityLogEntry): string[] {
  return [
    log.id,
    LOG_ROW_MARKER,
    log.actorUsername,
    log.actorName,
    log.actorRole,
    log.action,
    log.targetType,
    log.timestamp,
    JSON.stringify({
      targetId: log.targetId,
      targetTitle: log.targetTitle,
      summary: log.summary,
      details: log.details,
    }),
  ];
}

function parseLogAction(val: string): ActivityLogAction {
  if (val === 'create' || val === 'update' || val === 'delete') return val;
  return 'update';
}

function parseLogTargetType(val: string): ActivityLogTargetType {
  if (
    val === 'competition' ||
    val === 'category' ||
    val === 'user' ||
    val === 'registration' ||
    val === 'settings'
  ) {
    return val;
  }
  return 'competition';
}

function parseActivityLogs(rows: any[][]): ActivityLogEntry[] {
  if (!Array.isArray(rows) || rows.length <= 1) return [];
  const logs: ActivityLogEntry[] = [];
  for (let i = 1; i < rows.length; i += 1) {
    const row = rows[i];
    const id = String(row[0] || '');
    const marker = String(row[1] || '');
    if (!id.startsWith(LOG_ROW_PREFIX) && marker !== LOG_ROW_MARKER) {
      continue;
    }
    let meta: {
      targetId?: string;
      targetTitle?: string;
      summary?: string;
      details?: string[];
    } = {};
    try {
      if (row[8]) {
        meta = JSON.parse(String(row[8]));
      }
    } catch {
      meta = { summary: String(row[8] || '') };
    }
    logs.push({
      id,
      actorUsername: String(row[2] || ''),
      actorName: String(row[3] || row[2] || 'ไม่ระบุผู้ใช้'),
      actorRole: String(row[4]) === 'admin' ? 'admin' : 'school',
      action: parseLogAction(String(row[5] || '')),
      targetType: parseLogTargetType(String(row[6] || '')),
      timestamp: String(row[7] || ''),
      targetId: String(meta.targetId || ''),
      targetTitle: String(meta.targetTitle || ''),
      summary: String(meta.summary || ''),
      details: Array.isArray(meta.details)
        ? meta.details.map((d) => String(d))
        : [],
    });
  }
  return logs.sort((a, b) => {
    const ta = Date.parse(a.timestamp) || 0;
    const tb = Date.parse(b.timestamp) || 0;
    return tb - ta;
  });
}

function parseDiscoveredGasUrl(rows: any[][]): string {
  if (!Array.isArray(rows) || rows.length <= 1) return '';
  const configRow = rows
    .slice(1)
    .find((row) => String(row[0] || '') === GAS_URL_ROW_ID);
  const candidate = String(configRow?.[3] || '').trim();
  return isValidAppsScriptUrl(candidate) ? candidate : '';
}

function parseActiveSheetLink(rows: any[][]): ActiveSheetConfig | null {
  if (!Array.isArray(rows) || rows.length <= 1) return null;
  const configRow = rows
    .slice(1)
    .find((row) => String(row[0] || '') === ACTIVE_SHEET_LINK_ROW_ID);
  if (!configRow || !configRow[3]) return null;
  try {
    const parsed = JSON.parse(String(configRow[3]));
    if (!parsed || typeof parsed !== 'object') return null;
    const spreadsheetId = extractSpreadsheetId(String(parsed.spreadsheetId || parsed.sheetUrl || ''));
    const gasUrl = isValidAppsScriptUrl(String(parsed.gasUrl || ''))
      ? String(parsed.gasUrl).trim()
      : '';
    if (!spreadsheetId && !gasUrl) return null;
    const lastActivatedAt = Number(parsed.lastActivatedAt) || 0;
    return {
      spreadsheetId,
      sheetUrl: spreadsheetId ? buildGoogleSheetUrl(spreadsheetId) : '',
      gasUrl,
      label: typeof parsed.label === 'string' ? parsed.label.trim() : '',
      lastActivatedAt,
    };
  } catch {
    return null;
  }
}

function parseSheetLinks(rows: any[][]): SheetLinkEntry[] {
  if (!Array.isArray(rows) || rows.length <= 1) return [];
  const configRow = rows
    .slice(1)
    .find((row) => String(row[0] || '') === SHEET_LINKS_ROW_ID);
  if (!configRow || !configRow[3]) return [];
  try {
    const parsed = JSON.parse(String(configRow[3]));
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item: any): SheetLinkEntry | null => {
        if (!item || typeof item !== 'object') return null;
        const spreadsheetId = extractSpreadsheetId(
          String(item.spreadsheetId || item.sheetUrl || '')
        );
        const gasUrl = isValidAppsScriptUrl(String(item.gasUrl || ''))
          ? String(item.gasUrl).trim()
          : '';
        if (!spreadsheetId && !gasUrl) return null;
        return {
          id: String(item.id || spreadsheetId || gasUrl),
          label: String(item.label || '').trim(),
          spreadsheetId,
          sheetUrl: spreadsheetId ? buildGoogleSheetUrl(spreadsheetId) : '',
          gasUrl,
          lastActivatedAt: Number(item.lastActivatedAt) || 0,
        };
      })
      .filter((x): x is SheetLinkEntry => x !== null)
      .sort((a, b) => b.lastActivatedAt - a.lastActivatedAt);
  } catch {
    return [];
  }
}

function parseSiteSettings(rows: any[][]): SiteSettings {
  if (!Array.isArray(rows) || rows.length <= 1) {
    return { ...DEFAULT_SITE_SETTINGS };
  }
  const configRow = rows
    .slice(1)
    .find((row) => String(row[0] || '') === SITE_SETTINGS_ROW_ID);
  if (!configRow || !configRow[3]) {
    return { ...DEFAULT_SITE_SETTINGS };
  }
  try {
    const parsed = JSON.parse(String(configRow[3]));
    if (!parsed || typeof parsed !== 'object') {
      return { ...DEFAULT_SITE_SETTINGS };
    }
    return {
      siteTitle:
        typeof parsed.siteTitle === 'string' && parsed.siteTitle.trim()
          ? parsed.siteTitle
          : DEFAULT_SITE_SETTINGS.siteTitle,
      siteSubtitle:
        typeof parsed.siteSubtitle === 'string'
          ? parsed.siteSubtitle
          : DEFAULT_SITE_SETTINGS.siteSubtitle,
      heroHeading:
        typeof parsed.heroHeading === 'string' && parsed.heroHeading.trim()
          ? parsed.heroHeading
          : DEFAULT_SITE_SETTINGS.heroHeading,
      heroDescription:
        typeof parsed.heroDescription === 'string'
          ? parsed.heroDescription
          : DEFAULT_SITE_SETTINGS.heroDescription,
      footerText:
        typeof parsed.footerText === 'string' && parsed.footerText.trim()
          ? parsed.footerText
          : DEFAULT_SITE_SETTINGS.footerText,
    };
  } catch {
    return { ...DEFAULT_SITE_SETTINGS };
  }
}

function parseCompetitionLevel(
  val: string,
  mainActivity: string,
  subActivity: string
): CompetitionLevel | '' {
  const trimmed = String(val || '').trim();
  if (COMPETITION_LEVELS.includes(trimmed as CompetitionLevel)) {
    return trimmed as CompetitionLevel;
  }
  const combined = `${mainActivity} ${subActivity}`;
  const found = COMPETITION_LEVELS.find((lvl) => combined.includes(lvl));
  if (found) return found;
  if (/ป\.?\s*1\s*[-–]\s*3/.test(combined)) return 'ป.1-3';
  if (/ป\.?\s*4\s*[-–]\s*6/.test(combined)) return 'ป.4-6';
  if (/ม\.?\s*1\s*[-–]\s*3/.test(combined)) return 'ม.1-3';
  if (combined.includes('ปฐมวัย')) return 'ปฐมวัย';
  return '';
}

function parseCompetitions(rows: any[][]): CompetitionItem[] {
  if (!Array.isArray(rows) || rows.length <= 1) return [];
  return rows
    .slice(1)
    .filter(
      (row) =>
        row[0] &&
        !String(row[0]).startsWith('__') &&
        String(row[1]) !== '__CONFIG__' &&
        String(row[1]) !== LOG_ROW_MARKER &&
        row[1] &&
        row[2]
    )
    .map((row) => {
      const mainActivity = String(row[2] || '');
      const subActivity = String(row[3] || '');
      return {
        id: String(row[0] || ''),
        categoryGroup: String(row[1] || ''),
        mainActivity,
        subActivity,
        level: parseCompetitionLevel(String(row[8] || ''), mainActivity, subActivity),
        competitionDate: String(row[4] || ''),
        competitionTime: String(row[5] || ''),
        venue: String(row[6] || ''),
        updatedAt: String(row[7] || ''),
      };
    });
}

function parseCategoryGroups(rows: any[][], competitions: CompetitionItem[]): string[] {
  let configured: string[] | null = null;
  if (Array.isArray(rows) && rows.length > 1) {
    const configRow = rows
      .slice(1)
      .find((row) => String(row[0] || '') === CATEGORY_GROUPS_ROW_ID);
    if (configRow && configRow[3]) {
      const parsed = parseJsonArray<string>(configRow[3], []);
      if (parsed.length > 0) {
        configured = parsed.map((g) => String(g).trim()).filter(Boolean);
      }
    }
  }

  const base = configured ? [...configured] : [...DEFAULT_CATEGORY_GROUPS];
  const existingSet = new Set(base);
  competitions.forEach((c) => {
    if (c.categoryGroup && !existingSet.has(c.categoryGroup)) {
      existingSet.add(c.categoryGroup);
      base.push(c.categoryGroup);
    }
  });
  return base;
}

function parseLevel(val: string): CompetitionLevel {
  return COMPETITION_LEVELS.includes(val as CompetitionLevel)
    ? (val as CompetitionLevel)
    : 'ป.1-3';
}

function parseJsonArray<T>(raw: any, fallback: T[]): T[] {
  if (Array.isArray(raw)) return raw;
  if (!raw || typeof raw !== 'string') return fallback;
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
}

function parseRegistrations(rows: any[][]): RegistrationRecord[] {
  if (!Array.isArray(rows) || rows.length <= 1) return [];
  return rows
    .slice(1)
    .filter((row) => row[0] && row[1])
    .map((row) => ({
      id: String(row[0] || ''),
      competitionId: String(row[1] || ''),
      categoryGroup: String(row[2] || ''),
      mainActivity: String(row[3] || ''),
      subActivity: String(row[4] || ''),
      level: parseLevel(String(row[5] || '')),
      schoolName: String(row[6] || ''),
      advisors: parseJsonArray<string>(row[7], []),
      students: parseJsonArray<StudentEntry>(row[8], []),
      submittedBy: String(row[9] || ''),
      createdAt: String(row[10] || ''),
      updatedAt: String(row[11] || ''),
    }));
}

export function isValidAppsScriptUrl(url: string): boolean {
  const trimmed = url.trim();
  return /^https:\/\/script\.google\.com\/(a\/macros\/[^/]+\/|macros\/)s\/[^/]+\/exec/.test(
    trimmed
  );
}

export function extractSpreadsheetId(input: string): string {
  const trimmed = String(input || '').trim();
  if (!trimmed) return '';
  const urlMatch = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (urlMatch && urlMatch[1]) {
    return urlMatch[1];
  }
  if (/^[a-zA-Z0-9-_]{20,}$/.test(trimmed) && !trimmed.startsWith('http')) {
    return trimmed;
  }
  return '';
}

export function buildGoogleSheetUrl(spreadsheetId: string): string {
  const clean = extractSpreadsheetId(spreadsheetId) || spreadsheetId.trim();
  if (!clean) return '';
  return `https://docs.google.com/spreadsheets/d/${clean}/edit`;
}

function buildFetchFailureError(): Error {
  return new Error(
    'Failed to fetch: เบราว์เซอร์ไม่สามารถดึงข้อมูลจากลิงก์ Apps Script นี้ได้ (มักเกิดจากตอน Deploy ตั้งค่า "ผู้มีสิทธิ์เข้าถึง (Who has access)" เป็น "เฉพาะฉัน" แทนที่จะเป็น "ทุกคน (Anyone)" หรือยังไม่ได้กดยืนยันสิทธิ์ตอน Deploy)'
  );
}

async function parseGasResponse(res: Response): Promise<any> {
  if (!res.ok) {
    throw new Error(`ไม่สามารถติดต่อ Google Apps Script ได้ (HTTP ${res.status})`);
  }

  const text = await res.text();
  let json: any;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(
      'รูปแบบการตอบกลับจาก Apps Script ไม่ถูกต้อง กรุณาตรวจสอบว่าวางโค้ด Apps Script ครบถ้วน และ Deploy เป็น Web App โดยตั้งค่า "Who has access" เป็น "Anyone (ทุกคน)" แล้ว'
    );
  }

  if (!json.ok) {
    throw new Error(json.error || 'เกิดข้อผิดพลาดในการดำเนินการกับ Google Sheets');
  }

  return json;
}

async function callAppsScriptGet(gasUrl: string, params: Record<string, string>): Promise<any> {
  const url = new URL(gasUrl.trim());
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));

  let res: Response;
  try {
    res = await fetch(url.toString(), {
      method: 'GET',
      redirect: 'follow',
    });
  } catch {
    throw buildFetchFailureError();
  }

  return parseGasResponse(res);
}

async function callAppsScriptPost(
  gasUrl: string,
  payload: Record<string, any>
): Promise<any> {
  const trimmed = gasUrl.trim();
  if (!trimmed) {
    throw new Error('กรุณาระบุ Google Apps Script Web App URL');
  }

  let res: Response;
  try {
    // Plain string body uses default text/plain without triggering CORS preflight
    res = await fetch(trimmed, {
      method: 'POST',
      redirect: 'follow',
      body: JSON.stringify(payload),
    });
  } catch {
    throw buildFetchFailureError();
  }

  return parseGasResponse(res);
}

export async function fetchAllFromAppsScript(
  gasUrl: string,
  seedIfEmpty = true,
  targetSpreadsheetId?: string
): Promise<SheetDatabaseState> {
  const params: Record<string, string> = { action: 'getAll' };
  if (targetSpreadsheetId && targetSpreadsheetId.trim()) {
    params.spreadsheetId = targetSpreadsheetId.trim();
  }

  // Use simple GET first (fastest and avoids POST redirect quirks on initial connect)
  let json = await callAppsScriptGet(gasUrl, params);

  // If caller explicitly targeted a different spreadsheetId and Apps Script returned a mismatched spreadsheetId,
  // reject so caller can fall back to direct public CSV read for the target sheet.
  if (
    targetSpreadsheetId &&
    json.spreadsheetId &&
    String(json.spreadsheetId).trim() !== targetSpreadsheetId.trim()
  ) {
    throw new Error('APPS_SCRIPT_SPREADSHEET_MISMATCH');
  }

  const sheetsList: string[] = json.sheets || [];
  const missingAny =
    !sheetsList.includes(SHEET_NAMES.USERS) ||
    !sheetsList.includes(SHEET_NAMES.COMPETITIONS) ||
    !sheetsList.includes(SHEET_NAMES.REGISTRATIONS);

  const userRows = json.data?.user || [];
  const compRows = json.data?.['รายการ'] || [];

  const needsSeed =
    seedIfEmpty && (missingAny || (userRows.length <= 1 && compRows.length <= 1));

  if (needsSeed) {
    json = await callAppsScriptPost(gasUrl, {
      action: 'getAll',
      spreadsheetId: targetSpreadsheetId?.trim() || undefined,
      seedIfEmpty: true,
      seedData: {
        users: INITIAL_USERS.map(serializeUserRow),
        competitions: INITIAL_COMPETITIONS.map(serializeCompetitionRow),
        registrations: INITIAL_REGISTRATIONS.map(serializeRegistrationRow),
      },
    });
  }

  const users = parseUsers(json.data?.user || []);
  const compRawRows = json.data?.['รายการ'] || [];
  const competitions = parseCompetitions(compRawRows);
  const categoryGroups = parseCategoryGroups(compRawRows, competitions);
  const siteSettings = parseSiteSettings(compRawRows);
  const logs = parseActivityLogs(compRawRows);
  const discoveredGasUrl = parseDiscoveredGasUrl(compRawRows);
  const activeSheetLink = parseActiveSheetLink(compRawRows);
  const sheetLinks = parseSheetLinks(compRawRows);
  const registrations = parseRegistrations(json.data?.['ลงทะเบียน'] || []);

  // Ensure default admin account always exists in memory
  const hasAdmin = users.some((u) => u.username === 'admin' && u.role === 'admin');
  if (!hasAdmin) {
    users.unshift(INITIAL_USERS[0]);
  }

  return {
    users,
    competitions,
    registrations,
    categoryGroups,
    siteSettings,
    logs,
    discoveredGasUrl,
    activeSheetLink,
    sheetLinks,
    spreadsheetId: String(json.spreadsheetId || targetSpreadsheetId || '').trim() || undefined,
    spreadsheetTitle: json.spreadsheetTitle,
    sheets: json.sheets || [],
  };
}

export function parseCsvRows(csvText: string): string[][] {
  const clean = csvText.replace(/^\uFEFF/, '');
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < clean.length; i += 1) {
    const ch = clean[i];
    if (inQuotes) {
      if (ch === '"') {
        if (clean[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\r') {
      if (clean[i + 1] === '\n') i += 1;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else if (ch === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += ch;
    }
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows;
}

async function fetchPublicSheetCsv(
  spreadsheetId: string,
  sheetName: string,
  expectedCol1: string
): Promise<{ rows: string[][]; exists: boolean }> {
  const url = `https://docs.google.com/spreadsheets/d/${encodeURIComponent(
    spreadsheetId
  )}/gviz/tq?tqx=out:csv&headers=0&sheet=${encodeURIComponent(sheetName)}&_t=${Date.now()}`;

  const res = await fetch(url, { method: 'GET', redirect: 'follow' });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} while reading ${sheetName}`);
  }
  const text = await res.text();
  if (text.trim().startsWith('<!DOCTYPE') || text.trim().startsWith('<html')) {
    throw new Error('Google Sheet ไม่ได้เปิดสิทธิ์การดูแบบสาธารณะ (Anyone with the link)');
  }
  const rows = parseCsvRows(text);
  const headerMatches =
    rows.length > 0 &&
    String(rows[0][0] || '').trim() === 'id' &&
    String(rows[0][1] || '').trim() === expectedCol1;

  return {
    rows: headerMatches ? rows : [],
    exists: headerMatches,
  };
}

export async function fetchAllFromPublicSheetCsv(
  spreadsheetId: string = DEFAULT_SPREADSHEET_ID
): Promise<SheetDatabaseState> {
  const cleanId = extractSpreadsheetId(spreadsheetId) || DEFAULT_SPREADSHEET_ID;
  const [userRes, compRes, regRes] = await Promise.all([
    fetchPublicSheetCsv(cleanId, SHEET_NAMES.USERS, 'username'),
    fetchPublicSheetCsv(cleanId, SHEET_NAMES.COMPETITIONS, 'categoryGroup'),
    fetchPublicSheetCsv(cleanId, SHEET_NAMES.REGISTRATIONS, 'competitionId'),
  ]);

  if (!userRes.exists && !compRes.exists && !regRes.exists) {
    throw new Error('ไม่พบข้อมูลชีททั้ง 3 ชีทใน Google Spreadsheet (ตรวจสอบชื่อชีท user, รายการ, ลงทะเบียน และสิทธิ์แชร์แบบสาธารณะ)');
  }

  const users = parseUsers(userRes.rows);
  const competitions = parseCompetitions(compRes.rows);
  const categoryGroups = parseCategoryGroups(compRes.rows, competitions);
  const siteSettings = parseSiteSettings(compRes.rows);
  const logs = parseActivityLogs(compRes.rows);
  const discoveredGasUrl = parseDiscoveredGasUrl(compRes.rows);
  const activeSheetLink = parseActiveSheetLink(compRes.rows);
  const sheetLinks = parseSheetLinks(compRes.rows);
  const registrations = parseRegistrations(regRes.rows);

  const hasAdmin = users.some((u) => u.username === 'admin' && u.role === 'admin');
  if (!hasAdmin) {
    users.unshift(INITIAL_USERS[0]);
  }

  const sheets: string[] = [];
  if (userRes.exists) sheets.push(SHEET_NAMES.USERS);
  if (compRes.exists) sheets.push(SHEET_NAMES.COMPETITIONS);
  if (regRes.exists) sheets.push(SHEET_NAMES.REGISTRATIONS);

  return {
    users,
    competitions,
    registrations,
    categoryGroups,
    siteSettings,
    logs,
    discoveredGasUrl,
    activeSheetLink,
    sheetLinks,
    spreadsheetId: cleanId,
    spreadsheetTitle: 'Google Sheets (ซิงค์อัตโนมัติ)',
    sheets,
  };
}

export async function upsertRowViaAppsScript(
  gasUrl: string,
  sheetName: SheetTabName,
  id: string,
  rowValues: string[],
  targetSpreadsheetId?: string
): Promise<void> {
  await callAppsScriptPost(gasUrl, {
    action: 'upsert',
    spreadsheetId: targetSpreadsheetId?.trim() || undefined,
    sheetName,
    id,
    rowValues,
  });
}

export async function deleteRowViaAppsScript(
  gasUrl: string,
  sheetName: SheetTabName,
  id: string,
  targetSpreadsheetId?: string
): Promise<void> {
  await callAppsScriptPost(gasUrl, {
    action: 'delete',
    spreadsheetId: targetSpreadsheetId?.trim() || undefined,
    sheetName,
    id,
  });
}

export const APPS_SCRIPT_CODE = `// วางโค้ดนี้ใน ส่วนขยาย (Extensions) > Apps Script ของ Google Sheets
const SPREADSHEET_ID = '${DEFAULT_SPREADSHEET_ID}';

const HEADERS = {
  'user': ['id', 'username', 'password', 'role', 'schoolName', 'createdAt'],
  'รายการ': ['id', 'categoryGroup', 'mainActivity', 'subActivity', 'competitionDate', 'competitionTime', 'venue', 'updatedAt', 'level'],
  'ลงทะเบียน': ['id', 'competitionId', 'categoryGroup', 'mainActivity', 'subActivity', 'level', 'schoolName', 'advisorsJson', 'studentsJson', 'submittedBy', 'createdAt', 'updatedAt']
};

function getSpreadsheet_(targetId) {
  if (targetId && String(targetId).trim() !== '') {
    return SpreadsheetApp.openById(String(targetId).trim());
  }
  try {
    var active = SpreadsheetApp.getActiveSpreadsheet();
    if (active) return active;
  } catch (e) {}
  return SpreadsheetApp.openById(SPREADSHEET_ID);
}

function ensureSheet_(ss, name, seedRows) {
  var sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
  }
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(HEADERS[name]);
    if (seedRows && seedRows.length > 0) {
      sheet.getRange(2, 1, seedRows.length, HEADERS[name].length).setValues(seedRows);
    }
  }
  return sheet;
}

function readSheetValues_(ss, name) {
  var sheet = ss.getSheetByName(name);
  if (!sheet || sheet.getLastRow() === 0) return [];
  return sheet.getDataRange().getDisplayValues();
}

function jsonOut_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function doGet(e) {
  try {
    var targetId = (e && e.parameter && e.parameter.spreadsheetId) ? e.parameter.spreadsheetId : '';
    var ss = getSpreadsheet_(targetId);
    var action = (e && e.parameter && e.parameter.action) ? e.parameter.action : 'ping';
    if (action === 'getAll') {
      return jsonOut_({
        ok: true,
        spreadsheetId: ss.getId(),
        spreadsheetTitle: ss.getName(),
        sheets: ss.getSheets().map(function(s) { return s.getName(); }),
        data: {
          'user': readSheetValues_(ss, 'user'),
          'รายการ': readSheetValues_(ss, 'รายการ'),
          'ลงทะเบียน': readSheetValues_(ss, 'ลงทะเบียน')
        }
      });
    }
    return jsonOut_({ ok: true, message: 'Silapa74 Google Sheets Bridge Ready', spreadsheetId: ss.getId(), title: ss.getName() });
  } catch (err) {
    return jsonOut_({ ok: false, error: String(err) });
  }
}

function doPost(e) {
  var lock = null;
  try {
    lock = LockService.getScriptLock();
    lock.waitLock(15000);
    var raw = (e && e.postData && e.postData.contents) ? e.postData.contents : '{}';
    var req = JSON.parse(raw);
    var ss = getSpreadsheet_(req.spreadsheetId || '');
    var action = req.action || 'getAll';

    if (action === 'initSeed' || action === 'getAll') {
      var seed = req.seedData || {};
      var uSheet = ensureSheet_(ss, 'user', seed.users || []);
      var cSheet = ensureSheet_(ss, 'รายการ', seed.competitions || []);
      var rSheet = ensureSheet_(ss, 'ลงทะเบียน', seed.registrations || []);
      return jsonOut_({
        ok: true,
        spreadsheetId: ss.getId(),
        spreadsheetTitle: ss.getName(),
        sheets: ss.getSheets().map(function(s) { return s.getName(); }),
        data: {
          'user': uSheet.getDataRange().getDisplayValues(),
          'รายการ': cSheet.getDataRange().getDisplayValues(),
          'ลงทะเบียน': rSheet.getDataRange().getDisplayValues()
        }
      });
    }

    if (action === 'upsert') {
      var sheet = ensureSheet_(ss, req.sheetName, []);
      var values = sheet.getDataRange().getValues();
      var targetRow = -1;
      for (var i = 1; i < values.length; i++) {
        if (String(values[i][0]) === String(req.id)) {
          targetRow = i + 1;
          break;
        }
      }
      if (targetRow > 0) {
        sheet.getRange(targetRow, 1, 1, req.rowValues.length).setValues([req.rowValues]);
      } else {
        sheet.appendRow(req.rowValues);
      }
      return jsonOut_({ ok: true, spreadsheetId: ss.getId() });
    }

    if (action === 'delete') {
      var delSheet = ensureSheet_(ss, req.sheetName, []);
      var delValues = delSheet.getDataRange().getValues();
      for (var j = 1; j < delValues.length; j++) {
        if (String(delValues[j][0]) === String(req.id)) {
          delSheet.deleteRow(j + 1);
          break;
        }
      }
      return jsonOut_({ ok: true, spreadsheetId: ss.getId() });
    }

    return jsonOut_({ ok: false, error: 'Unknown action: ' + action });
  } catch (err) {
    return jsonOut_({ ok: false, error: String(err) });
  } finally {
    if (lock) {
      try { lock.releaseLock(); } catch (e2) {}
    }
  }
}`;

export interface ServerSheetConfigResponse {
  activeSheetConfig: ActiveSheetConfig | null;
  sheetLinks: SheetLinkEntry[];
}

export async function fetchServerSheetConfig(): Promise<ServerSheetConfigResponse | null> {
  try {
    const res = await fetch(`/api/sheet-config?_t=${Date.now()}`, {
      method: 'GET',
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const json = await res.json();
    if (!json || !json.ok || !json.activeSheetConfig) return null;
    return {
      activeSheetConfig: json.activeSheetConfig as ActiveSheetConfig,
      sheetLinks: Array.isArray(json.sheetLinks)
        ? (json.sheetLinks as SheetLinkEntry[])
        : [],
    };
  } catch {
    return null;
  }
}

export async function saveServerSheetConfig(
  activeSheetConfig: ActiveSheetConfig,
  sheetLinks: SheetLinkEntry[],
  options?: { forceReplace?: boolean; replaceLinks?: boolean }
): Promise<ServerSheetConfigResponse | null> {
  try {
    const res = await fetch('/api/sheet-config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        activeSheetConfig,
        sheetLinks,
        forceReplace: Boolean(options?.forceReplace),
        replaceLinks: Boolean(options?.replaceLinks),
      }),
    });
    if (!res.ok) return null;
    const json = await res.json();
    if (!json || !json.ok) return null;
    return {
      activeSheetConfig: json.activeSheetConfig as ActiveSheetConfig,
      sheetLinks: Array.isArray(json.sheetLinks)
        ? (json.sheetLinks as SheetLinkEntry[])
        : [],
    };
  } catch {
    return null;
  }
}
