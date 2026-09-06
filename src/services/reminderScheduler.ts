import { AppData, AppSettings, GoalItem, WeeklyReviewRecord } from "../types";
import { getValidGoogleAccessToken } from "./auth";
import {
  requestDraftReminderEmail,
  requestWeeklyReview,
  requestQuickBrief,
} from "./geminiClient";
import { sendEmailViaGmail } from "./gmailService";

/** Local YYYY-MM-DD (not UTC — reminders are keyed to the user's day). */
export const localDateStr = (d = new Date()): string => {
  const off = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - off).toISOString().split("T")[0];
};

/** ISO-8601 week identifier, e.g. "2026-W36". */
export const isoWeekId = (d = new Date()): string => {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
};

export interface AutomationResult {
  settingsPatch?: Partial<AppSettings>;
  newReview?: WeeklyReviewRecord;
  notices: string[];
}

const pendingDailyTasks = (goals: GoalItem[], today: string): GoalItem[] =>
  goals.filter(
    (g) =>
      g.tier === "daily" &&
      g.status !== "completed" &&
      (!g.targetDate || g.targetDate <= today)
  );

/**
 * Runs any automation that is *due* right now. Pure-ish: it performs the network
 * side effects (email / Gemini) but returns the state changes for the caller to
 * persist, so it never fights the app's debounced Drive sync.
 */
export const runDueAutomations = async (
  appData: AppData,
  userName: string,
  userEmail: string | null
): Promise<AutomationResult> => {
  const s = appData.settings;
  const now = new Date();
  const today = localDateStr(now);
  const result: AutomationResult = { notices: [] };
  const settingsPatch: Partial<AppSettings> = {};

  // --- 1. Daily unfinished-task reminder email -----------------------------
  if (s.autoReminderEnabled && s.lastAutoReminderDate !== today) {
    const hourOk = now.getHours() >= (s.reminderHour ?? 20);
    const pending = pendingDailyTasks(appData.goals, today);
    const recipient = (s.notificationEmail || userEmail || "").trim();

    if (hourOk && pending.length > 0 && recipient) {
      const token = await getValidGoogleAccessToken();
      if (!token) {
        result.notices.push(
          "Auto daily reminder is due, but Google access expired — sign in again to send it."
        );
      } else {
        try {
          const unachieved = appData.goals.filter((g) => g.status === "unachieved");
          const draft = await requestDraftReminderEmail({
            userName,
            pendingTasks: pending,
            unachievedGoals: unachieved,
          });
          const send = await sendEmailViaGmail(token, {
            to: recipient,
            subject: draft.subject,
            bodyText: draft.bodyText,
            bodyHtml: draft.bodyHtml,
          });
          if (send.success) {
            settingsPatch.lastAutoReminderDate = today;
            result.notices.push(
              `Auto reminder emailed to ${recipient} — ${pending.length} task(s) still pending today.`
            );
          } else {
            result.notices.push(`Auto reminder failed to send: ${send.error}`);
          }
        } catch (err: any) {
          result.notices.push(`Auto reminder error: ${err.message || err}`);
        }
      }
    } else if (hourOk && pending.length === 0) {
      // Check if user had 0 daily tasks logged at all today!
      const allDailyToday = appData.goals.filter(
        (g) => g.tier === "daily" && (!g.targetDate || g.targetDate === today)
      );

      if (
        allDailyToday.length === 0 &&
        s.autoRemindIfZeroTasks !== false &&
        s.lastZeroTasksPromptDate !== today &&
        recipient
      ) {
        const token = await getValidGoogleAccessToken();
        if (token) {
          try {
            const draft = await requestDraftReminderEmail({
              userName,
              pendingTasks: [],
              unachievedGoals: [],
              isZeroTasksDay: true,
            });
            const send = await sendEmailViaGmail(token, {
              to: recipient,
              subject: draft.subject,
              bodyText: draft.bodyText,
              bodyHtml: draft.bodyHtml,
            });
            if (send.success) {
              settingsPatch.lastZeroTasksPromptDate = today;
              settingsPatch.lastAutoReminderDate = today;
              result.notices.push(`Sent accountability email: "Are you totally free today?" to ${recipient}.`);
            }
          } catch (err: any) {
            console.warn("Zero task check-in error:", err);
          }
        }
      } else {
        // Nothing pending — record the date so we don't re-check all evening.
        settingsPatch.lastAutoReminderDate = today;
      }
    }
  }

  // --- 2. Weekend AI financial review ------------------------------------
  const weekId = isoWeekId(now);
  const isWeekend = now.getDay() === 0 || now.getDay() === 6;
  if (
    s.autoWeekendReviewEnabled &&
    isWeekend &&
    s.lastAutoWeekendReviewWeek !== weekId
  ) {
    const weekAgo = new Date(now.getTime() - 7 * 86400000);
    const weekExpenses = appData.expenses.filter((e) => new Date(e.date) >= weekAgo);
    const weekEarnings = appData.earnings.filter((e) => new Date(e.date) >= weekAgo);

    if (weekExpenses.length > 0 || weekEarnings.length > 0) {
      try {
        const totalEarned = weekEarnings.reduce((sum, e) => sum + e.amount, 0);
        const tithePct = s.defaultTithePercentage ?? s.defaultTithePercent ?? 10;
        const tithe = appData.titheRecords.find(
          (t) => new Date(t.weekEndDate) >= weekAgo
        );
        const reviewText = await requestWeeklyReview({
          expenses: weekExpenses,
          earnings: weekEarnings,
          weekInfo: `${localDateStr(weekAgo)} to ${today} (auto)`,
          titheStatus: {
            totalEarned,
            titheDue: (totalEarned * tithePct) / 100,
            tithePaid: tithe?.tithePaid || 0,
            isPaid: tithe?.isPaid || false,
          },
        });
        result.newReview = {
          id: `review-auto-${Date.now()}`,
          weekIdentifier: `Week ${weekId} (auto)`,
          weekStartDate: localDateStr(weekAgo),
          weekEndDate: today,
          reviewContent: reviewText,
          generatedAt: new Date().toISOString(),
        };
        settingsPatch.lastAutoWeekendReviewWeek = weekId;

        // Auto-push to email if configured
        const recipient = (s.notificationEmail || userEmail || "").trim();
        const token = await getValidGoogleAccessToken();
        if (s.autoEmailAiReviews !== false && recipient && token) {
          await sendEmailViaGmail(token, {
            to: recipient,
            subject: `📊 Direct AI Weekly Review (${today})`,
            bodyText: reviewText,
            bodyHtml: `<div style="font-family: Arial, sans-serif; line-height: 1.6; color: #1e293b; max-width: 600px; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
              <h2 style="color: #4f46e5; margin-top: 0; font-size: 18px;">Direct AI Financial Review</h2>
              <pre style="font-family: inherit; white-space: pre-wrap; font-size: 14px; background: #f8fafc; padding: 12px; border-radius: 6px;">${reviewText}</pre>
              <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 16px 0;" />
              <p style="font-size: 11px; color: #64748b;">Automated Direct AI Brief • Ethos Finance</p>
            </div>`,
          });
          result.notices.push(`Weekend AI review generated & emailed directly to ${recipient}.`);
        } else {
          result.notices.push("Weekend AI financial review generated automatically.");
        }
      } catch (err: any) {
        result.notices.push(`Auto weekend review error: ${err.message || err}`);
      }
    } else {
      settingsPatch.lastAutoWeekendReviewWeek = weekId;
    }
  }

  if (Object.keys(settingsPatch).length > 0) result.settingsPatch = settingsPatch;
  return result;
};

/**
 * Trigger an instant Direct & Short Executive Progress Brief (combining finances + tasks)
 * and push it directly to the user's Gmail inbox.
 */
export const triggerExecutiveBriefAndEmail = async (
  appData: AppData,
  userName: string,
  userEmail: string,
  token: string
): Promise<{ success: boolean; brief: string; emailSent: boolean; error?: string }> => {
  const totalEarnings = appData.earnings.reduce((sum, e) => sum + e.amount, 0);
  const totalExpenses = appData.expenses.reduce((sum, e) => sum + e.amount, 0);
  const tithePaid = appData.titheRecords.reduce((sum, t) => sum + (t.tithePaid || 0), 0);
  const tithePct = appData.settings.defaultTithePercentage ?? appData.settings.defaultTithePercent ?? 10;
  const titheDue = (totalEarnings * tithePct) / 100;
  const totalInvested = appData.investments.reduce((sum, i) => sum + i.amount, 0);

  const dailyGoals = appData.goals.filter((g) => g.tier === "daily");
  const pendingDailyCount = dailyGoals.filter((g) => g.status !== "completed").length;
  const completedDailyCount = dailyGoals.filter((g) => g.status === "completed").length;
  const unachievedCount = appData.goals.filter((g) => g.status === "unachieved").length;

  try {
    const brief = await requestQuickBrief({
      userName,
      financialSummary: {
        totalEarnings,
        totalExpenses,
        tithePaid,
        titheDue,
        totalInvested,
      },
      goalSummary: {
        totalGoals: appData.goals.length,
        pendingDailyCount,
        completedDailyCount,
        unachievedCount,
      },
    });

    let emailSent = false;
    if (userEmail && token) {
      const emailRes = await sendEmailViaGmail(token, {
        to: userEmail,
        subject: `⚡ Direct AI Brief: Finances & Tasks (${localDateStr()})`,
        bodyText: brief,
        bodyHtml: `<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.5; color: #1e293b; max-width: 580px; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background: #ffffff;">
          <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 16px;">
            <div style="background: #4f46e5; color: white; width: 28px; height: 28px; border-radius: 6px; display: inline-flex; align-items: center; justify-content: center; font-weight: bold; text-align: center; line-height: 28px;">⚡</div>
            <h2 style="color: #0f172a; margin: 0; font-size: 18px; font-weight: 700;">Executive Progress Brief</h2>
          </div>
          <p style="font-size: 12px; color: #64748b; margin-top: 0;">Direct & Short AI Brief for <strong>${userName}</strong></p>
          <div style="background: #f8fafc; border-left: 3px solid #4f46e5; padding: 14px 18px; border-radius: 0 8px 8px 0; margin: 16px 0;">
            <pre style="font-family: inherit; white-space: pre-wrap; margin: 0; font-size: 13.5px; line-height: 1.6; color: #334155;">${brief}</pre>
          </div>
          <div style="margin-top: 20px; padding-top: 14px; border-top: 1px solid #f1f5f9; display: flex; justify-content: space-between; font-size: 11px; color: #94a3b8;">
            <span>Ethos Finance • Self-Managing Personal Finance</span>
            <span>${new Date().toLocaleDateString()}</span>
          </div>
        </div>`,
      });
      emailSent = emailRes.success;
    }

    return { success: true, brief, emailSent };
  } catch (err: any) {
    console.error("triggerExecutiveBriefAndEmail error:", err);
    return {
      success: false,
      brief: "Failed to generate AI brief.",
      emailSent: false,
      error: err.message || "Failed to generate brief",
    };
  }
};

/**
 * Manually trigger the "Are you totally free today?" check-in email on-demand.
 */
export const triggerZeroTaskCheckInEmail = async (
  userName: string,
  userEmail: string,
  token: string
): Promise<{ success: boolean; subject?: string; bodyText?: string; error?: string }> => {
  try {
    const draft = await requestDraftReminderEmail({
      userName,
      pendingTasks: [],
      unachievedGoals: [],
      isZeroTasksDay: true,
    });

    const sendRes = await sendEmailViaGmail(token, {
      to: userEmail,
      subject: draft.subject,
      bodyText: draft.bodyText,
      bodyHtml: draft.bodyHtml,
    });

    if (sendRes.success) {
      return { success: true, subject: draft.subject, bodyText: draft.bodyText };
    } else {
      return { success: false, error: sendRes.error };
    }
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to send zero tasks email" };
  }
};

