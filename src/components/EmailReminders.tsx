import React, { useState } from "react";
import {
  Mail,
  Send,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Clock,
  UserCheck,
  Edit3,
  CalendarX,
  Coffee,
  BellRing,
  HelpCircle,
} from "lucide-react";
import { User } from "firebase/auth";
import { GoalItem, AppSettings } from "../types";
import { requestDraftReminderEmail } from "../services/geminiClient";
import { sendEmailViaGmail } from "../services/gmailService";
import { getValidGoogleAccessToken, reauthorizeGoogleAccess } from "../services/auth";
import { ConfirmationModal } from "./ConfirmationModal";

interface EmailRemindersProps {
  user: User | null;
  goals: GoalItem[];
  theme?: "dark" | "light";
  settings?: AppSettings;
  defaultNotificationEmail?: string;
  onLoginRequest: () => void;
  onUpdateSettings?: (newSettings: Partial<AppSettings>) => void;
}

export const EmailReminders: React.FC<EmailRemindersProps> = ({
  user,
  goals,
  theme = "dark",
  settings,
  defaultNotificationEmail,
  onLoginRequest,
  onUpdateSettings,
}) => {
  const isLight = theme === "light";
  const targetEmail = user?.email || defaultNotificationEmail || settings?.notificationEmail || "";

  const todayStr = new Date().toISOString().split("T")[0];
  const todayDailyTasks = goals.filter(
    (g) => g.tier === "daily" && (!g.targetDate || g.targetDate === todayStr)
  );
  const pendingDailyTasks = todayDailyTasks.filter((g) => g.status === "pending");
  const isZeroTasksDay = todayDailyTasks.length === 0;
  const unachievedGoals = goals.filter((g) => g.status === "unachieved");

  const [isDrafting, setIsDrafting] = useState(false);
  const [recipient, setRecipient] = useState(targetEmail);
  const [subject, setSubject] = useState("");
  const [bodyText, setBodyText] = useState("");
  const [hasDraft, setHasDraft] = useState(false);
  const [draftType, setDraftType] = useState<"pending" | "free_day">("pending");

  // Confirmation Modal state
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [sendResult, setSendResult] = useState<{ success: boolean; message: string } | null>(null);

  // Sync recipient with user email if changed
  React.useEffect(() => {
    if (user?.email && !recipient) {
      setRecipient(user.email);
    }
  }, [user, recipient]);

  const handleDraftWithAI = async (forceFreeDay = false) => {
    setIsDrafting(true);
    setSendResult(null);
    const zeroDay = forceFreeDay || (isZeroTasksDay && pendingDailyTasks.length === 0);
    setDraftType(zeroDay ? "free_day" : "pending");

    try {
      const draft = await requestDraftReminderEmail({
        userName: user?.displayName || user?.email?.split("@")[0] || "Friend",
        pendingTasks: zeroDay ? [] : pendingDailyTasks,
        unachievedGoals,
        isZeroTasksDay: zeroDay,
      });

      setSubject(draft.subject);
      setBodyText(draft.bodyText);
      setHasDraft(true);
    } catch (err: any) {
      setSendResult({
        success: false,
        message: err.message || "Could not draft reminder email",
      });
    } finally {
      setIsDrafting(false);
    }
  };

  const handleInitiateSend = () => {
    if (!recipient.trim() || !subject.trim() || !bodyText.trim()) {
      return;
    }
    setIsConfirmModalOpen(true);
  };

  const handleConfirmSend = async () => {
    setIsConfirmModalOpen(false);
    setIsSending(true);
    setSendResult(null);

    let token = await getValidGoogleAccessToken();
    if (!token) {
      token = await reauthorizeGoogleAccess();
    }

    if (!token) {
      setSendResult({
        success: false,
        message:
          "Google Workspace authorization token missing or expired. Please sign in with Google to enable Gmail sending.",
      });
      setIsSending(false);
      return;
    }

    const res = await sendEmailViaGmail(token, {
      to: recipient.trim(),
      subject: subject.trim(),
      bodyText: bodyText.trim(),
      bodyHtml: `<div style="font-family: Arial, sans-serif; line-height: 1.6; color: #1e293b; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px;">
        <div style="background-color: #0f172a; padding: 16px 20px; border-radius: 8px; margin-bottom: 20px;">
          <h2 style="color: #10b981; margin: 0; font-size: 18px;">Life & Wealth Accountability Alert</h2>
          <p style="color: #94a3b8; font-size: 12px; margin: 4px 0 0 0;">Automated Check-in</p>
        </div>
        <div style="font-size: 14px; color: #334155; line-height: 1.7; white-space: pre-wrap;">${bodyText}</div>
        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0 16px 0;" />
        <p style="font-size: 11px; color: #94a3b8; text-align: center;">Sent via your Self-Managing Life & Wealth Assistant</p>
      </div>`,
    });

    if (res.success) {
      setSendResult({
        success: true,
        message: `Check-in reminder successfully sent to ${recipient.trim()} (Gmail Message ID: ${res.id})`,
      });
    } else {
      setSendResult({
        success: false,
        message: res.error || "Failed to send email via Gmail API",
      });
    }
    setIsSending(false);
  };

  const cardBg = isLight ? "bg-white border-slate-200 shadow-sm" : "bg-[#141417] border-white/5 shadow-xl";
  const innerCardBg = isLight ? "bg-slate-50 border-slate-200" : "bg-black/20 border-white/5";
  const inputBg = isLight
    ? "bg-white text-slate-900 border-slate-300 placeholder-slate-400 focus:border-indigo-500"
    : "bg-[#0A0A0B] text-white border-white/10 placeholder-slate-600 focus:border-emerald-500";

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className={`rounded-2xl border p-6 ${cardBg}`}>
        <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b ${
          isLight ? "border-slate-200" : "border-white/5"
        }`}>
          <div>
            <div className="flex items-center gap-2">
              <Mail className="w-5 h-5 text-indigo-500" />
              <h2 className={`text-base sm:text-lg font-bold uppercase tracking-wider ${isLight ? "text-slate-900" : "text-white"}`}>
                Gmail Automated Task Reminders
              </h2>
            </div>
            <p className={`text-xs mt-1 max-w-2xl ${isLight ? "text-slate-600" : "text-slate-400"}`}>
              Gemini AI generates daily accountability emails alerting you to pending tasks, missed deadlines, or checking in when no tasks were added (<em>"Are you totally free today?"</em>), sent straight to your inbox via Google Workspace.
            </p>
          </div>

          {!user ? (
            <button
              onClick={onLoginRequest}
              className="px-4 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold rounded-xl shadow-lg shadow-emerald-500/20 transition-all cursor-pointer shrink-0"
            >
              Connect Google Account
            </button>
          ) : (
            <div className={`flex items-center gap-2 text-xs px-3.5 py-2 rounded-xl border shrink-0 ${
              isLight ? "bg-slate-100 border-slate-200 text-slate-700" : "bg-black/40 border-white/5 text-slate-400"
            }`}>
              <UserCheck className="w-4 h-4 text-emerald-500" />
              <span>
                Connected as <strong className={isLight ? "text-slate-900" : "text-white"}>{user.email}</strong>
              </span>
            </div>
          )}
        </div>

        {/* FREE DAY CHECK-IN PROMPT (When 0 tasks added today) */}
        {isZeroTasksDay && (
          <div className={`mt-5 p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
            isLight
              ? "bg-amber-50/80 border-amber-200 text-amber-950"
              : "bg-amber-500/10 border-amber-500/30 text-amber-200"
          }`}>
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-500 shrink-0">
                <Coffee className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="font-bold text-xs uppercase tracking-wider">
                    Zero Daily Tasks Added for Today
                  </h4>
                  <span className="text-2xs font-semibold px-2 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/30 text-amber-600 dark:text-amber-300">
                    Free Day Check-In
                  </span>
                </div>
                <p className="text-xs mt-1 leading-relaxed max-w-xl">
                  You haven't scheduled any tasks for today yet. <strong>Are you totally free today?</strong> Let AI send an email check-in to confirm if today is a scheduled rest day or encourage locking in 1-3 micro commitments.
                </p>
              </div>
            </div>

            <button
              onClick={() => handleDraftWithAI(true)}
              disabled={isDrafting}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold rounded-xl shadow-md shadow-amber-500/20 transition-all disabled:opacity-50 cursor-pointer shrink-0"
            >
              <Sparkles className="w-4 h-4" />
              <span>{isDrafting ? "Drafting Check-in..." : "Draft \"Are You Totally Free?\" Email"}</span>
            </button>
          </div>
        )}

        {/* Status Panels */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-5">
          {/* Pending Tasks Panel */}
          <div className={`p-4 rounded-xl border ${innerCardBg}`}>
            <div className="flex items-center justify-between text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">
              <span>Today's Pending Tasks</span>
              <span className={`px-2.5 py-0.5 rounded-full text-2xs font-mono border ${
                pendingDailyTasks.length > 0
                  ? "bg-amber-500/10 border-amber-500/20 text-amber-500"
                  : "bg-emerald-500/10 border-emerald-500/20 text-emerald-500"
              }`}>
                {pendingDailyTasks.length} pending
              </span>
            </div>
            {pendingDailyTasks.length === 0 ? (
              <p className="text-xs text-slate-500 italic py-1">
                {isZeroTasksDay ? "No tasks were scheduled for today yet." : "All tasks for today are completed!"}
              </p>
            ) : (
              <ul className={`text-xs space-y-1.5 font-sans ${isLight ? "text-slate-700" : "text-slate-300"}`}>
                {pendingDailyTasks.slice(0, 5).map((t) => (
                  <li key={t.id} className="truncate flex items-center gap-2">
                    <Clock className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                    <span>{t.title}</span>
                    {t.targetTime && (
                      <span className="text-2xs font-mono text-slate-400">({t.targetTime})</span>
                    )}
                  </li>
                ))}
                {pendingDailyTasks.length > 5 && (
                  <li className="text-2xs text-slate-500">+{pendingDailyTasks.length - 5} more</li>
                )}
              </ul>
            )}
          </div>

          {/* Unachieved / Missed Goals Panel */}
          <div className={`p-4 rounded-xl border ${innerCardBg}`}>
            <div className="flex items-center justify-between text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">
              <span>Unachieved / Missed Goals</span>
              <span className={`px-2.5 py-0.5 rounded-full text-2xs font-mono border ${
                unachievedGoals.length > 0
                  ? "bg-rose-500/10 border-rose-500/20 text-rose-500"
                  : "bg-emerald-500/10 border-emerald-500/20 text-emerald-500"
              }`}>
                {unachievedGoals.length} missed
              </span>
            </div>
            {unachievedGoals.length === 0 ? (
              <p className="text-xs text-slate-500 italic py-1">No missed goals logged. Great execution momentum!</p>
            ) : (
              <ul className={`text-xs space-y-1.5 font-sans ${isLight ? "text-slate-700" : "text-slate-300"}`}>
                {unachievedGoals.slice(0, 5).map((t) => (
                  <li key={t.id} className="truncate flex items-center gap-2">
                    <AlertCircle className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                    <span>
                      {t.title} <span className="text-2xs text-slate-400">({t.tier})</span>
                    </span>
                  </li>
                ))}
                {unachievedGoals.length > 5 && (
                  <li className="text-2xs text-slate-500">+{unachievedGoals.length - 5} more</li>
                )}
              </ul>
            )}
          </div>
        </div>

        {/* AI Action Triggers */}
        <div className={`mt-5 pt-4 border-t flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
          isLight ? "border-slate-200" : "border-white/5"
        }`}>
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <Sparkles className="w-4 h-4 text-indigo-500 shrink-0" />
            <span>AI drafts concise, high-impact emails based on today's status.</span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => handleDraftWithAI(false)}
              disabled={isDrafting}
              className="flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl shadow-md transition-all disabled:opacity-50 cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>{isDrafting ? "Drafting..." : "Draft Task Reminder"}</span>
            </button>

            <button
              onClick={() => handleDraftWithAI(true)}
              disabled={isDrafting}
              className={`flex items-center justify-center gap-2 px-4 py-2 text-xs font-bold rounded-xl border transition-all disabled:opacity-50 cursor-pointer ${
                isLight
                  ? "bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300"
                  : "bg-white/5 hover:bg-white/10 text-slate-300 border-white/10"
              }`}
            >
              <Coffee className="w-3.5 h-3.5 text-amber-500" />
              <span>Draft "Are You Totally Free?" Check</span>
            </button>
          </div>
        </div>

        {/* Self-Managing Toggle Helper */}
        {settings && onUpdateSettings && (
          <div className={`mt-4 pt-3 border-t flex items-center justify-between gap-4 text-xs ${
            isLight ? "border-slate-200 text-slate-600" : "border-white/5 text-slate-400"
          }`}>
            <label className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.autoRemindIfZeroTasks !== false}
                onChange={(e) => onUpdateSettings({ autoRemindIfZeroTasks: e.target.checked })}
                className="w-4 h-4 accent-indigo-600 rounded"
              />
              <span>Auto-send check-in email (<em>"Are you totally free today?"</em>) when zero tasks are logged</span>
            </label>
            <span className="text-2xs text-slate-500 hidden sm:inline">Runs when opened after {settings.reminderHour ?? 20}:00</span>
          </div>
        )}
      </div>

      {/* Result Notification */}
      {sendResult && (
        <div
          className={`p-4 rounded-xl border flex items-center gap-3 text-xs ${
            sendResult.success
              ? isLight
                ? "bg-emerald-50 border-emerald-200 text-emerald-950"
                : "bg-emerald-500/10 border-emerald-500/20 text-emerald-300"
              : isLight
              ? "bg-rose-50 border-rose-200 text-rose-950"
              : "bg-rose-500/10 border-rose-500/20 text-rose-300"
          }`}
        >
          {sendResult.success ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 text-rose-500 shrink-0" />
          )}
          <span>{sendResult.message}</span>
        </div>
      )}

      {/* Email Preview & Editor */}
      {(hasDraft || subject) && (
        <div className={`rounded-2xl border overflow-hidden ${cardBg}`}>
          <div className={`px-6 py-4 flex items-center justify-between border-b ${
            isLight ? "bg-slate-50 border-slate-200" : "bg-black/20 border-white/5"
          }`}>
            <div className="flex items-center gap-2">
              <Edit3 className="w-4 h-4 text-indigo-500" />
              <h3 className={`font-bold text-sm ${isLight ? "text-slate-900" : "text-white"}`}>
                Review & Send Email
              </h3>
            </div>
            <span className={`text-2xs font-bold px-2.5 py-0.5 rounded-full border ${
              draftType === "free_day"
                ? "bg-amber-500/10 border-amber-500/20 text-amber-600 dark:text-amber-300"
                : "bg-indigo-500/10 border-indigo-500/20 text-indigo-600 dark:text-indigo-300"
            }`}>
              {draftType === "free_day" ? "Free Day Inquiry Draft" : "Task Reminder Draft"}
            </span>
          </div>

          <div className="p-6 space-y-4">
            <div>
              <label className={`block text-xs font-bold uppercase tracking-widest mb-1.5 ${
                isLight ? "text-slate-700" : "text-slate-400"
              }`}>
                Recipient (To:) *
              </label>
              <input
                type="email"
                required
                value={recipient}
                onChange={(e) => setRecipient(e.target.value)}
                placeholder="youremail@gmail.com"
                className={`w-full px-3.5 py-2.5 border rounded-xl text-xs focus:outline-hidden ${inputBg}`}
              />
            </div>

            <div>
              <label className={`block text-xs font-bold uppercase tracking-widest mb-1.5 ${
                isLight ? "text-slate-700" : "text-slate-400"
              }`}>
                Subject *
              </label>
              <input
                type="text"
                required
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className={`w-full px-3.5 py-2.5 border rounded-xl text-xs focus:outline-hidden ${inputBg}`}
              />
            </div>

            <div>
              <label className={`block text-xs font-bold uppercase tracking-widest mb-1.5 ${
                isLight ? "text-slate-700" : "text-slate-400"
              }`}>
                Email Message Body *
              </label>
              <textarea
                rows={8}
                required
                value={bodyText}
                onChange={(e) => setBodyText(e.target.value)}
                className={`w-full px-3.5 py-2.5 border rounded-xl text-xs font-mono leading-relaxed focus:outline-hidden ${inputBg}`}
              />
            </div>

            <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t ${
              isLight ? "border-slate-200" : "border-white/5"
            }`}>
              <span className="text-2xs text-slate-500">
                Sending requires your explicit confirmation before transmission.
              </span>
              <button
                type="button"
                onClick={handleInitiateSend}
                disabled={isSending || !user}
                className="flex items-center justify-center gap-2 px-5 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold rounded-xl shadow-lg shadow-emerald-500/20 transition-all disabled:opacity-50 cursor-pointer shrink-0"
              >
                <Send className="w-4 h-4" />
                <span>{isSending ? "Sending via Gmail..." : "Send Reminder Email"}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Explicit User Confirmation Modal */}
      <ConfirmationModal
        isOpen={isConfirmModalOpen}
        theme={theme}
        title={draftType === "free_day" ? "Send Free Day Check-in Email?" : "Send Task Reminder Email?"}
        message={`You are about to send an email to:\n${recipient}\n\nSubject: "${subject}"\n\nThis will be transmitted securely through your authenticated Google Workspace Gmail account.`}
        confirmText="Send Now"
        cancelText="Review Draft"
        onConfirm={handleConfirmSend}
        onCancel={() => setIsConfirmModalOpen(false)}
      />
    </div>
  );
};
