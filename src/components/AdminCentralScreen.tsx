import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowDown,
  ArrowUp,
  Building2,
  CheckCircle2,
  ClipboardList,
  Clock,
  Edit3,
  FileSpreadsheet,
  Globe,
  History,
  Layers,
  Lock,
  LogOut,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  Settings,
  ShieldCheck,
  Trash2,
  Trophy,
  Users,
} from 'lucide-react';
import {
  ActivityLogAction,
  ActivityLogEntry,
  ActivityLogTargetType,
  COMPETITION_LEVELS,
  CompetitionItem,
  CompetitionLevel,
  ConfirmationState,
  DEFAULT_CATEGORY_GROUPS,
  DEFAULT_SITE_SETTINGS,
  RegistrationRecord,
  ScreenPath,
  SiteSettings,
  TransitionType,
  UserAccount,
  isRegistrationComplete,
} from '../types';

interface AdminCentralScreenProps {
  currentUser: UserAccount | null;
  users: UserAccount[];
  competitions: CompetitionItem[];
  registrations: RegistrationRecord[];
  categoryGroups: string[];
  siteSettings: SiteSettings;
  activityLogs: ActivityLogEntry[];
  isGoogleConnected: boolean;
  spreadsheetId: string;
  spreadsheetTitle?: string;
  isSyncing: boolean;
  onNavigate: (path: ScreenPath, transition: TransitionType) => void;
  onLoginSuccess: (user: UserAccount, targetScreen: ScreenPath) => void;
  onLogout: () => void;
  onOpenSheetsModal: () => void;
  onSyncNow: () => Promise<void>;
  onSaveCategoryGroups: (nextGroups: string[]) => Promise<boolean>;
  onSaveSiteSettings: (nextSettings: SiteSettings) => Promise<boolean>;
  onRequestConfirm: (config: Omit<ConfirmationState, 'isOpen'>) => void;
  onSaveCompetition: (
    data: Omit<CompetitionItem, 'id' | 'updatedAt'>,
    existingId?: string
  ) => Promise<boolean>;
  onSaveCompetitionsBatch: (
    items: Array<Omit<CompetitionItem, 'id' | 'updatedAt'>>
  ) => Promise<boolean>;
  onDeleteCompetition: (comp: CompetitionItem) => void;
  onSaveUser: (
    data: Omit<UserAccount, 'id' | 'createdAt'>,
    existingId?: string
  ) => Promise<boolean>;
  onDeleteUser: (user: UserAccount) => void;
  onDeleteRegistration: (reg: RegistrationRecord) => void;
}

type AdminTab =
  | 'competitions'
  | 'categories'
  | 'users'
  | 'registrations'
  | 'logs'
  | 'settings';

interface DisplayLogItem extends ActivityLogEntry {
  source: 'log' | 'snapshot';
}

function getLocalDateKey(isoString: string): string {
  const ms = Date.parse(isoString);
  if (Number.isNaN(ms)) return '';
  const d = new Date(ms);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function formatThaiLogTimestamp(isoString: string): {
  dateText: string;
  timeText: string;
  relativeText: string;
} {
  const ms = Date.parse(isoString);
  if (Number.isNaN(ms)) {
    return {
      dateText: isoString || 'ไม่ระบุวันที่',
      timeText: '-',
      relativeText: '',
    };
  }
  const d = new Date(ms);
  const dateText = new Intl.DateTimeFormat('th-TH', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(d);
  const timeText = `${new Intl.DateTimeFormat('th-TH', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(d)} น.`;

  const diffSec = Math.floor((Date.now() - ms) / 1000);
  let relativeText = '';
  if (diffSec < 60 && diffSec >= -5) {
    relativeText = 'เมื่อสักครู่';
  } else if (diffSec < 3600 && diffSec > 0) {
    relativeText = `${Math.floor(diffSec / 60)} นาทีที่แล้ว`;
  } else if (diffSec < 86400 && diffSec > 0) {
    relativeText = `${Math.floor(diffSec / 3600)} ชั่วโมงที่แล้ว`;
  } else if (diffSec >= 86400) {
    const days = Math.floor(diffSec / 86400);
    relativeText = days === 1 ? 'เมื่อวาน' : `${days} วันที่แล้ว`;
  }

  return { dateText, timeText, relativeText };
}

const ACTION_LABELS: Record<ActivityLogAction, string> = {
  create: 'เพิ่มเติม',
  update: 'แก้ไข / อัปเดต',
  delete: 'ลบข้อมูล',
};

const TARGET_TYPE_LABELS: Record<ActivityLogTargetType, string> = {
  competition: 'รายการแข่งขัน',
  category: 'กลุ่มกิจกรรม',
  user: 'บัญชีโรงเรียน',
  registration: 'การลงทะเบียน',
  settings: 'ตั้งค่าหน้าเว็บ',
};

function getLevelRank(level?: string): number {
  const idx = COMPETITION_LEVELS.indexOf(level as CompetitionLevel);
  return idx === -1 ? 99 : idx;
}

function buildLevelActivityName(baseName: string, lvl: CompetitionLevel): string {
  const trimmed = baseName.trim();
  if (!trimmed) return '';
  const compactLvl = lvl.replace('.', '');
  if (trimmed.includes(lvl) || trimmed.includes(compactLvl)) {
    return trimmed;
  }
  return `${trimmed} ${lvl}`;
}

export const AdminCentralScreen: React.FC<AdminCentralScreenProps> = ({
  currentUser,
  users,
  competitions,
  registrations,
  categoryGroups,
  siteSettings,
  activityLogs,
  isGoogleConnected,
  spreadsheetId,
  spreadsheetTitle,
  isSyncing,
  onNavigate,
  onLoginSuccess,
  onLogout,
  onOpenSheetsModal,
  onSyncNow,
  onSaveCategoryGroups,
  onSaveSiteSettings,
  onRequestConfirm,
  onSaveCompetition,
  onSaveCompetitionsBatch,
  onDeleteCompetition,
  onSaveUser,
  onDeleteUser,
  onDeleteRegistration,
}) => {
  const isAdmin = currentUser?.role === 'admin';
  const [activeTab, setActiveTab] = useState<AdminTab>('competitions');

  // Inline Admin Sign-In Gate
  const [adminUserInput, setAdminUserInput] = useState('admin');
  const [adminPassInput, setAdminPassInput] = useState('');
  const [adminAuthError, setAdminAuthError] = useState<string | null>(null);

  // Competition Form State
  const [editingCompId, setEditingCompId] = useState<string | null>(null);
  const [categoryGroup, setCategoryGroup] = useState<string>(
    categoryGroups[0] || DEFAULT_CATEGORY_GROUPS[0]
  );
  const [customCategoryGroup, setCustomCategoryGroup] = useState<string>('');
  const [mainActivity, setMainActivity] = useState<string>('');
  const [subActivity, setSubActivity] = useState<string>('');
  const [selectedNewLevels, setSelectedNewLevels] = useState<CompetitionLevel[]>(['ป.1-3']);
  const [compLevel, setCompLevel] = useState<CompetitionLevel | ''>('');
  const [competitionDate, setCompetitionDate] = useState<string>('');
  const [competitionTime, setCompetitionTime] = useState<string>('');
  const [venue, setVenue] = useState<string>('');
  const [compFormError, setCompFormError] = useState<string | null>(null);
  const [compFormSuccess, setCompFormSuccess] = useState<string | null>(null);

  // Category Groups Management State
  const [newCategoryInput, setNewCategoryInput] = useState<string>('');
  const [catFormError, setCatFormError] = useState<string | null>(null);
  const [catFormSuccess, setCatFormSuccess] = useState<string | null>(null);
  const [isSavingCategories, setIsSavingCategories] = useState<boolean>(false);

  // School User Form State
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [schoolNameInput, setSchoolNameInput] = useState('');
  const [usernameInput, setUsernameInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [userFormError, setUserFormError] = useState<string | null>(null);
  const [userFormSuccess, setUserFormSuccess] = useState<string | null>(null);

  // Registration Overview Filters
  const [regFilterCategory, setRegFilterCategory] = useState<string>('ALL');
  const [regFilterLevel, setRegFilterLevel] = useState<string>('ALL');
  const [regFilterSchool, setRegFilterSchool] = useState<string>('ALL');

  // Activity Log Filters
  const [logSearch, setLogSearch] = useState<string>('');
  const [logFilterAction, setLogFilterAction] = useState<string>('ALL');
  const [logFilterTarget, setLogFilterTarget] = useState<string>('ALL');
  const [logFilterActor, setLogFilterActor] = useState<string>('ALL');
  const [logFilterDate, setLogFilterDate] = useState<string>('');
  const [includeSheetSnapshots, setIncludeSheetSnapshots] = useState<boolean>(true);

  // Site Settings Form State
  const [siteTitleInput, setSiteTitleInput] = useState(siteSettings.siteTitle);
  const [siteSubtitleInput, setSiteSubtitleInput] = useState(siteSettings.siteSubtitle);
  const [heroHeadingInput, setHeroHeadingInput] = useState(siteSettings.heroHeading);
  const [heroDescriptionInput, setHeroDescriptionInput] = useState(siteSettings.heroDescription);
  const [footerTextInput, setFooterTextInput] = useState(siteSettings.footerText);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const [settingsSuccess, setSettingsSuccess] = useState<string | null>(null);

  useEffect(() => {
    setSiteTitleInput(siteSettings.siteTitle);
    setSiteSubtitleInput(siteSettings.siteSubtitle);
    setHeroHeadingInput(siteSettings.heroHeading);
    setHeroDescriptionInput(siteSettings.heroDescription);
    setFooterTextInput(siteSettings.footerText);
  }, [siteSettings]);

  const allCategoryOptions = useMemo(() => {
    const ordered = [...categoryGroups];
    const seen = new Set(ordered);
    competitions.forEach((c) => {
      if (c.categoryGroup && !seen.has(c.categoryGroup)) {
        seen.add(c.categoryGroup);
        ordered.push(c.categoryGroup);
      }
    });
    return ordered;
  }, [categoryGroups, competitions]);

  const sortedCompetitions = useMemo(() => {
    const orderMap = new Map<string, number>();
    allCategoryOptions.forEach((cat, idx) => orderMap.set(cat, idx));
    return [...competitions].sort((a, b) => {
      const idxA = orderMap.get(a.categoryGroup) ?? Number.MAX_SAFE_INTEGER;
      const idxB = orderMap.get(b.categoryGroup) ?? Number.MAX_SAFE_INTEGER;
      if (idxA !== idxB) return idxA - idxB;
      const lDiff = getLevelRank(a.level) - getLevelRank(b.level);
      if (lDiff !== 0) return lDiff;
      return a.id.localeCompare(b.id, 'th');
    });
  }, [competitions, allCategoryOptions]);

  const competitionCountByCategory = useMemo(() => {
    const counts = new Map<string, number>();
    competitions.forEach((c) => {
      if (!c.categoryGroup) return;
      counts.set(c.categoryGroup, (counts.get(c.categoryGroup) || 0) + 1);
    });
    return counts;
  }, [competitions]);

  const schoolList = useMemo(() => {
    const set = new Set<string>();
    users.filter((u) => u.role === 'school').forEach((u) => set.add(u.schoolName));
    registrations.forEach((r) => {
      if (r.schoolName) set.add(r.schoolName);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'th'));
  }, [users, registrations]);

  const filteredRegistrations = useMemo(() => {
    const list = registrations.filter((r) => {
      if (regFilterCategory !== 'ALL' && r.categoryGroup !== regFilterCategory) return false;
      if (regFilterLevel !== 'ALL' && r.level !== regFilterLevel) return false;
      if (regFilterSchool !== 'ALL' && r.schoolName !== regFilterSchool) return false;
      return true;
    });
    return [...list].sort((a, b) => {
      const lDiff = getLevelRank(a.level) - getLevelRank(b.level);
      if (lDiff !== 0) return lDiff;
      const actDiff = a.mainActivity.localeCompare(b.mainActivity, 'th');
      if (actDiff !== 0) return actDiff;
      return a.schoolName.localeCompare(b.schoolName, 'th');
    });
  }, [registrations, regFilterCategory, regFilterLevel, regFilterSchool]);

  const combinedLogs = useMemo<DisplayLogItem[]>(() => {
    const explicit: DisplayLogItem[] = activityLogs.map((l) => ({
      ...l,
      source: 'log',
    }));

    if (!includeSheetSnapshots) {
      return explicit.sort(
        (a, b) => (Date.parse(b.timestamp) || 0) - (Date.parse(a.timestamp) || 0)
      );
    }

    const loggedTargetIds = new Set(activityLogs.map((l) => l.targetId).filter(Boolean));
    const snapshots: DisplayLogItem[] = [];

    registrations.forEach((reg) => {
      if (loggedTargetIds.has(reg.id)) return;
      const ts = reg.updatedAt || reg.createdAt;
      if (!ts) return;
      const isEdited =
        reg.createdAt && reg.updatedAt && reg.createdAt !== reg.updatedAt;
      const submitterUser = users.find((u) => u.username === reg.submittedBy);
      snapshots.push({
        id: `snap_reg_${reg.id}`,
        timestamp: ts,
        actorUsername: reg.submittedBy || 'school',
        actorName: submitterUser?.schoolName || reg.schoolName,
        actorRole: submitterUser?.role || 'school',
        action: isEdited ? 'update' : 'create',
        targetType: 'registration',
        targetId: reg.id,
        targetTitle: `${reg.schoolName} · ${reg.mainActivity}`,
        summary: `${reg.schoolName} ${isEdited ? 'อัปเดตข้อมูลลงทะเบียน' : 'บันทึกข้อมูลลงทะเบียน'} "${reg.mainActivity}" (${reg.id})`,
        details: [
          `กลุ่มกิจกรรม: ${reg.categoryGroup}`,
          `รุ่น: ${reg.level || 'ไม่ระบุ'}`,
          `ครูที่ปรึกษา: ${reg.advisors.length > 0 ? reg.advisors.join(', ') : 'ยังไม่ระบุ'}`,
          `นักเรียน: ${reg.students.length} คน`,
        ],
        source: 'snapshot',
      });
    });

    competitions.forEach((comp) => {
      if (loggedTargetIds.has(comp.id)) return;
      if (!comp.updatedAt) return;
      snapshots.push({
        id: `snap_cmp_${comp.id}`,
        timestamp: comp.updatedAt,
        actorUsername: 'admin',
        actorName: 'ผู้ดูแลระบบ',
        actorRole: 'admin',
        action: 'update',
        targetType: 'competition',
        targetId: comp.id,
        targetTitle: comp.mainActivity,
        summary: `บันทึกข้อมูลรายการแข่งขัน "${comp.mainActivity}" (${comp.id})`,
        details: [
          `กลุ่มกิจกรรม: ${comp.categoryGroup}${comp.level ? ` · รุ่น: ${comp.level}` : ''}`,
          `วัน/เวลา: ${comp.competitionDate || 'ยังไม่กำหนด'} ${comp.competitionTime || ''}`.trim(),
          `สถานที่: ${comp.venue || 'ยังไม่กำหนด'}`,
        ],
        source: 'snapshot',
      });
    });

    users.forEach((u) => {
      if (loggedTargetIds.has(u.id)) return;
      if (!u.createdAt) return;
      snapshots.push({
        id: `snap_usr_${u.id}`,
        timestamp: u.createdAt,
        actorUsername: 'admin',
        actorName: 'ผู้ดูแลระบบ',
        actorRole: 'admin',
        action: 'create',
        targetType: 'user',
        targetId: u.id,
        targetTitle: u.schoolName,
        summary: `สร้างบัญชี "${u.schoolName}" (${u.username})`,
        details: [`รหัสบัญชี: ${u.id}`, `สิทธิ์: ${u.role === 'admin' ? 'ผู้ดูแลระบบ' : 'แอดมินโรงเรียน'}`],
        source: 'snapshot',
      });
    });

    return [...explicit, ...snapshots].sort(
      (a, b) => (Date.parse(b.timestamp) || 0) - (Date.parse(a.timestamp) || 0)
    );
  }, [activityLogs, includeSheetSnapshots, registrations, competitions, users]);

  const logActorOptions = useMemo(() => {
    const map = new Map<string, string>();
    combinedLogs.forEach((l) => {
      const key = l.actorName || l.actorUsername;
      if (key && !map.has(key)) {
        map.set(key, key);
      }
    });
    return Array.from(map.values()).sort((a, b) => a.localeCompare(b, 'th'));
  }, [combinedLogs]);

  const filteredLogs = useMemo(() => {
    const q = logSearch.trim().toLowerCase();
    return combinedLogs.filter((item) => {
      if (logFilterAction !== 'ALL' && item.action !== logFilterAction) return false;
      if (logFilterTarget !== 'ALL' && item.targetType !== logFilterTarget) return false;
      if (
        logFilterActor !== 'ALL' &&
        (item.actorName || item.actorUsername) !== logFilterActor
      ) {
        return false;
      }
      if (logFilterDate && getLocalDateKey(item.timestamp) !== logFilterDate) {
        return false;
      }
      if (!q) return true;
      return (
        item.actorName.toLowerCase().includes(q) ||
        item.actorUsername.toLowerCase().includes(q) ||
        item.summary.toLowerCase().includes(q) ||
        item.targetTitle.toLowerCase().includes(q) ||
        item.targetId.toLowerCase().includes(q) ||
        item.details.some((d) => d.toLowerCase().includes(q))
      );
    });
  }, [
    combinedLogs,
    logSearch,
    logFilterAction,
    logFilterTarget,
    logFilterActor,
    logFilterDate,
  ]);

  const logActionCounts = useMemo(() => {
    let create = 0;
    let update = 0;
    let del = 0;
    filteredLogs.forEach((l) => {
      if (l.action === 'create') create += 1;
      else if (l.action === 'update') update += 1;
      else if (l.action === 'delete') del += 1;
    });
    return { total: filteredLogs.length, create, update, del };
  }, [filteredLogs]);

  const handleAdminGateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setAdminAuthError(null);
    const matched = users.find(
      (u) =>
        u.role === 'admin' &&
        u.username.trim() === adminUserInput.trim() &&
        u.password === adminPassInput
    );
    if (!matched) {
      setAdminAuthError('ชื่อผู้ใช้หรือรหัสผ่านผู้ดูแลระบบไม่ถูกต้อง');
      return;
    }
    setAdminPassInput('');
    onLoginSuccess(matched, 'admin-central');
  };

  const resetCompForm = () => {
    setEditingCompId(null);
    setCategoryGroup(categoryGroups[0] || DEFAULT_CATEGORY_GROUPS[0]);
    setCustomCategoryGroup('');
    setMainActivity('');
    setSubActivity('');
    setSelectedNewLevels(['ป.1-3']);
    setCompLevel('');
    setCompetitionDate('');
    setCompetitionTime('');
    setVenue('');
    setCompFormError(null);
  };

  const handleAddCategoryGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    setCatFormError(null);
    setCatFormSuccess(null);

    const trimmed = newCategoryInput.trim();
    if (!trimmed) {
      setCatFormError('กรุณาระบุชื่อกลุ่มกิจกรรม');
      return;
    }
    const isDuplicate = categoryGroups.some(
      (g) => g.trim().toLowerCase() === trimmed.toLowerCase()
    );
    if (isDuplicate) {
      setCatFormError('มีกลุ่มกิจกรรมชื่อนี้อยู่ในรายการแล้ว');
      return;
    }

    setIsSavingCategories(true);
    try {
      const ok = await onSaveCategoryGroups([...categoryGroups, trimmed]);
      if (ok) {
        setNewCategoryInput('');
        setCatFormSuccess(`เพิ่มกลุ่มกิจกรรม "${trimmed}" และจัดเก็บลำดับเรียบร้อยแล้ว`);
      }
    } finally {
      setIsSavingCategories(false);
    }
  };

  const handleMoveCategoryGroup = async (index: number, direction: 'up' | 'down') => {
    if (isSavingCategories) return;
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= categoryGroups.length) return;

    setCatFormError(null);
    setCatFormSuccess(null);

    const reordered = [...categoryGroups];
    const [moved] = reordered.splice(index, 1);
    reordered.splice(targetIndex, 0, moved);

    setIsSavingCategories(true);
    try {
      const ok = await onSaveCategoryGroups(reordered);
      if (ok) {
        setCatFormSuccess(`อัปเดตลำดับกลุ่มกิจกรรม "${moved}" เป็นลำดับที่ ${targetIndex + 1} แล้ว`);
      }
    } finally {
      setIsSavingCategories(false);
    }
  };

  const handleRequestDeleteCategoryGroup = (groupName: string, index: number) => {
    const usedCount = competitionCountByCategory.get(groupName) || 0;
    const details = [
      `• ชื่อกลุ่มกิจกรรม: ${groupName}`,
      `• ลำดับปัจจุบัน: ${index + 1}`,
    ];
    if (usedCount > 0) {
      details.push(
        `• คำเตือน: มีรายการแข่งขัน ${usedCount} รายการอยู่ในกลุ่มนี้ (ข้อมูลรายการเดิมยังคงอยู่ แต่ชื่อกลุ่มจะถูกลบออกจากรายการจัดลำดับหลัก)`
      );
    }

    onRequestConfirm({
      title: 'ยืนยันการลบกลุ่มกิจกรรม',
      description: `คุณต้องการลบกลุ่มกิจกรรม "${groupName}" ออกจากรายการกลุ่มกิจกรรมใช่หรือไม่`,
      details,
      confirmLabel: 'ยืนยันการลบ',
      tone: 'danger',
      onConfirm: async () => {
        setCatFormError(null);
        setCatFormSuccess(null);
        const nextGroups = categoryGroups.filter((_, i) => i !== index);
        const ok = await onSaveCategoryGroups(nextGroups);
        if (ok) {
          setCatFormSuccess(`ลบกลุ่มกิจกรรม "${groupName}" เรียบร้อยแล้ว`);
          if (categoryGroup === groupName) {
            setCategoryGroup(nextGroups[0] || '__CUSTOM__');
          }
        }
      },
    });
  };

  const handleToggleNewLevel = (lvl: CompetitionLevel) => {
    setSelectedNewLevels((prev) =>
      prev.includes(lvl) ? prev.filter((item) => item !== lvl) : [...prev, lvl]
    );
  };

  const handleEditComp = (comp: CompetitionItem) => {
    setEditingCompId(comp.id);
    if (allCategoryOptions.includes(comp.categoryGroup)) {
      setCategoryGroup(comp.categoryGroup);
      setCustomCategoryGroup('');
    } else {
      setCategoryGroup('__CUSTOM__');
      setCustomCategoryGroup(comp.categoryGroup);
    }
    setMainActivity(comp.mainActivity);
    setSubActivity(comp.subActivity || '');
    setCompLevel(comp.level || '');
    setCompetitionDate(comp.competitionDate || '');
    setCompetitionTime(comp.competitionTime || '');
    setVenue(comp.venue || '');
    setCompFormError(null);
    setCompFormSuccess(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSaveCompSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCompFormError(null);
    setCompFormSuccess(null);

    const finalCategory =
      categoryGroup === '__CUSTOM__' ? customCategoryGroup.trim() : categoryGroup.trim();

    if (!finalCategory) {
      setCompFormError('กรุณาระบุกลุ่มกิจกรรม');
      return;
    }
    if (!mainActivity.trim()) {
      setCompFormError('กรุณาระบุชื่อกิจกรรมหลัก');
      return;
    }

    if (editingCompId) {
      const ok = await onSaveCompetition(
        {
          categoryGroup: finalCategory,
          mainActivity: mainActivity.trim(),
          subActivity: subActivity.trim(),
          level: compLevel,
          competitionDate: competitionDate.trim(),
          competitionTime: competitionTime.trim(),
          venue: venue.trim(),
        },
        editingCompId
      );

      if (ok) {
        setCompFormSuccess('แก้ไขข้อมูลรายการแข่งขันเรียบร้อยแล้ว');
        resetCompForm();
      }
      return;
    }

    const orderedLevels = COMPETITION_LEVELS.filter((lvl) =>
      selectedNewLevels.includes(lvl)
    );
    if (orderedLevels.length === 0) {
      setCompFormError(
        'กรุณาเลือกรุ่นอย่างน้อย 1 รุ่น (ระบบจะสร้างแยกเป็น 1 รายการต่อ 1 รุ่น)'
      );
      return;
    }

    const items = orderedLevels.map((lvl) => ({
      categoryGroup: finalCategory,
      mainActivity: buildLevelActivityName(mainActivity, lvl),
      subActivity: subActivity.trim(),
      level: lvl,
      competitionDate: competitionDate.trim(),
      competitionTime: competitionTime.trim(),
      venue: venue.trim(),
    }));

    const ok = await onSaveCompetitionsBatch(items);
    if (ok) {
      setCompFormSuccess(
        items.length > 1
          ? `เพิ่มรายการแข่งขันแยกตามรุ่นจำนวน ${items.length} รายการเรียบร้อยแล้ว`
          : 'เพิ่มรายการแข่งขันใหม่เรียบร้อยแล้ว'
      );
      resetCompForm();
    }
  };

  const resetUserForm = () => {
    setEditingUserId(null);
    setSchoolNameInput('');
    setUsernameInput('');
    setPasswordInput('');
    setUserFormError(null);
  };

  const handleEditUser = (u: UserAccount) => {
    setEditingUserId(u.id);
    setSchoolNameInput(u.schoolName);
    setUsernameInput(u.username);
    setPasswordInput(u.password);
    setUserFormError(null);
    setUserFormSuccess(null);
  };

  const handleSaveUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setUserFormError(null);
    setUserFormSuccess(null);

    if (!schoolNameInput.trim()) {
      setUserFormError('กรุณาระบุชื่อโรงเรียน');
      return;
    }
    if (!usernameInput.trim()) {
      setUserFormError('กรุณาระบุชื่อผู้ใช้ (Username)');
      return;
    }
    if (!passwordInput.trim()) {
      setUserFormError('กรุณาระบุรหัสผ่าน');
      return;
    }

    const duplicate = users.find(
      (u) =>
        u.username.trim().toLowerCase() === usernameInput.trim().toLowerCase() &&
        u.id !== editingUserId
    );
    if (duplicate) {
      setUserFormError('Username นี้มีอยู่ในระบบแล้ว กรุณาใช้ชื่ออื่น');
      return;
    }

    const editingTarget = users.find((u) => u.id === editingUserId);
    const ok = await onSaveUser(
      {
        username: usernameInput.trim(),
        password: passwordInput.trim(),
        role: editingTarget?.role === 'admin' ? 'admin' : 'school',
        schoolName: schoolNameInput.trim(),
      },
      editingUserId || undefined
    );

    if (ok) {
      setUserFormSuccess(
        editingUserId
          ? 'อัปเดตข้อมูลบัญชีโรงเรียนเรียบร้อยแล้ว'
          : 'สร้างบัญชีโรงเรียนใหม่เรียบร้อยแล้ว (แสดงในดร็อปดาวน์หน้าเข้าสู่ระบบทันที)'
      );
      resetUserForm();
    }
  };

  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-900">
      {/* Sidebar (<aside>) with required navigation links */}
      <aside className="hidden w-64 shrink-0 flex-col justify-between border-r border-slate-200 bg-white lg:flex">
        <div className="space-y-6 p-5">
          <div className="border-b border-slate-200 pb-4">
            <p className="text-xs font-medium text-blue-900">ผู้ดูแลระบบกลาง</p>
            <h2 className="font-display mt-0.5 text-base font-bold text-slate-900">
              {siteSettings.siteTitle}
            </h2>
          </div>

          <nav className="space-y-1 text-sm">
            <button
              type="button"
              onClick={() => {
                if (activeTab === 'logs' || activeTab === 'settings') {
                  setActiveTab('competitions');
                }
              }}
              className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left font-medium transition-colors ${
                activeTab !== 'logs' && activeTab !== 'settings'
                  ? 'bg-blue-50 text-blue-900'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <ShieldCheck className="h-4 w-4 shrink-0" />
              จัดการรายการและผู้ใช้งาน
            </button>

            {isAdmin && (
              <>
                <button
                  type="button"
                  onClick={() => setActiveTab('logs')}
                  className={`flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2.5 text-left font-medium transition-colors ${
                    activeTab === 'logs'
                      ? 'bg-blue-50 text-blue-900'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  <span className="inline-flex items-center gap-2.5">
                    <History className="h-4 w-4 shrink-0" />
                    ประวัติการใช้งาน (Log)
                  </span>
                  <span className="font-mono text-xs text-slate-500 tabular-nums">
                    {activityLogs.length}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setSettingsError(null);
                    setSettingsSuccess(null);
                    setActiveTab('settings');
                  }}
                  className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left font-medium transition-colors ${
                    activeTab === 'settings'
                      ? 'bg-blue-50 text-blue-900'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  <Settings className="h-4 w-4 shrink-0" />
                  ตั้งค่าหัวเรื่องและรายละเอียด
                </button>
              </>
            )}

            <a
              href="#school-portal"
              data-path="school-portal"
              onClick={(e) => {
                e.preventDefault();
                onNavigate('school-portal', 'none');
              }}
              className="flex items-center gap-2.5 rounded-lg px-3 py-2.5 font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900"
            >
              <ClipboardList className="h-4 w-4" />
              ระบบลงทะเบียนโรงเรียน
            </a>

            <a
              href="#public-portal"
              data-path="public-portal"
              onClick={(e) => {
                e.preventDefault();
                onNavigate('public-portal', 'push_back');
              }}
              className="flex items-center gap-2.5 rounded-lg px-3 py-2.5 font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900"
            >
              <Globe className="h-4 w-4" />
              หน้าบุคคลทั่วไป
            </a>

            <a
              href="#login"
              data-path="login"
              onClick={(e) => {
                e.preventDefault();
                onNavigate('login', 'push_back');
              }}
              className="flex items-center gap-2.5 rounded-lg px-3 py-2.5 font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900"
            >
              <LogOut className="h-4 w-4" />
              สลับบัญชี / เข้าสู่ระบบ
            </a>
          </nav>
        </div>

        <div className="border-t border-slate-200 p-5">
          {isAdmin ? (
            <div className="space-y-2">
              <p className="text-xs text-slate-500">เข้าสู่ระบบในฐานะ</p>
              <p className="text-xs font-semibold text-slate-900">
                {currentUser.schoolName} ({currentUser.username})
              </p>
              <button
                type="button"
                onClick={onLogout}
                className="text-xs font-medium text-red-700 hover:underline"
              >
                ออกจากระบบ
              </button>
            </div>
          ) : (
            <p className="text-xs text-slate-500">รอการยืนยันสิทธิ์ผู้ดูแลระบบ</p>
          )}
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top Header (<header>) with required navigation links */}
        <header className="sticky top-0 z-30 border-b border-slate-200 bg-white">
          <div className="flex items-center justify-between gap-6 px-6 py-3.5">
            <div className="min-w-0">
              <p className="truncate text-xs text-slate-500">
                ศูนย์บริหารจัดการกลาง · Google Sheets 3 ชีท (user / รายการ / ลงทะเบียน)
              </p>
              <h1 className="font-display truncate text-base font-bold text-slate-900">
                จัดการรายการแข่งขัน (ผู้ดูแลระบบ)
              </h1>
            </div>

            <div className="flex shrink-0 items-center gap-4 text-xs font-medium">
              <a
                href="#school-portal"
                data-path="school-portal"
                onClick={(e) => {
                  e.preventDefault();
                  onNavigate('school-portal', 'none');
                }}
                className="shrink-0 whitespace-nowrap text-slate-600 hover:text-blue-900 hover:underline"
              >
                ระบบโรงเรียน
              </a>
              <a
                href="#public-portal"
                data-path="public-portal"
                onClick={(e) => {
                  e.preventDefault();
                  onNavigate('public-portal', 'push_back');
                }}
                className="shrink-0 whitespace-nowrap text-slate-600 hover:text-blue-900 hover:underline"
              >
                หน้าบุคคลทั่วไป
              </a>
              <a
                href="#login"
                data-path="login"
                onClick={(e) => {
                  e.preventDefault();
                  onNavigate('login', 'push_back');
                }}
                className="shrink-0 whitespace-nowrap text-slate-600 hover:text-blue-900 hover:underline"
              >
                หน้าเข้าสู่ระบบ
              </a>
              {isAdmin && (
                <button
                  type="button"
                  onClick={onOpenSheetsModal}
                  className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg bg-blue-900 px-3.5 py-1.5 text-xs font-medium text-white hover:bg-blue-950"
                >
                  <FileSpreadsheet className="h-3.5 w-3.5" />
                  {isGoogleConnected ? 'ตั้งค่า Google Sheets' : 'เชื่อมต่อ Google Sheets'}
                </button>
              )}
            </div>
          </div>
        </header>

        <main className="mx-auto w-full max-w-6xl space-y-6 p-6">
          {/* Google Sheets Database Connection Strip (System Admin Only) */}
          {isAdmin && (
            <section className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white px-5 py-4">
            <div className="space-y-0.5">
              <p className="text-xs font-medium text-slate-500">สถานะฐานข้อมูล Google Sheets</p>
              <p className="text-sm font-semibold text-slate-900">
                {isGoogleConnected && spreadsheetId
                  ? `เชื่อมต่อกับ "${spreadsheetTitle || 'Google Spreadsheet'}" แล้ว`
                  : 'ยังไม่เชื่อมต่อไฟล์ Google Sheets (กำลังแสดงข้อมูลในเครื่อง)'}
              </p>
            </div>
            <div className="flex items-center gap-2.5">
              {isGoogleConnected && spreadsheetId && (
                <button
                  type="button"
                  onClick={onSyncNow}
                  disabled={isSyncing}
                  className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                  ซิงค์จากชีทล่าสุด
                </button>
              )}
              <button
                type="button"
                onClick={onOpenSheetsModal}
                className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg bg-slate-900 px-3.5 py-2 text-xs font-medium text-white hover:bg-slate-800"
              >
                <FileSpreadsheet className="h-3.5 w-3.5" />
                {isGoogleConnected ? 'ตั้งค่า Google Sheets' : 'เชื่อมต่อ Google Sheets'}
              </button>
            </div>
            </section>
          )}

          {/* Admin Auth Gate */}
          {!isAdmin ? (
            <section className="mx-auto max-w-md rounded-xl border border-slate-200 bg-white p-6">
              <div className="mb-4 space-y-1">
                <h2 className="font-display text-lg font-bold text-slate-900">
                  ยืนยันสิทธิ์ผู้ดูแลระบบ
                </h2>
                <p className="text-xs text-slate-500">
                  กรุณาเข้าสู่ระบบด้วยบัญชีผู้ดูแลระบบเพื่อเพิ่ม/แก้ไขรายการแข่งขันและสร้างบัญชีโรงเรียน
                </p>
              </div>
              <form onSubmit={handleAdminGateSubmit} className="space-y-3.5">
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-700">
                    ชื่อผู้ใช้ (Username)
                  </label>
                  <input
                    type="text"
                    value={adminUserInput}
                    onChange={(e) => setAdminUserInput(e.target.value)}
                    required
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-800 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-700">รหัสผ่าน</label>
                  <div className="relative">
                    <Lock className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      type="password"
                      value={adminPassInput}
                      onChange={(e) => setAdminPassInput(e.target.value)}
                      placeholder="รหัสผ่านผู้ดูแลระบบ"
                      required
                      className="w-full rounded-lg border border-slate-300 py-2 pr-3 pl-9 text-sm focus:border-blue-800 focus:outline-none"
                    />
                  </div>
                </div>
                {adminAuthError && (
                  <p className="text-xs font-medium text-red-700">{adminAuthError}</p>
                )}
                <button
                  type="submit"
                  className="w-full rounded-lg bg-blue-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-950"
                >
                  ยืนยันเข้าสู่ระบบผู้ดูแล
                </button>
              </form>
            </section>
          ) : (
            <>
              {/* Workspace Tabs */}
              <div className="flex flex-wrap items-center gap-1 rounded-xl border border-slate-200 bg-white p-1.5">
                <button
                  type="button"
                  onClick={() => setActiveTab('competitions')}
                  className={`inline-flex items-center gap-2 whitespace-nowrap rounded-lg px-4 py-2 text-xs font-medium transition-colors ${
                    activeTab === 'competitions'
                      ? 'bg-blue-900 text-white'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  <Trophy className="h-3.5 w-3.5" />
                  จัดการรายการแข่งขัน (ชีท รายการ · {competitions.length})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('categories')}
                  className={`inline-flex items-center gap-2 whitespace-nowrap rounded-lg px-4 py-2 text-xs font-medium transition-colors ${
                    activeTab === 'categories'
                      ? 'bg-blue-900 text-white'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  <Layers className="h-3.5 w-3.5" />
                  จัดการกลุ่มกิจกรรม ({categoryGroups.length})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('users')}
                  className={`inline-flex items-center gap-2 whitespace-nowrap rounded-lg px-4 py-2 text-xs font-medium transition-colors ${
                    activeTab === 'users'
                      ? 'bg-blue-900 text-white'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  <Building2 className="h-3.5 w-3.5" />
                  จัดการโรงเรียน & ผู้ใช้งาน (ชีท user · {users.length})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('registrations')}
                  className={`inline-flex items-center gap-2 whitespace-nowrap rounded-lg px-4 py-2 text-xs font-medium transition-colors ${
                    activeTab === 'registrations'
                      ? 'bg-blue-900 text-white'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  <Users className="h-3.5 w-3.5" />
                  ภาพรวมการลงทะเบียน (ชีท ลงทะเบียน · {registrations.length})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('logs')}
                  className={`inline-flex items-center gap-2 whitespace-nowrap rounded-lg px-4 py-2 text-xs font-medium transition-colors ${
                    activeTab === 'logs'
                      ? 'bg-blue-900 text-white'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  <History className="h-3.5 w-3.5" />
                  ประวัติการใช้งาน / Log ({combinedLogs.length})
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSettingsError(null);
                    setSettingsSuccess(null);
                    setActiveTab('settings');
                  }}
                  className={`inline-flex items-center gap-2 whitespace-nowrap rounded-lg px-4 py-2 text-xs font-medium transition-colors ${
                    activeTab === 'settings'
                      ? 'bg-blue-900 text-white'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  <Settings className="h-3.5 w-3.5" />
                  ตั้งค่าหัวเรื่องและรายละเอียด
                </button>
              </div>

              {/* TAB 1: Competitions CRUD */}
              {activeTab === 'competitions' && (
                <div className="space-y-6">
                  <section className="rounded-xl border border-slate-200 bg-white p-6">
                    <div className="flex items-center justify-between border-b border-slate-200 pb-4">
                      <div>
                        <h2 className="font-display text-base font-bold text-slate-900">
                          {editingCompId
                            ? `แก้ไขรายการแข่งขัน (${editingCompId})`
                            : 'เพิ่มรายการแข่งขันใหม่'}
                        </h2>
                        <p className="text-xs text-slate-500">
                          กลุ่มกิจกรรมและกิจกรรมหลักเป็นข้อมูลบังคับ ส่วนกิจกรรมย่อย วัน เวลา และสถานที่
                          สามารถเว้นว่างและกลับมาแก้ไขภายหลังได้
                        </p>
                      </div>
                      {editingCompId && (
                        <button
                          type="button"
                          onClick={resetCompForm}
                          className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                        >
                          ยกเลิกการแก้ไข
                        </button>
                      )}
                    </div>

                    <form onSubmit={handleSaveCompSubmit} className="mt-5 space-y-4">
                      <div className="grid grid-cols-1 gap-4 md:grid-cols-12">
                        <div className="md:col-span-4">
                          <label className="mb-1.5 block text-xs font-medium text-slate-700">
                            กลุ่มกิจกรรม <span className="text-red-600">*</span>
                          </label>
                          <select
                            value={categoryGroup}
                            onChange={(e) => setCategoryGroup(e.target.value)}
                            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-800 focus:outline-none"
                          >
                            {allCategoryOptions.map((cat) => (
                              <option key={cat} value={cat}>
                                {cat}
                              </option>
                            ))}
                            <option value="__CUSTOM__">+ ระบุกลุ่มกิจกรรมใหม่...</option>
                          </select>
                          {categoryGroup === '__CUSTOM__' && (
                            <input
                              type="text"
                              value={customCategoryGroup}
                              onChange={(e) => setCustomCategoryGroup(e.target.value)}
                              placeholder="พิมพ์ชื่อกลุ่มกิจกรรมใหม่"
                              className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-800 focus:outline-none"
                            />
                          )}
                        </div>

                        <div className="md:col-span-4">
                          <label className="mb-1.5 block text-xs font-medium text-slate-700">
                            กิจกรรมหลัก <span className="text-red-600">*</span>
                          </label>
                          <input
                            type="text"
                            value={mainActivity}
                            onChange={(e) => setMainActivity(e.target.value)}
                            placeholder="เช่น วาดภาพระบายสี (ระบบจะต่อท้ายรุ่นให้)"
                            required
                            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-800 focus:outline-none"
                          />
                        </div>

                        <div className="md:col-span-4">
                          {editingCompId ? (
                            <>
                              <label className="mb-1.5 block text-xs font-medium text-slate-700">
                                รุ่นของรายการนี้
                              </label>
                              <div className="grid grid-cols-5 gap-1.5">
                                {COMPETITION_LEVELS.map((lvl) => {
                                  const active = compLevel === lvl;
                                  return (
                                    <button
                                      key={lvl}
                                      type="button"
                                      onClick={() => setCompLevel(lvl)}
                                      className={`rounded-lg border px-1.5 py-2 text-xs font-medium whitespace-nowrap transition-colors ${
                                        active
                                          ? 'border-blue-900 bg-blue-900 text-white'
                                          : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                                      }`}
                                    >
                                      {lvl}
                                    </button>
                                  );
                                })}
                                <button
                                  type="button"
                                  onClick={() => setCompLevel('')}
                                  className={`rounded-lg border px-1.5 py-2 text-xs font-medium whitespace-nowrap transition-colors ${
                                    compLevel === ''
                                      ? 'border-slate-800 bg-slate-800 text-white'
                                      : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-50'
                                  }`}
                                >
                                  ไม่ระบุ
                                </button>
                              </div>
                            </>
                          ) : (
                            <>
                              <label className="mb-1.5 block text-xs font-medium text-slate-700">
                                รุ่นที่เปิดแข่งขัน <span className="text-red-600">*</span>{' '}
                                <span className="text-slate-400">(เลือกหลายรุ่น = แยกเป็นคนละรายการ)</span>
                              </label>
                              <div className="grid grid-cols-4 gap-1.5">
                                {COMPETITION_LEVELS.map((lvl) => {
                                  const active = selectedNewLevels.includes(lvl);
                                  return (
                                    <button
                                      key={lvl}
                                      type="button"
                                      onClick={() => handleToggleNewLevel(lvl)}
                                      className={`rounded-lg border px-2 py-2 text-xs font-medium whitespace-nowrap transition-colors ${
                                        active
                                          ? 'border-blue-900 bg-blue-900 text-white'
                                          : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                                      }`}
                                    >
                                      {lvl}
                                    </button>
                                  );
                                })}
                              </div>
                            </>
                          )}
                        </div>
                      </div>

                      {!editingCompId && mainActivity.trim() && selectedNewLevels.length > 0 && (
                        <div className="rounded-lg border border-blue-100 bg-blue-50/70 px-3.5 py-2.5 text-xs text-blue-950">
                          <span className="font-medium">
                            ตัวอย่างรายการที่จะสร้าง ({selectedNewLevels.length} รายการ):
                          </span>{' '}
                          {COMPETITION_LEVELS.filter((l) => selectedNewLevels.includes(l))
                            .map((lvl) => buildLevelActivityName(mainActivity, lvl))
                            .join(' / ')}
                        </div>
                      )}

                      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
                        <div>
                          <label className="mb-1.5 block text-xs font-medium text-slate-700">
                            กิจกรรมย่อย (มีหรือไม่มีก็ได้)
                          </label>
                          <input
                            type="text"
                            value={subActivity}
                            onChange={(e) => setSubActivity(e.target.value)}
                            placeholder="เช่น เดี่ยว / ทีม 3 คน หรือเว้นว่าง"
                            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-800 focus:outline-none"
                          />
                        </div>

                        <div>
                          <label className="mb-1.5 block text-xs font-medium text-slate-700">
                            วัน (มีหรือไม่มีก็ได้)
                          </label>
                          <input
                            type="date"
                            value={competitionDate}
                            onChange={(e) => setCompetitionDate(e.target.value)}
                            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-800 focus:outline-none"
                          />
                        </div>

                        <div>
                          <label className="mb-1.5 block text-xs font-medium text-slate-700">
                            เวลา (มีหรือไม่มีก็ได้)
                          </label>
                          <input
                            type="text"
                            value={competitionTime}
                            onChange={(e) => setCompetitionTime(e.target.value)}
                            placeholder="เช่น 09:00 - 12:00 น."
                            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-800 focus:outline-none"
                          />
                        </div>

                        <div>
                          <label className="mb-1.5 block text-xs font-medium text-slate-700">
                            สถานที่ (มีหรือไม่มีก็ได้)
                          </label>
                          <input
                            type="text"
                            value={venue}
                            onChange={(e) => setVenue(e.target.value)}
                            placeholder="เช่น หอประชุมอาคาร 1"
                            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-800 focus:outline-none"
                          />
                        </div>
                      </div>

                      {compFormError && (
                        <p className="text-xs font-medium text-red-700">{compFormError}</p>
                      )}
                      {compFormSuccess && (
                        <p className="text-xs font-medium text-emerald-700">{compFormSuccess}</p>
                      )}

                      <div className="flex justify-end gap-3 pt-2">
                        <button
                          type="submit"
                          className="inline-flex items-center gap-1.5 rounded-lg bg-blue-900 px-5 py-2 text-sm font-medium text-white hover:bg-blue-950"
                        >
                          <Plus className="h-4 w-4" />
                          {editingCompId ? 'บันทึกการแก้ไขรายการ' : 'เพิ่มรายการแข่งขัน'}
                        </button>
                      </div>
                    </form>
                  </section>

                  <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-sm">
                        <thead>
                          <tr className="border-b border-slate-200 bg-slate-50 text-xs font-medium text-slate-600">
                            <th className="px-5 py-3">รหัส</th>
                            <th className="px-5 py-3">กลุ่มกิจกรรม / กิจกรรมหลัก / กิจกรรมย่อย</th>
                            <th className="px-5 py-3">รุ่น</th>
                            <th className="px-5 py-3">วัน</th>
                            <th className="px-5 py-3">เวลา</th>
                            <th className="px-5 py-3">สถานที่</th>
                            <th className="px-5 py-3 text-right">จัดการ</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                          {sortedCompetitions.map((comp) => (
                            <tr key={comp.id} className="align-top hover:bg-slate-50/70">
                              <td className="px-5 py-3.5 font-mono text-xs text-slate-500">
                                {comp.id}
                              </td>
                              <td className="px-5 py-3.5">
                                <div className="text-xs font-medium text-blue-900">
                                  {comp.categoryGroup}
                                </div>
                                <div className="font-medium text-slate-900">
                                  {comp.mainActivity}
                                </div>
                                <div className="text-xs text-slate-500">
                                  {comp.subActivity ? `กิจกรรมย่อย: ${comp.subActivity}` : 'ไม่มีกิจกรรมย่อย'}
                                </div>
                              </td>
                              <td className="px-5 py-3.5 whitespace-nowrap text-xs font-semibold text-slate-800">
                                {comp.level || <span className="font-normal text-slate-400">ไม่ระบุ</span>}
                              </td>
                              <td className="px-5 py-3.5 font-mono text-xs text-slate-700 tabular-nums">
                                {comp.competitionDate || (
                                  <span className="text-amber-700">ยังไม่กำหนด</span>
                                )}
                              </td>
                              <td className="px-5 py-3.5 font-mono text-xs text-slate-700 tabular-nums">
                                {comp.competitionTime || (
                                  <span className="text-amber-700">ยังไม่กำหนด</span>
                                )}
                              </td>
                              <td className="px-5 py-3.5 text-xs text-slate-700">
                                {comp.venue || <span className="text-amber-700">ยังไม่กำหนด</span>}
                              </td>
                              <td className="px-5 py-3.5 text-right whitespace-nowrap">
                                <div className="inline-flex items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() => handleEditComp(comp)}
                                    className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                                  >
                                    <Edit3 className="h-3 w-3" />
                                    แก้ไข
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => onDeleteCompetition(comp)}
                                    className="inline-flex items-center gap-1 rounded-md border border-red-200 bg-white px-2.5 py-1 text-xs font-medium text-red-700 hover:bg-red-50"
                                  >
                                    <Trash2 className="h-3 w-3" />
                                    ลบ
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </section>
                </div>
              )}

              {/* TAB 2: Category Groups CRUD & Ordering */}
              {activeTab === 'categories' && (
                <div className="space-y-6">
                  <section className="rounded-xl border border-slate-200 bg-white p-6">
                    <div className="border-b border-slate-200 pb-4">
                      <h2 className="font-display text-base font-bold text-slate-900">
                        จัดการกลุ่มกิจกรรม (เพิ่ม / ลบ / จัดลำดับ)
                      </h2>
                      <p className="mt-0.5 text-xs text-slate-500">
                        ลำดับกลุ่มกิจกรรมที่ตั้งค่าที่นี่จะใช้เรียงลำดับในตารางกำหนดการหน้าบุคคลทั่วไปและตัวเลือกทั้งหมดโดยอัตโนมัติ
                        พร้อมบันทึกไว้ในชีท รายการ ของ Google Sheets
                      </p>
                    </div>

                    <form onSubmit={handleAddCategoryGroup} className="mt-5 space-y-3">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                        <div className="flex-1">
                          <label className="mb-1.5 block text-xs font-medium text-slate-700">
                            ชื่อกลุ่มกิจกรรมใหม่ <span className="text-red-600">*</span>
                          </label>
                          <input
                            type="text"
                            value={newCategoryInput}
                            onChange={(e) => setNewCategoryInput(e.target.value)}
                            placeholder="เช่น หุ่นยนต์และนวัตกรรม หรือ สุขศึกษาและพลศึกษา"
                            disabled={isSavingCategories}
                            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-800 focus:outline-none disabled:bg-slate-100"
                          />
                        </div>
                        <button
                          type="submit"
                          disabled={isSavingCategories}
                          className="inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg bg-blue-900 px-5 py-2 text-sm font-medium text-white hover:bg-blue-950 disabled:opacity-50"
                        >
                          <Plus className="h-4 w-4" />
                          เพิ่มกลุ่มกิจกรรม
                        </button>
                      </div>

                      {catFormError && (
                        <p className="text-xs font-medium text-red-700">{catFormError}</p>
                      )}
                      {catFormSuccess && (
                        <p className="text-xs font-medium text-emerald-700">{catFormSuccess}</p>
                      )}
                    </form>
                  </section>

                  <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                    <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3.5">
                      <h3 className="text-sm font-semibold text-slate-900">
                        ลำดับกลุ่มกิจกรรมทั้งหมด ({categoryGroups.length} กลุ่ม)
                      </h3>
                      <span className="text-xs text-slate-500">
                        กดปุ่มเลื่อนขึ้น / เลื่อนลง เพื่อจัดลำดับการแสดงผล
                      </span>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-sm">
                        <thead>
                          <tr className="border-b border-slate-200 bg-slate-50 text-xs font-medium text-slate-600">
                            <th className="w-24 px-5 py-3">ลำดับที่</th>
                            <th className="px-5 py-3">ชื่อกลุ่มกิจกรรม</th>
                            <th className="w-40 px-5 py-3 text-right">จำนวนรายการแข่งขัน</th>
                            <th className="w-64 px-5 py-3 text-right">จัดลำดับ / จัดการ</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                          {categoryGroups.length === 0 ? (
                            <tr>
                              <td
                                colSpan={4}
                                className="px-5 py-10 text-center text-xs text-slate-500"
                              >
                                ยังไม่มีกลุ่มกิจกรรม กรุณาเพิ่มกลุ่มกิจกรรมใหม่จากแบบฟอร์มด้านบน
                              </td>
                            </tr>
                          ) : (
                            categoryGroups.map((group, index) => {
                              const compCount = competitionCountByCategory.get(group) || 0;
                              return (
                                <tr key={group} className="hover:bg-slate-50/70">
                                  <td className="px-5 py-3 font-mono text-xs font-semibold text-slate-600 tabular-nums">
                                    {index + 1}
                                  </td>
                                  <td className="px-5 py-3 font-medium text-slate-900">
                                    {group}
                                  </td>
                                  <td className="px-5 py-3 text-right font-mono text-xs text-slate-600 tabular-nums">
                                    {compCount} รายการ
                                  </td>
                                  <td className="px-5 py-3 text-right whitespace-nowrap">
                                    <div className="inline-flex items-center gap-1.5">
                                      <button
                                        type="button"
                                        onClick={() => handleMoveCategoryGroup(index, 'up')}
                                        disabled={index === 0 || isSavingCategories}
                                        title="เลื่อนขึ้น"
                                        className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                                      >
                                        <ArrowUp className="h-3 w-3" />
                                        ขึ้น
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleMoveCategoryGroup(index, 'down')}
                                        disabled={
                                          index === categoryGroups.length - 1 || isSavingCategories
                                        }
                                        title="เลื่อนลง"
                                        className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                                      >
                                        <ArrowDown className="h-3 w-3" />
                                        ลง
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() =>
                                          handleRequestDeleteCategoryGroup(group, index)
                                        }
                                        disabled={isSavingCategories}
                                        className="inline-flex items-center gap-1 rounded-md border border-red-200 bg-white px-2.5 py-1 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-40"
                                      >
                                        <Trash2 className="h-3 w-3" />
                                        ลบ
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              );
                            })
                          )}
                        </tbody>
                      </table>
                    </div>
                  </section>
                </div>
              )}

              {/* TAB 2: Users & School Accounts CRUD */}
              {activeTab === 'users' && (
                <div className="space-y-6">
                  <section className="rounded-xl border border-slate-200 bg-white p-6">
                    <div className="flex items-center justify-between border-b border-slate-200 pb-4">
                      <div>
                        <h2 className="font-display text-base font-bold text-slate-900">
                          {editingUserId
                            ? `แก้ไขบัญชีผู้ใช้งาน (${editingUserId})`
                            : 'สร้างบัญชีโรงเรียนใหม่ (แอดมินโรงเรียน)'}
                        </h2>
                        <p className="text-xs text-slate-500">
                          โรงเรียนที่สร้างในชีท user จะปรากฏเป็นตัวเลือกในดร็อปดาวน์หน้าเข้าสู่ระบบโดยอัตโนมัติ
                        </p>
                      </div>
                      {editingUserId && (
                        <button
                          type="button"
                          onClick={resetUserForm}
                          className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                        >
                          ยกเลิกการแก้ไข
                        </button>
                      )}
                    </div>

                    <form onSubmit={handleSaveUserSubmit} className="mt-5 space-y-4">
                      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                        <div>
                          <label className="mb-1.5 block text-xs font-medium text-slate-700">
                            ชื่อโรงเรียน / ชื่อแสดงผล <span className="text-red-600">*</span>
                          </label>
                          <input
                            type="text"
                            value={schoolNameInput}
                            onChange={(e) => setSchoolNameInput(e.target.value)}
                            placeholder="เช่น โรงเรียนบ้านหนองแสง"
                            required
                            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-800 focus:outline-none"
                          />
                        </div>
                        <div>
                          <label className="mb-1.5 block text-xs font-medium text-slate-700">
                            รหัสอ้างอิง / Username <span className="text-red-600">*</span>
                          </label>
                          <input
                            type="text"
                            value={usernameInput}
                            onChange={(e) => setUsernameInput(e.target.value)}
                            placeholder="เช่น sch_nongsaeng"
                            required
                            disabled={
                              editingUserId ===
                              users.find((u) => u.username === 'admin')?.id
                            }
                            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-800 focus:outline-none disabled:bg-slate-100"
                          />
                        </div>
                        <div>
                          <label className="mb-1.5 block text-xs font-medium text-slate-700">
                            รหัสผ่าน <span className="text-red-600">*</span>
                          </label>
                          <input
                            type="text"
                            value={passwordInput}
                            onChange={(e) => setPasswordInput(e.target.value)}
                            placeholder="กำหนดรหัสผ่านสำหรับโรงเรียน"
                            required
                            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-800 focus:outline-none"
                          />
                        </div>
                      </div>

                      {userFormError && (
                        <p className="text-xs font-medium text-red-700">{userFormError}</p>
                      )}
                      {userFormSuccess && (
                        <p className="text-xs font-medium text-emerald-700">{userFormSuccess}</p>
                      )}

                      <div className="flex justify-end">
                        <button
                          type="submit"
                          className="inline-flex items-center gap-1.5 rounded-lg bg-blue-900 px-5 py-2 text-sm font-medium text-white hover:bg-blue-950"
                        >
                          <Plus className="h-4 w-4" />
                          {editingUserId ? 'บันทึกการแก้ไขบัญชี' : 'สร้างบัญชีโรงเรียน'}
                        </button>
                      </div>
                    </form>
                  </section>

                  <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-sm">
                        <thead>
                          <tr className="border-b border-slate-200 bg-slate-50 text-xs font-medium text-slate-600">
                            <th className="px-5 py-3">รหัส</th>
                            <th className="px-5 py-3">ชื่อโรงเรียน / บทบาท</th>
                            <th className="px-5 py-3">Username</th>
                            <th className="px-5 py-3">รหัสผ่าน</th>
                            <th className="px-5 py-3">สิทธิ์</th>
                            <th className="px-5 py-3 text-right">จัดการ</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                          {users.map((u) => (
                            <tr key={u.id} className="hover:bg-slate-50/70">
                              <td className="px-5 py-3 font-mono text-xs text-slate-500">
                                {u.id}
                              </td>
                              <td className="px-5 py-3 font-medium text-slate-900">
                                {u.schoolName}
                              </td>
                              <td className="px-5 py-3 font-mono text-xs text-slate-700">
                                {u.username}
                              </td>
                              <td className="px-5 py-3 font-mono text-xs text-slate-600">
                                {u.password}
                              </td>
                              <td className="px-5 py-3 text-xs font-medium text-slate-700">
                                {u.role === 'admin' ? 'ผู้ดูแลระบบ' : 'แอดมินโรงเรียน'}
                              </td>
                              <td className="px-5 py-3 text-right whitespace-nowrap">
                                <div className="inline-flex items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() => handleEditUser(u)}
                                    className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                                  >
                                    <Edit3 className="h-3 w-3" />
                                    แก้ไข
                                  </button>
                                  {u.username !== 'admin' && (
                                    <button
                                      type="button"
                                      onClick={() => onDeleteUser(u)}
                                      className="inline-flex items-center gap-1 rounded-md border border-red-200 bg-white px-2.5 py-1 text-xs font-medium text-red-700 hover:bg-red-50"
                                    >
                                      <Trash2 className="h-3 w-3" />
                                      ลบ
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </section>
                </div>
              )}

              {/* TAB 3: All Registrations Overview */}
              {activeTab === 'registrations' && (
                <div className="space-y-4">
                  <section className="grid grid-cols-1 gap-3 rounded-xl border border-slate-200 bg-white p-4 md:grid-cols-3">
                    <select
                      aria-label="กรองกลุ่มกิจกรรม"
                      value={regFilterCategory}
                      onChange={(e) => setRegFilterCategory(e.target.value)}
                      className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-800 focus:outline-none"
                    >
                      <option value="ALL">ทุกกลุ่มกิจกรรม</option>
                      {allCategoryOptions.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </select>

                    <select
                      aria-label="กรองรุ่น"
                      value={regFilterLevel}
                      onChange={(e) => setRegFilterLevel(e.target.value)}
                      className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-800 focus:outline-none"
                    >
                      <option value="ALL">ทุกรุ่น</option>
                      {COMPETITION_LEVELS.map((lvl) => (
                        <option key={lvl} value={lvl}>
                          รุ่น {lvl}
                        </option>
                      ))}
                    </select>

                    <select
                      aria-label="กรองโรงเรียน"
                      value={regFilterSchool}
                      onChange={(e) => setRegFilterSchool(e.target.value)}
                      className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-800 focus:outline-none"
                    >
                      <option value="ALL">ทุกโรงเรียน</option>
                      {schoolList.map((sch) => (
                        <option key={sch} value={sch}>
                          {sch}
                        </option>
                      ))}
                    </select>
                  </section>

                  <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-sm">
                        <thead>
                          <tr className="border-b border-slate-200 bg-slate-50 text-xs font-medium text-slate-600">
                            <th className="px-5 py-3">รหัส</th>
                            <th className="px-5 py-3">โรงเรียน</th>
                            <th className="px-5 py-3">รายการแข่งขัน</th>
                            <th className="px-5 py-3">รุ่น</th>
                            <th className="px-5 py-3">ครูที่ปรึกษา</th>
                            <th className="px-5 py-3">นักเรียน</th>
                            <th className="px-5 py-3">สถานะ</th>
                            <th className="px-5 py-3 text-right">จัดการ</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                          {filteredRegistrations.length === 0 ? (
                            <tr>
                              <td
                                colSpan={8}
                                className="px-5 py-10 text-center text-xs text-slate-500"
                              >
                                ไม่พบข้อมูลการลงทะเบียนตามตัวกรองที่เลือก
                              </td>
                            </tr>
                          ) : (
                            filteredRegistrations.map((reg) => {
                              const complete = isRegistrationComplete(reg);
                              return (
                                <tr key={reg.id} className="align-top hover:bg-slate-50/70">
                                  <td className="px-5 py-3.5 font-mono text-xs text-slate-500">
                                    {reg.id}
                                  </td>
                                  <td className="px-5 py-3.5 font-medium text-slate-900">
                                    {reg.schoolName}
                                  </td>
                                  <td className="px-5 py-3.5">
                                    <div className="text-xs text-blue-900">{reg.categoryGroup}</div>
                                    <div className="font-medium text-slate-900">
                                      {reg.mainActivity}
                                    </div>
                                    {reg.subActivity && (
                                      <div className="text-xs text-slate-500">
                                        {reg.subActivity}
                                      </div>
                                    )}
                                  </td>
                                  <td className="px-5 py-3.5 whitespace-nowrap text-xs font-semibold text-slate-800">
                                    {reg.level}
                                  </td>
                                  <td className="px-5 py-3.5 text-xs text-slate-700">
                                    {reg.advisors.length === 0 ? (
                                      <span className="text-orange-700">ยังไม่ระบุ</span>
                                    ) : (
                                      reg.advisors.map((a, i) => <div key={i}>{a}</div>)
                                    )}
                                  </td>
                                  <td className="px-5 py-3.5 text-xs text-slate-700">
                                    {reg.students.length === 0 ? (
                                      <span className="text-orange-700">ยังไม่ระบุ</span>
                                    ) : (
                                      reg.students.map((s, i) => (
                                        <div key={i}>
                                          {s.title}
                                          {s.fullName} ({s.grade})
                                        </div>
                                      ))
                                    )}
                                  </td>
                                  <td className="px-5 py-3.5 whitespace-nowrap">
                                    <span
                                      className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium ${
                                        complete
                                          ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                                          : 'border-orange-200 bg-orange-50 text-orange-800'
                                      }`}
                                    >
                                      {complete ? (
                                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                                      ) : (
                                        <AlertCircle className="h-3.5 w-3.5 text-orange-600" />
                                      )}
                                      {complete ? 'เรียบร้อย' : 'ไม่เรียบร้อย'}
                                    </span>
                                  </td>
                                  <td className="px-5 py-3.5 text-right whitespace-nowrap">
                                    <button
                                      type="button"
                                      onClick={() => onDeleteRegistration(reg)}
                                      className="inline-flex items-center gap-1 rounded-md border border-red-200 bg-white px-2.5 py-1 text-xs font-medium text-red-700 hover:bg-red-50"
                                    >
                                      <Trash2 className="h-3 w-3" />
                                      ลบ
                                    </button>
                                  </td>
                                </tr>
                              );
                            })
                          )}
                        </tbody>
                      </table>
                    </div>
                  </section>
                </div>
              )}

              {/* TAB 4: Admin Activity Log */}
              {activeTab === 'logs' && (
                <div className="space-y-5">
                  {/* Summary Metrics */}
                  <section className="grid grid-cols-2 divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white sm:grid-cols-4 sm:divide-x sm:divide-y-0">
                    <div className="px-5 py-4">
                      <p className="text-xs font-medium text-slate-500">รายการที่แสดง</p>
                      <p className="mt-1 font-mono text-2xl font-semibold text-slate-900 tabular-nums">
                        {logActionCounts.total}
                      </p>
                    </div>
                    <div className="px-5 py-4">
                      <p className="text-xs font-medium text-emerald-700">เพิ่มเติมข้อมูล</p>
                      <p className="mt-1 font-mono text-2xl font-semibold text-emerald-700 tabular-nums">
                        {logActionCounts.create}
                      </p>
                    </div>
                    <div className="px-5 py-4">
                      <p className="text-xs font-medium text-blue-900">แก้ไข / อัปเดต</p>
                      <p className="mt-1 font-mono text-2xl font-semibold text-blue-900 tabular-nums">
                        {logActionCounts.update}
                      </p>
                    </div>
                    <div className="px-5 py-4">
                      <p className="text-xs font-medium text-red-700">ลบข้อมูล</p>
                      <p className="mt-1 font-mono text-2xl font-semibold text-red-700 tabular-nums">
                        {logActionCounts.del}
                      </p>
                    </div>
                  </section>

                  {/* Filter Bar */}
                  <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-5">
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3.5">
                      <div>
                        <h2 className="font-display text-base font-bold text-slate-900">
                          ประวัติการเพิ่มเติม แก้ไข และอัปเดตข้อมูล (Activity Log)
                        </h2>
                        <p className="text-xs text-slate-500">
                          ตรวจสอบย้อนหลังได้ว่าใคร เพิ่ม แก้ไข อัปเดต หรือลบข้อมูลอะไร ในวันและเวลาใด
                          (บันทึกลง Google Sheets อัตโนมัติ)
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center gap-3">
                        <label className="inline-flex cursor-pointer items-center gap-2 text-xs text-slate-700">
                          <input
                            type="checkbox"
                            checked={includeSheetSnapshots}
                            onChange={(e) => setIncludeSheetSnapshots(e.target.checked)}
                            className="h-4 w-4 rounded border-slate-300 text-blue-900 focus:ring-blue-800"
                          />
                          รวมเวลาบันทึกเดิมจากข้อมูลในชีท
                        </label>
                        {(logSearch !== '' ||
                          logFilterAction !== 'ALL' ||
                          logFilterTarget !== 'ALL' ||
                          logFilterActor !== 'ALL' ||
                          logFilterDate !== '') && (
                          <button
                            type="button"
                            onClick={() => {
                              setLogSearch('');
                              setLogFilterAction('ALL');
                              setLogFilterTarget('ALL');
                              setLogFilterActor('ALL');
                              setLogFilterDate('');
                            }}
                            className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                          >
                            <RotateCcw className="h-3.5 w-3.5" />
                            ล้างตัวกรอง
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-3 md:grid-cols-12">
                      <div className="relative md:col-span-4">
                        <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
                        <input
                          type="text"
                          value={logSearch}
                          onChange={(e) => setLogSearch(e.target.value)}
                          placeholder="ค้นหาชื่อผู้ทำรายการ, โรงเรียน, กิจกรรม, รหัส..."
                          className="w-full rounded-lg border border-slate-300 bg-white py-2 pr-3 pl-9 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-800 focus:outline-none"
                        />
                      </div>

                      <div className="md:col-span-2">
                        <select
                          aria-label="กรองตามการดำเนินการ"
                          value={logFilterAction}
                          onChange={(e) => setLogFilterAction(e.target.value)}
                          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-800 focus:outline-none"
                        >
                          <option value="ALL">ทุกการดำเนินการ</option>
                          <option value="create">เพิ่มเติมข้อมูล</option>
                          <option value="update">แก้ไข / อัปเดต</option>
                          <option value="delete">ลบข้อมูล</option>
                        </select>
                      </div>

                      <div className="md:col-span-2">
                        <select
                          aria-label="กรองตามหมวดหมู่"
                          value={logFilterTarget}
                          onChange={(e) => setLogFilterTarget(e.target.value)}
                          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-800 focus:outline-none"
                        >
                          <option value="ALL">ทุกหมวดหมู่</option>
                          <option value="registration">การลงทะเบียน</option>
                          <option value="competition">รายการแข่งขัน</option>
                          <option value="category">กลุ่มกิจกรรม</option>
                          <option value="user">บัญชีโรงเรียน</option>
                          <option value="settings">ตั้งค่าหน้าเว็บ</option>
                        </select>
                      </div>

                      <div className="md:col-span-2">
                        <select
                          aria-label="กรองตามผู้ดำเนินการ"
                          value={logFilterActor}
                          onChange={(e) => setLogFilterActor(e.target.value)}
                          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-800 focus:outline-none"
                        >
                          <option value="ALL">ผู้ดำเนินการทั้งหมด</option>
                          {logActorOptions.map((actor) => (
                            <option key={actor} value={actor}>
                              {actor}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="md:col-span-2">
                        <input
                          type="date"
                          aria-label="กรองตามวันที่"
                          value={logFilterDate}
                          onChange={(e) => setLogFilterDate(e.target.value)}
                          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-800 focus:outline-none"
                        />
                      </div>
                    </div>
                  </section>

                  {/* Log Entries Table */}
                  <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-sm">
                        <thead>
                          <tr className="border-b border-slate-200 bg-slate-50 text-xs font-medium text-slate-600">
                            <th className="w-52 px-5 py-3">วัน / เวลา (เมื่อไหร่)</th>
                            <th className="w-52 px-5 py-3">ผู้ดำเนินการ (ใคร)</th>
                            <th className="w-40 px-5 py-3">การดำเนินการ / หมวดหมู่</th>
                            <th className="px-5 py-3">รายละเอียดการเปลี่ยนแปลง (ทำอะไร)</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                          {filteredLogs.length === 0 ? (
                            <tr>
                              <td
                                colSpan={4}
                                className="px-5 py-12 text-center text-xs text-slate-500"
                              >
                                ยังไม่พบบันทึกประวัติการใช้งานที่ตรงกับเงื่อนไขที่เลือก
                              </td>
                            </tr>
                          ) : (
                            filteredLogs.map((log) => {
                              const { dateText, timeText, relativeText } =
                                formatThaiLogTimestamp(log.timestamp);
                              const actionTone =
                                log.action === 'create'
                                  ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                                  : log.action === 'delete'
                                  ? 'border-red-200 bg-red-50 text-red-800'
                                  : 'border-blue-200 bg-blue-50 text-blue-900';
                              return (
                                <tr key={log.id} className="align-top hover:bg-slate-50/70">
                                  <td className="px-5 py-3.5 whitespace-nowrap">
                                    <div className="text-xs font-semibold text-slate-900 tabular-nums">
                                      {dateText}
                                    </div>
                                    <div className="mt-0.5 inline-flex items-center gap-1 font-mono text-xs text-slate-600 tabular-nums">
                                      <Clock className="h-3 w-3 text-slate-400" />
                                      {timeText}
                                    </div>
                                    {relativeText && (
                                      <div className="mt-0.5 text-[11px] text-slate-400">
                                        {relativeText}
                                      </div>
                                    )}
                                  </td>

                                  <td className="px-5 py-3.5">
                                    <div className="text-xs font-semibold text-slate-900">
                                      {log.actorName}
                                    </div>
                                    <div className="mt-0.5 font-mono text-[11px] text-slate-500">
                                      @{log.actorUsername}
                                    </div>
                                    <div className="mt-1">
                                      <span
                                        className={`inline-block rounded border px-1.5 py-0.5 text-[10px] font-medium ${
                                          log.actorRole === 'admin'
                                            ? 'border-slate-300 bg-slate-100 text-slate-800'
                                            : 'border-blue-200 bg-blue-50 text-blue-900'
                                        }`}
                                      >
                                        {log.actorRole === 'admin'
                                          ? 'ผู้ดูแลระบบ'
                                          : 'แอดมินโรงเรียน'}
                                      </span>
                                    </div>
                                  </td>

                                  <td className="px-5 py-3.5 whitespace-nowrap">
                                    <span
                                      className={`inline-block rounded-md border px-2 py-0.5 text-xs font-medium ${actionTone}`}
                                    >
                                      {ACTION_LABELS[log.action]}
                                    </span>
                                    <div className="mt-1.5 text-xs font-medium text-slate-700">
                                      {TARGET_TYPE_LABELS[log.targetType]}
                                    </div>
                                    <div className="mt-0.5 text-[11px] text-slate-400">
                                      {log.source === 'log' ? 'Log กิจกรรม' : 'เวลาเดิมในชีท'}
                                    </div>
                                  </td>

                                  <td className="px-5 py-3.5">
                                    <div className="text-xs font-semibold text-slate-900">
                                      {log.summary}
                                    </div>
                                    {log.details.length > 0 && (
                                      <ul className="mt-1.5 space-y-0.5 text-xs text-slate-600">
                                        {log.details.map((detail, idx) => (
                                          <li key={idx} className="leading-relaxed">
                                            • {detail}
                                          </li>
                                        ))}
                                      </ul>
                                    )}
                                  </td>
                                </tr>
                              );
                            })
                          )}
                        </tbody>
                      </table>
                    </div>
                  </section>
                </div>
              )}
              {/* TAB 5: Site Title & Details Settings */}
              {activeTab === 'settings' && (
                <div className="space-y-6">
                  <section className="rounded-xl border border-slate-200 bg-white p-6">
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-4">
                      <div>
                        <h2 className="font-display text-base font-bold text-slate-900">
                          แก้ไขหัวเรื่องและรายละเอียดหน้าเว็บไซต์
                        </h2>
                        <p className="mt-0.5 text-xs text-slate-500">
                          เปลี่ยนชื่อหัวเรื่องหลัก (เช่น ศิลปหัตถกรรมฯ ครั้งที่ 74) คำอธิบาย และข้อความส่วนท้ายเว็บ
                          พร้อมบันทึกไว้ใน Google Sheets เพื่อให้แสดงผลเหมือนกันทุกเครื่อง
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setSiteTitleInput(DEFAULT_SITE_SETTINGS.siteTitle);
                          setSiteSubtitleInput(DEFAULT_SITE_SETTINGS.siteSubtitle);
                          setHeroHeadingInput(DEFAULT_SITE_SETTINGS.heroHeading);
                          setHeroDescriptionInput(DEFAULT_SITE_SETTINGS.heroDescription);
                          setFooterTextInput(DEFAULT_SITE_SETTINGS.footerText);
                          setSettingsError(null);
                          setSettingsSuccess(null);
                        }}
                        className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                        คืนค่าข้อความเริ่มต้น
                      </button>
                    </div>

                    <form
                      onSubmit={async (e) => {
                        e.preventDefault();
                        setSettingsError(null);
                        setSettingsSuccess(null);
                        if (!siteTitleInput.trim()) {
                          setSettingsError('กรุณาระบุหัวเรื่องหลักของเว็บไซต์');
                          return;
                        }
                        if (!heroHeadingInput.trim()) {
                          setSettingsError('กรุณาระบุหัวข้อใหญ่หน้าแรก');
                          return;
                        }
                        setIsSavingSettings(true);
                        try {
                          const ok = await onSaveSiteSettings({
                            siteTitle: siteTitleInput.trim(),
                            siteSubtitle: siteSubtitleInput.trim(),
                            heroHeading: heroHeadingInput.trim(),
                            heroDescription: heroDescriptionInput.trim(),
                            footerText:
                              footerTextInput.trim() || DEFAULT_SITE_SETTINGS.footerText,
                          });
                          if (ok) {
                            setSettingsSuccess(
                              'บันทึกหัวเรื่องและรายละเอียดเรียบร้อยแล้ว (อัปเดตทุกหน้าทันที)'
                            );
                          }
                        } finally {
                          setIsSavingSettings(false);
                        }
                      }}
                      className="mt-5 space-y-4"
                    >
                      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        <div>
                          <label className="mb-1.5 block text-xs font-medium text-slate-700">
                            หัวเรื่องหลัก (แถบด้านบน / แถบข้าง / Title เบราว์เซอร์){' '}
                            <span className="text-red-600">*</span>
                          </label>
                          <input
                            type="text"
                            value={siteTitleInput}
                            onChange={(e) => setSiteTitleInput(e.target.value)}
                            placeholder="เช่น ศิลปหัตถกรรมฯ ครั้งที่ 74"
                            required
                            className="w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm text-slate-900 focus:border-blue-800 focus:outline-none"
                          />
                        </div>

                        <div>
                          <label className="mb-1.5 block text-xs font-medium text-slate-700">
                            ข้อความหัวข้อย่อยเหนือหัวข้อหน้าแรก
                          </label>
                          <input
                            type="text"
                            value={siteSubtitleInput}
                            onChange={(e) => setSiteSubtitleInput(e.target.value)}
                            placeholder="เช่น งานศิลปหัตถกรรมนักเรียน ครั้งที่ 74 · ประกาศรายการแข่งขันและผู้เข้าประกวด"
                            className="w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm text-slate-900 focus:border-blue-800 focus:outline-none"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="mb-1.5 block text-xs font-medium text-slate-700">
                          หัวข้อใหญ่หน้าแรก (หน้าบุคคลทั่วไป){' '}
                          <span className="text-red-600">*</span>
                        </label>
                        <input
                          type="text"
                          value={heroHeadingInput}
                          onChange={(e) => setHeroHeadingInput(e.target.value)}
                          placeholder="เช่น รายการแข่งขัน กำหนดการ และรายชื่อโรงเรียนที่ลงทะเบียน"
                          required
                          className="w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm text-slate-900 focus:border-blue-800 focus:outline-none"
                        />
                      </div>

                      <div>
                        <label className="mb-1.5 block text-xs font-medium text-slate-700">
                          รายละเอียดหน้าแรก (คำอธิบายใต้หัวข้อใหญ่)
                        </label>
                        <textarea
                          rows={3}
                          value={heroDescriptionInput}
                          onChange={(e) => setHeroDescriptionInput(e.target.value)}
                          placeholder="คำอธิบายรายละเอียดงานแข่งขัน..."
                          className="w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm text-slate-900 focus:border-blue-800 focus:outline-none"
                        />
                      </div>

                      <div>
                        <label className="mb-1.5 block text-xs font-medium text-slate-700">
                          ข้อความส่วนท้ายเว็บไซต์ (Footer)
                        </label>
                        <input
                          type="text"
                          value={footerTextInput}
                          onChange={(e) => setFooterTextInput(e.target.value)}
                          placeholder="เช่น งานศิลปหัตถกรรมนักเรียน ครั้งที่ 74 · ระบบจัดการรายการแข่งขันและลงทะเบียน"
                          className="w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm text-slate-900 focus:border-blue-800 focus:outline-none"
                        />
                      </div>

                      {settingsError && (
                        <p className="text-xs font-medium text-red-700">{settingsError}</p>
                      )}
                      {settingsSuccess && (
                        <p className="text-xs font-medium text-emerald-700">{settingsSuccess}</p>
                      )}

                      <div className="flex justify-end pt-2">
                        <button
                          type="submit"
                          disabled={isSavingSettings}
                          className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg bg-blue-900 px-5 py-2 text-sm font-medium text-white hover:bg-blue-950 disabled:opacity-50"
                        >
                          <CheckCircle2 className="h-4 w-4" />
                          {isSavingSettings ? 'กำลังบันทึก...' : 'บันทึกหัวเรื่องและรายละเอียด'}
                        </button>
                      </div>
                    </form>
                  </section>

                  {/* Live Preview */}
                  <section className="rounded-xl border border-slate-200 bg-white p-6">
                    <p className="mb-3 text-xs font-semibold text-slate-500">
                      ตัวอย่างการแสดงผลหน้าบุคคลทั่วไป
                    </p>
                    <div className="overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
                      <div className="border-b border-slate-200 bg-white px-5 py-3">
                        <span className="font-display text-sm font-bold text-slate-900">
                          {siteTitleInput || DEFAULT_SITE_SETTINGS.siteTitle}
                        </span>
                      </div>
                      <div className="space-y-2 bg-white px-5 py-5">
                        {siteSubtitleInput.trim() && (
                          <p className="text-xs font-medium text-blue-900">
                            {siteSubtitleInput}
                          </p>
                        )}
                        <h3 className="font-display text-xl font-bold text-slate-900">
                          {heroHeadingInput || DEFAULT_SITE_SETTINGS.heroHeading}
                        </h3>
                        {heroDescriptionInput.trim() && (
                          <p className="text-xs leading-relaxed text-slate-600">
                            {heroDescriptionInput}
                          </p>
                        )}
                      </div>
                      <div className="border-t border-slate-200 bg-slate-50 px-5 py-2.5 text-[11px] text-slate-500">
                        {footerTextInput || DEFAULT_SITE_SETTINGS.footerText}
                      </div>
                    </div>
                  </section>
                </div>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
};
