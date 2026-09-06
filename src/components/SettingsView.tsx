import React, { useState } from "react";
import { Sliders, Download, Upload, Trash2, Cloud, Check } from "lucide-react";
import { UserSettings, AppData } from "../types";
import { ConfirmationModal } from "./ConfirmationModal";

interface SettingsViewProps {
  settings: UserSettings;
  appData: AppData;
  onUpdateSettings: (newSettings: Partial<UserSettings>) => void;
  onImportData: (data: AppData) => void;
  onClearAllData: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  settings,
  appData,
  onUpdateSettings,
  onImportData,
  onClearAllData,
}) => {
  const [currency, setCurrency] = useState(settings.currencySymbol || "$");
  const [titheRate, setTitheRate] = useState((settings.defaultTithePercentage ?? 10).toString());
  const [notificationEmail, setNotificationEmail] = useState(settings.notificationEmail || "");
  const [autoReminderEnabled, setAutoReminderEnabled] = useState(
    settings.autoReminderEnabled ?? false
  );
  const [reminderHour, setReminderHour] = useState((settings.reminderHour ?? 20).toString());
  const [autoWeekendReviewEnabled, setAutoWeekendReviewEnabled] = useState(
    settings.autoWeekendReviewEnabled ?? false
  );
  const [savedSuccess, setSavedSuccess] = useState(false);

  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState(false);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const rate = parseFloat(titheRate);
    const hour = parseInt(reminderHour, 10);
    onUpdateSettings({
      currencySymbol: currency.trim() || "$",
      defaultTithePercentage: isNaN(rate) ? 10 : rate,
      notificationEmail: notificationEmail.trim() || undefined,
      autoReminderEnabled,
      reminderHour: isNaN(hour) ? 20 : Math.min(23, Math.max(0, hour)),
      autoWeekendReviewEnabled,
    });
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2500);
  };

  const handleExportJSON = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(appData, null, 2));
    const downloadAnchor = document.createElement("a");
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `personal_finance_goals_backup_${new Date().toISOString().split("T")[0]}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const handleImportJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if (parsed && Array.isArray(parsed.expenses) && Array.isArray(parsed.earnings)) {
          onImportData(parsed);
          alert("Data imported successfully!");
        } else {
          alert("Invalid backup file format.");
        }
      } catch (err) {
        alert("Failed to parse JSON file.");
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="space-y-6">
      <div className="bg-[#141417] rounded-2xl border border-white/5 shadow-xl p-6">
        <div className="flex items-center gap-2 pb-4 border-b border-white/5">
          <Sliders className="w-5 h-5 text-indigo-400" />
          <h2 className="text-base font-bold text-white uppercase tracking-wider">Application Preferences</h2>
        </div>

        <form onSubmit={handleSave} className="mt-6 space-y-4 max-w-lg">
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1.5">
              Currency Symbol
            </label>
            <input
              type="text"
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              placeholder="$"
              className="w-full px-3.5 py-2.5 border border-white/10 rounded-xl bg-[#0A0A0B] text-white placeholder-slate-600 text-xs focus:outline-hidden focus:border-emerald-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1.5">
              Default Tithe Percentage (%)
            </label>
            <input
              type="number"
              min="0"
              max="100"
              step="0.5"
              value={titheRate}
              onChange={(e) => setTitheRate(e.target.value)}
              placeholder="10"
              className="w-full px-3.5 py-2.5 border border-white/10 rounded-xl bg-[#0A0A0B] text-white placeholder-slate-600 text-xs font-mono focus:outline-hidden focus:border-emerald-500"
            />
            <p className="text-2xs text-slate-500 mt-1">Standard biblical guideline is 10%.</p>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1.5">
              Default Reminder Recipient Email
            </label>
            <input
              type="email"
              value={notificationEmail}
              onChange={(e) => setNotificationEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full px-3.5 py-2.5 border border-white/10 rounded-xl bg-[#0A0A0B] text-white placeholder-slate-600 text-xs focus:outline-hidden focus:border-emerald-500"
            />
          </div>

          {/* Self-managing automations */}
          <div className="pt-2 border-t border-white/5 space-y-3">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">
              Self-Managing Automations
            </p>

            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={autoReminderEnabled}
                onChange={(e) => setAutoReminderEnabled(e.target.checked)}
                className="mt-0.5 h-4 w-4 accent-emerald-500"
              />
              <span className="text-xs text-slate-300">
                Auto-email me a Gemini reminder when daily tasks are still unfinished.
                <span className="block text-2xs text-slate-500 mt-0.5">
                  Sends once per day, only when the app is opened after the hour below, on any device.
                  Requires being signed in with Google.
                </span>
              </span>
            </label>

            <div className="pl-7">
              <label className="block text-2xs font-bold text-slate-500 uppercase tracking-widest mb-1">
                Send reminders after (hour, 0–23 local time)
              </label>
              <input
                type="number"
                min="0"
                max="23"
                value={reminderHour}
                onChange={(e) => setReminderHour(e.target.value)}
                disabled={!autoReminderEnabled}
                className="w-24 px-3 py-2 border border-white/10 rounded-xl bg-[#0A0A0B] text-white text-xs font-mono focus:outline-hidden focus:border-emerald-500 disabled:opacity-40"
              />
            </div>

            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={autoWeekendReviewEnabled}
                onChange={(e) => setAutoWeekendReviewEnabled(e.target.checked)}
                className="mt-0.5 h-4 w-4 accent-emerald-500"
              />
              <span className="text-xs text-slate-300">
                Auto-generate the Gemini weekend financial review on Saturday/Sunday.
                <span className="block text-2xs text-slate-500 mt-0.5">
                  Runs once per week when the app is opened over the weekend; saved to Weekend AI Review.
                </span>
              </span>
            </label>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <button
              type="submit"
              className="px-5 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold rounded-xl shadow-lg shadow-emerald-500/20 transition-all"
            >
              Save Settings
            </button>
            {savedSuccess && (
              <span className="text-xs text-emerald-400 flex items-center gap-1 font-medium">
                <Check className="w-3.5 h-3.5" /> Saved successfully!
              </span>
            )}
          </div>
        </form>
      </div>

      {/* Backup, Export & Storage Operations */}
      <div className="bg-[#141417] rounded-2xl border border-white/5 shadow-xl p-6 space-y-4">
        <div className="flex items-center gap-2 pb-4 border-b border-white/5">
          <Cloud className="w-5 h-5 text-indigo-400" />
          <h3 className="text-base font-bold text-white uppercase tracking-wider">Data Management & Cloud Synchronization</h3>
        </div>

        <p className="text-xs text-slate-400 leading-relaxed">
          Your data is automatically synced to your Google Drive inside the file{" "}
          <code className="bg-black/40 border border-white/5 px-2 py-0.5 rounded-md text-emerald-300 font-mono text-2xs">personal_finance_goals_data.json</code>.
          You can also download an offline snapshot or restore from a JSON backup file anytime.
        </p>

        <div className="flex flex-wrap items-center gap-3 pt-2">
          <button
            type="button"
            onClick={handleExportJSON}
            className="flex items-center gap-2 px-4 py-2.5 bg-black/20 hover:bg-white/5 border border-white/5 text-slate-300 text-xs font-semibold rounded-xl transition-all"
          >
            <Download className="w-4 h-4 text-slate-400" />
            <span>Download Local JSON Backup</span>
          </button>

          <label className="flex items-center gap-2 px-4 py-2.5 bg-black/20 hover:bg-white/5 border border-white/5 text-slate-300 text-xs font-semibold rounded-xl cursor-pointer transition-all">
            <Upload className="w-4 h-4 text-slate-400" />
            <span>Restore from JSON Backup</span>
            <input
              type="file"
              accept=".json"
              onChange={handleImportJSON}
              className="hidden"
            />
          </label>

          <button
            type="button"
            onClick={() => setIsResetConfirmOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 text-rose-400 text-xs font-semibold rounded-xl transition-all sm:ml-auto"
          >
            <Trash2 className="w-4 h-4" />
            <span>Reset Local Records</span>
          </button>
        </div>
      </div>

      <ConfirmationModal
        isOpen={isResetConfirmOpen}
        title="Reset All Local Records?"
        message="Are you sure you want to erase all locally cached expenses, earnings, tithes, and goals? This action cannot be undone unless you have a Google Drive or JSON backup."
        confirmText="Yes, Reset Records"
        isDestructive={true}
        onConfirm={() => {
          setIsResetConfirmOpen(false);
          onClearAllData();
        }}
        onCancel={() => setIsResetConfirmOpen(false)}
      />
    </div>
  );
};
