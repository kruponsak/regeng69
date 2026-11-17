import React, { useEffect, useState } from 'react';
import {
  Check,
  Clock,
  Code2,
  Copy,
  Database,
  ExternalLink,
  FileSpreadsheet,
  Link2,
  RefreshCw,
  Trash2,
  Unplug,
  X,
} from 'lucide-react';
import {
  APPS_SCRIPT_CODE,
  DEFAULT_SPREADSHEET_ID,
  SHEET_NAMES,
  buildGoogleSheetUrl,
} from '../lib/sheetsDb';
import { ActiveSheetConfig, SheetLinkEntry } from '../types';

interface GoogleSheetsModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeSheetConfig: ActiveSheetConfig;
  sheetLinks: SheetLinkEntry[];
  isConnected: boolean;
  isSyncing: boolean;
  spreadsheetTitle?: string;
  availableSheets: string[];
  syncError: string | null;
  onConnectSheetLink: (input: {
    sheetUrlOrId?: string;
    gasUrl?: string;
    label?: string;
  }) => Promise<boolean>;
  onSelectSheetLink: (entry: SheetLinkEntry) => Promise<boolean>;
  onRemoveSheetLink: (entryId: string) => void;
  onDisconnect: () => void;
  onSyncNow: () => Promise<void>;
}

function formatActivatedTime(ms: number): string {
  if (!ms) return 'ค่าเริ่มต้น';
  try {
    return new Intl.DateTimeFormat('th-TH', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(new Date(ms));
  } catch {
    return '';
  }
}

export const GoogleSheetsModal: React.FC<GoogleSheetsModalProps> = ({
  isOpen,
  onClose,
  activeSheetConfig,
  sheetLinks,
  isConnected,
  isSyncing,
  spreadsheetTitle,
  availableSheets,
  syncError,
  onConnectSheetLink,
  onSelectSheetLink,
  onRemoveSheetLink,
  onDisconnect,
  onSyncNow,
}) => {
  const [labelInput, setLabelInput] = useState(activeSheetConfig.label || '');
  const [sheetUrlInput, setSheetUrlInput] = useState(
    activeSheetConfig.sheetUrl || buildGoogleSheetUrl(activeSheetConfig.spreadsheetId || DEFAULT_SPREADSHEET_ID)
  );
  const [gasUrlInput, setGasUrlInput] = useState(activeSheetConfig.gasUrl || '');
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedShareLink, setCopiedShareLink] = useState(false);

  useEffect(() => {
    setLabelInput(activeSheetConfig.label || '');
    setSheetUrlInput(
      activeSheetConfig.sheetUrl ||
        buildGoogleSheetUrl(activeSheetConfig.spreadsheetId || DEFAULT_SPREADSHEET_ID)
    );
    setGasUrlInput(activeSheetConfig.gasUrl || '');
  }, [activeSheetConfig]);

  if (!isOpen) return null;

  const activeSid = activeSheetConfig.spreadsheetId || DEFAULT_SPREADSHEET_ID;
  const activeSheetUrl = activeSheetConfig.sheetUrl || buildGoogleSheetUrl(activeSid);
  const activeGasUrl = activeSheetConfig.gasUrl || '';

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
    try {
      const params = new URLSearchParams();
      if (activeSid) params.set('sheet', activeSid);
      if (activeGasUrl.trim()) params.set('gas', activeGasUrl.trim());
      const shareUrl = `${window.location.origin}/?${params.toString()}`;
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
                จัดการลิงก์ Google Sheets และซิงค์ข้อมูลอัตโนมัติ
              </h2>
              <p className="text-xs text-slate-500">
                สลับลิงก์ชีทได้อัตโนมัติ โดยยึดตามลิงก์ล่าสุดที่แอดมินกดใช้งาน
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
                      ตรวจสอบว่าลิงก์ Apps Script เป็น{' '}
                      <span className="font-mono font-semibold">Web app URL</span>{' '}
                      ที่ลงท้ายด้วย <span className="font-mono font-semibold">/exec</span>
                    </li>
                    <li>
                      ใน Apps Script กด{' '}
                      <span className="font-semibold">Deploy → Manage deployments → Edit</span>{' '}
                      ตั้งค่า <span className="font-semibold">Who has access</span> เป็น{' '}
                      <span className="font-semibold text-blue-900">Anyone (ทุกคน)</span>{' '}
                      แล้วกด Deploy
                    </li>
                  </ol>
                  {gasUrlInput.trim().startsWith('https://script.google.com') && (
                    <a
                      href={gasUrlInput.trim()}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-1 inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-slate-50 px-3 py-1.5 text-[11px] font-medium text-slate-800 hover:bg-slate-100"
                    >
                      ทดสอบเปิดลิงก์ Apps Script
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Active Connection Status Box */}
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-xs font-medium text-slate-500">ลิงก์ชีทที่ใช้งานอยู่ (ยึดตามที่กดล่าสุด)</p>
                  <span className="inline-flex items-center gap-1 rounded border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-800">
                    <Clock className="h-3 w-3" />
                    {formatActivatedTime(activeSheetConfig.lastActivatedAt)}
                  </span>
                </div>
                <p className="text-sm font-semibold text-slate-900">
                  {isConnected
                    ? `${activeSheetConfig.label || spreadsheetTitle || 'Google Sheets'} (${spreadsheetTitle || 'เชื่อมต่อแล้ว'})`
                    : 'ยังไม่ได้เชื่อมต่อ Google Sheets'}
                </p>
                <p className="truncate font-mono text-[11px] text-slate-500">
                  ID: {activeSid}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <a
                  href={activeSheetUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 whitespace-nowrap rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
                >
                  เปิด Google Sheet นี้
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
                          คัดลอกลิงก์แชร์
                        </>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={onDisconnect}
                      className="inline-flex items-center gap-1 whitespace-nowrap rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50"
                    >
                      <Unplug className="h-3.5 w-3.5" />
                      รีเซ็ตลิงก์
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

          {/* Saved Sheet Links History — Click to switch automatically */}
          {sheetLinks.length > 0 && (
            <div className="space-y-2.5 rounded-lg border border-slate-200 p-4">
              <div>
                <p className="text-sm font-semibold text-slate-900">
                  รายการลิงก์ชีทที่บันทึกไว้ (คลิกเพื่อสลับใช้งานอัตโนมัติ)
                </p>
                <p className="text-xs text-slate-500">
                  เมื่อกดเลือกลิงก์ใด ระบบจะยึดลิงก์ที่กดล่าสุดเป็นฐานข้อมูลหลักและซิงค์ให้อุปกรณ์อื่นอัตโนมัติ
                </p>
              </div>

              <div className="divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white">
                {sheetLinks.map((entry) => {
                  const isCurrent =
                    entry.spreadsheetId === activeSid &&
                    (entry.gasUrl || '') === activeGasUrl;
                  return (
                    <div
                      key={entry.id}
                      className={`flex flex-wrap items-center justify-between gap-3 px-3.5 py-2.5 ${
                        isCurrent ? 'bg-blue-50/60' : 'hover:bg-slate-50'
                      }`}
                    >
                      <div className="min-w-0 flex-1 space-y-0.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-xs font-semibold text-slate-900">
                            {entry.label || 'Google Sheets'}
                          </span>
                          {isCurrent && (
                            <span className="rounded border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-800">
                              กำลังใช้งาน (ล่าสุด)
                            </span>
                          )}
                          <span className="rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] text-slate-600">
                            {entry.gasUrl ? 'อ่าน + เขียนข้อมูลได้' : 'อ่านจากชีทสาธารณะ'}
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-500">
                          <span className="truncate font-mono">
                            ID: {entry.spreadsheetId || '-'}
                          </span>
                          <span>กดล่าสุด: {formatActivatedTime(entry.lastActivatedAt)}</span>
                        </div>
                      </div>

                      <div className="flex shrink-0 items-center gap-1.5">
                        {entry.sheetUrl && (
                          <a
                            href={entry.sheetUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="rounded-md border border-slate-200 bg-white p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
                            title="เปิดชีทในแท็บใหม่"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                        )}
                        <button
                          type="button"
                          disabled={isSyncing}
                          onClick={async () => {
                            await onSelectSheetLink(entry);
                          }}
                          className={`inline-flex items-center gap-1 whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50 ${
                            isCurrent
                              ? 'border border-blue-200 bg-white text-blue-900 hover:bg-blue-50'
                              : 'bg-blue-900 text-white hover:bg-blue-950'
                          }`}
                        >
                          <Link2 className="h-3 w-3" />
                          {isCurrent ? 'ซิงค์ลิงก์นี้อีกครั้ง' : 'กดใช้ลิงก์นี้'}
                        </button>
                        {!isCurrent && entry.spreadsheetId !== DEFAULT_SPREADSHEET_ID && (
                          <button
                            type="button"
                            onClick={() => onRemoveSheetLink(entry.id)}
                            className="rounded-md border border-red-200 bg-white p-1.5 text-red-600 hover:bg-red-50"
                            title="ลบออกจากรายการ"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Step 1: Change / Add Sheet Link Form */}
          <div className="space-y-3 rounded-lg border border-slate-200 p-4">
            <div>
              <p className="text-sm font-semibold text-slate-900">
                เปลี่ยนลิงก์ Google Sheets หรือวางลิงก์ใหม่
              </p>
              <p className="text-xs text-slate-600">
                วางลิงก์ Google Sheets (<span className="font-mono">https://docs.google.com/spreadsheets/d/...</span>) หรือ Spreadsheet ID และลิงก์ Apps Script Web App (<span className="font-mono">/exec</span>) เพื่อสลับใช้งานทันที
              </p>
            </div>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                await onConnectSheetLink({
                  label: labelInput,
                  sheetUrlOrId: sheetUrlInput,
                  gasUrl: gasUrlInput,
                });
              }}
              className="space-y-3"
            >
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-700">
                  ชื่อเรียกชีท (ไม่บังคับ)
                </label>
                <input
                  type="text"
                  value={labelInput}
                  onChange={(e) => setLabelInput(e.target.value)}
                  placeholder="เช่น ชีทหลัก 2569 / ชีทสำรอง"
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-800 focus:outline-none"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-700">
                  ลิงก์ Google Sheets (URL หรือ Spreadsheet ID)
                </label>
                <input
                  type="text"
                  value={sheetUrlInput}
                  onChange={(e) => setSheetUrlInput(e.target.value)}
                  placeholder="https://docs.google.com/spreadsheets/d/.../edit"
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-800 focus:outline-none"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-700">
                  ลิงก์ Google Apps Script Web App URL (/exec) สำหรับเขียนข้อมูลลงชีท
                </label>
                <input
                  type="url"
                  value={gasUrlInput}
                  onChange={(e) => setGasUrlInput(e.target.value)}
                  placeholder="https://script.google.com/macros/s/.../exec"
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-800 focus:outline-none"
                />
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={isSyncing || (!sheetUrlInput.trim() && !gasUrlInput.trim())}
                  className="inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg bg-blue-900 px-4 py-2 text-xs font-medium text-white hover:bg-blue-950 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Link2 className="h-3.5 w-3.5" />
                  {isSyncing ? 'กำลังสลับและซิงค์...' : 'สลับและซิงค์ลิงก์นี้ทันที'}
                </button>
              </div>
            </form>
          </div>

          {/* Step 2: Apps Script Setup Instructions & Code */}
          <div className="space-y-3 rounded-lg border border-slate-200 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Code2 className="h-4 w-4 text-blue-900" />
                <p className="text-sm font-semibold text-slate-900">
                  โค้ด Apps Script สำหรับเชื่อม Google Sheet (รองรับสลับหลายชีทอัตโนมัติ)
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
                เปิด Google Sheet ที่ต้องการ แล้วไปที่เมนู <span className="font-semibold">ส่วนขยาย (Extensions) → Apps Script</span>
              </li>
              <li>
                วางโค้ดด้านล่างลงไปและบันทึก จากนั้นกด <span className="font-semibold">Deploy → New deployment (เว็บแอป)</span> โดยตั้งสิทธิ์ <span className="font-semibold">Who has access: Anyone (ทุกคน)</span>
              </li>
              <li>
                นำลิงก์ Google Sheets และลิงก์ <span className="font-mono">/exec</span> มาวางด้านบน แล้วกดสลับใช้งาน
              </li>
            </ol>

            <pre className="max-h-48 overflow-auto rounded-lg border border-slate-200 bg-slate-900 p-3 font-mono text-[11px] leading-relaxed text-slate-100">
              {APPS_SCRIPT_CODE}
            </pre>
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-6 py-3.5">
          <p className="text-xs text-slate-500">
            เชื่อมต่อตรงระหว่างเว็บแอปและ Google Sheets (ยึดตามลิงก์ล่าสุดที่กดใช้งาน)
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
