import { AppData, AppSettings, GoalItem, WeeklyReviewRecord } from "../types";
import { getValidGoogleAccessToken } from "./auth";
import { requestDraftReminderEmail, requestWeeklyReview } from "./geminiClient";
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
      // Nothing pending — record the date so we don't re-check all evening.
      settingsPatch.lastAutoReminderDate = today;
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
        result.notices.push("Weekend AI financial review generated automatically.");
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
