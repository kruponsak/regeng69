import React from 'react';
import { AlertTriangle, CheckCircle2, X } from 'lucide-react';
import { ConfirmationState } from '../types';

interface ConfirmDialogProps {
  state: ConfirmationState | null;
  isLoading: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  state,
  isLoading,
  onCancel,
  onConfirm,
}) => {
  if (!state || !state.isOpen) return null;

  const isDanger = state.tone === 'danger';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
    >
      <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white shadow-xl">
        <div className="flex items-start justify-between border-b border-slate-200 px-6 py-4">
          <div className="flex items-center gap-3">
            <div
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                isDanger ? 'bg-red-50 text-red-700' : 'bg-blue-50 text-blue-900'
              }`}
            >
              {isDanger ? (
                <AlertTriangle className="h-5 w-5" />
              ) : (
                <CheckCircle2 className="h-5 w-5" />
              )}
            </div>
            <h3 id="confirm-dialog-title" className="text-base font-semibold text-slate-900">
              {state.title}
            </h3>
          </div>
          <button
            type="button"
            onClick={onCancel}
            disabled={isLoading}
            className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 focus-visible:outline-2 focus-visible:outline-blue-700"
            aria-label="ปิดหน้าต่างยืนยัน"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-3 px-6 py-5">
          <p className="text-sm leading-relaxed text-slate-700">{state.description}</p>
          {state.details.length > 0 && (
            <ul className="space-y-1.5 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-700">
              {state.details.map((item, idx) => (
                <li key={idx} className="leading-relaxed">
                  {item}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-slate-200 bg-slate-50/70 px-6 py-3.5">
          <button
            type="button"
            onClick={onCancel}
            disabled={isLoading}
            className="whitespace-nowrap rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-blue-700 disabled:opacity-50"
          >
            ยกเลิก
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isLoading}
            className={`whitespace-nowrap rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50 ${
              isDanger
                ? 'bg-red-700 hover:bg-red-800 focus-visible:outline-red-700'
                : 'bg-blue-900 hover:bg-blue-950 focus-visible:outline-blue-900'
            }`}
          >
            {isLoading ? 'กำลังดำเนินการ...' : state.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};
