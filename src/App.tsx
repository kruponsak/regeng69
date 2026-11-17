import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  ActiveSheetConfig,
  ActivityLogEntry,
  CompetitionItem,
  ConfirmationState,
  DEFAULT_CATEGORY_GROUPS,
  DEFAULT_SITE_SETTINGS,
  RegistrationRecord,
  ScreenPath,
  SiteSettings,
  TransitionType,
  UserAccount,
  isRegistrationComplete,
} from './types';
import {
  INITIAL_COMPETITIONS,
  INITIAL_REGISTRATIONS,
  INITIAL_USERS,
} from './lib/seedData';
import {
  CATEGORY_GROUPS_ROW_ID,
  DEFAULT_APPS_SCRIPT_URL,
  DEFAULT_SPREADSHEET_ID,
  GAS_URL_ROW_ID,
  LOG_ROW_PREFIX,
  SHEET_NAMES,
  SITE_SETTINGS_ROW_ID,
  SheetDatabaseState,
  buildGoogleSheetUrl,
  deleteRowViaAppsScript,
  extractSpreadsheetId,
  fetchAllFromAppsScript,
  fetchAllFromPublicSheetCsv,
  fetchServerSheetConfig,
  isValidAppsScriptUrl,
  saveServerSheetConfig,
  serializeCategoryGroupsRow,
  serializeCompetitionRow,
  serializeGasUrlRow,
  serializeLogRow,
  serializeRegistrationRow,
  serializeSiteSettingsRow,
  serializeUserRow,
  upsertRowViaAppsScript,
} from './lib/sheetsDb';
import { PublicPortalScreen } from './components/PublicPortalScreen';
import { LoginScreen } from './components/LoginScreen';
import { SchoolPortalScreen } from './components/SchoolPortalScreen';
import { AdminCentralScreen } from './components/AdminCentralScreen';
import { ConfirmDialog } from './components/ConfirmDialog';
import { GoogleSheetsModal } from './components/GoogleSheetsModal';

const APP_PATH_SCOPE = (() => {
  try {
    const clean = (window.location.pathname || '/').replace(/\/+$/, '');
    return clean ? clean.replace(/[^a-zA-Z0-9_-]/g, '_') : 'root';
  } catch {
    return 'root';
  }
})();

const STORAGE_PREFIX = `silapa74_${APP_PATH_SCOPE}`;
const SERVER_INSTANCE_ID_STORAGE_KEY = `${STORAGE_PREFIX}_server_instance_id`;
const GAS_URL_STORAGE_KEY = `${STORAGE_PREFIX}_gas_webapp_url`;
const ACTIVE_SHEET_CONFIG_STORAGE_KEY = `${STORAGE_PREFIX}_active_sheet_config`;
const CATEGORY_GROUPS_STORAGE_KEY = `${STORAGE_PREFIX}_category_groups`;
const SITE_SETTINGS_STORAGE_KEY = `${STORAGE_PREFIX}_site_settings`;
const ACTIVITY_LOGS_STORAGE_KEY = `${STORAGE_PREFIX}_activity_logs`;

function generateNextId(prefix: string, existingIds: string[]): string {
  const nums = existingIds
    .map((id) => {
      const m = id.match(new RegExp(`^${prefix}-(\\d+)$`));
      return m ? parseInt(m[1], 10) : 0;
    })
    .filter((n) => !Number.isNaN(n));
  const next = (nums.length > 0 ? Math.max(...nums) : 0) + 1;
  return `${prefix}-${String(next).padStart(3, '0')}`;
}

export default function App() {
  // Navigation State — Initial Screen is public-portal
  const [activeScreen, setActiveScreen] = useState<ScreenPath>('public-portal');
  const [transitionType, setTransitionType] = useState<TransitionType>('none');

  // Application Data State (3 sheets: user, รายการ, ลงทะเบียน)
  const [users, setUsers] = useState<UserAccount[]>(INITIAL_USERS);
  const [competitions, setCompetitions] = useState<CompetitionItem[]>(INITIAL_COMPETITIONS);
  const [registrations, setRegistrations] = useState<RegistrationRecord[]>(INITIAL_REGISTRATIONS);
  const [categoryGroups, setCategoryGroups] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(CATEGORY_GROUPS_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // ignore storage error
    }
    return [...DEFAULT_CATEGORY_GROUPS];
  });
  const [siteSettings, setSiteSettings] = useState<SiteSettings>(() => {
    try {
      const saved = localStorage.getItem(SITE_SETTINGS_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === 'object') {
          return { ...DEFAULT_SITE_SETTINGS, ...parsed };
        }
      }
    } catch {
      // ignore storage error
    }
    return { ...DEFAULT_SITE_SETTINGS };
  });
  const [activityLogs, setActivityLogs] = useState<ActivityLogEntry[]>(() => {
    try {
      const saved = localStorage.getItem(ACTIVITY_LOGS_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {
      // ignore storage error
    }
    return [];
  });

  // Authenticated App User (admin or school admin)
  const [currentUser, setCurrentUser] = useState<UserAccount | null>(null);

  // Direct Google Sheets Connection State (No Firebase) — Anchored to Latest Clicked Link
  const [activeSheetConfig, setActiveSheetConfig] = useState<ActiveSheetConfig>(() => {
    const defaultGas = isValidAppsScriptUrl(DEFAULT_APPS_SCRIPT_URL)
      ? DEFAULT_APPS_SCRIPT_URL
      : '';
    try {
      const params = new URLSearchParams(window.location.search);
      const urlParamSheet = extractSpreadsheetId(params.get('sheet') || '');
      const urlParamGas = (params.get('gas') || '').trim();
      const validParamGas = isValidAppsScriptUrl(urlParamGas) ? urlParamGas : '';

      if (urlParamSheet || validParamGas) {
        const sid = urlParamSheet || DEFAULT_SPREADSHEET_ID;
        const fromUrl: ActiveSheetConfig = {
          spreadsheetId: sid,
          sheetUrl: buildGoogleSheetUrl(sid),
          gasUrl: validParamGas,
          label: 'ลิงก์จาก URL ล่าสุด',
          lastActivatedAt: Date.now(),
        };
        localStorage.setItem(ACTIVE_SHEET_CONFIG_STORAGE_KEY, JSON.stringify(fromUrl));
        if (validParamGas) {
          localStorage.setItem(GAS_URL_STORAGE_KEY, validParamGas);
        }
        params.delete('sheet');
        params.delete('gas');
        const nextSearch = params.toString();
        const cleanUrl = `${window.location.pathname}${nextSearch ? `?${nextSearch}` : ''}${window.location.hash}`;
        window.history.replaceState({}, '', cleanUrl);
        return fromUrl;
      }

      const savedConfigRaw = localStorage.getItem(ACTIVE_SHEET_CONFIG_STORAGE_KEY);
      if (savedConfigRaw) {
        const parsed = JSON.parse(savedConfigRaw);
        if (parsed && typeof parsed === 'object') {
          const sid = extractSpreadsheetId(parsed.spreadsheetId || parsed.sheetUrl || '') || DEFAULT_SPREADSHEET_ID;
          const gUrl = isValidAppsScriptUrl(String(parsed.gasUrl || ''))
            ? String(parsed.gasUrl).trim()
            : '';
          return {
            spreadsheetId: sid,
            sheetUrl: buildGoogleSheetUrl(sid),
            gasUrl: gUrl,
            label: typeof parsed.label === 'string' ? parsed.label : '',
            lastActivatedAt: Number(parsed.lastActivatedAt) || 0,
          };
        }
      }

      const legacyGas = (localStorage.getItem(GAS_URL_STORAGE_KEY) || '').trim();
      if (legacyGas && isValidAppsScriptUrl(legacyGas)) {
        return {
          spreadsheetId: DEFAULT_SPREADSHEET_ID,
          sheetUrl: buildGoogleSheetUrl(DEFAULT_SPREADSHEET_ID),
          gasUrl: legacyGas,
          label: 'ชีทหลักเริ่มต้น',
          lastActivatedAt: 1,
        };
      }
    } catch {
      // ignore storage/URL errors
    }

    return {
      spreadsheetId: DEFAULT_SPREADSHEET_ID,
      sheetUrl: buildGoogleSheetUrl(DEFAULT_SPREADSHEET_ID),
      gasUrl: defaultGas,
      label: 'Google Sheets หลัก',
      lastActivatedAt: 0,
    };
  });

  const gasUrl = activeSheetConfig.gasUrl;
  const activeSpreadsheetId = activeSheetConfig.spreadsheetId || DEFAULT_SPREADSHEET_ID;

  const [isConnected, setIsConnected] = useState(false);
  const [isSyncing, setIsSyncing] = useState(true);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [spreadsheetTitle, setSpreadsheetTitle] = useState<string>('');
  const [availableSheets, setAvailableSheets] = useState<string[]>([]);
  const [isSheetsModalOpen, setIsSheetsModalOpen] = useState(false);

  // Confirmation Modal State
  const [confirmState, setConfirmState] = useState<ConfirmationState | null>(null);
  const [isConfirmLoading, setIsConfirmLoading] = useState(false);

  const activeConfigRef = useRef(activeSheetConfig);
  activeConfigRef.current = activeSheetConfig;
  const gasUrlRef = useRef(gasUrl);
  gasUrlRef.current = gasUrl;
  const spreadsheetIdRef = useRef(activeSpreadsheetId);
  spreadsheetIdRef.current = activeSpreadsheetId;

  const persistActiveConfigLocally = useCallback((config: ActiveSheetConfig) => {
    setActiveSheetConfig(config);
    activeConfigRef.current = config;
    gasUrlRef.current = config.gasUrl;
    spreadsheetIdRef.current = config.spreadsheetId || DEFAULT_SPREADSHEET_ID;
    try {
      localStorage.setItem(ACTIVE_SHEET_CONFIG_STORAGE_KEY, JSON.stringify(config));
      if (config.gasUrl) {
        localStorage.setItem(GAS_URL_STORAGE_KEY, config.gasUrl);
      } else {
        localStorage.removeItem(GAS_URL_STORAGE_KEY);
      }
    } catch {
      // ignore storage error
    }
  }, []);

  // Sync document.title with active screen & siteSettings
  useEffect(() => {
    const titlePrefix: Record<ScreenPath, string> = {
      'public-portal': 'รายการแข่งขันและกำหนดการ (บุคคลทั่วไป)',
      'login': 'เข้าสู่ระบบ',
      'school-portal': 'ระบบลงทะเบียนรายการแข่งขัน (แอดมินโรงเรียน)',
      'admin-central': 'จัดการรายการแข่งขัน (ผู้ดูแลระบบ)',
    };
    document.title = `${titlePrefix[activeScreen]} - ${siteSettings.siteTitle || DEFAULT_SITE_SETTINGS.siteTitle}`;
  }, [activeScreen, siteSettings.siteTitle]);

  const applySheetData = useCallback((data: SheetDatabaseState) => {
    setUsers(data.users);
    setCompetitions(data.competitions);
    setRegistrations(data.registrations);
    setCategoryGroups(data.categoryGroups);
    if (data.siteSettings) {
      setSiteSettings(data.siteSettings);
      try {
        localStorage.setItem(SITE_SETTINGS_STORAGE_KEY, JSON.stringify(data.siteSettings));
      } catch {
        // ignore storage error
      }
    }
    setActivityLogs((prev) => {
      const sheetLogs = data.logs || [];
      const sheetIds = new Set(sheetLogs.map((l) => l.id));
      const nowMs = Date.now();
      const pendingRecent = prev.filter(
        (l) => !sheetIds.has(l.id) && nowMs - (Date.parse(l.timestamp) || 0) < 30000
      );
      const merged = [...pendingRecent, ...sheetLogs].sort(
        (a, b) => (Date.parse(b.timestamp) || 0) - (Date.parse(a.timestamp) || 0)
      );
      try {
        localStorage.setItem(ACTIVITY_LOGS_STORAGE_KEY, JSON.stringify(merged.slice(0, 500)));
      } catch {
        // ignore storage error
      }
      return merged;
    });
    try {
      localStorage.setItem(CATEGORY_GROUPS_STORAGE_KEY, JSON.stringify(data.categoryGroups));
    } catch {
      // ignore storage error
    }
    setSpreadsheetTitle(data.spreadsheetTitle || 'Google Sheets (3 ชีท)');
    setAvailableSheets(data.sheets || []);
    setIsConnected(true);
  }, []);

  const syncSheetDatabase = useCallback(
    async (
      target?: {
        spreadsheetId?: string;
        gasUrl?: string;
        label?: string;
        activatedAt?: number;
      },
      options?: {
        explicitActivation?: boolean;
        silent?: boolean;
      }
    ): Promise<boolean> => {
      const explicitActivation = Boolean(options?.explicitActivation);
      const silent = Boolean(options?.silent);

      const prevConfig = activeConfigRef.current;
      const targetSid =
        extractSpreadsheetId(target?.spreadsheetId || '') ||
        (explicitActivation ? '' : prevConfig.spreadsheetId || DEFAULT_SPREADSHEET_ID);

      let targetGas = (target?.gasUrl || '').trim();
      if (targetGas && !isValidAppsScriptUrl(targetGas)) {
        setSyncError(
          'ลิงก์ Apps Script ต้องขึ้นต้นด้วย https://script.google.com/macros/s/.../exec'
        );
        return false;
      }

      if (!targetGas && !explicitActivation && targetSid && prevConfig.spreadsheetId === targetSid) {
        targetGas = prevConfig.gasUrl;
      }

      if (!silent) {
        setIsSyncing(true);
        setSyncError(null);
      }

      try {
        let data: SheetDatabaseState | null = null;
        let usedGasUrl = '';

        // 1) Try Apps Script URL if provided for this link
        if (targetGas) {
          try {
            data = await fetchAllFromAppsScript(
              targetGas,
              true,
              targetSid || undefined
            );
            usedGasUrl = targetGas;
          } catch (err: any) {
            if (err?.message === 'APPS_SCRIPT_SPREADSHEET_MISMATCH' && targetSid) {
              data = null;
              usedGasUrl = '';
            } else if (targetSid) {
              data = null;
              usedGasUrl = '';
            } else {
              throw err;
            }
          }
        }

        // 2) Public Google Sheets CSV read for targetSid
        if (!data) {
          const csvSid = targetSid || DEFAULT_SPREADSHEET_ID;
          data = await fetchAllFromPublicSheetCsv(csvSid);
          if (data.discoveredGasUrl && isValidAppsScriptUrl(data.discoveredGasUrl)) {
            usedGasUrl = data.discoveredGasUrl;
          }
        }

        const resolvedSid =
          extractSpreadsheetId(data.spreadsheetId || '') ||
          targetSid ||
          DEFAULT_SPREADSHEET_ID;
        const resolvedGas =
          usedGasUrl ||
          (targetGas && isValidAppsScriptUrl(targetGas) ? targetGas : '') ||
          (data.discoveredGasUrl && isValidAppsScriptUrl(data.discoveredGasUrl)
            ? data.discoveredGasUrl
            : '');
        const activatedAt = explicitActivation
          ? target?.activatedAt || Date.now()
          : target?.activatedAt ?? prevConfig.lastActivatedAt ?? 0;

        const resolvedLabel =
          (target?.label && target.label.trim()) ||
          (data.spreadsheetTitle &&
          data.spreadsheetTitle !== 'Google Sheets (ซิงค์อัตโนมัติ)'
            ? data.spreadsheetTitle
            : '') ||
          'Google Sheets หลัก';

        const nextConfig: ActiveSheetConfig = {
          spreadsheetId: resolvedSid,
          sheetUrl: buildGoogleSheetUrl(resolvedSid),
          gasUrl: resolvedGas,
          label: resolvedLabel,
          lastActivatedAt: activatedAt,
        };

        applySheetData(data);
        persistActiveConfigLocally(nextConfig);

        // Save strictly to this repository's own server config and target sheet's GAS URL (never to previous/other sheets)
        if (explicitActivation) {
          await saveServerSheetConfig(nextConfig);
          if (resolvedGas && data.discoveredGasUrl !== resolvedGas) {
            upsertRowViaAppsScript(
              resolvedGas,
              SHEET_NAMES.COMPETITIONS,
              GAS_URL_ROW_ID,
              serializeGasUrlRow(resolvedGas),
              resolvedSid
            ).catch(() => {});
          }
        } else if (resolvedGas && data.discoveredGasUrl !== resolvedGas) {
          upsertRowViaAppsScript(
            resolvedGas,
            SHEET_NAMES.COMPETITIONS,
            GAS_URL_ROW_ID,
            serializeGasUrlRow(resolvedGas),
            resolvedSid
          ).catch(() => {});
        }

        return true;
      } catch (err: any) {
        if (!silent) {
          setIsConnected(false);
          setSyncError(err?.message || 'ไม่สามารถเชื่อมต่อกับ Google Sheets ได้');
        }
        return false;
      } finally {
        if (!silent) {
          setIsSyncing(false);
        }
      }
    },
    [applySheetData, persistActiveConfigLocally]
  );

  const syncWithServerDefaultAndSheets = useCallback(
    async (silent: boolean) => {
      const serverRes = await fetchServerSheetConfig();
      if (serverRes) {
        const { instanceId, activeSheetConfig: srv } = serverRes;
        let instanceChanged = false;
        try {
          const prevInstanceId = localStorage.getItem(SERVER_INSTANCE_ID_STORAGE_KEY) || '';
          if (instanceId && prevInstanceId && prevInstanceId !== instanceId) {
            instanceChanged = true;
            localStorage.removeItem(CATEGORY_GROUPS_STORAGE_KEY);
            localStorage.removeItem(SITE_SETTINGS_STORAGE_KEY);
            localStorage.removeItem(ACTIVITY_LOGS_STORAGE_KEY);
          }
          if (instanceId) {
            localStorage.setItem(SERVER_INSTANCE_ID_STORAGE_KEY, instanceId);
          }
        } catch {
          // ignore storage error
        }

        const loc = activeConfigRef.current;
        const isDifferent =
          srv.spreadsheetId !== loc.spreadsheetId ||
          srv.gasUrl !== loc.gasUrl ||
          srv.label !== loc.label;
        const shouldAdopt =
          instanceChanged ||
          srv.lastActivatedAt >= (loc.lastActivatedAt || 0) ||
          (srv.lastActivatedAt > 0 && isDifferent);

        if (shouldAdopt && (instanceChanged || isDifferent || srv.lastActivatedAt !== loc.lastActivatedAt)) {
          persistActiveConfigLocally(srv);
        }
      }

      const cfg = activeConfigRef.current;
      await syncSheetDatabase(
        {
          spreadsheetId: cfg.spreadsheetId,
          gasUrl: cfg.gasUrl,
          label: cfg.label,
          activatedAt: cfg.lastActivatedAt,
        },
        { explicitActivation: false, silent }
      );
    },
    [persistActiveConfigLocally, syncSheetDatabase]
  );

  // Auto-sync on mount across ALL devices (always opens the single shared link from server)
  useEffect(() => {
    let cancelled = false;

    const runInitial = async () => {
      if (!cancelled) {
        await syncWithServerDefaultAndSheets(false);
      }
    };

    runInitial();

    // Silent background auto-sync every 60s and when tab becomes active again
    const intervalId = window.setInterval(() => {
      if (!cancelled && document.visibilityState === 'visible') {
        syncWithServerDefaultAndSheets(true);
      }
    }, 60000);

    const handleVisibility = () => {
      if (!cancelled && document.visibilityState === 'visible') {
        syncWithServerDefaultAndSheets(true);
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [syncWithServerDefaultAndSheets]);

  const handleDisconnect = async () => {
    const fallbackConfig: ActiveSheetConfig = {
      spreadsheetId: DEFAULT_SPREADSHEET_ID,
      sheetUrl: buildGoogleSheetUrl(DEFAULT_SPREADSHEET_ID),
      gasUrl: isValidAppsScriptUrl(DEFAULT_APPS_SCRIPT_URL) ? DEFAULT_APPS_SCRIPT_URL : '',
      label: 'Google Sheets หลัก',
      lastActivatedAt: Date.now(),
    };
    persistActiveConfigLocally(fallbackConfig);
    await saveServerSheetConfig(fallbackConfig);
    setSyncError(null);
    await syncSheetDatabase(
      {
        spreadsheetId: fallbackConfig.spreadsheetId,
        gasUrl: fallbackConfig.gasUrl,
        label: fallbackConfig.label,
        activatedAt: fallbackConfig.lastActivatedAt,
      },
      { explicitActivation: true, silent: false }
    );
  };

  const handleSyncNow = useCallback(async (): Promise<void> => {
    await syncWithServerDefaultAndSheets(false);
  }, [syncWithServerDefaultAndSheets]);

  const handleConnectSheetLink = useCallback(
    async (input: {
      sheetUrlOrId?: string;
      gasUrl?: string;
      label?: string;
    }): Promise<boolean> => {
      const rawSheet = (input.sheetUrlOrId || '').trim();
      const rawGas = (input.gasUrl || '').trim();

      let parsedSid = extractSpreadsheetId(rawSheet);
      let parsedGas = isValidAppsScriptUrl(rawGas) ? rawGas : '';

      // Smart detection if admin pasted an Apps Script URL into the sheet box or vice versa
      if (!parsedSid && isValidAppsScriptUrl(rawSheet) && !parsedGas) {
        parsedGas = rawSheet;
      }
      if (!parsedSid && rawGas) {
        parsedSid = extractSpreadsheetId(rawGas);
      }

      if (rawGas && !isValidAppsScriptUrl(rawGas) && !extractSpreadsheetId(rawGas)) {
        setSyncError(
          'ลิงก์ Apps Script ต้องขึ้นต้นด้วย https://script.google.com/macros/s/.../exec'
        );
        return false;
      }

      if (rawSheet && !parsedSid && !isValidAppsScriptUrl(rawSheet)) {
        setSyncError(
          'รูปแบบลิงก์ Google Sheets ไม่ถูกต้อง กรุณาวางลิงก์ https://docs.google.com/spreadsheets/d/... หรือ Spreadsheet ID'
        );
        return false;
      }

      if (!parsedSid && !parsedGas) {
        setSyncError('กรุณาระบุลิงก์ Google Sheets หรือลิงก์ Apps Script Web App URL');
        return false;
      }

      const nowMs = Date.now();
      const ok = await syncSheetDatabase(
        {
          spreadsheetId: parsedSid || undefined,
          gasUrl: parsedGas || undefined,
          label: input.label?.trim() || undefined,
          activatedAt: nowMs,
        },
        { explicitActivation: true, silent: false }
      );

      if (ok) {
        const finalCfg = activeConfigRef.current;
        const logEntry: ActivityLogEntry = {
          id: `${LOG_ROW_PREFIX}${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          timestamp: new Date().toISOString(),
          actorUsername: currentUser?.username || 'admin',
          actorName: currentUser?.schoolName || 'ผู้ดูแลระบบ',
          actorRole: currentUser?.role || 'admin',
          action: 'update',
          targetType: 'settings',
          targetId: finalCfg.spreadsheetId,
          targetTitle: finalCfg.label || finalCfg.spreadsheetId,
          summary: `แทนค่าลิงก์ Google Sheets หลักเป็น "${finalCfg.label || finalCfg.spreadsheetId}"`,
          details: [
            `Spreadsheet ID: ${finalCfg.spreadsheetId}`,
            `Apps Script: ${finalCfg.gasUrl ? 'เชื่อมต่อพร้อมเขียนข้อมูล' : 'อ่านข้อมูลจากชีทสาธารณะ'}`,
          ],
        };
        setActivityLogs((prev) => [logEntry, ...prev]);
        if (finalCfg.gasUrl) {
          upsertRowViaAppsScript(
            finalCfg.gasUrl,
            SHEET_NAMES.COMPETITIONS,
            logEntry.id,
            serializeLogRow(logEntry),
            finalCfg.spreadsheetId
          ).catch(() => {});
        }
      }

      return ok;
    },
    [currentUser, syncSheetDatabase]
  );

  const handleNavigate = useCallback((path: ScreenPath, transition: TransitionType) => {
    setTransitionType(transition);
    setActiveScreen(path);
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, []);

  const handleLoginSuccess = useCallback(
    (user: UserAccount, targetScreen: ScreenPath) => {
      setCurrentUser(user);
      setTransitionType('push');
      setActiveScreen(targetScreen);
      window.scrollTo({ top: 0, behavior: 'auto' });
    },
    []
  );

  const handleLogout = useCallback(() => {
    setCurrentUser(null);
    setTransitionType('push_back');
    setActiveScreen('login');
  }, []);

  const requestConfirmation = (config: Omit<ConfirmationState, 'isOpen'>) => {
    setConfirmState({ ...config, isOpen: true });
  };

  const recordActivityLog = useCallback(
    (
      entry: Omit<
        ActivityLogEntry,
        'id' | 'timestamp' | 'actorUsername' | 'actorName' | 'actorRole'
      >
    ) => {
      const now = new Date().toISOString();
      const rand = Math.random().toString(36).slice(2, 6);
      const actor = currentUser;
      const fullEntry: ActivityLogEntry = {
        id: `${LOG_ROW_PREFIX}${Date.now()}_${rand}`,
        timestamp: now,
        actorUsername: actor?.username || 'system',
        actorName: actor?.schoolName || 'ผู้ดูแลระบบ',
        actorRole: actor?.role || 'admin',
        ...entry,
      };

      setActivityLogs((prev) => {
        const next = [fullEntry, ...prev];
        try {
          localStorage.setItem(
            ACTIVITY_LOGS_STORAGE_KEY,
            JSON.stringify(next.slice(0, 500))
          );
        } catch {
          // ignore storage error
        }
        return next;
      });

      const activeGasUrl = gasUrlRef.current;
      const activeSid = spreadsheetIdRef.current;
      if (isConnected && activeGasUrl) {
        upsertRowViaAppsScript(
          activeGasUrl,
          SHEET_NAMES.COMPETITIONS,
          fullEntry.id,
          serializeLogRow(fullEntry),
          activeSid
        ).catch(() => {
          // keep primary action resilient if background log append fails
        });
      }
    },
    [currentUser, isConnected]
  );

  // --- CRUD Handlers ---

  const handleSaveCategoryGroups = useCallback(
    async (nextGroups: string[]): Promise<boolean> => {
      const prevGroups = categoryGroups;
      setCategoryGroups(nextGroups);
      try {
        localStorage.setItem(CATEGORY_GROUPS_STORAGE_KEY, JSON.stringify(nextGroups));
      } catch {
        // ignore storage error
      }
      if (isConnected && gasUrl) {
        try {
          await upsertRowViaAppsScript(
            gasUrl,
            SHEET_NAMES.COMPETITIONS,
            CATEGORY_GROUPS_ROW_ID,
            serializeCategoryGroupsRow(nextGroups),
            spreadsheetIdRef.current
          );
        } catch (err: any) {
          setSyncError(err?.message || 'บันทึกลำดับกลุ่มกิจกรรมลง Google Sheets ไม่สำเร็จ');
          if (currentUser?.role === 'admin') setIsSheetsModalOpen(true);
          return false;
        }
      } else if (isConnected && !gasUrl && currentUser?.role === 'admin') {
        setSyncError('ยังไม่ได้ตั้งค่า Apps Script Web App URL สำหรับเขียนข้อมูลลงชีท');
        setIsSheetsModalOpen(true);
        return false;
      }

      const added = nextGroups.filter((g) => !prevGroups.includes(g));
      const removed = prevGroups.filter((g) => !nextGroups.includes(g));
      if (added.length > 0) {
        recordActivityLog({
          action: 'create',
          targetType: 'category',
          targetId: CATEGORY_GROUPS_ROW_ID,
          targetTitle: added.join(', '),
          summary: `เพิ่มกลุ่มกิจกรรม "${added.join(', ')}"`,
          details: [`จำนวนกลุ่มกิจกรรมทั้งหมด: ${nextGroups.length} กลุ่ม`],
        });
      } else if (removed.length > 0) {
        recordActivityLog({
          action: 'delete',
          targetType: 'category',
          targetId: CATEGORY_GROUPS_ROW_ID,
          targetTitle: removed.join(', '),
          summary: `ลบกลุ่มกิจกรรม "${removed.join(', ')}"`,
          details: [`คงเหลือกลุ่มกิจกรรม: ${nextGroups.length} กลุ่ม`],
        });
      } else {
        recordActivityLog({
          action: 'update',
          targetType: 'category',
          targetId: CATEGORY_GROUPS_ROW_ID,
          targetTitle: 'ลำดับกลุ่มกิจกรรม',
          summary: `จัดลำดับกลุ่มกิจกรรมใหม่ (${nextGroups.length} กลุ่ม)`,
          details: nextGroups.slice(0, 5).map((g, i) => `ลำดับ ${i + 1}: ${g}`),
        });
      }
      return true;
    },
    [categoryGroups, isConnected, gasUrl, currentUser, recordActivityLog]
  );

  const handleSaveSiteSettings = useCallback(
    async (nextSettings: SiteSettings): Promise<boolean> => {
      const prevSettings = siteSettings;
      const sanitized: SiteSettings = {
        siteTitle: nextSettings.siteTitle.trim() || DEFAULT_SITE_SETTINGS.siteTitle,
        siteSubtitle: nextSettings.siteSubtitle.trim(),
        heroHeading: nextSettings.heroHeading.trim() || DEFAULT_SITE_SETTINGS.heroHeading,
        heroDescription: nextSettings.heroDescription.trim(),
        footerText: nextSettings.footerText.trim() || DEFAULT_SITE_SETTINGS.footerText,
      };

      setSiteSettings(sanitized);
      try {
        localStorage.setItem(SITE_SETTINGS_STORAGE_KEY, JSON.stringify(sanitized));
      } catch {
        // ignore storage error
      }

      if (isConnected && gasUrl) {
        try {
          await upsertRowViaAppsScript(
            gasUrl,
            SHEET_NAMES.COMPETITIONS,
            SITE_SETTINGS_ROW_ID,
            serializeSiteSettingsRow(sanitized),
            spreadsheetIdRef.current
          );
        } catch (err: any) {
          setSyncError(err?.message || 'บันทึกการตั้งค่าหัวเรื่องลง Google Sheets ไม่สำเร็จ');
          if (currentUser?.role === 'admin') setIsSheetsModalOpen(true);
          return false;
        }
      } else if (isConnected && !gasUrl && currentUser?.role === 'admin') {
        setSyncError('ยังไม่ได้ตั้งค่า Apps Script Web App URL สำหรับเขียนข้อมูลลงชีท');
        setIsSheetsModalOpen(true);
        return false;
      }

      const diffs: string[] = [];
      if (prevSettings.siteTitle !== sanitized.siteTitle) {
        diffs.push(`หัวเรื่องหลัก: "${prevSettings.siteTitle}" → "${sanitized.siteTitle}"`);
      }
      if (prevSettings.siteSubtitle !== sanitized.siteSubtitle) {
        diffs.push(`หัวข้อย่อย: "${prevSettings.siteSubtitle}" → "${sanitized.siteSubtitle}"`);
      }
      if (prevSettings.heroHeading !== sanitized.heroHeading) {
        diffs.push(`หัวข้อหน้าแรก: "${prevSettings.heroHeading}" → "${sanitized.heroHeading}"`);
      }
      if (prevSettings.heroDescription !== sanitized.heroDescription) {
        diffs.push(`รายละเอียดหน้าแรก: ปรับปรุงข้อความแล้ว`);
      }
      if (prevSettings.footerText !== sanitized.footerText) {
        diffs.push(`ข้อความส่วนท้าย: "${prevSettings.footerText}" → "${sanitized.footerText}"`);
      }

      recordActivityLog({
        action: 'update',
        targetType: 'settings',
        targetId: SITE_SETTINGS_ROW_ID,
        targetTitle: sanitized.siteTitle,
        summary: `แก้ไขหัวเรื่องและรายละเอียดหน้าเว็บ "${sanitized.siteTitle}"`,
        details: diffs.length > 0 ? diffs : ['บันทึกอัปเดตการตั้งค่าหน้าเว็บ'],
      });
      return true;
    },
    [siteSettings, isConnected, gasUrl, currentUser, recordActivityLog]
  );

  const handleSaveCompetition = async (
    data: Omit<CompetitionItem, 'id' | 'updatedAt'>,
    existingId?: string
  ): Promise<boolean> => {
    const now = new Date().toISOString();
    const existing = existingId
      ? competitions.find((c) => c.id === existingId) || null
      : null;
    const targetItem: CompetitionItem = {
      id: existingId || generateNextId('CMP', competitions.map((c) => c.id)),
      ...data,
      updatedAt: now,
    };

    try {
      if (isConnected && !gasUrl) {
        throw new Error('ยังไม่ได้ตั้งค่า Apps Script Web App URL สำหรับเขียนข้อมูลลงชีท');
      }
      if (isConnected && gasUrl) {
        await upsertRowViaAppsScript(
          gasUrl,
          SHEET_NAMES.COMPETITIONS,
          targetItem.id,
          serializeCompetitionRow(targetItem),
          spreadsheetIdRef.current
        );
      }
      setCompetitions((prev) =>
        existingId
          ? prev.map((c) => (c.id === existingId ? targetItem : c))
          : [...prev, targetItem]
      );

      if (!existing) {
        recordActivityLog({
          action: 'create',
          targetType: 'competition',
          targetId: targetItem.id,
          targetTitle: targetItem.mainActivity,
          summary: `เพิ่มรายการแข่งขัน "${targetItem.mainActivity}" (${targetItem.id})`,
          details: [
            `กลุ่มกิจกรรม: ${targetItem.categoryGroup}`,
            `รุ่น: ${targetItem.level || 'ไม่ระบุ'}`,
            `กิจกรรมย่อย: ${targetItem.subActivity || '-'}`,
            `วัน/เวลา: ${targetItem.competitionDate || 'ยังไม่กำหนด'} ${targetItem.competitionTime || ''}`.trim(),
            `สถานที่: ${targetItem.venue || 'ยังไม่กำหนด'}`,
          ],
        });
      } else {
        const diffs: string[] = [];
        if (existing.categoryGroup !== targetItem.categoryGroup) {
          diffs.push(`กลุ่มกิจกรรม: "${existing.categoryGroup}" → "${targetItem.categoryGroup}"`);
        }
        if (existing.mainActivity !== targetItem.mainActivity) {
          diffs.push(`กิจกรรมหลัก: "${existing.mainActivity}" → "${targetItem.mainActivity}"`);
        }
        if ((existing.subActivity || '') !== (targetItem.subActivity || '')) {
          diffs.push(
            `กิจกรรมย่อย: "${existing.subActivity || '-'}" → "${targetItem.subActivity || '-'}"`
          );
        }
        if ((existing.level || '') !== (targetItem.level || '')) {
          diffs.push(
            `รุ่น: "${existing.level || 'ไม่ระบุ'}" → "${targetItem.level || 'ไม่ระบุ'}"`
          );
        }
        if ((existing.competitionDate || '') !== (targetItem.competitionDate || '')) {
          diffs.push(
            `วันแข่งขัน: "${existing.competitionDate || 'ยังไม่กำหนด'}" → "${targetItem.competitionDate || 'ยังไม่กำหนด'}"`
          );
        }
        if ((existing.competitionTime || '') !== (targetItem.competitionTime || '')) {
          diffs.push(
            `เวลาแข่งขัน: "${existing.competitionTime || 'ยังไม่กำหนด'}" → "${targetItem.competitionTime || 'ยังไม่กำหนด'}"`
          );
        }
        if ((existing.venue || '') !== (targetItem.venue || '')) {
          diffs.push(
            `สถานที่: "${existing.venue || 'ยังไม่กำหนด'}" → "${targetItem.venue || 'ยังไม่กำหนด'}"`
          );
        }
        recordActivityLog({
          action: 'update',
          targetType: 'competition',
          targetId: targetItem.id,
          targetTitle: targetItem.mainActivity,
          summary: `แก้ไขรายการแข่งขัน "${targetItem.mainActivity}" (${targetItem.id})`,
          details:
            diffs.length > 0
              ? diffs
              : ['บันทึกอัปเดตข้อมูลรายการ (ไม่มีฟิลด์เปลี่ยนแปลง)'],
        });
      }

      if (targetItem.categoryGroup && !categoryGroups.includes(targetItem.categoryGroup)) {
        const nextGroups = [...categoryGroups, targetItem.categoryGroup];
        await handleSaveCategoryGroups(nextGroups);
      }
      return true;
    } catch (err: any) {
      setSyncError(err?.message || 'บันทึกรายการแข่งขันลง Google Sheets ไม่สำเร็จ');
      if (currentUser?.role === 'admin') setIsSheetsModalOpen(true);
      return false;
    }
  };

  const handleSaveCompetitionsBatch = async (
    items: Array<Omit<CompetitionItem, 'id' | 'updatedAt'>>
  ): Promise<boolean> => {
    if (items.length === 0) return false;
    const now = new Date().toISOString();
    const usedIds = competitions.map((c) => c.id);
    const createdItems: CompetitionItem[] = items.map((data) => {
      const nextId = generateNextId('CMP', usedIds);
      usedIds.push(nextId);
      return {
        id: nextId,
        ...data,
        updatedAt: now,
      };
    });

    try {
      if (isConnected && !gasUrl) {
        throw new Error('ยังไม่ได้ตั้งค่า Apps Script Web App URL สำหรับเขียนข้อมูลลงชีท');
      }
      if (isConnected && gasUrl) {
        for (const item of createdItems) {
          await upsertRowViaAppsScript(
            gasUrl,
            SHEET_NAMES.COMPETITIONS,
            item.id,
            serializeCompetitionRow(item),
            spreadsheetIdRef.current
          );
        }
      }
      setCompetitions((prev) => [...prev, ...createdItems]);

      for (const item of createdItems) {
        recordActivityLog({
          action: 'create',
          targetType: 'competition',
          targetId: item.id,
          targetTitle: item.mainActivity,
          summary: `เพิ่มรายการแข่งขัน "${item.mainActivity}" (${item.id})`,
          details: [
            `กลุ่มกิจกรรม: ${item.categoryGroup}`,
            `รุ่น: ${item.level || 'ไม่ระบุ'}`,
            `กิจกรรมย่อย: ${item.subActivity || '-'}`,
            `วัน/เวลา: ${item.competitionDate || 'ยังไม่กำหนด'} ${item.competitionTime || ''}`.trim(),
            `สถานที่: ${item.venue || 'ยังไม่กำหนด'}`,
          ],
        });
      }

      const firstCategory = createdItems[0]?.categoryGroup;
      if (firstCategory && !categoryGroups.includes(firstCategory)) {
        await handleSaveCategoryGroups([...categoryGroups, firstCategory]);
      }
      return true;
    } catch (err: any) {
      setSyncError(err?.message || 'บันทึกรายการแข่งขันลง Google Sheets ไม่สำเร็จ');
      if (currentUser?.role === 'admin') setIsSheetsModalOpen(true);
      return false;
    }
  };

  const handleDeleteCompetition = (comp: CompetitionItem) => {
    requestConfirmation({
      title: 'ยืนยันการลบรายการแข่งขัน',
      description: `คุณต้องการลบรายการ "${comp.mainActivity}" (${comp.id}) ออกจากชีท "${SHEET_NAMES.COMPETITIONS}" ใช่หรือไม่ การดำเนินการนี้ไม่สามารถย้อนกลับได้`,
      details: [
        `• กลุ่มกิจกรรม: ${comp.categoryGroup}`,
        `• กิจกรรมหลัก: ${comp.mainActivity}`,
        `• รุ่น: ${comp.level || 'ไม่ระบุ'}`,
      ],
      confirmLabel: 'ยืนยันการลบ',
      tone: 'danger',
      onConfirm: async () => {
        if (isConnected && !gasUrl) {
          throw new Error('ยังไม่ได้ตั้งค่า Apps Script Web App URL สำหรับลบข้อมูลในชีท');
        }
        if (isConnected && gasUrl) {
          await deleteRowViaAppsScript(
            gasUrl,
            SHEET_NAMES.COMPETITIONS,
            comp.id,
            spreadsheetIdRef.current
          );
        }
        setCompetitions((prev) => prev.filter((c) => c.id !== comp.id));
        recordActivityLog({
          action: 'delete',
          targetType: 'competition',
          targetId: comp.id,
          targetTitle: comp.mainActivity,
          summary: `ลบรายการแข่งขัน "${comp.mainActivity}" (${comp.id})`,
          details: [
            `กลุ่มกิจกรรม: ${comp.categoryGroup}`,
            `รุ่น: ${comp.level || 'ไม่ระบุ'}`,
            `สถานที่: ${comp.venue || 'ยังไม่กำหนด'}`,
          ],
        });
      },
    });
  };

  const handleSaveUser = async (
    data: Omit<UserAccount, 'id' | 'createdAt'>,
    existingId?: string
  ): Promise<boolean> => {
    const existing = existingId ? users.find((u) => u.id === existingId) : null;
    const targetUser: UserAccount = {
      id: existingId || generateNextId('USR', users.map((u) => u.id)),
      ...data,
      createdAt: existing?.createdAt || new Date().toISOString(),
    };

    try {
      if (isConnected && !gasUrl) {
        throw new Error('ยังไม่ได้ตั้งค่า Apps Script Web App URL สำหรับเขียนข้อมูลลงชีท');
      }
      if (isConnected && gasUrl) {
        await upsertRowViaAppsScript(
          gasUrl,
          SHEET_NAMES.USERS,
          targetUser.id,
          serializeUserRow(targetUser),
          spreadsheetIdRef.current
        );
      }
      setUsers((prev) =>
        existingId
          ? prev.map((u) => (u.id === existingId ? targetUser : u))
          : [...prev, targetUser]
      );

      if (!existing) {
        recordActivityLog({
          action: 'create',
          targetType: 'user',
          targetId: targetUser.id,
          targetTitle: targetUser.schoolName,
          summary: `สร้างบัญชีโรงเรียน "${targetUser.schoolName}" (${targetUser.username})`,
          details: [
            `รหัสบัญชี: ${targetUser.id}`,
            `Username: ${targetUser.username}`,
            `สิทธิ์: ${targetUser.role === 'admin' ? 'ผู้ดูแลระบบ' : 'แอดมินโรงเรียน'}`,
          ],
        });
      } else {
        const diffs: string[] = [];
        if (existing.schoolName !== targetUser.schoolName) {
          diffs.push(`ชื่อโรงเรียน: "${existing.schoolName}" → "${targetUser.schoolName}"`);
        }
        if (existing.username !== targetUser.username) {
          diffs.push(`Username: "${existing.username}" → "${targetUser.username}"`);
        }
        if (existing.password !== targetUser.password) {
          diffs.push('เปลี่ยนรหัสผ่านบัญชี');
        }
        recordActivityLog({
          action: 'update',
          targetType: 'user',
          targetId: targetUser.id,
          targetTitle: targetUser.schoolName,
          summary: `แก้ไขบัญชี "${targetUser.schoolName}" (${targetUser.username})`,
          details: diffs.length > 0 ? diffs : ['บันทึกอัปเดตข้อมูลบัญชี'],
        });
      }
      return true;
    } catch (err: any) {
      setSyncError(err?.message || 'บันทึกบัญชีผู้ใช้ลง Google Sheets ไม่สำเร็จ');
      if (currentUser?.role === 'admin') setIsSheetsModalOpen(true);
      return false;
    }
  };

  const handleDeleteUser = (user: UserAccount) => {
    if (user.username === 'admin') return;
    requestConfirmation({
      title: 'ยืนยันการลบบัญชีโรงเรียน',
      description: `คุณต้องการลบบัญชี "${user.schoolName}" (${user.username}) ออกจากชีท "${SHEET_NAMES.USERS}" ใช่หรือไม่`,
      details: [`• รหัสบัญชี: ${user.id}`, `• Username: ${user.username}`],
      confirmLabel: 'ยืนยันการลบ',
      tone: 'danger',
      onConfirm: async () => {
        if (isConnected && !gasUrl) {
          throw new Error('ยังไม่ได้ตั้งค่า Apps Script Web App URL สำหรับลบข้อมูลในชีท');
        }
        if (isConnected && gasUrl) {
          await deleteRowViaAppsScript(
            gasUrl,
            SHEET_NAMES.USERS,
            user.id,
            spreadsheetIdRef.current
          );
        }
        setUsers((prev) => prev.filter((u) => u.id !== user.id));
        recordActivityLog({
          action: 'delete',
          targetType: 'user',
          targetId: user.id,
          targetTitle: user.schoolName,
          summary: `ลบบัญชีโรงเรียน "${user.schoolName}" (${user.username})`,
          details: [`รหัสบัญชี: ${user.id}`, `Username: ${user.username}`],
        });
      },
    });
  };

  const handleSaveRegistration = async (
    data: Omit<RegistrationRecord, 'id' | 'createdAt' | 'updatedAt'>,
    existingId?: string
  ): Promise<boolean> => {
    const now = new Date().toISOString();
    const existing = existingId
      ? registrations.find((r) => r.id === existingId)
      : null;
    const targetReg: RegistrationRecord = {
      id: existingId || generateNextId('REG', registrations.map((r) => r.id)),
      ...data,
      createdAt: existing?.createdAt || now,
      updatedAt: now,
    };

    try {
      if (isConnected && !gasUrl) {
        throw new Error('ยังไม่ได้เชื่อมต่อ Google Apps Script Web App URL สำหรับบันทึกข้อมูล');
      }
      if (isConnected && gasUrl) {
        await upsertRowViaAppsScript(
          gasUrl,
          SHEET_NAMES.REGISTRATIONS,
          targetReg.id,
          serializeRegistrationRow(targetReg),
          spreadsheetIdRef.current
        );
      }
      setRegistrations((prev) =>
        existingId
          ? prev.map((r) => (r.id === existingId ? targetReg : r))
          : [...prev, targetReg]
      );

      const completeLabel = isRegistrationComplete(targetReg)
        ? 'เรียบร้อย'
        : 'ไม่เรียบร้อย';
      if (!existing) {
        recordActivityLog({
          action: 'create',
          targetType: 'registration',
          targetId: targetReg.id,
          targetTitle: `${targetReg.schoolName} · ${targetReg.mainActivity}`,
          summary: `${targetReg.schoolName} ลงทะเบียนรายการ "${targetReg.mainActivity}" (${targetReg.id})`,
          details: [
            `กลุ่มกิจกรรม: ${targetReg.categoryGroup}`,
            `รุ่น: ${targetReg.level}`,
            `ครูที่ปรึกษา: ${targetReg.advisors.length > 0 ? targetReg.advisors.join(', ') : 'ยังไม่ระบุ'}`,
            `นักเรียน: ${targetReg.students.length > 0 ? `${targetReg.students.length} คน (${targetReg.students.map((s) => `${s.title}${s.fullName}`).join(', ')})` : 'ยังไม่ระบุ'}`,
            `สถานะข้อมูล: ${completeLabel}`,
          ],
        });
      } else {
        const diffs: string[] = [];
        if (existing.mainActivity !== targetReg.mainActivity) {
          diffs.push(`รายการแข่งขัน: "${existing.mainActivity}" → "${targetReg.mainActivity}"`);
        }
        if (existing.level !== targetReg.level) {
          diffs.push(`รุ่น: "${existing.level}" → "${targetReg.level}"`);
        }
        const prevAdv = existing.advisors.join(', ');
        const nextAdv = targetReg.advisors.join(', ');
        if (prevAdv !== nextAdv) {
          diffs.push(
            `ครูที่ปรึกษา: "${prevAdv || 'ยังไม่ระบุ'}" → "${nextAdv || 'ยังไม่ระบุ'}"`
          );
        }
        const prevStu = existing.students
          .map((s) => `${s.title}${s.fullName}(${s.grade})`)
          .join(', ');
        const nextStu = targetReg.students
          .map((s) => `${s.title}${s.fullName}(${s.grade})`)
          .join(', ');
        if (prevStu !== nextStu) {
          diffs.push(
            `นักเรียน (${existing.students.length} → ${targetReg.students.length} คน): "${prevStu || 'ยังไม่ระบุ'}" → "${nextStu || 'ยังไม่ระบุ'}"`
          );
        }
        diffs.push(`สถานะข้อมูลปัจจุบัน: ${completeLabel}`);

        recordActivityLog({
          action: 'update',
          targetType: 'registration',
          targetId: targetReg.id,
          targetTitle: `${targetReg.schoolName} · ${targetReg.mainActivity}`,
          summary: `แก้ไขข้อมูลลงทะเบียน "${targetReg.mainActivity}" ของ ${targetReg.schoolName} (${targetReg.id})`,
          details: diffs,
        });
      }
      return true;
    } catch (err: any) {
      const msg = err?.message || 'บันทึกข้อมูลการลงทะเบียนลง Google Sheets ไม่สำเร็จ';
      setSyncError(msg);
      if (currentUser?.role === 'admin') {
        setIsSheetsModalOpen(true);
      } else {
        requestConfirmation({
          title: 'ไม่สามารถบันทึกข้อมูลลงฐานข้อมูลได้',
          description: 'เกิดข้อผิดพลาดระหว่างเชื่อมต่อฐานข้อมูล กรุณาแจ้งผู้ดูแลระบบหรือลองใหม่อีกครั้ง',
          details: [`• รายละเอียด: ${msg}`],
          confirmLabel: 'รับทราบ',
          tone: 'primary',
          onConfirm: () => {},
        });
      }
      return false;
    }
  };

  const handleDeleteRegistration = (reg: RegistrationRecord) => {
    requestConfirmation({
      title: 'ยืนยันการลบข้อมูลการลงทะเบียน',
      description: `คุณต้องการลบการลงทะเบียนรายการ "${reg.mainActivity}" ของ ${reg.schoolName} ออกจากชีท "${SHEET_NAMES.REGISTRATIONS}" ใช่หรือไม่`,
      details: [
        `• รหัสลงทะเบียน: ${reg.id}`,
        `• รุ่น: ${reg.level}`,
        `• จำนวนนักเรียน: ${reg.students.length} คน`,
      ],
      confirmLabel: 'ยืนยันการลบ',
      tone: 'danger',
      onConfirm: async () => {
        if (isConnected && !gasUrl) {
          throw new Error('ยังไม่ได้ตั้งค่า Apps Script Web App URL สำหรับลบข้อมูลในชีท');
        }
        if (isConnected && gasUrl) {
          await deleteRowViaAppsScript(
            gasUrl,
            SHEET_NAMES.REGISTRATIONS,
            reg.id,
            spreadsheetIdRef.current
          );
        }
        setRegistrations((prev) => prev.filter((r) => r.id !== reg.id));
        recordActivityLog({
          action: 'delete',
          targetType: 'registration',
          targetId: reg.id,
          targetTitle: `${reg.schoolName} · ${reg.mainActivity}`,
          summary: `ลบการลงทะเบียน "${reg.mainActivity}" ของ ${reg.schoolName} (${reg.id})`,
          details: [
            `รุ่น: ${reg.level}`,
            `จำนวนนักเรียน: ${reg.students.length} คน`,
          ],
        });
      },
    });
  };

  const motionProps =
    transitionType === 'none'
      ? {
          initial: { opacity: 1, x: 0 },
          animate: { opacity: 1, x: 0 },
          exit: { opacity: 1, x: 0 },
          transition: { duration: 0 },
        }
      : transitionType === 'push'
      ? {
          initial: { opacity: 0, x: 24 },
          animate: { opacity: 1, x: 0 },
          exit: { opacity: 0, x: -16 },
          transition: { duration: 0.18, ease: [0.16, 1, 0.3, 1] as const },
        }
      : {
          initial: { opacity: 0, x: -24 },
          animate: { opacity: 1, x: 0 },
          exit: { opacity: 0, x: 16 },
          transition: { duration: 0.18, ease: [0.16, 1, 0.3, 1] as const },
        };

  return (
    <>
      <AnimatePresence mode="wait">
        <motion.div key={activeScreen} {...motionProps}>
          {activeScreen === 'public-portal' && (
            <PublicPortalScreen
              competitions={competitions}
              registrations={registrations}
              users={users}
              categoryGroups={categoryGroups}
              siteSettings={siteSettings}
              currentUser={currentUser}
              isGoogleConnected={isConnected}
              isSyncing={isSyncing}
              onNavigate={handleNavigate}
            />
          )}

          {activeScreen === 'login' && (
            <LoginScreen
              users={users}
              siteSettings={siteSettings}
              onLoginSuccess={handleLoginSuccess}
              onNavigate={handleNavigate}
            />
          )}

          {activeScreen === 'school-portal' && (
            <SchoolPortalScreen
              currentUser={currentUser}
              users={users}
              competitions={competitions}
              registrations={registrations}
              categoryGroups={categoryGroups}
              siteSettings={siteSettings}
              onNavigate={handleNavigate}
              onLoginSuccess={handleLoginSuccess}
              onLogout={handleLogout}
              onSaveRegistration={handleSaveRegistration}
              onDeleteRegistration={handleDeleteRegistration}
            />
          )}

          {activeScreen === 'admin-central' && (
            <AdminCentralScreen
              currentUser={currentUser}
              users={users}
              competitions={competitions}
              registrations={registrations}
              categoryGroups={categoryGroups}
              siteSettings={siteSettings}
              activityLogs={activityLogs}
              isGoogleConnected={isConnected}
              spreadsheetId={activeSpreadsheetId}
              spreadsheetTitle={spreadsheetTitle}
              activeSheetConfig={activeSheetConfig}
              isSyncing={isSyncing}
              onNavigate={handleNavigate}
              onLoginSuccess={handleLoginSuccess}
              onLogout={handleLogout}
              onOpenSheetsModal={() => setIsSheetsModalOpen(true)}
              onSyncNow={handleSyncNow}
              onSaveCategoryGroups={handleSaveCategoryGroups}
              onSaveSiteSettings={handleSaveSiteSettings}
              onRequestConfirm={requestConfirmation}
              onSaveCompetition={handleSaveCompetition}
              onSaveCompetitionsBatch={handleSaveCompetitionsBatch}
              onDeleteCompetition={handleDeleteCompetition}
              onSaveUser={handleSaveUser}
              onDeleteUser={handleDeleteUser}
              onDeleteRegistration={handleDeleteRegistration}
            />
          )}
        </motion.div>
      </AnimatePresence>

      {currentUser?.role === 'admin' && (
        <GoogleSheetsModal
          isOpen={isSheetsModalOpen}
          onClose={() => setIsSheetsModalOpen(false)}
          activeSheetConfig={activeSheetConfig}
          isConnected={isConnected}
          isSyncing={isSyncing}
          spreadsheetTitle={spreadsheetTitle}
          availableSheets={availableSheets}
          syncError={syncError}
          onConnectSheetLink={handleConnectSheetLink}
          onDisconnect={handleDisconnect}
          onSyncNow={handleSyncNow}
        />
      )}

      <ConfirmDialog
        state={confirmState}
        isLoading={isConfirmLoading}
        onCancel={() => {
          if (!isConfirmLoading) {
            confirmState?.onCancel?.();
            setConfirmState(null);
          }
        }}
        onConfirm={async () => {
          if (!confirmState) return;
          setIsConfirmLoading(true);
          try {
            await confirmState.onConfirm();
            setConfirmState(null);
          } catch (err: any) {
            setSyncError(err?.message || 'เกิดข้อผิดพลาดระหว่างบันทึกข้อมูลลง Google Sheets');
            setConfirmState(null);
          } finally {
            setIsConfirmLoading(false);
          }
        }}
      />
    </>
  );
}
