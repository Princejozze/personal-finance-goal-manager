import React from "react";
import { AlertTriangle } from "lucide-react";

interface ConfirmationModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  isDestructive?: boolean;
  theme?: "dark" | "light";
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
  isOpen,
  title,
  message,
  confirmText = "Confirm",
  cancelText = "Cancel",
  isDestructive = false,
  theme = "dark",
  onConfirm,
  onCancel,
}) => {
  if (!isOpen) return null;
  const isLight = theme === "light";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4">
      <div className={`rounded-2xl shadow-2xl max-w-md w-full p-6 border ${
        isLight ? "bg-white border-slate-200 text-slate-900" : "bg-[#141417] border-white/10 text-white"
      }`}>
        <div className="flex items-center gap-3 mb-4">
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${
              isDestructive
                ? "bg-rose-500/10 text-rose-500 border-rose-500/20"
                : "bg-indigo-500/10 text-indigo-500 border-indigo-500/20"
            }`}
          >
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <h3 className={`text-base sm:text-lg font-bold ${isLight ? "text-slate-900" : "text-white"}`}>{title}</h3>
          </div>
        </div>

        <p className={`text-xs sm:text-sm mb-6 leading-relaxed whitespace-pre-line font-mono ${
          isLight ? "text-slate-600" : "text-slate-400"
        }`}>{message}</p>

        <div className={`flex items-center justify-end gap-3 pt-2 border-t ${
          isLight ? "border-slate-200" : "border-white/5"
        }`}>
          <button
            type="button"
            onClick={onCancel}
            className={`px-4 py-2 text-xs sm:text-sm font-medium rounded-xl transition-colors cursor-pointer ${
              isLight ? "text-slate-600 hover:bg-slate-100" : "text-slate-400 hover:bg-white/5"
            }`}
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`px-5 py-2 text-xs sm:text-sm font-bold rounded-xl transition-all shadow-md cursor-pointer ${
              isDestructive
                ? "bg-rose-500 hover:bg-rose-600 text-white shadow-rose-500/20"
                : "bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-emerald-500/20"
            }`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};
