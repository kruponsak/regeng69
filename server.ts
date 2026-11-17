import express from 'express';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

interface StoredActiveSheetConfig {
  spreadsheetId: string;
  sheetUrl: string;
  gasUrl: string;
  label: string;
  lastActivatedAt: number;
}

interface StoredServerSheetState {
  instanceId: string;
  activeSheetConfig: StoredActiveSheetConfig;
}

const REPO_GAS_URL =
  'https://script.google.com/macros/s/AKfycbziZn0nGQXNw3METIFDrKWDD3WXgqrCpeNXYjxf_59U103hDLU3V2FaIn-vm_hiNxErxg/exec';
const DEFAULT_SPREADSHEET_ID = (
  process.env.VITE_DEFAULT_SPREADSHEET_ID ||
  process.env.DEFAULT_SPREADSHEET_ID ||
  ''
).trim();
const DEFAULT_GAS_URL = (
  process.env.VITE_APPS_SCRIPT_URL ||
  REPO_GAS_URL
).trim();
const ENV_INSTANCE_ID = (process.env.APP_INSTANCE_ID || '').trim();
const DATA_DIR = path.resolve(process.cwd(), 'data');
const CONFIG_FILE = path.join(DATA_DIR, 'regeng69-sheet-config.json');

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

function createDefaultConfig(): StoredActiveSheetConfig {
  const validGas = isValidAppsScriptUrl(DEFAULT_GAS_URL) ? DEFAULT_GAS_URL : REPO_GAS_URL;
  return {
    spreadsheetId: DEFAULT_SPREADSHEET_ID,
    sheetUrl: buildGoogleSheetUrl(DEFAULT_SPREADSHEET_ID),
    gasUrl: validGas,
    label: 'Google Sheets หลัก (regeng69)',
    lastActivatedAt: Date.now(),
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

function writeStoredState(state: StoredServerSheetState): void {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(state, null, 2), 'utf8');
}

function readStoredState(): StoredServerSheetState {
  try {
    if (!fs.existsSync(CONFIG_FILE)) {
      const initial: StoredServerSheetState = {
        instanceId: ENV_INSTANCE_ID || crypto.randomUUID(),
        activeSheetConfig: createDefaultConfig(),
      };
      try {
        writeStoredState(initial);
      } catch {
        // ignore write failure on read-only filesystem
      }
      return initial;
    }
    const raw = fs.readFileSync(CONFIG_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    const instanceId =
      ENV_INSTANCE_ID ||
      (typeof parsed?.instanceId === 'string' && parsed.instanceId.trim()
        ? parsed.instanceId.trim()
        : crypto.randomUUID());
    const cfg = sanitizeConfig(parsed?.activeSheetConfig ?? parsed) || createDefaultConfig();
    const state: StoredServerSheetState = { instanceId, activeSheetConfig: cfg };
    if (!parsed?.instanceId) {
      try {
        writeStoredState(state);
      } catch {
        // ignore write failure
      }
    }
    return state;
  } catch {
    return {
      instanceId: ENV_INSTANCE_ID || crypto.randomUUID(),
      activeSheetConfig: createDefaultConfig(),
    };
  }
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '128kb' }));

  app.get('/api/sheet-config', (_req, res) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    const state = readStoredState();
    res.json({
      ok: true,
      instanceId: state.instanceId,
      activeSheetConfig: state.activeSheetConfig,
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
    const nextActive: StoredActiveSheetConfig = {
      ...incomingConfig,
      lastActivatedAt: incomingConfig.lastActivatedAt || Date.now(),
    };
    const nextState: StoredServerSheetState = {
      instanceId: currentState.instanceId,
      activeSheetConfig: nextActive,
    };

    try {
      writeStoredState(nextState);
      res.json({
        ok: true,
        instanceId: nextState.instanceId,
        activeSheetConfig: nextState.activeSheetConfig,
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
