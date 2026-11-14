import React from 'react';
import { AlertTriangle, X } from 'lucide-react';

interface ConfirmActionModalProps {
  open: boolean;
  title: string;
  description: string;
  details?: string[];
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmActionModal: React.FC<ConfirmActionModalProps> = ({
  open,
  title,
  description,
  details,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  onConfirm,
  onCancel,
}) => {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-md rounded-xl bg-[#12131A] border border-[#27293A] p-6 space-y-4 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-[#8B5CF6]/15 border border-[#8B5CF6]/40 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-4 h-4 text-[#8B5CF6]" />
            </div>
            <h3 className="text-base font-semibold text-white">{title}</h3>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="p-1 text-[#8E92A8] hover:text-white rounded"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-xs text-[#C8CBDA] leading-relaxed">{description}</p>

        {details && details.length > 0 && (
          <div className="rounded-lg bg-[#09090E] border border-[#27293A] p-3 max-h-36 overflow-y-auto space-y-1 text-[11px] font-mono-tabular text-[#9B9FB5]">
            {details.map((line, i) => (
              <div key={i} className="truncate">
                • {line}
              </div>
            ))}
          </div>
        )}

        <div className="flex items-center justify-end gap-2.5 pt-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 rounded-lg bg-[#181924] hover:bg-[#222434] border border-[#27293A] text-xs font-medium text-[#D4D6E2]"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="px-4 py-2 rounded-lg bg-[#8B5CF6] hover:bg-[#7C3AED] text-xs font-semibold text-white"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};
