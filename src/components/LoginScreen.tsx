import React, { useMemo, useState } from 'react';
import { ArrowLeft, Lock, LogIn, UserCheck } from 'lucide-react';
import { ScreenPath, SiteSettings, TransitionType, UserAccount } from '../types';

interface LoginScreenProps {
  users: UserAccount[];
  siteSettings: SiteSettings;
  onLoginSuccess: (user: UserAccount, targetScreen: ScreenPath) => void;
  onNavigate: (path: ScreenPath, transition: TransitionType) => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({
  users,
  siteSettings,
  onLoginSuccess,
  onNavigate,
}) => {
  const schoolUsers = useMemo(
    () =>
      users
        .filter((u) => u.role === 'school')
        .sort((a, b) => a.schoolName.localeCompare(b.schoolName, 'th')),
    [users]
  );

  // Dropdown selection: 'admin' or specific school user id
  const [selectedUserId, setSelectedUserId] = useState<string>(() => {
    return schoolUsers[0]?.id || 'admin';
  });
  const [adminUsername, setAdminUsername] = useState('admin');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [emblemFailed, setEmblemFailed] = useState(false);

  const selectedAccount = useMemo(() => {
    if (selectedUserId === 'admin') {
      return users.find((u) => u.role === 'admin') || null;
    }
    return users.find((u) => u.id === selectedUserId) || null;
  }, [selectedUserId, users]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (selectedUserId === 'admin') {
      const matchedAdmin = users.find(
        (u) =>
          u.role === 'admin' &&
          u.username.trim() === adminUsername.trim() &&
          u.password === password
      );
      if (!matchedAdmin) {
        setErrorMsg('ชื่อผู้ใช้หรือรหัสผ่านผู้ดูแลระบบไม่ถูกต้อง');
        return;
      }
      onLoginSuccess(matchedAdmin, 'admin-central');
      return;
    }

    if (!selectedAccount) {
      setErrorMsg('กรุณาเลือกโรงเรียนที่ต้องการเข้าสู่ระบบ');
      return;
    }

    if (selectedAccount.password !== password) {
      setErrorMsg('รหัสผ่านของโรงเรียนไม่ถูกต้อง กรุณาตรวจสอบอีกครั้ง');
      return;
    }

    onLoginSuccess(selectedAccount, 'school-portal');
  };

  return (
    <div className="flex min-h-screen flex-col justify-center bg-slate-50 px-6 py-10">
      <div className="mx-auto grid w-full max-w-5xl grid-cols-1 overflow-hidden rounded-2xl border border-slate-200 bg-white lg:grid-cols-12">
        {/* Left Institutional Context Panel */}
        <div className="flex flex-col justify-between gap-8 border-b border-slate-200 bg-slate-900 p-8 text-white lg:col-span-5 lg:border-r lg:border-b-0 lg:p-10">
          <div className="space-y-6">
            <div className="flex items-center gap-4">
              <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl border border-slate-700 bg-white">
                {!emblemFailed ? (
                  <img
                    src="/src/assets/images/competition_emblem_1794540306947.jpg"
                    alt={`ตราสัญลักษณ์ ${siteSettings.siteTitle}`}
                    referrerPolicy="no-referrer"
                    onError={() => setEmblemFailed(true)}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-blue-900">
                    <UserCheck className="h-6 w-6" />
                  </div>
                )}
              </div>
              <div>
                <p className="text-xs font-medium text-slate-300">
                  ระบบจัดการแข่งขันและลงทะเบียน
                </p>
                <h1 className="font-display text-lg font-bold tracking-tight text-white">
                  {siteSettings.siteTitle}
                </h1>
              </div>
            </div>

            <div className="space-y-2.5">
              <h2 className="font-display text-2xl leading-snug font-semibold text-balance">
                เข้าสู่ระบบสำหรับโรงเรียนและผู้ดูแลระบบ
              </h2>
              <p className="text-sm leading-relaxed text-slate-300">
                เลือกบัญชีผู้ดูแลระบบ หรือรายชื่อโรงเรียนที่ผู้ดูแลระบบสร้างไว้ให้จากชีท{' '}
                <span className="font-mono text-white">user</span>{' '}
                เพื่อบันทึกข้อมูลการส่งนักเรียนเข้าแข่งขันและกำหนดการลงใน Google Sheets
              </p>
            </div>
          </div>

          <div className="space-y-2 border-t border-slate-800 pt-6">
            <p className="text-xs text-slate-300">
              สำหรับการตั้งค่าและซิงค์ฐานข้อมูล Google Sheets สามารถจัดการได้หลังเข้าสู่ระบบผู้ดูแลระบบหลัก
            </p>
            <p className="text-[11px] leading-relaxed text-slate-400">
              ผู้ดูแลระบบเริ่มต้น: username <span className="font-mono text-slate-200">admin</span>
            </p>
          </div>
        </div>

        {/* Right Authentication Form */}
        <div className="flex flex-col justify-between p-8 lg:col-span-7 lg:p-10">
          <div className="space-y-6">
            <div>
              <h2 className="font-display text-2xl font-bold text-slate-900">เข้าสู่ระบบ</h2>
              <p className="mt-1 text-sm text-slate-500">
                เลือกผู้ใช้งานหรือชื่อโรงเรียนจากรายการด้านล่าง
              </p>
            </div>

            <form id="auth-form" onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label
                  htmlFor="login-user-select"
                  className="mb-1.5 block text-sm font-medium text-slate-700"
                >
                  เลือกผู้ใช้งาน / โรงเรียน
                </label>
                <select
                  id="login-user-select"
                  value={selectedUserId}
                  onChange={(e) => {
                    setSelectedUserId(e.target.value);
                    setErrorMsg(null);
                  }}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:border-blue-800 focus:outline-none"
                >
                  <option value="admin">ผู้ดูแลระบบ</option>
                  {schoolUsers.length > 0 && (
                    <optgroup label="รายชื่อโรงเรียน (แอดมินโรงเรียน)">
                      {schoolUsers.map((school) => (
                        <option key={school.id} value={school.id}>
                          {school.schoolName}
                        </option>
                      ))}
                    </optgroup>
                  )}
                </select>
              </div>

              {selectedUserId === 'admin' ? (
                <div>
                  <label
                    htmlFor="admin-username"
                    className="mb-1.5 block text-sm font-medium text-slate-700"
                  >
                    ชื่อผู้ใช้ (Username)
                  </label>
                  <input
                    id="admin-username"
                    type="text"
                    value={adminUsername}
                    onChange={(e) => setAdminUsername(e.target.value)}
                    required
                    placeholder="admin"
                    className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:border-blue-800 focus:outline-none"
                  />
                </div>
              ) : (
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs text-slate-600">
                  รหัสอ้างอิงบัญชีโรงเรียน:{' '}
                  <span className="font-mono font-medium text-slate-900">
                    {selectedAccount?.username}
                  </span>
                </div>
              )}

              <div>
                <label
                  htmlFor="login-password"
                  className="mb-1.5 block text-sm font-medium text-slate-700"
                >
                  รหัสผ่าน
                </label>
                <div className="relative">
                  <Lock className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    id="login-password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    placeholder="กรอกรหัสผ่าน"
                    className="w-full rounded-lg border border-slate-300 bg-white py-2.5 pr-3.5 pl-10 text-sm text-slate-900 focus:border-blue-800 focus:outline-none"
                  />
                </div>
              </div>

              {errorMsg && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-xs font-medium text-red-800">
                  {errorMsg}
                </div>
              )}

              <button
                type="submit"
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-blue-900 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-900"
              >
                <LogIn className="h-4 w-4" />
                เข้าสู่ระบบ
              </button>
            </form>
          </div>

          <div className="mt-8 border-t border-slate-200 pt-5">
            <button
              type="button"
              onClick={() => onNavigate('public-portal', 'push_back')}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
            >
              <ArrowLeft className="h-4 w-4" />
              เข้าชมโดยไม่ต้องล็อกอิน
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
