import express from 'express';
import fs from 'node:fs';
import path from 'node:path';

interface StoredSheetLinkEntry {
  id: string;
  label: string;
  spreadsheetId: string;
  sheetUrl: string;
  gasUrl: string;
  lastActivatedAt: number;
}

interface StoredActiveSheetConfig {
  spreadsheetId: string;
  sheetUrl: string;
  gasUrl: string;
  label: string;
  lastActivatedAt: number;
}

interface StoredSheetState {
  activeSheetConfig: StoredActiveSheetConfig;
  sheetLinks: StoredSheetLinkEntry[];
}

const DEFAULT_SPREADSHEET_ID = '1RauGo4xOfKS9xG17azBQpPbi-IgPBaBeUKEjU1Qg9NE';
const DEFAULT_GAS_URL = (process.env.VITE_APPS_SCRIPT_URL || '').trim();
const DATA_DIR = path.resolve(process.cwd(), 'data');
const CONFIG_FILE = path.join(DATA_DIR, 'sheet-config.json');

function extractSpreadsheetId(input: string): string {
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

function isValidAppsScriptUrl(url: string): boolean {
  const trimmed = String(url || '').trim();
  return /^https:\/\/script\.google\.com\/(a\/macros\/[^/]+\/|macros\/)s\/[^/]+\/exec/.test(
    trimmed
  );
}

function buildGoogleSheetUrl(spreadsheetId: string): string {
  const clean = extractSpreadsheetId(spreadsheetId) || spreadsheetId.trim();
  if (!clean) return '';
  return `https://docs.google.com/spreadsheets/d/${clean}/edit`;
}

function createDefaultState(): StoredSheetState {
  const validGas = isValidAppsScriptUrl(DEFAULT_GAS_URL) ? DEFAULT_GAS_URL : '';
  const activeSheetConfig: StoredActiveSheetConfig = {
    spreadsheetId: DEFAULT_SPREADSHEET_ID,
    sheetUrl: buildGoogleSheetUrl(DEFAULT_SPREADSHEET_ID),
    gasUrl: validGas,
    label: 'ชีทหลักเริ่มต้น',
    lastActivatedAt: 0,
  };
  return {
    activeSheetConfig,
    sheetLinks: [
      {
        id: DEFAULT_SPREADSHEET_ID,
        label: 'ชีทหลักเริ่มต้น',
        spreadsheetId: DEFAULT_SPREADSHEET_ID,
        sheetUrl: buildGoogleSheetUrl(DEFAULT_SPREADSHEET_ID),
        gasUrl: validGas,
        lastActivatedAt: 0,
      },
    ],
  };
}

function sanitizeConfig(raw: any): StoredActiveSheetConfig | null {
  if (!raw || typeof raw !== 'object') return null;
  const sid = extractSpreadsheetId(String(raw.spreadsheetId || raw.sheetUrl || ''));
  const gUrl = isValidAppsScriptUrl(String(raw.gasUrl || ''))
    ? String(raw.gasUrl).trim()
    : '';
  if (!sid && !gUrl) return null;
  const finalSid = sid || DEFAULT_SPREADSHEET_ID;
  return {
    spreadsheetId: finalSid,
    sheetUrl: buildGoogleSheetUrl(finalSid),
    gasUrl: gUrl,
    label: typeof raw.label === 'string' ? raw.label.trim() : '',
    lastActivatedAt: Number(raw.lastActivatedAt) || 0,
  };
}

function sanitizeLinks(rawList: any): StoredSheetLinkEntry[] {
  if (!Array.isArray(rawList)) return [];
  const map = new Map<string, StoredSheetLinkEntry>();
  for (const item of rawList) {
    if (!item || typeof item !== 'object') continue;
    const sid = extractSpreadsheetId(String(item.spreadsheetId || item.sheetUrl || ''));
    const gUrl = isValidAppsScriptUrl(String(item.gasUrl || ''))
      ? String(item.gasUrl).trim()
      : '';
    if (!sid && !gUrl) continue;
    const key = sid || gUrl;
    const existing = map.get(key);
    const ts = Number(item.lastActivatedAt) || 0;
    if (!existing || ts >= existing.lastActivatedAt) {
      map.set(key, {
        id: key,
        label: typeof item.label === 'string' ? item.label.trim() : existing?.label || '',
        spreadsheetId: sid || existing?.spreadsheetId || '',
        sheetUrl: (sid || existing?.spreadsheetId)
          ? buildGoogleSheetUrl(sid || existing?.spreadsheetId || '')
          : '',
        gasUrl: gUrl || existing?.gasUrl || '',
        lastActivatedAt: Math.max(ts, existing?.lastActivatedAt || 0),
      });
    }
  }
  return Array.from(map.values()).sort((a, b) => b.lastActivatedAt - a.lastActivatedAt);
}

function readStoredState(): StoredSheetState {
  try {
    if (!fs.existsSync(CONFIG_FILE)) {
      return createDefaultState();
    }
    const raw = fs.readFileSync(CONFIG_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    const cfg = sanitizeConfig(parsed?.activeSheetConfig);
    if (!cfg) {
      return createDefaultState();
    }
    const links = sanitizeLinks([
      ...(Array.isArray(parsed?.sheetLinks) ? parsed.sheetLinks : []),
      {
        id: cfg.spreadsheetId || cfg.gasUrl,
        ...cfg,
      },
    ]);
    return {
      activeSheetConfig: cfg,
      sheetLinks: links,
    };
  } catch {
    return createDefaultState();
  }
}

function writeStoredState(state: StoredSheetState): void {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(state, null, 2), 'utf8');
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '256kb' }));

  app.get('/api/sheet-config', (_req, res) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    const state = readStoredState();
    res.json({
      ok: true,
      activeSheetConfig: state.activeSheetConfig,
      sheetLinks: state.sheetLinks,
    });
  });

  app.post('/api/sheet-config', (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    const incomingConfig = sanitizeConfig(req.body?.activeSheetConfig);
    if (!incomingConfig) {
      res.status(400).json({ ok: false, error: 'ข้อมูลลิงก์ Google Sheets ไม่ถูกต้อง' });
      return;
    }

    const currentState = readStoredState();
    const forceReplace = Boolean(req.body?.forceReplace);
    const shouldReplace =
      forceReplace ||
      incomingConfig.lastActivatedAt >= currentState.activeSheetConfig.lastActivatedAt;

    const nextActive = shouldReplace
      ? incomingConfig
      : currentState.activeSheetConfig;

    const incomingLinks = Array.isArray(req.body?.sheetLinks)
      ? req.body.sheetLinks
      : [];
    const replaceLinks = Boolean(req.body?.replaceLinks);
    const nextLinks = sanitizeLinks([
      ...(replaceLinks ? [] : currentState.sheetLinks),
      ...incomingLinks,
      {
        id: nextActive.spreadsheetId || nextActive.gasUrl,
        ...nextActive,
      },
    ]);

    const nextState: StoredSheetState = {
      activeSheetConfig: nextActive,
      sheetLinks: nextLinks,
    };

    try {
      writeStoredState(nextState);
      res.json({
        ok: true,
        activeSheetConfig: nextState.activeSheetConfig,
        sheetLinks: nextState.sheetLinks,
      });
    } catch (err: any) {
      res.status(500).json({
        ok: false,
        error: err?.message || 'ไม่สามารถบันทึกลิงก์ชีทลงเซิร์ฟเวอร์ได้',
      });
    }
  });

  const isProd = process.env.NODE_ENV === 'production';
  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  const port = Number(process.env.PORT) || 3000;
  app.listen(port, '0.0.0.0', () => {
    console.log(`Server listening on http://0.0.0.0:${port}`);
  });
}

startServer();
