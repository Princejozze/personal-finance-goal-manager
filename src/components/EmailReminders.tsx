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
} from "lucide-react";
import { User } from "firebase/auth";
import { GoalItem } from "../types";
import { requestDraftReminderEmail } from "../services/geminiClient";
import { sendEmailViaGmail } from "../services/gmailService";
import { getCachedGoogleAccessToken } from "../services/auth";
import { ConfirmationModal } from "./ConfirmationModal";

interface EmailRemindersProps {
  user: User | null;
  goals: GoalItem[];
  defaultNotificationEmail?: string;
  onLoginRequest: () => void;
}

export const EmailReminders: React.FC<EmailRemindersProps> = ({
  user,
  goals,
  defaultNotificationEmail,
  onLoginRequest,
}) => {
  const targetEmail = user?.email || defaultNotificationEmail || "";

  const pendingDailyTasks = goals.filter(
    (g) => g.tier === "daily" && g.status === "pending"
  );
  const unachievedGoals = goals.filter((g) => g.status === "unachieved");

  const [isDrafting, setIsDrafting] = useState(false);
  const [recipient, setRecipient] = useState(targetEmail);
  const [subject, setSubject] = useState("");
  const [bodyText, setBodyText] = useState("");
  const [hasDraft, setHasDraft] = useState(false);

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

  const handleDraftWithAI = async () => {
    setIsDrafting(true);
    setSendResult(null);
    try {
      const draft = await requestDraftReminderEmail({
        userName: user?.displayName || user?.email?.split("@")[0] || "Friend",
        pendingTasks: pendingDailyTasks,
        unachievedGoals,
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

    const token = getCachedGoogleAccessToken();
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
      bodyHtml: `<div style="font-family: Arial, sans-serif; line-height: 1.6; color: #1e293b;">
        <h2 style="color: #059669;">Daily Life & Wealth Reminder</h2>
        <pre style="font-family: inherit; white-space: pre-wrap;">${bodyText}</pre>
        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
        <p style="font-size: 12px; color: #64748b;">Sent via your Self-Managing Life & Wealth Assistant</p>
      </div>`,
    });

    if (res.success) {
      setSendResult({
        success: true,
        message: `Reminder successfully sent to ${recipient.trim()} (Gmail Message ID: ${res.id})`,
      });
    } else {
      setSendResult({
        success: false,
        message: res.error || "Failed to send email via Gmail API",
      });
    }
    setIsSending(false);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-[#141417] rounded-2xl border border-white/5 shadow-xl p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-white/5">
          <div>
            <div className="flex items-center gap-2">
              <Mail className="w-5 h-5 text-indigo-400" />
              <h2 className="text-base sm:text-lg font-bold text-white uppercase tracking-wider">
                Gmail Automated Task Reminders
              </h2>
            </div>
            <p className="text-xs text-slate-400 mt-1 max-w-2xl">
              Gemini AI generates daily accountability emails alerting you to unachieved goals and
              pending daily tasks, delivered directly to your inbox via Google Workspace.
            </p>
          </div>

          {!user ? (
            <button
              onClick={onLoginRequest}
              className="px-4 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold rounded-xl shadow-lg shadow-emerald-500/20 transition-all"
            >
              Connect Google Account
            </button>
          ) : (
            <div className="flex items-center gap-2 text-xs text-slate-400 bg-black/40 px-3.5 py-2 rounded-xl border border-white/5">
              <UserCheck className="w-4 h-4 text-emerald-400" />
              <span>
                Connected as <strong className="text-white">{user.email}</strong>
              </span>
            </div>
          )}
        </div>

        {/* Pending Tasks Overview */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
          <div className="p-4 bg-black/20 rounded-xl border border-white/5">
            <div className="flex items-center justify-between text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">
              <span>Pending Daily Tasks</span>
              <span className="px-2.5 py-0.5 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-full text-2xs font-mono">
                {pendingDailyTasks.length} pending
              </span>
            </div>
            {pendingDailyTasks.length === 0 ? (
              <p className="text-xs text-slate-500 italic">No daily tasks currently pending!</p>
            ) : (
              <ul className="text-xs text-slate-400 space-y-1.5 font-sans">
                {pendingDailyTasks.slice(0, 5).map((t) => (
                  <li key={t.id} className="truncate flex items-center gap-2">
                    <Clock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    <span>{t.title}</span>
                  </li>
                ))}
                {pendingDailyTasks.length > 5 && (
                  <li className="text-2xs text-slate-500">+{pendingDailyTasks.length - 5} more</li>
                )}
              </ul>
            )}
          </div>

          <div className="p-4 bg-black/20 rounded-xl border border-white/5">
            <div className="flex items-center justify-between text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">
              <span>Unachieved / Missed Goals</span>
              <span className="px-2.5 py-0.5 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-full text-2xs font-mono">
                {unachievedGoals.length} missed
              </span>
            </div>
            {unachievedGoals.length === 0 ? (
              <p className="text-xs text-slate-500 italic">No missed goals logged. Great momentum!</p>
            ) : (
              <ul className="text-xs text-slate-400 space-y-1.5 font-sans">
                {unachievedGoals.slice(0, 5).map((t) => (
                  <li key={t.id} className="truncate flex items-center gap-2">
                    <AlertCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                    <span>
                      {t.title} ({t.tier})
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

        {/* AI Draft Trigger */}
        <div className="mt-5 pt-4 border-t border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <p className="text-xs text-slate-400">
            Click to let Gemini compose an actionable, motivational reminder.
          </p>
          <button
            onClick={handleDraftWithAI}
            disabled={isDrafting}
            className="flex items-center justify-center gap-2 px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 text-xs font-bold rounded-xl shadow-lg shadow-emerald-500/20 transition-all disabled:opacity-50 shrink-0"
          >
            <Sparkles className="w-4 h-4" />
            <span>{isDrafting ? "Drafting Reminder..." : "Draft Email with AI"}</span>
          </button>
        </div>
      </div>

      {/* Result Notification */}
      {sendResult && (
        <div
          className={`p-4 rounded-xl border flex items-center gap-3 text-xs ${
            sendResult.success
              ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-300"
              : "bg-rose-500/10 border-rose-500/20 text-rose-300"
          }`}
        >
          {sendResult.success ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
          )}
          <span>{sendResult.message}</span>
        </div>
      )}

      {/* Email Preview & Editor */}
      {(hasDraft || subject) && (
        <div className="bg-[#141417] rounded-2xl border border-white/5 shadow-xl overflow-hidden">
          <div className="border-b border-white/5 bg-black/20 px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Edit3 className="w-4 h-4 text-indigo-400" />
              <h3 className="font-bold text-white text-sm">Review & Send Email</h3>
            </div>
            <span className="text-2xs font-bold px-2.5 py-0.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300">
              Draft Preview
            </span>
          </div>

          <div className="p-6 space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1.5">
                Recipient (To:) *
              </label>
              <input
                type="email"
                required
                value={recipient}
                onChange={(e) => setRecipient(e.target.value)}
                placeholder="youremail@gmail.com"
                className="w-full px-3.5 py-2.5 border border-white/10 rounded-xl bg-[#0A0A0B] text-white placeholder-slate-600 text-xs focus:outline-hidden focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1.5">Subject *</label>
              <input
                type="text"
                required
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full px-3.5 py-2.5 border border-white/10 rounded-xl bg-[#0A0A0B] text-white placeholder-slate-600 text-xs focus:outline-hidden focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1.5">
                Email Message Body *
              </label>
              <textarea
                rows={8}
                required
                value={bodyText}
                onChange={(e) => setBodyText(e.target.value)}
                className="w-full px-3.5 py-2.5 border border-white/10 rounded-xl bg-[#0A0A0B] text-white text-xs font-mono leading-relaxed focus:outline-hidden focus:border-emerald-500"
              />
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-white/5">
              <span className="text-2xs text-slate-500">
                Sending requires your explicit confirmation before transmission.
              </span>
              <button
                type="button"
                onClick={handleInitiateSend}
                disabled={isSending || !user}
                className="flex items-center justify-center gap-2 px-5 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold rounded-xl shadow-lg shadow-emerald-500/20 transition-all disabled:opacity-50 shrink-0"
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
        title="Send Task Reminder Email?"
        message={`You are about to send an email to:\n${recipient}\n\nSubject: "${subject}"\n\nThis will be transmitted securely through your authenticated Google Workspace Gmail account.`}
        confirmText="Send Now"
        cancelText="Review Draft"
        onConfirm={handleConfirmSend}
        onCancel={() => setIsConfirmModalOpen(false)}
      />
    </div>
  );
};
