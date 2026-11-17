import React, { useEffect, useState } from 'react';
import {
  Check,
  Code2,
  Copy,
  Database,
  ExternalLink,
  FileSpreadsheet,
  Link2,
  RefreshCw,
  Unplug,
  X,
} from 'lucide-react';
import {
  APPS_SCRIPT_CODE,
  DEFAULT_SPREADSHEET_ID,
  SHEET_NAMES,
} from '../lib/sheetsDb';

interface GoogleSheetsModalProps {
  isOpen: boolean;
  onClose: () => void;
  gasUrl: string;
  isConnected: boolean;
  isSyncing: boolean;
  spreadsheetTitle?: string;
  availableSheets: string[];
  syncError: string | null;
  onConnectUrl: (url: string) => Promise<void>;
  onDisconnect: () => void;
  onSyncNow: () => Promise<void>;
}

export const GoogleSheetsModal: React.FC<GoogleSheetsModalProps> = ({
  isOpen,
  onClose,
  gasUrl,
  isConnected,
  isSyncing,
  spreadsheetTitle,
  availableSheets,
  syncError,
  onConnectUrl,
  onDisconnect,
  onSyncNow,
}) => {
  const [urlInput, setUrlInput] = useState(gasUrl);
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedShareLink, setCopiedShareLink] = useState(false);

  useEffect(() => {
    setUrlInput(gasUrl);
  }, [gasUrl]);

  if (!isOpen) return null;

  const requiredTabs = [
    SHEET_NAMES.USERS,
    SHEET_NAMES.COMPETITIONS,
    SHEET_NAMES.REGISTRATIONS,
  ];

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(APPS_SCRIPT_CODE);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2500);
    } catch {
      // ignore clipboard errors
    }
  };

  const handleCopyShareLink = async () => {
    if (!gasUrl.trim()) return;
    try {
      const shareUrl = `${window.location.origin}/?gas=${encodeURIComponent(gasUrl.trim())}`;
      await navigator.clipboard.writeText(shareUrl);
      setCopiedShareLink(true);
      setTimeout(() => setCopiedShareLink(false), 2500);
    } catch {
      // ignore clipboard errors
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="gs-modal-title"
    >
      <div className="w-full max-w-2xl overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-blue-900">
              <FileSpreadsheet className="h-5 w-5" />
            </div>
            <div>
              <h2 id="gs-modal-title" className="text-base font-semibold text-slate-900">
                เชื่อมต่อเว็บแอปกับ Google Sheets โดยตรง (ไม่ใช้ Firebase)
              </h2>
              <p className="text-xs text-slate-500">
                เชื่อมต่อผ่าน Google Apps Script Web App สำหรับ 3 ชีท: user · รายการ · ลงทะเบียน
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
            aria-label="ปิดหน้าต่าง"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="max-h-[78vh] space-y-5 overflow-y-auto px-6 py-5">
          {syncError && (
            <div className="space-y-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-900">
              <p className="font-medium leading-relaxed">{syncError}</p>
              {syncError.includes('Failed to fetch') && (
                <div className="space-y-1.5 rounded-md border border-red-200 bg-white p-3 text-slate-800">
                  <p className="font-semibold text-slate-900">วิธีตรวจสอบและแก้ไข (Failed to fetch):</p>
                  <ol className="list-inside list-decimal space-y-1 text-slate-700">
                    <li>
                      ตรวจสอบว่าลิงก์ที่วางเป็นลิงก์{' '}
                      <span className="font-mono font-semibold">Web app URL</span>{' '}
                      ที่ลงท้ายด้วย <span className="font-mono font-semibold">/exec</span>{' '}
                      (ไม่ใช่ลิงก์หน้าเอกสาร Google Sheets และไม่ใช่ <span className="font-mono">/dev</span>)
                    </li>
                    <li>
                      ใน Apps Script กด{' '}
                      <span className="font-semibold">Deploy → Manage deployments → Edit (รูปดินสอ)</span>{' '}
                      ตั้งค่า <span className="font-semibold">Who has access (ผู้มีสิทธิ์เข้าถึง)</span>{' '}
                      เป็น <span className="font-semibold text-blue-900">Anyone (ทุกคน)</span>{' '}
                      แล้วเลือก <span className="font-semibold">New version</span> → กด Deploy
                    </li>
                    <li>
                      หากเพิ่งวางโค้ดใหม่ ให้กดปุ่ม{' '}
                      <span className="font-semibold">คัดลอกโค้ด Apps Script</span>{' '}
                      ด้านล่างไปวางทับและ Deploy เวอร์ชันใหม่อีกครั้ง
                    </li>
                  </ol>
                  {urlInput.trim().startsWith('https://script.google.com') && (
                    <a
                      href={urlInput.trim()}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-1 inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-slate-50 px-3 py-1.5 text-[11px] font-medium text-slate-800 hover:bg-slate-100"
                    >
                      ทดสอบเปิดลิงก์ Apps Script (ควรขึ้นข้อความ Silapa74 Google Sheets Bridge Ready)
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Connection Status Box */}
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="space-y-0.5">
                <p className="text-xs font-medium text-slate-500">สถานะการเชื่อมต่อ</p>
                <p className="text-sm font-semibold text-slate-900">
                  {isConnected
                    ? `เชื่อมต่อกับ "${spreadsheetTitle || 'Google Sheets'}" แล้ว`
                    : 'ยังไม่ได้เชื่อมต่อ Web App URL (แสดงข้อมูลตัวอย่างในเครื่อง)'}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <a
                  href={`https://docs.google.com/spreadsheets/d/${DEFAULT_SPREADSHEET_ID}/edit`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 whitespace-nowrap rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
                >
                  เปิด Google Sheet ของคุณ
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
                {isConnected && (
                  <>
                    <button
                      type="button"
                      onClick={onSyncNow}
                      disabled={isSyncing}
                      className="inline-flex items-center gap-1 whitespace-nowrap rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-50"
                    >
                      <RefreshCw className={`h-3.5 w-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                      ซิงค์ข้อมูล
                    </button>
                    {gasUrl && (
                      <button
                        type="button"
                        onClick={handleCopyShareLink}
                        className="inline-flex items-center gap-1 whitespace-nowrap rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
                      >
                        {copiedShareLink ? (
                          <>
                            <Check className="h-3.5 w-3.5 text-emerald-700" />
                            คัดลอกลิงก์แชร์แล้ว
                          </>
                        ) : (
                          <>
                            <Copy className="h-3.5 w-3.5" />
                            คัดลอกลิงก์แชร์ให้เครื่องอื่น
                          </>
                        )}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={onDisconnect}
                      className="inline-flex items-center gap-1 whitespace-nowrap rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50"
                    >
                      <Unplug className="h-3.5 w-3.5" />
                      ตัดการเชื่อมต่อ
                    </button>
                  </>
                )}
              </div>
            </div>

            {isConnected && (
              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-slate-200 pt-2.5 text-xs text-slate-700">
                <span className="font-medium text-slate-500">สถานะ 3 ชีท:</span>
                {requiredTabs.map((tab) => {
                  const found = availableSheets.includes(tab);
                  return (
                    <span
                      key={tab}
                      className={`inline-flex items-center gap-1 font-medium ${
                        found ? 'text-emerald-700' : 'text-amber-700'
                      }`}
                    >
                      {found ? (
                        <Check className="h-3.5 w-3.5" />
                      ) : (
                        <Database className="h-3.5 w-3.5" />
                      )}
                      {tab} ({found ? 'พร้อมใช้งาน' : 'ยังไม่พบ'})
                    </span>
                  );
                })}
              </div>
            )}
          </div>

          {/* Step 1: Connect Web App URL */}
          <div className="space-y-3 rounded-lg border border-slate-200 p-4">
            <div>
              <p className="text-sm font-semibold text-slate-900">
                วางลิงก์ Google Apps Script Web App URL (/exec)
              </p>
              <p className="text-xs text-slate-600">
                เมื่อเชื่อมต่อสำเร็จ 1 ครั้ง ระบบจะบันทึกลิงก์ไว้ในชีทอัตโนมัติ เพื่อให้เครื่องอื่นและมือถือซิงค์ข้อมูลและใช้งานได้ทันที
              </p>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (urlInput.trim()) {
                  onConnectUrl(urlInput);
                }
              }}
              className="flex flex-col gap-2 sm:flex-row"
            >
              <input
                type="url"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                placeholder="https://script.google.com/macros/s/.../exec"
                required
                className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-800 focus:outline-none"
              />
              <button
                type="submit"
                disabled={isSyncing || !urlInput.trim()}
                className="inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg bg-blue-900 px-4 py-2 text-xs font-medium text-white hover:bg-blue-950 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Link2 className="h-3.5 w-3.5" />
                {isSyncing ? 'กำลังเชื่อมต่อ...' : 'เชื่อมต่อและซิงค์ 3 ชีท'}
              </button>
            </form>
          </div>

          {/* Step 2: Apps Script Setup Instructions & Code */}
          <div className="space-y-3 rounded-lg border border-slate-200 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Code2 className="h-4 w-4 text-blue-900" />
                <p className="text-sm font-semibold text-slate-900">
                  วิธีติดตั้งตัวเชื่อมใน Google Sheet (ทำครั้งเดียว)
                </p>
              </div>
              <button
                type="button"
                onClick={handleCopyCode}
                className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-800 hover:bg-slate-50"
              >
                {copiedCode ? (
                  <>
                    <Check className="h-3.5 w-3.5 text-emerald-700" />
                    คัดลอกโค้ดแล้ว
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" />
                    คัดลอกโค้ด Apps Script
                  </>
                )}
              </button>
            </div>

            <ol className="list-inside list-decimal space-y-1.5 text-xs leading-relaxed text-slate-700">
              <li>
                เปิด Google Sheet ของคุณ (ID:{' '}
                <span className="font-mono font-semibold text-slate-900">
                  {DEFAULT_SPREADSHEET_ID}
                </span>
                ) แล้วไปที่เมนู <span className="font-semibold">ส่วนขยาย (Extensions) → Apps Script</span>
              </li>
              <li>
                ลบโค้ดเดิมออกทั้งหมด แล้ววางโค้ดด้านล่างลงไป จากนั้นกดบันทึก (Save)
              </li>
              <li>
                กดปุ่ม <span className="font-semibold">ทำให้ใช้งานได้ (Deploy) → การทำให้ใช้งานได้รายการใหม่ (New deployment)</span>
              </li>
              <li>
                เลือกประเภทเป็น <span className="font-semibold">เว็บแอป (Web app)</span> · ดำเนินการในนาม: <span className="font-semibold">ฉัน (Me)</span> · ผู้มีสิทธิ์เข้าถึง: <span className="font-semibold">ทุกคน (Anyone)</span> → กด <span className="font-semibold">Deploy</span>
              </li>
              <li>
                นำลิงก์ <span className="font-mono">https://script.google.com/macros/s/.../exec</span> ที่ได้มาวางในช่องด้านบนแล้วกดเชื่อมต่อ ระบบจะสร้างชีท <span className="font-semibold">user, รายการ, ลงทะเบียน</span> ให้อัตโนมัติทันที
              </li>
            </ol>

            <pre className="max-h-48 overflow-auto rounded-lg border border-slate-200 bg-slate-900 p-3 font-mono text-[11px] leading-relaxed text-slate-100">
              {APPS_SCRIPT_CODE}
            </pre>
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-6 py-3.5">
          <p className="text-xs text-slate-500">
            เชื่อมต่อตรงระหว่างเว็บแอปและ Google Sheets (ไม่มี Firebase และไม่มี Pop-up ล็อกอิน)
          </p>
          <button
            type="button"
            onClick={onClose}
            className="whitespace-nowrap rounded-lg bg-slate-900 px-4 py-2 text-xs font-medium text-white hover:bg-slate-800"
          >
            ปิดหน้าต่าง
          </button>
        </div>
      </div>
    </div>
  );
};
