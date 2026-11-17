import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Building2,
  CheckCircle2,
  ClipboardList,
  Edit3,
  Globe,
  LogOut,
  Plus,
  ShieldCheck,
  Trash2,
  UserPlus,
  Users,
} from 'lucide-react';
import {
  COMPETITION_LEVELS,
  CompetitionItem,
  CompetitionLevel,
  RegistrationRecord,
  ScreenPath,
  STUDENT_GRADES,
  STUDENT_PREFIXES,
  SiteSettings,
  StudentEntry,
  TransitionType,
  UserAccount,
  isRegistrationComplete,
} from '../types';

interface SchoolPortalScreenProps {
  currentUser: UserAccount | null;
  users: UserAccount[];
  competitions: CompetitionItem[];
  registrations: RegistrationRecord[];
  categoryGroups: string[];
  siteSettings: SiteSettings;
  onNavigate: (path: ScreenPath, transition: TransitionType) => void;
  onLoginSuccess: (user: UserAccount, targetScreen: ScreenPath) => void;
  onLogout: () => void;
  onSaveRegistration: (
    data: Omit<RegistrationRecord, 'id' | 'createdAt' | 'updatedAt'>,
    existingId?: string
  ) => Promise<boolean>;
  onDeleteRegistration: (reg: RegistrationRecord) => void;
}

const createEmptyStudent = (): StudentEntry => ({
  title: 'เด็กหญิง',
  fullName: '',
  grade: 'ป.4',
});

export const SchoolPortalScreen: React.FC<SchoolPortalScreenProps> = ({
  currentUser,
  users,
  competitions,
  registrations,
  categoryGroups,
  siteSettings,
  onNavigate,
  onLoginSuccess,
  onLogout,
  onSaveRegistration,
  onDeleteRegistration,
}) => {
  const schoolUsers = useMemo(
    () =>
      users
        .filter((u) => u.role === 'school')
        .sort((a, b) => a.schoolName.localeCompare(b.schoolName, 'th')),
    [users]
  );

  // Inline quick login if visitor navigated here without signing in as a school
  const [quickSchoolId, setQuickSchoolId] = useState<string>(() => schoolUsers[0]?.id || '');
  const [quickPassword, setQuickPassword] = useState('');
  const [quickLoginError, setQuickLoginError] = useState<string | null>(null);

  const isSchoolAuthenticated = currentUser?.role === 'school';
  const activeSchoolName = isSchoolAuthenticated ? currentUser.schoolName : '';

  const availableCategoryGroups = useMemo(() => {
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

  // Registration Form State
  const [editingRegId, setEditingRegId] = useState<string | null>(null);
  const [selectedCategoryGroup, setSelectedCategoryGroup] = useState<string>(
    () => availableCategoryGroups[0] || ''
  );
  const [selectedCompetitionId, setSelectedCompetitionId] = useState<string>(() => {
    const firstGroup = availableCategoryGroups[0] || '';
    const firstComp = competitions.find((c) => c.categoryGroup === firstGroup);
    return firstComp?.id || competitions[0]?.id || '';
  });
  const [level, setLevel] = useState<CompetitionLevel | ''>(() => {
    const firstGroup = availableCategoryGroups[0] || '';
    const firstComp =
      competitions.find((c) => c.categoryGroup === firstGroup) || competitions[0];
    return firstComp?.level || '';
  });
  const [advisors, setAdvisors] = useState<string[]>(['']);
  const [students, setStudents] = useState<StudentEntry[]>([createEmptyStudent()]);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);

  const filteredCompetitionsByCategory = useMemo(() => {
    if (!selectedCategoryGroup) return [];
    return competitions.filter((c) => c.categoryGroup === selectedCategoryGroup);
  }, [competitions, selectedCategoryGroup]);

  useEffect(() => {
    if (availableCategoryGroups.length === 0) {
      if (selectedCategoryGroup !== '') setSelectedCategoryGroup('');
      return;
    }
    if (!selectedCategoryGroup || !availableCategoryGroups.includes(selectedCategoryGroup)) {
      setSelectedCategoryGroup(availableCategoryGroups[0]);
    }
  }, [availableCategoryGroups, selectedCategoryGroup]);

  useEffect(() => {
    if (filteredCompetitionsByCategory.length === 0) {
      if (selectedCompetitionId !== '') setSelectedCompetitionId('');
      return;
    }
    const stillValid = filteredCompetitionsByCategory.some(
      (c) => c.id === selectedCompetitionId
    );
    if (!stillValid) {
      setSelectedCompetitionId(filteredCompetitionsByCategory[0].id);
    }
  }, [filteredCompetitionsByCategory, selectedCompetitionId]);

  const schoolRegistrations = useMemo(() => {
    if (!isSchoolAuthenticated) return [];
    return registrations
      .filter((r) => r.schoolName === activeSchoolName)
      .sort((a, b) => {
        const rankA = COMPETITION_LEVELS.indexOf(a.level);
        const rankB = COMPETITION_LEVELS.indexOf(b.level);
        const lA = rankA === -1 ? 99 : rankA;
        const lB = rankB === -1 ? 99 : rankB;
        if (lA !== lB) return lA - lB;
        return a.mainActivity.localeCompare(b.mainActivity, 'th');
      });
  }, [registrations, isSchoolAuthenticated, activeSchoolName]);

  const selectedCompetition = useMemo(
    () => competitions.find((c) => c.id === selectedCompetitionId) || null,
    [competitions, selectedCompetitionId]
  );

  useEffect(() => {
    if (selectedCompetition?.level) {
      setLevel(selectedCompetition.level);
    }
  }, [selectedCompetition?.id, selectedCompetition?.level]);

  const handleCategoryGroupChange = (nextGroup: string) => {
    setSelectedCategoryGroup(nextGroup);
    const firstCompInGroup = competitions.find((c) => c.categoryGroup === nextGroup);
    setSelectedCompetitionId(firstCompInGroup?.id || '');
    setLevel(firstCompInGroup?.level || '');
  };

  const handleCompetitionChange = (nextCompId: string) => {
    setSelectedCompetitionId(nextCompId);
    const nextComp = competitions.find((c) => c.id === nextCompId);
    setLevel(nextComp?.level || '');
  };

  const handleQuickSchoolLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setQuickLoginError(null);
    const target = schoolUsers.find((u) => u.id === quickSchoolId);
    if (!target) {
      setQuickLoginError('ไม่พบบัญชีโรงเรียนที่เลือก');
      return;
    }
    if (target.password !== quickPassword) {
      setQuickLoginError('รหัสผ่านไม่ถูกต้อง');
      return;
    }
    setQuickPassword('');
    onLoginSuccess(target, 'school-portal');
  };

  const resetForm = () => {
    const firstGroup = availableCategoryGroups[0] || '';
    const firstComp = competitions.find((c) => c.categoryGroup === firstGroup);
    setEditingRegId(null);
    setSelectedCategoryGroup(firstGroup);
    setSelectedCompetitionId(firstComp?.id || competitions[0]?.id || '');
    setLevel(firstComp?.level || '');
    setAdvisors(['']);
    setStudents([createEmptyStudent()]);
    setFormError(null);
  };

  const handleEditClick = (reg: RegistrationRecord) => {
    const targetComp = competitions.find((c) => c.id === reg.competitionId);
    setEditingRegId(reg.id);
    setSelectedCategoryGroup(
      targetComp?.categoryGroup || reg.categoryGroup || availableCategoryGroups[0] || ''
    );
    setSelectedCompetitionId(reg.competitionId);
    setLevel(targetComp?.level || reg.level);
    setAdvisors(reg.advisors.length > 0 ? [...reg.advisors] : ['']);
    setStudents(
      reg.students.length > 0
        ? reg.students.map((s) => ({ ...s }))
        : [createEmptyStudent()]
    );
    setFormError(null);
    setFormSuccess(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleAdvisorChange = (idx: number, val: string) => {
    setAdvisors((prev) => prev.map((item, i) => (i === idx ? val : item)));
  };

  const handleAddAdvisor = () => {
    setAdvisors((prev) => [...prev, '']);
  };

  const handleRemoveAdvisor = (idx: number) => {
    if (advisors.length <= 1) return;
    setAdvisors((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleStudentChange = (
    idx: number,
    field: keyof StudentEntry,
    val: string
  ) => {
    setStudents((prev) =>
      prev.map((item, i) => (i === idx ? { ...item, [field]: val } : item))
    );
  };

  const handleAddStudent = () => {
    setStudents((prev) => [...prev, createEmptyStudent()]);
  };

  const handleRemoveStudent = (idx: number) => {
    if (students.length <= 1) return;
    setStudents((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSubmitRegistration = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFormSuccess(null);

    if (!isSchoolAuthenticated || !currentUser) {
      setFormError('กรุณาเข้าสู่ระบบด้วยบัญชีแอดมินโรงเรียนก่อนส่งข้อมูล');
      return;
    }

    if (!selectedCompetition) {
      setFormError('กรุณาเลือกรายการแข่งขัน');
      return;
    }

    if (!level) {
      setFormError('กรุณาเลือกรุ่นที่เข้าแข่งขัน (ปฐมวัย / ป.1-3 / ป.4-6 / ม.1-3)');
      return;
    }

    const cleanedAdvisors = advisors.map((a) => a.trim()).filter(Boolean);

    const cleanedStudents = students
      .map((s) => ({
        title: s.title.trim(),
        fullName: s.fullName.trim(),
        grade: s.grade.trim(),
      }))
      .filter((s) => s.fullName !== '');

    const incompleteStudent = cleanedStudents.some(
      (s) => !s.title || !s.fullName || !s.grade
    );
    if (incompleteStudent) {
      setFormError('กรุณากรอกคำนำหน้า ชื่อ-สกุล และชั้นปีของนักเรียนให้ครบถ้วน');
      return;
    }

    const saved = await onSaveRegistration(
      {
        competitionId: selectedCompetition.id,
        categoryGroup: selectedCompetition.categoryGroup,
        mainActivity: selectedCompetition.mainActivity,
        subActivity: selectedCompetition.subActivity || '',
        level,
        schoolName: currentUser.schoolName,
        advisors: cleanedAdvisors,
        students: cleanedStudents,
        submittedBy: currentUser.username,
      },
      editingRegId || undefined
    );

    if (saved) {
      setFormSuccess(
        editingRegId
          ? 'บันทึกการแก้ไขข้อมูลการลงทะเบียนเรียบร้อยแล้ว'
          : 'ลงทะเบียนส่งรายการแข่งขันเรียบร้อยแล้ว'
      );
      resetForm();
    }
  };

  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-900">
      {/* Sidebar (<aside>) with required navigation links */}
      <aside className="hidden w-64 shrink-0 flex-col justify-between border-r border-slate-200 bg-white lg:flex">
        <div className="space-y-6 p-5">
          <div className="border-b border-slate-200 pb-4">
            <p className="text-xs font-medium text-blue-900">แอดมินโรงเรียน</p>
            <h2 className="font-display mt-0.5 text-base font-bold text-slate-900">
              {siteSettings.siteTitle}
            </h2>
          </div>

          <nav className="space-y-1 text-sm">
            <div className="rounded-lg bg-blue-50 px-3 py-2.5 font-medium text-blue-900">
              <span className="inline-flex items-center gap-2.5">
                <ClipboardList className="h-4 w-4" />
                ลงทะเบียนรายการแข่งขัน
              </span>
            </div>

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
              href="#admin-central"
              data-path="admin-central"
              onClick={(e) => {
                e.preventDefault();
                onNavigate('admin-central', 'none');
              }}
              className="flex items-center gap-2.5 rounded-lg px-3 py-2.5 font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900"
            >
              <ShieldCheck className="h-4 w-4" />
              จัดการระบบ (ผู้ดูแล)
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
          {isSchoolAuthenticated ? (
            <div className="space-y-2">
              <p className="text-xs text-slate-500">บัญชีโรงเรียนที่ใช้งานอยู่</p>
              <p className="text-xs font-semibold text-slate-900">{currentUser.schoolName}</p>
              <button
                type="button"
                onClick={onLogout}
                className="text-xs font-medium text-red-700 hover:underline"
              >
                ออกจากระบบ
              </button>
            </div>
          ) : (
            <p className="text-xs text-slate-500">ยังไม่ได้เข้าสู่ระบบบัญชีโรงเรียน</p>
          )}
        </div>
      </aside>

      {/* Main Column */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top Header (<header>) with required navigation links */}
        <header className="sticky top-0 z-30 border-b border-slate-200 bg-white">
          <div className="flex items-center justify-between gap-6 px-6 py-3.5">
            <div className="min-w-0">
              <p className="truncate text-xs text-slate-500">
                ระบบลงทะเบียนรายการแข่งขัน · แอดมินโรงเรียน
              </p>
              <h1 className="font-display truncate text-base font-bold text-slate-900">
                {isSchoolAuthenticated ? currentUser.schoolName : 'พอร์ทัลโรงเรียน'}
              </h1>
            </div>

            <div className="flex shrink-0 items-center gap-4 text-xs font-medium">
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
                href="#admin-central"
                data-path="admin-central"
                onClick={(e) => {
                  e.preventDefault();
                  onNavigate('admin-central', 'none');
                }}
                className="shrink-0 whitespace-nowrap text-slate-600 hover:text-blue-900 hover:underline"
              >
                ผู้ดูแลระบบ
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
            </div>
          </div>
        </header>

        <main className="mx-auto w-full max-w-6xl space-y-8 p-6">
          {/* School Authentication Gate if not logged in as school */}
          {!isSchoolAuthenticated && (
            <section className="rounded-xl border border-amber-300 bg-amber-50/70 p-6">
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 lg:items-center">
                <div className="space-y-1.5 lg:col-span-6">
                  <h2 className="text-base font-semibold text-slate-900">
                    ยืนยันบัญชีแอดมินโรงเรียนเพื่อส่งรายชื่อเข้าแข่งขัน
                  </h2>
                  <p className="text-xs leading-relaxed text-slate-700">
                    ระบบจะกำหนดชื่อโรงเรียนให้อัตโนมัติตามบัญชีแอดมินโรงเรียนที่เข้าสู่ระบบ (ชีท{' '}
                    <span className="font-mono">user</span>)
                    {currentUser?.role === 'admin'
                      ? ' — ขณะนี้คุณเข้าสู่ระบบในฐานะผู้ดูแลระบบ กรุณาเลือกบัญชีโรงเรียนด้านขวาเพื่อทดสอบการส่งในนามโรงเรียน'
                      : ''}
                  </p>
                </div>

                <form
                  onSubmit={handleQuickSchoolLogin}
                  className="grid grid-cols-1 gap-3 sm:grid-cols-12 lg:col-span-6"
                >
                  <div className="sm:col-span-5">
                    <select
                      aria-label="เลือกโรงเรียน"
                      value={quickSchoolId}
                      onChange={(e) => setQuickSchoolId(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-blue-800 focus:outline-none"
                    >
                      {schoolUsers.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.schoolName}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="sm:col-span-4">
                    <input
                      type="password"
                      value={quickPassword}
                      onChange={(e) => setQuickPassword(e.target.value)}
                      placeholder="รหัสผ่านโรงเรียน"
                      required
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-blue-800 focus:outline-none"
                    />
                  </div>
                  <div className="sm:col-span-3">
                    <button
                      type="submit"
                      className="w-full whitespace-nowrap rounded-lg bg-blue-900 px-3 py-2 text-xs font-medium text-white hover:bg-blue-950"
                    >
                      เข้าสู่ระบบ
                    </button>
                  </div>
                  {quickLoginError && (
                    <p className="text-xs font-medium text-red-700 sm:col-span-12">
                      {quickLoginError}
                    </p>
                  )}
                </form>
              </div>
            </section>
          )}

          {/* Registration Submission Form */}
          <section className="rounded-xl border border-slate-200 bg-white p-6">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-4">
              <div>
                <h2 className="font-display text-lg font-bold text-slate-900">
                  {editingRegId ? 'แก้ไขข้อมูลการลงทะเบียนแข่งขัน' : 'แบบฟอร์มลงทะเบียนส่งเข้าแข่งขัน'}
                </h2>
                <p className="mt-0.5 text-xs text-slate-500">
                  ระบุรายการแข่งขัน รุ่นที่แข่งขัน ครูที่ปรึกษา และรายชื่อนักเรียนผู้เข้าแข่งขัน (บันทึกไปยังชีท ลงทะเบียน)
                </p>
              </div>
              {editingRegId && (
                <button
                  type="button"
                  onClick={resetForm}
                  className="whitespace-nowrap rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  ยกเลิกการแก้ไข
                </button>
              )}
            </div>

            <form onSubmit={handleSubmitRegistration} className="mt-6 space-y-6">
              {/* School (Locked to User) */}
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  โรงเรียน (กำหนดอัตโนมัติตามบัญชีแอดมินโรงเรียน)
                </label>
                <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-100 px-3.5 py-2.5 text-sm font-medium text-slate-800">
                  <Building2 className="h-4 w-4 shrink-0 text-slate-500" />
                  <span className="truncate">
                    {isSchoolAuthenticated
                      ? activeSchoolName
                      : 'กรุณาเข้าสู่ระบบด้วยบัญชีโรงเรียน'}
                  </span>
                </div>
              </div>

              {/* 2-Step Selection: Category Group first, then Competition */}
              <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                <div>
                  <label
                    htmlFor="reg-category-select"
                    className="mb-1.5 block text-sm font-medium text-slate-700"
                  >
                    1. เลือกกลุ่มกิจกรรม <span className="text-red-600">*</span>
                  </label>
                  <select
                    id="reg-category-select"
                    value={selectedCategoryGroup}
                    onChange={(e) => handleCategoryGroupChange(e.target.value)}
                    disabled={availableCategoryGroups.length === 0}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:border-blue-800 focus:outline-none disabled:bg-slate-100"
                  >
                    {availableCategoryGroups.length === 0 ? (
                      <option value="">ยังไม่มีกลุ่มกิจกรรมในระบบ</option>
                    ) : (
                      availableCategoryGroups.map((group) => {
                        const count = competitions.filter(
                          (c) => c.categoryGroup === group
                        ).length;
                        return (
                          <option key={group} value={group}>
                            {group} ({count} รายการ)
                          </option>
                        );
                      })
                    )}
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="reg-competition-select"
                    className="mb-1.5 block text-sm font-medium text-slate-700"
                  >
                    2. เลือกรายการแข่งขัน <span className="text-red-600">*</span>
                  </label>
                  <select
                    id="reg-competition-select"
                    value={selectedCompetitionId}
                    onChange={(e) => handleCompetitionChange(e.target.value)}
                    disabled={filteredCompetitionsByCategory.length === 0}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:border-blue-800 focus:outline-none disabled:bg-slate-100"
                  >
                    {filteredCompetitionsByCategory.length === 0 ? (
                      <option value="">ไม่มีรายการแข่งขันในกลุ่มกิจกรรมนี้</option>
                    ) : (
                      filteredCompetitionsByCategory.map((comp) => (
                        <option key={comp.id} value={comp.id}>
                          {comp.mainActivity}
                          {comp.level && !comp.mainActivity.includes(comp.level)
                            ? ` (${comp.level})`
                            : ''}
                          {comp.subActivity ? ` · ${comp.subActivity}` : ''}
                        </option>
                      ))
                    )}
                  </select>
                  {selectedCompetition && (
                    <p className="mt-1.5 text-xs text-slate-500">
                      {selectedCompetition.level ? `รุ่น: ${selectedCompetition.level} · ` : ''}
                      กำหนดการ:{' '}
                      {selectedCompetition.competitionDate || 'ยังไม่ระบุวัน'} ·{' '}
                      {selectedCompetition.competitionTime || 'ยังไม่ระบุเวลา'} ·{' '}
                      {selectedCompetition.venue || 'ยังไม่ระบุสถานที่'}
                    </p>
                  )}
                </div>
              </div>

              {/* Level Selection (Fixed by competition if level-separated, otherwise selectable) */}
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  รุ่นที่เข้าแข่งขัน <span className="text-red-600">* (จำเป็น)</span>
                </label>
                {selectedCompetition?.level ? (
                  <div className="flex flex-wrap items-center gap-3 rounded-lg border border-blue-200 bg-blue-50/60 px-4 py-3 text-sm">
                    <span className="rounded-md bg-blue-900 px-3 py-1 font-semibold text-white">
                      {selectedCompetition.level}
                    </span>
                    <span className="text-xs text-slate-600">
                      กำหนดตามรายการที่เลือก (แต่ละรุ่นแยกเป็นคนละรายการ — หากต้องการสมัครรุ่นอื่น ให้เลือกรายการของรุ่นนั้นด้านบน)
                    </span>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    {COMPETITION_LEVELS.map((lvl) => {
                      const active = level === lvl;
                      return (
                        <button
                          key={lvl}
                          type="button"
                          onClick={() => setLevel(lvl)}
                          className={`rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors ${
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
                )}
              </div>

              {/* Dynamic Advisors List */}
              <div className="space-y-3 border-t border-slate-200 pt-5">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900">
                      รายชื่อครูที่ปรึกษา{' '}
                      <span className="text-xs font-normal text-slate-500">
                        (ไม่บังคับ — เพิ่มภายหลังได้)
                      </span>
                    </h3>
                    <p className="text-xs text-slate-500">
                      สามารถกดเพิ่มรายชื่อครูที่ปรึกษาได้หลายคน หรือเว้นว่างไว้ก่อนได้
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleAddAdvisor}
                    className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-800 hover:bg-slate-50"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    เพิ่มครูที่ปรึกษา
                  </button>
                </div>

                <div className="space-y-2.5">
                  {advisors.map((advisor, idx) => (
                    <div key={idx} className="flex items-center gap-2.5">
                      <span className="w-6 shrink-0 text-right font-mono text-xs text-slate-400 tabular-nums">
                        {idx + 1}.
                      </span>
                      <input
                        type="text"
                        value={advisor}
                        onChange={(e) => handleAdvisorChange(idx, e.target.value)}
                        placeholder={`ชื่อ-สกุล ครูที่ปรึกษาคนที่ ${idx + 1} (เช่น นางสาวสุภาพร ใจดี)`}
                        className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 focus:border-blue-800 focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => handleRemoveAdvisor(idx)}
                        disabled={advisors.length <= 1}
                        className="rounded-lg border border-slate-200 p-2 text-slate-400 transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-40"
                        aria-label="ลบครูที่ปรึกษา"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Dynamic Students List */}
              <div className="space-y-3 border-t border-slate-200 pt-5">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900">
                      รายชื่อนักเรียนผู้เข้าแข่งขัน{' '}
                      <span className="text-xs font-normal text-slate-500">
                        (ไม่บังคับ — เพิ่มภายหลังได้)
                      </span>
                    </h3>
                    <p className="text-xs text-slate-500">
                      ระบุคำนำหน้า ชื่อ-สกุล และชั้นปี (กดเพิ่มได้ตามจำนวนสมาชิกทีม หรือเว้นว่างไว้ก่อนได้)
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleAddStudent}
                    className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-800 hover:bg-slate-50"
                  >
                    <UserPlus className="h-3.5 w-3.5" />
                    เพิ่มนักเรียน
                  </button>
                </div>

                <div className="space-y-2.5">
                  {students.map((student, idx) => (
                    <div
                      key={idx}
                      className="grid grid-cols-1 gap-2.5 rounded-lg border border-slate-200 bg-slate-50/70 p-3 sm:grid-cols-12 sm:items-center"
                    >
                      <div className="sm:col-span-3">
                        <label className="mb-1 block text-[11px] font-medium text-slate-500">
                          คำนำหน้า
                        </label>
                        <select
                          value={student.title}
                          onChange={(e) => handleStudentChange(idx, 'title', e.target.value)}
                          className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-sm text-slate-900 focus:border-blue-800 focus:outline-none"
                        >
                          {STUDENT_PREFIXES.map((prefix) => (
                            <option key={prefix} value={prefix}>
                              {prefix}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="sm:col-span-5">
                        <label className="mb-1 block text-[11px] font-medium text-slate-500">
                          ชื่อ-สกุล นักเรียนคนที่ {idx + 1}
                        </label>
                        <input
                          type="text"
                          value={student.fullName}
                          onChange={(e) => handleStudentChange(idx, 'fullName', e.target.value)}
                          placeholder="เช่น ปาลิดา รักศิลป์"
                          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-800 focus:outline-none"
                        />
                      </div>

                      <div className="sm:col-span-3">
                        <label className="mb-1 block text-[11px] font-medium text-slate-500">
                          ชั้นปี
                        </label>
                        <select
                          value={student.grade}
                          onChange={(e) => handleStudentChange(idx, 'grade', e.target.value)}
                          className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-sm text-slate-900 focus:border-blue-800 focus:outline-none"
                        >
                          {STUDENT_GRADES.map((g) => (
                            <option key={g} value={g}>
                              {g}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="flex justify-end sm:col-span-1 sm:pt-5">
                        <button
                          type="button"
                          onClick={() => handleRemoveStudent(idx)}
                          disabled={students.length <= 1}
                          className="rounded-lg border border-slate-200 bg-white p-2 text-slate-400 transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-40"
                          aria-label="ลบนักเรียน"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {formError && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-xs font-medium text-red-800">
                  {formError}
                </div>
              )}

              {formSuccess && (
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-medium text-emerald-800">
                  {formSuccess}
                </div>
              )}

              {(() => {
                const formComplete = isRegistrationComplete({ advisors, students });
                return (
                  <div
                    className={`flex items-center gap-2 rounded-lg border px-4 py-2.5 text-xs font-medium ${
                      formComplete
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                        : 'border-orange-200 bg-orange-50 text-orange-800'
                    }`}
                  >
                    {formComplete ? (
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                    ) : (
                      <AlertCircle className="h-4 w-4 shrink-0 text-orange-600" />
                    )}
                    <span>
                      {formComplete
                        ? 'สถานะข้อมูล: เรียบร้อย (กรอกรายชื่อครูที่ปรึกษาและนักเรียนครบแล้ว)'
                        : 'สถานะข้อมูล: ไม่เรียบร้อย (ยังไม่ได้กรอกครูที่ปรึกษาหรือนักเรียน — สามารถบันทึกไว้ก่อนและกลับมาแก้ไขภายหลังได้)'}
                    </span>
                  </div>
                );
              })()}

              <div className="flex items-center justify-end gap-3 border-t border-slate-200 pt-5">
                <button
                  type="button"
                  onClick={resetForm}
                  className="whitespace-nowrap rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  ล้างแบบฟอร์ม
                </button>
                <button
                  type="submit"
                  disabled={!isSchoolAuthenticated}
                  className="whitespace-nowrap rounded-lg bg-blue-900 px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-950 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {editingRegId ? 'บันทึกการแก้ไขข้อมูล' : 'บันทึกการลงทะเบียน'}
                </button>
              </div>
            </form>
          </section>

          {/* School's Submitted Registrations List */}
          <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <div className="flex items-center gap-2.5">
                <Users className="h-4 w-4 text-blue-900" />
                <h2 className="font-display text-base font-bold text-slate-900">
                  รายการที่โรงเรียนลงทะเบียนแล้ว ({schoolRegistrations.length})
                </h2>
              </div>
            </div>

            {!isSchoolAuthenticated ? (
              <div className="px-6 py-10 text-center text-xs text-slate-500">
                เข้าสู่ระบบด้วยบัญชีโรงเรียนเพื่อดูและจัดการรายการที่โรงเรียนส่งเข้าแข่งขัน
              </div>
            ) : schoolRegistrations.length === 0 ? (
              <div className="px-6 py-10 text-center text-xs text-slate-500">
                ยังไม่มีรายการลงทะเบียนของ {activeSchoolName} กรุณากรอกแบบฟอร์มด้านบนเพื่อส่งรายการแรก
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-xs font-medium text-slate-600">
                      <th className="px-5 py-3">รายการแข่งขัน</th>
                      <th className="px-5 py-3">รุ่น</th>
                      <th className="px-5 py-3">ครูที่ปรึกษา</th>
                      <th className="px-5 py-3">นักเรียน</th>
                      <th className="px-5 py-3">สถานะ</th>
                      <th className="px-5 py-3 text-right">จัดการ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {schoolRegistrations.map((reg) => {
                      const complete = isRegistrationComplete(reg);
                      return (
                        <tr key={reg.id} className="align-top hover:bg-slate-50/70">
                          <td className="px-5 py-3.5">
                            <div className="text-xs text-blue-900">{reg.categoryGroup}</div>
                            <div className="font-medium text-slate-900">{reg.mainActivity}</div>
                            {reg.subActivity && (
                              <div className="text-xs text-slate-500">{reg.subActivity}</div>
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
                            <div className="inline-flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => handleEditClick(reg)}
                                className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                              >
                                <Edit3 className="h-3 w-3" />
                                แก้ไข
                              </button>
                              <button
                                type="button"
                                onClick={() => onDeleteRegistration(reg)}
                                className="inline-flex items-center gap-1 rounded-md border border-red-200 bg-white px-2.5 py-1 text-xs font-medium text-red-700 hover:bg-red-50"
                              >
                                <Trash2 className="h-3 w-3" />
                                ลบ
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </main>
      </div>
    </div>
  );
};
