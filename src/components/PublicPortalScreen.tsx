import React, { useMemo, useState } from 'react';
import {
  AlertCircle,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Lock,
  MapPin,
  RotateCcw,
  Search,
  Users,
} from 'lucide-react';
import {
  COMPETITION_LEVELS,
  CompetitionItem,
  CompetitionLevel,
  RegistrationRecord,
  ScreenPath,
  SiteSettings,
  TransitionType,
  UserAccount,
  formatCountdownThai,
  formatThaiDateTime,
  getRegistrationStatus,
  isRegistrationComplete,
} from '../types';

interface PublicPortalScreenProps {
  competitions: CompetitionItem[];
  registrations: RegistrationRecord[];
  users: UserAccount[];
  categoryGroups: string[];
  siteSettings: SiteSettings;
  nowMs: number;
  currentUser: UserAccount | null;
  isGoogleConnected: boolean;
  isSyncing: boolean;
  onNavigate: (path: ScreenPath, transition: TransitionType) => void;
}

function getLevelRank(level?: string): number {
  const idx = COMPETITION_LEVELS.indexOf(level as CompetitionLevel);
  return idx === -1 ? 99 : idx;
}

function groupRegistrationsByLevel(regs: RegistrationRecord[], categoryGroups: string[]) {
  const sorted = [...regs].sort((a, b) => {
    const lDiff = getLevelRank(a.level) - getLevelRank(b.level);
    if (lDiff !== 0) return lDiff;
    const catIdxA = categoryGroups.indexOf(a.categoryGroup);
    const catIdxB = categoryGroups.indexOf(b.categoryGroup);
    const cRankA = catIdxA === -1 ? Number.MAX_SAFE_INTEGER : catIdxA;
    const cRankB = catIdxB === -1 ? Number.MAX_SAFE_INTEGER : catIdxB;
    if (cRankA !== cRankB) return cRankA - cRankB;
    const actDiff = a.mainActivity.localeCompare(b.mainActivity, 'th');
    if (actDiff !== 0) return actDiff;
    return a.schoolName.localeCompare(b.schoolName, 'th');
  });

  const groups: Array<{ level: string; regs: RegistrationRecord[] }> = [];
  const map = new Map<string, RegistrationRecord[]>();
  sorted.forEach((reg) => {
    const key = reg.level || 'ไม่ระบุรุ่น';
    let bucket = map.get(key);
    if (!bucket) {
      bucket = [];
      map.set(key, bucket);
      groups.push({ level: key, regs: bucket });
    }
    bucket.push(reg);
  });
  return groups;
}

export const PublicPortalScreen: React.FC<PublicPortalScreenProps> = ({
  competitions,
  registrations,
  users,
  categoryGroups,
  siteSettings,
  nowMs,
  currentUser,
  isGoogleConnected,
  isSyncing,
  onNavigate,
}) => {
  const isSystemReady = isGoogleConnected && !isSyncing;
  const registrationStatus = useMemo(
    () => getRegistrationStatus(siteSettings, nowMs),
    [siteSettings, nowMs]
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectedLevel, setSelectedLevel] = useState<string>('ALL');
  const [selectedSchool, setSelectedSchool] = useState<string>('ALL');
  const [viewMode, setViewMode] = useState<'competitions' | 'schools'>('competitions');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'REGISTERED' | 'HAS_VENUE'>('ALL');
  const [expandedCompIds, setExpandedCompIds] = useState<Record<string, boolean>>({});
  const [heroImgFailed, setHeroImgFailed] = useState(false);

  const venueCompetitionIdSet = useMemo(() => {
    const set = new Set<string>();
    competitions.forEach((c) => {
      if (c.venue && c.venue.trim() !== '') {
        set.add(c.id);
      }
    });
    return set;
  }, [competitions]);

  const categories = useMemo(() => {
    const usedSet = new Set<string>();
    competitions.forEach((c) => {
      if (c.categoryGroup) usedSet.add(c.categoryGroup);
    });
    const ordered = categoryGroups.filter((g) => usedSet.has(g));
    usedSet.forEach((g) => {
      if (!ordered.includes(g)) ordered.push(g);
    });
    return ordered;
  }, [competitions, categoryGroups]);

  const schools = useMemo(() => {
    const set = new Set<string>();
    users
      .filter((u) => u.role === 'school' && u.schoolName)
      .forEach((u) => set.add(u.schoolName));
    registrations.forEach((r) => {
      if (r.schoolName) set.add(r.schoolName);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'th'));
  }, [users, registrations]);

  const filteredRegistrations = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const list = registrations.filter((reg) => {
      if (statusFilter === 'HAS_VENUE' && !venueCompetitionIdSet.has(reg.competitionId)) {
        return false;
      }
      if (selectedCategory !== 'ALL' && reg.categoryGroup !== selectedCategory) return false;
      if (selectedLevel !== 'ALL' && reg.level !== selectedLevel) return false;
      if (selectedSchool !== 'ALL' && reg.schoolName !== selectedSchool) return false;
      if (!q) return true;
      const inBasic =
        reg.mainActivity.toLowerCase().includes(q) ||
        (reg.subActivity || '').toLowerCase().includes(q) ||
        reg.categoryGroup.toLowerCase().includes(q) ||
        reg.level.toLowerCase().includes(q) ||
        reg.schoolName.toLowerCase().includes(q);
      const inAdvisors = reg.advisors.some((a) => a.toLowerCase().includes(q));
      const inStudents = reg.students.some((s) =>
        `${s.title}${s.fullName} ${s.grade}`.toLowerCase().includes(q)
      );
      return inBasic || inAdvisors || inStudents;
    });

    return [...list].sort((a, b) => {
      const lDiff = getLevelRank(a.level) - getLevelRank(b.level);
      if (lDiff !== 0) return lDiff;
      const idxA = categoryGroups.indexOf(a.categoryGroup);
      const idxB = categoryGroups.indexOf(b.categoryGroup);
      const rankA = idxA === -1 ? Number.MAX_SAFE_INTEGER : idxA;
      const rankB = idxB === -1 ? Number.MAX_SAFE_INTEGER : idxB;
      if (rankA !== rankB) return rankA - rankB;
      const actDiff = a.mainActivity.localeCompare(b.mainActivity, 'th');
      if (actDiff !== 0) return actDiff;
      return a.schoolName.localeCompare(b.schoolName, 'th');
    });
  }, [
    registrations,
    categoryGroups,
    statusFilter,
    venueCompetitionIdSet,
    searchQuery,
    selectedCategory,
    selectedLevel,
    selectedSchool,
  ]);

  const groupedFilteredRegistrations = useMemo(
    () => groupRegistrationsByLevel(filteredRegistrations, categoryGroups),
    [filteredRegistrations, categoryGroups]
  );

  const baseMatchingCompetitions = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const list = competitions.filter((comp) => {
      if (selectedCategory !== 'ALL' && comp.categoryGroup !== selectedCategory) return false;

      if (selectedLevel !== 'ALL') {
        if (comp.level) {
          if (comp.level !== selectedLevel) return false;
        } else {
          const hasMatchingLevelReg = registrations.some(
            (r) =>
              r.competitionId === comp.id &&
              r.level === selectedLevel &&
              (selectedSchool === 'ALL' || r.schoolName === selectedSchool)
          );
          if (!hasMatchingLevelReg) return false;
        }
      }

      if (selectedSchool !== 'ALL') {
        const hasMatchingSchoolReg = registrations.some(
          (r) =>
            r.competitionId === comp.id &&
            r.schoolName === selectedSchool &&
            (selectedLevel === 'ALL' || r.level === selectedLevel)
        );
        if (!hasMatchingSchoolReg) return false;
      }

      if (!q) return true;
      const matchesComp =
        comp.categoryGroup.toLowerCase().includes(q) ||
        comp.mainActivity.toLowerCase().includes(q) ||
        (comp.subActivity || '').toLowerCase().includes(q) ||
        (comp.level || '').toLowerCase().includes(q) ||
        (comp.venue || '').toLowerCase().includes(q);
      const matchesReg = registrations.some((r) => {
        if (r.competitionId !== comp.id) return false;
        if (selectedLevel !== 'ALL' && r.level !== selectedLevel) return false;
        if (selectedSchool !== 'ALL' && r.schoolName !== selectedSchool) return false;
        const inBasic =
          r.mainActivity.toLowerCase().includes(q) ||
          (r.subActivity || '').toLowerCase().includes(q) ||
          r.categoryGroup.toLowerCase().includes(q) ||
          r.level.toLowerCase().includes(q) ||
          r.schoolName.toLowerCase().includes(q);
        const inAdvisors = r.advisors.some((a) => a.toLowerCase().includes(q));
        const inStudents = r.students.some((s) =>
          `${s.title}${s.fullName} ${s.grade}`.toLowerCase().includes(q)
        );
        return inBasic || inAdvisors || inStudents;
      });
      return matchesComp || matchesReg;
    });

    return [...list].sort((a, b) => {
      const idxA = categoryGroups.indexOf(a.categoryGroup);
      const idxB = categoryGroups.indexOf(b.categoryGroup);
      const rankA = idxA === -1 ? Number.MAX_SAFE_INTEGER : idxA;
      const rankB = idxB === -1 ? Number.MAX_SAFE_INTEGER : idxB;
      if (rankA !== rankB) return rankA - rankB;
      const lDiff = getLevelRank(a.level) - getLevelRank(b.level);
      if (lDiff !== 0) return lDiff;
      return a.id.localeCompare(b.id);
    });
  }, [
    competitions,
    categoryGroups,
    registrations,
    searchQuery,
    selectedCategory,
    selectedLevel,
    selectedSchool,
  ]);

  const statusCounts = useMemo(() => {
    let registered = 0;
    let hasVenue = 0;
    baseMatchingCompetitions.forEach((comp) => {
      const hasReg = registrations.some(
        (r) =>
          r.competitionId === comp.id &&
          (selectedLevel === 'ALL' || r.level === selectedLevel) &&
          (selectedSchool === 'ALL' || r.schoolName === selectedSchool)
      );
      if (hasReg) registered += 1;
      if (comp.venue && comp.venue.trim() !== '') hasVenue += 1;
    });
    return {
      all: baseMatchingCompetitions.length,
      registered,
      hasVenue,
    };
  }, [baseMatchingCompetitions, registrations, selectedLevel, selectedSchool]);

  const filteredCompetitions = useMemo(() => {
    if (statusFilter === 'ALL') return baseMatchingCompetitions;
    if (statusFilter === 'HAS_VENUE') {
      return baseMatchingCompetitions.filter((comp) => !!comp.venue && comp.venue.trim() !== '');
    }
    return baseMatchingCompetitions.filter((comp) =>
      registrations.some(
        (r) =>
          r.competitionId === comp.id &&
          (selectedLevel === 'ALL' || r.level === selectedLevel) &&
          (selectedSchool === 'ALL' || r.schoolName === selectedSchool)
      )
    );
  }, [
    baseMatchingCompetitions,
    statusFilter,
    registrations,
    selectedLevel,
    selectedSchool,
  ]);

  const toggleExpand = (id: string) => {
    setExpandedCompIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const resetFilters = () => {
    setSearchQuery('');
    setSelectedCategory('ALL');
    setSelectedLevel('ALL');
    setSelectedSchool('ALL');
    setStatusFilter('ALL');
  };

  const hasActiveFilters =
    searchQuery.trim() !== '' ||
    selectedCategory !== 'ALL' ||
    selectedLevel !== 'ALL' ||
    selectedSchool !== 'ALL' ||
    statusFilter !== 'ALL';

  const uniqueParticipatingSchoolsCount = useMemo(() => {
    return new Set(registrations.map((r) => r.schoolName).filter(Boolean)).size;
  }, [registrations]);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      {/* Top Bar Contract: 3 zones separated by gap-8 */}
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-8 px-6 py-3.5">
          {/* Zone 1: Brand Wordmark */}
          <span className="font-display shrink-0 whitespace-nowrap text-lg font-bold tracking-tight text-slate-900">
            {siteSettings.siteTitle}
          </span>

          {/* Zone 2: Single-line navigation links */}
          <nav className="flex items-center gap-6 text-sm font-medium text-slate-600">
            <a
              href="#login"
              data-path="login"
              onClick={(e) => {
                e.preventDefault();
                onNavigate('login', 'push');
              }}
              className="shrink-0 whitespace-nowrap py-1 transition-colors hover:text-blue-900 hover:underline hover:underline-offset-4"
            >
              {currentUser ? `เข้าสู่ระบบ (${currentUser.schoolName})` : 'เข้าสู่ระบบ'}
            </a>
            <a
              href="#school-portal"
              data-path="school-portal"
              onClick={(e) => {
                e.preventDefault();
                onNavigate('school-portal', 'push');
              }}
              className="shrink-0 whitespace-nowrap py-1 transition-colors hover:text-blue-900 hover:underline hover:underline-offset-4"
            >
              ระบบโรงเรียน
            </a>
            <a
              href="#admin-central"
              data-path="admin-central"
              onClick={(e) => {
                e.preventDefault();
                onNavigate('admin-central', 'push');
              }}
              className="shrink-0 whitespace-nowrap py-1 transition-colors hover:text-blue-900 hover:underline hover:underline-offset-4"
            >
              ผู้ดูแลระบบ
            </a>
          </nav>

          {/* Zone 3: Sync Readiness Light (Red = waiting to sync, Green = ready) */}
          <div className="flex shrink-0 items-center">
            <div
              role="status"
              aria-live="polite"
              className={`inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-lg border px-3.5 py-1.5 text-xs font-medium ${
                isSystemReady
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                  : 'border-red-200 bg-red-50 text-red-800'
              }`}
            >
              <span
                aria-hidden="true"
                className={`h-2.5 w-2.5 shrink-0 rounded-full ${
                  isSystemReady ? 'bg-emerald-600' : 'bg-red-600'
                }`}
              />
              {isSystemReady ? 'พร้อมใช้งาน' : 'รอโหลดซิ้งข้อมูล'}
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-8 px-6 py-8">
        {/* Hero Split */}
        <section className="grid grid-cols-1 items-stretch gap-8 rounded-xl border border-slate-200 bg-white p-6 lg:grid-cols-12 lg:p-8">
          <div className="flex flex-col justify-between gap-6 lg:col-span-7">
            <div className="space-y-3">
              {siteSettings.siteSubtitle && (
                <p className="text-xs font-medium text-blue-900">
                  {siteSettings.siteSubtitle}
                </p>
              )}
              <h1 className="font-display text-3xl leading-tight font-bold tracking-tight text-slate-900 text-balance lg:text-4xl">
                {siteSettings.heroHeading}
              </h1>
              {siteSettings.heroDescription && (
                <p className="max-w-2xl text-sm leading-relaxed text-slate-600 lg:text-base">
                  {siteSettings.heroDescription}
                </p>
              )}
            </div>

            <div className="space-y-2.5 pt-2">
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => onNavigate('login', 'push')}
                  className="whitespace-nowrap rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-slate-800"
                >
                  เข้าสู่ระบบสำหรับโรงเรียน / ผู้ดูแล
                </button>
                <span className="inline-flex items-center gap-2 text-xs text-slate-600">
                  <span
                    aria-hidden="true"
                    className={`h-2 w-2 shrink-0 rounded-full ${
                      isSystemReady ? 'bg-emerald-600' : 'bg-red-600'
                    }`}
                  />
                  {isSystemReady
                    ? 'ข้อมูลล่าสุดซิงค์เรียบร้อย · พร้อมใช้งาน (ผู้เยี่ยมชมทั่วไปไม่ต้องล็อกอิน)'
                    : 'รอโหลดซิ้งข้อมูลจากฐานข้อมูล (ผู้เยี่ยมชมทั่วไปไม่ต้องล็อกอิน)'}
                </span>
              </div>

              {registrationStatus.isClosed ? (
                <div className="inline-flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-800">
                  <Lock className="h-3.5 w-3.5 shrink-0 text-red-700" />
                  <span>
                    ปิดรับการลงทะเบียนแล้ว
                    {registrationStatus.reason === 'scheduled' && registrationStatus.closeAtMs
                      ? ` (ครบกำหนด ${formatThaiDateTime(registrationStatus.closeAtMs)})`
                      : ''}
                  </span>
                </div>
              ) : (
                registrationStatus.reason === 'open_scheduled' && (
                  <div className="inline-flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-900">
                    <Clock className="h-3.5 w-3.5 shrink-0 text-amber-700" />
                    <span>
                      ปิดรับลงทะเบียนอัตโนมัติ: {formatThaiDateTime(registrationStatus.closeAtMs)}{' '}
                      (เหลือ {formatCountdownThai(registrationStatus.remainingMs || 0)})
                    </span>
                  </div>
                )
              )}
            </div>
          </div>

          <div className="relative min-h-[220px] overflow-hidden rounded-lg border border-slate-200 bg-slate-100 lg:col-span-5">
            {!heroImgFailed ? (
              <img
                src="/src/assets/images/arts_crafts_hero_1794540307994.jpg"
                alt="นักเรียนกำลังสร้างสรรค์ผลงานศิลปะและหัตถกรรมในการแข่งขัน"
                referrerPolicy="no-referrer"
                onError={() => setHeroImgFailed(true)}
                className="h-full w-full object-cover lg:h-full"
              />
            ) : (
              <div className="flex h-full min-h-[220px] flex-col items-center justify-center bg-gradient-to-br from-slate-100 to-blue-50 p-6 text-center">
                <Users className="mb-2 h-8 w-8 text-blue-900/60" />
                <p className="text-sm font-semibold text-slate-800">
                  {siteSettings.siteTitle}
                </p>
                <p className="text-xs text-slate-500">เวทีส่งเสริมทักษะวิชาการ ศิลปะ และหัตถศิลป์</p>
              </div>
            )}
          </div>
        </section>

        {/* 4-Column KPI Strip */}
        <section className="grid grid-cols-2 divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white sm:grid-cols-4 sm:divide-x sm:divide-y-0">
          <div className="px-6 py-4">
            <p className="text-xs font-medium text-slate-500">รายการแข่งขันทั้งหมด</p>
            <p className="mt-1 font-mono text-2xl font-semibold text-slate-900 tabular-nums">
              {competitions.length}
            </p>
          </div>
          <div className="px-6 py-4">
            <p className="text-xs font-medium text-slate-500">กลุ่มกิจกรรม</p>
            <p className="mt-1 font-mono text-2xl font-semibold text-slate-900 tabular-nums">
              {categories.length}
            </p>
          </div>
          <div className="px-6 py-4">
            <p className="text-xs font-medium text-slate-500">โรงเรียนที่ลงทะเบียนแล้ว</p>
            <p className="mt-1 font-mono text-2xl font-semibold text-slate-900 tabular-nums">
              {uniqueParticipatingSchoolsCount}
            </p>
          </div>
          <div className="px-6 py-4">
            <p className="text-xs font-medium text-slate-500">ทีมที่ส่งเข้าประกวด</p>
            <p className="mt-1 font-mono text-2xl font-semibold text-blue-900 tabular-nums">
              {registrations.length}
            </p>
          </div>
        </section>

        {/* Filter Bar & View Switch */}
        <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-4">
            <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1">
              <button
                type="button"
                onClick={() => setViewMode('competitions')}
                className={`whitespace-nowrap rounded-md px-3.5 py-1.5 text-xs font-medium transition-colors ${
                  viewMode === 'competitions'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                รายการแข่งขันและกำหนดการ ({filteredCompetitions.length})
              </button>
              <button
                type="button"
                onClick={() => setViewMode('schools')}
                className={`whitespace-nowrap rounded-md px-3.5 py-1.5 text-xs font-medium transition-colors ${
                  viewMode === 'schools'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                รายชื่อโรงเรียนที่ลงทะเบียน ({filteredRegistrations.length})
              </button>
            </div>

            {hasActiveFilters && (
              <button
                type="button"
                onClick={resetFilters}
                className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                ล้างตัวกรอง
              </button>
            )}
          </div>

          {/* Competition Status Segmented Selector */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="shrink-0 text-xs font-medium text-slate-500">เลือกแสดงรายการ:</span>
            <div
              role="group"
              aria-label="ตัวเลือกการแสดงรายการแข่งขัน"
              className="flex flex-wrap items-center gap-1.5"
            >
              <button
                type="button"
                onClick={() => setStatusFilter('ALL')}
                className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                  statusFilter === 'ALL'
                    ? 'border-blue-900 bg-blue-900 text-white'
                    : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                รายการทั้งหมด
                <span
                  className={`font-mono tabular-nums ${
                    statusFilter === 'ALL' ? 'text-blue-100' : 'text-slate-400'
                  }`}
                >
                  ({statusCounts.all})
                </span>
              </button>

              <button
                type="button"
                onClick={() => setStatusFilter('REGISTERED')}
                className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                  statusFilter === 'REGISTERED'
                    ? 'border-blue-900 bg-blue-900 text-white'
                    : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                รายการที่มีการลงทะเบียน
                <span
                  className={`font-mono tabular-nums ${
                    statusFilter === 'REGISTERED' ? 'text-blue-100' : 'text-slate-400'
                  }`}
                >
                  ({statusCounts.registered})
                </span>
              </button>

              <button
                type="button"
                onClick={() => setStatusFilter('HAS_VENUE')}
                className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                  statusFilter === 'HAS_VENUE'
                    ? 'border-blue-900 bg-blue-900 text-white'
                    : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                รายการที่มีการแข่งขัน (ลงสถานที่แล้ว)
                <span
                  className={`font-mono tabular-nums ${
                    statusFilter === 'HAS_VENUE' ? 'text-blue-100' : 'text-slate-400'
                  }`}
                >
                  ({statusCounts.hasVenue})
                </span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-12">
            {/* Search */}
            <div className="relative md:col-span-4">
              <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="ค้นหากิจกรรม, รุ่น, สถานที่, โรงเรียน, นักเรียน..."
                className="w-full rounded-lg border border-slate-300 bg-white py-2 pr-3 pl-9 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-800 focus:outline-none"
              />
            </div>

            {/* Category Filter */}
            <div className="md:col-span-3">
              <select
                aria-label="กรองตามกลุ่มกิจกรรม"
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-800 focus:outline-none"
              >
                <option value="ALL">ทุกกลุ่มกิจกรรม</option>
                {categories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            {/* Level Filter */}
            <div className="md:col-span-2">
              <select
                aria-label="กรองตามรุ่น"
                value={selectedLevel}
                onChange={(e) => setSelectedLevel(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-800 focus:outline-none"
              >
                <option value="ALL">ทุกรุ่น</option>
                {COMPETITION_LEVELS.map((lvl) => (
                  <option key={lvl} value={lvl}>
                    รุ่น {lvl}
                  </option>
                ))}
              </select>
            </div>

            {/* School Filter */}
            <div className="md:col-span-3">
              <select
                aria-label="กรองตามโรงเรียน"
                value={selectedSchool}
                onChange={(e) => setSelectedSchool(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-800 focus:outline-none"
              >
                <option value="ALL">ทุกโรงเรียน</option>
                {schools.map((sch) => (
                  <option key={sch} value={sch}>
                    {sch}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </section>

        {/* Main Content View */}
        {viewMode === 'competitions' ? (
          <section className="space-y-3">
            {filteredCompetitions.length === 0 ? (
              <div className="rounded-xl border border-slate-200 bg-white px-6 py-12 text-center">
                <p className="text-sm font-medium text-slate-800">
                  ไม่พบรายการแข่งขันที่ตรงกับเงื่อนไขการค้นหา
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  ลองปรับเปลี่ยนกลุ่มกิจกรรม รุ่น หรือโรงเรียนที่ต้องการค้นหา
                </p>
              </div>
            ) : (
              <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                <div className="divide-y divide-slate-200">
                  {filteredCompetitions.map((comp) => {
                    const compRegs = filteredRegistrations.filter(
                      (r) => r.competitionId === comp.id
                    );
                    const isExpanded = !!expandedCompIds[comp.id];

                    return (
                      <div key={comp.id} className="transition-colors hover:bg-slate-50/60">
                        <div className="flex flex-col justify-between gap-4 px-6 py-4 lg:flex-row lg:items-center">
                          <div className="min-w-0 flex-1 space-y-1.5">
                            {/* Quiet unboxed metadata line */}
                            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                              <span className="font-mono text-slate-400">{comp.id}</span>
                              <span aria-hidden="true">·</span>
                              <span className="font-medium text-blue-900">{comp.categoryGroup}</span>
                              {comp.level && (
                                <>
                                  <span aria-hidden="true">·</span>
                                  <span className="font-semibold text-slate-800">
                                    รุ่น: {comp.level}
                                  </span>
                                </>
                              )}
                              {comp.subActivity && (
                                <>
                                  <span aria-hidden="true">·</span>
                                  <span>{comp.subActivity}</span>
                                </>
                              )}
                            </div>

                            <h2 className="text-base font-semibold text-slate-900">
                              {comp.mainActivity}
                            </h2>

                            <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-slate-600">
                              <span className="inline-flex items-center gap-1.5 tabular-nums">
                                <Calendar className="h-3.5 w-3.5 text-slate-400" />
                                วัน: {comp.competitionDate ? comp.competitionDate : 'ยังไม่กำหนด'}
                              </span>
                              <span className="inline-flex items-center gap-1.5 tabular-nums">
                                <Clock className="h-3.5 w-3.5 text-slate-400" />
                                เวลา: {comp.competitionTime ? comp.competitionTime : 'ยังไม่กำหนด'}
                              </span>
                              <span className="inline-flex items-center gap-1.5">
                                <MapPin className="h-3.5 w-3.5 text-slate-400" />
                                สถานที่: {comp.venue ? comp.venue : 'ยังไม่กำหนด'}
                              </span>
                            </div>
                          </div>

                          <div className="flex shrink-0 items-center gap-4">
                            <div className="text-right">
                              <p className="text-xs text-slate-500">โรงเรียนที่ลงทะเบียน</p>
                              <p className="font-mono text-sm font-semibold text-slate-900 tabular-nums">
                                {compRegs.length} ทีม
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => toggleExpand(comp.id)}
                              className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-100"
                            >
                              {isExpanded ? 'ซ่อนรายชื่อ' : 'ดูโรงเรียนที่สมัคร'}
                              {isExpanded ? (
                                <ChevronUp className="h-3.5 w-3.5" />
                              ) : (
                                <ChevronDown className="h-3.5 w-3.5" />
                              )}
                            </button>
                          </div>
                        </div>

                        {isExpanded && (
                          <div className="border-t border-slate-200 bg-slate-50/80 px-6 py-4">
                            {compRegs.length === 0 ? (
                              <p className="text-xs text-slate-500">
                                ยังไม่มีโรงเรียนลงทะเบียนในรายการนี้ตามตัวกรองที่เลือก
                              </p>
                            ) : (
                              <div className="space-y-4">
                                {groupRegistrationsByLevel(compRegs, categoryGroups).map(
                                  (group) => (
                                    <div
                                      key={group.level}
                                      className="overflow-hidden rounded-lg border border-slate-200 bg-white"
                                    >
                                      <div className="flex items-center justify-between border-b border-blue-100 bg-blue-50/80 px-4 py-2.5">
                                        <div className="flex items-center gap-2">
                                          <span className="rounded bg-blue-900 px-2.5 py-0.5 text-xs font-semibold text-white">
                                            รุ่น {group.level}
                                          </span>
                                          <span className="text-xs font-medium text-slate-600">
                                            รายชื่อทีมที่ลงทะเบียน
                                          </span>
                                        </div>
                                        <span className="font-mono text-xs font-semibold text-blue-950 tabular-nums">
                                          {group.regs.length} ทีม
                                        </span>
                                      </div>

                                      <div className="overflow-x-auto px-4 py-1">
                                        <table className="w-full text-left text-xs">
                                          <thead>
                                            <tr className="border-b border-slate-200 text-slate-500">
                                              <th className="w-12 py-2 pr-3 font-medium">ลำดับ</th>
                                              <th className="py-2 pr-4 font-medium">โรงเรียน</th>
                                              <th className="py-2 pr-4 font-medium">รุ่น</th>
                                              <th className="py-2 pr-4 font-medium">ครูที่ปรึกษา</th>
                                              <th className="py-2 pr-4 font-medium">รายชื่อนักเรียน</th>
                                              <th className="py-2 font-medium">สถานะ</th>
                                            </tr>
                                          </thead>
                                          <tbody className="divide-y divide-slate-200/70">
                                            {group.regs.map((reg, regIdx) => {
                                              const complete = isRegistrationComplete(reg);
                                              return (
                                                <tr key={reg.id} className="align-top">
                                                  <td className="py-2.5 pr-3 font-mono text-slate-400 tabular-nums">
                                                    {regIdx + 1}
                                                  </td>
                                                  <td className="py-2.5 pr-4 font-medium text-slate-900">
                                                    {reg.schoolName}
                                                  </td>
                                                  <td className="py-2.5 pr-4 whitespace-nowrap font-medium text-blue-900">
                                                    {reg.level}
                                                  </td>
                                                  <td className="py-2.5 pr-4 text-slate-700">
                                                    {reg.advisors.length > 0 ? (
                                                      reg.advisors.join(', ')
                                                    ) : (
                                                      <span className="text-orange-700">
                                                        ยังไม่ระบุ
                                                      </span>
                                                    )}
                                                  </td>
                                                  <td className="py-2.5 pr-4 text-slate-700">
                                                    {reg.students.length === 0 ? (
                                                      <span className="text-orange-700">
                                                        ยังไม่ระบุ
                                                      </span>
                                                    ) : (
                                                      <ul className="space-y-0.5">
                                                        {reg.students.map((st, idx) => (
                                                          <li key={idx}>
                                                            {st.title}
                                                            {st.fullName} ({st.grade})
                                                          </li>
                                                        ))}
                                                      </ul>
                                                    )}
                                                  </td>
                                                  <td className="py-2.5 whitespace-nowrap">
                                                    <span
                                                      className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-medium ${
                                                        complete
                                                          ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                                                          : 'border-orange-200 bg-orange-50 text-orange-800'
                                                      }`}
                                                    >
                                                      {complete ? (
                                                        <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                                                      ) : (
                                                        <AlertCircle className="h-3 w-3 text-orange-600" />
                                                      )}
                                                      {complete ? 'เรียบร้อย' : 'ไม่เรียบร้อย'}
                                                    </span>
                                                  </td>
                                                </tr>
                                              );
                                            })}
                                          </tbody>
                                        </table>
                                      </div>
                                    </div>
                                  )
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </section>
        ) : (
          <section className="space-y-5">
            {groupedFilteredRegistrations.length === 0 ? (
              <div className="rounded-xl border border-slate-200 bg-white px-6 py-12 text-center">
                <p className="text-sm font-medium text-slate-800">
                  ไม่พบข้อมูลโรงเรียนที่ลงทะเบียนตามตัวกรองที่เลือก
                </p>
              </div>
            ) : (
              <>
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-5 py-3.5">
                  <span className="text-xs font-semibold text-slate-700">
                    สรุปทีมที่ลงทะเบียนแยกตามรุ่น (เรียงจาก ปฐมวัย → ป.1-3 → ป.4-6 → ม.1-3)
                  </span>
                  <div className="flex flex-wrap items-center gap-2">
                    {groupedFilteredRegistrations.map((group) => (
                      <span
                        key={group.level}
                        className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-800 tabular-nums"
                      >
                        <span className="font-semibold text-blue-900">{group.level}:</span>
                        <span className="font-mono">{group.regs.length} ทีม</span>
                      </span>
                    ))}
                  </div>
                </div>

                {groupedFilteredRegistrations.map((group) => (
                  <div
                    key={group.level}
                    className="overflow-hidden rounded-xl border border-slate-200 bg-white"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-slate-100/90 px-5 py-3">
                      <div className="flex items-center gap-2.5">
                        <span className="rounded-md bg-blue-900 px-3 py-1 text-xs font-bold text-white">
                          รุ่น {group.level}
                        </span>
                        <span className="text-xs font-medium text-slate-600">
                          รายการทีมที่ลงทะเบียนในรุ่นนี้
                        </span>
                      </div>
                      <span className="font-mono text-xs font-semibold text-slate-800 tabular-nums">
                        ทั้งหมด {group.regs.length} ทีม
                      </span>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-sm">
                        <thead>
                          <tr className="border-b border-slate-200 bg-slate-50 text-xs font-medium text-slate-600">
                            <th className="w-14 px-5 py-3">ลำดับ</th>
                            <th className="px-5 py-3">โรงเรียน</th>
                            <th className="px-5 py-3">กลุ่มกิจกรรม</th>
                            <th className="px-5 py-3">รายการแข่งขัน</th>
                            <th className="px-5 py-3">รุ่น</th>
                            <th className="px-5 py-3">ครูที่ปรึกษา</th>
                            <th className="px-5 py-3">นักเรียนผู้เข้าแข่งขัน</th>
                            <th className="px-5 py-3">สถานะ</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                          {group.regs.map((reg, regIdx) => {
                            const complete = isRegistrationComplete(reg);
                            return (
                              <tr key={reg.id} className="align-top hover:bg-slate-50/70">
                                <td className="px-5 py-3.5 font-mono text-xs text-slate-400 tabular-nums">
                                  {regIdx + 1}
                                </td>
                                <td className="px-5 py-3.5 font-medium text-slate-900">
                                  {reg.schoolName}
                                </td>
                                <td className="px-5 py-3.5 text-xs text-slate-600">
                                  {reg.categoryGroup}
                                </td>
                                <td className="px-5 py-3.5 text-slate-900">
                                  <div className="font-medium">{reg.mainActivity}</div>
                                  {reg.subActivity && (
                                    <div className="text-xs text-slate-500">
                                      {reg.subActivity}
                                    </div>
                                  )}
                                </td>
                                <td className="px-5 py-3.5 whitespace-nowrap text-xs font-semibold text-blue-900">
                                  {reg.level}
                                </td>
                                <td className="px-5 py-3.5 text-xs text-slate-700">
                                  {reg.advisors.length === 0 ? (
                                    <span className="text-orange-700">ยังไม่ระบุ</span>
                                  ) : (
                                    reg.advisors.map((adv, idx) => <div key={idx}>{adv}</div>)
                                  )}
                                </td>
                                <td className="px-5 py-3.5 text-xs text-slate-700">
                                  {reg.students.length === 0 ? (
                                    <span className="text-orange-700">ยังไม่ระบุ</span>
                                  ) : (
                                    reg.students.map((st, idx) => (
                                      <div key={idx}>
                                        {st.title}
                                        {st.fullName} · {st.grade}
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
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}
              </>
            )}
          </section>
        )}
      </main>

      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-6 py-5 text-xs text-slate-500">
          <p>{siteSettings.footerText}</p>
          <p>ฐานข้อมูล Google Sheets: ชีท user · รายการ · ลงทะเบียน</p>
        </div>
      </footer>
    </div>
  );
};
