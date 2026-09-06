/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useCallback } from "react";
import { User } from "firebase/auth";
import {
  AppData,
  Expense,
  Earning,
  TitheRecord,
  InvestmentRecord,
  GoalItem,
  WeeklyReviewRecord,
  UserSettings,
} from "./types";
import {
  signInWithGoogle,
  signOutFromGoogle,
  subscribeToAuthChanges,
  getValidGoogleAccessToken,
} from "./services/auth";
import {
  loadFromGoogleDrive,
  saveToGoogleDrive,
  loadLocalAppData,
  saveLocalAppData,
  getInitialDefaultData,
  SyncStatus,
} from "./services/driveStorage";
import { runDueAutomations } from "./services/reminderScheduler";
import { Header } from "./components/Header";
import { DailyMoneyTracker } from "./components/DailyMoneyTracker";
import { TitheAndInvestment } from "./components/TitheAndInvestment";
import { WeekendReview } from "./components/WeekendReview";
import { GoalHierarchy } from "./components/GoalHierarchy";
import { EmailReminders } from "./components/EmailReminders";
import { SettingsView } from "./components/SettingsView";

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>({ state: "idle" });
  const [activeTab, setActiveTab] = useState<
    "finances" | "tithe" | "weekend_review" | "goals" | "reminders" | "settings"
  >("finances");

  const [appData, setAppData] = useState<AppData>(() => loadLocalAppData());
  const [notice, setNotice] = useState<string | null>(null);

  const isInitialMount = useRef(true);
  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Always-current snapshot of appData for use inside async callbacks/timers.
  const appDataRef = useRef(appData);
  useEffect(() => {
    appDataRef.current = appData;
  }, [appData]);

  // Push local data up to Drive (acquires/refreshes the token itself).
  const performDriveSync = useCallback(async (dataToSave: AppData) => {
    const token = await getValidGoogleAccessToken();
    if (!token) {
      setSyncStatus({ state: "error", errorMessage: "Google session expired — sign in again." });
      return;
    }
    setSyncStatus({ state: "syncing" });
    const result = await saveToGoogleDrive(token, dataToSave);
    setSyncStatus(
      result.success
        ? { state: "synced", lastSyncedAt: new Date().toLocaleTimeString() }
        : { state: "error", errorMessage: result.error }
    );
  }, []);

  const hydrateFromDrive = useCallback(async () => {
    const token = await getValidGoogleAccessToken();
    if (!token) return;
    setSyncStatus({ state: "syncing" });
    const driveData = await loadFromGoogleDrive(token);
    if (driveData) {
      setAppData(driveData);
      saveLocalAppData(driveData);
      setSyncStatus({ state: "synced", lastSyncedAt: new Date().toLocaleTimeString() });
    } else {
      // No file yet — seed Drive with whatever we have locally.
      await performDriveSync(appDataRef.current);
    }
  }, [performDriveSync]);

  // Listen to Firebase Auth state (persists across reloads / devices).
  useEffect(() => {
    const unsubscribe = subscribeToAuthChanges(async (currentUser) => {
      setUser(currentUser);
      if (currentUser) await hydrateFromDrive();
      else setSyncStatus({ state: "idle" });
    });
    return () => unsubscribe();
  }, [hydrateFromDrive]);

  // Autosave locally immediately; debounce a Drive push.
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    saveLocalAppData(appData);

    if (user) {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
      autoSaveTimerRef.current = setTimeout(() => {
        performDriveSync(appDataRef.current);
      }, 1500);
    }
    return () => {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    };
  }, [appData, user, performDriveSync]);

  // Auth Handlers
  const handleLogin = async () => {
    setIsLoggingIn(true);
    try {
      const { user: authedUser } = await signInWithGoogle();
      setUser(authedUser);
      await hydrateFromDrive();
    } catch (err: any) {
      console.error("Login failure:", err);
      alert(`Sign in error: ${err.message || "Failed to authenticate"}`);
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    await signOutFromGoogle();
    setUser(null);
    setSyncStatus({ state: "idle" });
  };

  const handleManualSync = async () => {
    if (!user) {
      handleLogin();
      return;
    }
    await performDriveSync(appDataRef.current);
  };

  // Data Mutation Handlers
  const handleAddExpense = (newExp: Omit<Expense, "id" | "createdAt">) => {
    const expenseItem: Expense = {
      ...newExp,
      id: `exp-${Date.now()}`,
      createdAt: new Date().toISOString(),
    };
    setAppData((prev) => ({
      ...prev,
      lastUpdated: new Date().toISOString(),
      expenses: [expenseItem, ...prev.expenses],
    }));
  };

  const handleDeleteExpense = (id: string) => {
    setAppData((prev) => ({
      ...prev,
      lastUpdated: new Date().toISOString(),
      expenses: prev.expenses.filter((e) => e.id !== id),
    }));
  };

  const handleAddEarning = (newEarn: Omit<Earning, "id" | "createdAt">) => {
    const earningItem: Earning = {
      ...newEarn,
      id: `earn-${Date.now()}`,
      createdAt: new Date().toISOString(),
    };
    setAppData((prev) => ({
      ...prev,
      lastUpdated: new Date().toISOString(),
      earnings: [earningItem, ...prev.earnings],
    }));
  };

  const handleDeleteEarning = (id: string) => {
    setAppData((prev) => ({
      ...prev,
      lastUpdated: new Date().toISOString(),
      earnings: prev.earnings.filter((e) => e.id !== id),
    }));
  };

  const handleSaveTitheRecord = (tithe: TitheRecord) => {
    setAppData((prev) => {
      const existingIdx = prev.titheRecords.findIndex((t) => t.id === tithe.id);
      let updated: TitheRecord[];
      if (existingIdx >= 0) {
        updated = [...prev.titheRecords];
        updated[existingIdx] = tithe;
      } else {
        updated = [tithe, ...prev.titheRecords];
      }
      return {
        ...prev,
        lastUpdated: new Date().toISOString(),
        titheRecords: updated,
      };
    });
  };

  const handleAddInvestment = (inv: Omit<InvestmentRecord, "id" | "createdAt">) => {
    const invItem: InvestmentRecord = {
      ...inv,
      id: `inv-${Date.now()}`,
      createdAt: new Date().toISOString(),
    };
    setAppData((prev) => ({
      ...prev,
      lastUpdated: new Date().toISOString(),
      investments: [invItem, ...prev.investments],
    }));
  };

  const handleDeleteInvestment = (id: string) => {
    setAppData((prev) => ({
      ...prev,
      lastUpdated: new Date().toISOString(),
      investments: prev.investments.filter((i) => i.id !== id),
    }));
  };

  const handleSaveWeeklyReview = (rev: WeeklyReviewRecord) => {
    setAppData((prev) => ({
      ...prev,
      lastUpdated: new Date().toISOString(),
      weeklyReviews: [rev, ...prev.weeklyReviews],
    }));
  };

  const handleAddGoal = (goal: Omit<GoalItem, "id" | "createdAt">) => {
    const item: GoalItem = {
      ...goal,
      id: `goal-${Date.now()}`,
      createdAt: new Date().toISOString(),
    };
    setAppData((prev) => ({
      ...prev,
      lastUpdated: new Date().toISOString(),
      goals: [item, ...prev.goals],
    }));
  };

  const handleUpdateGoalStatus = (
    goalId: string,
    status: GoalItem["status"],
    reasonCategory?: any,
    reasonDetails?: string,
    aiPivots?: string
  ) => {
    setAppData((prev) => ({
      ...prev,
      lastUpdated: new Date().toISOString(),
      goals: prev.goals.map((g) =>
        g.id === goalId
          ? {
              ...g,
              status,
              missedReasonCategory: reasonCategory ?? g.missedReasonCategory,
              missedReasonDetails: reasonDetails ?? g.missedReasonDetails,
              aiSuggestedPivots: aiPivots ?? g.aiSuggestedPivots,
            }
          : g
      ),
    }));
  };

  const handleDeleteGoal = (goalId: string) => {
    setAppData((prev) => ({
      ...prev,
      lastUpdated: new Date().toISOString(),
      goals: prev.goals.filter((g) => g.id !== goalId),
    }));
  };

  const handleUpdateSettings = (newSettings: Partial<UserSettings>) => {
    setAppData((prev) => ({
      ...prev,
      lastUpdated: new Date().toISOString(),
      settings: {
        ...prev.settings,
        ...newSettings,
      },
    }));
  };

  const handleImportData = (importedData: AppData) => {
    setAppData(importedData);
    saveLocalAppData(importedData);
    if (user) performDriveSync(importedData);
  };

  const handleClearAllData = () => {
    const freshData = getInitialDefaultData();
    setAppData(freshData);
    saveLocalAppData(freshData);
    if (user) performDriveSync(freshData);
  };

  // --- Self-managing automations (run when opened; re-check periodically) ---
  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    const tick = async () => {
      const data = appDataRef.current;
      if (!data.settings.autoReminderEnabled && !data.settings.autoWeekendReviewEnabled) {
        return;
      }
      const res = await runDueAutomations(
        data,
        user.displayName || user.email?.split("@")[0] || "Friend",
        user.email
      );
      if (cancelled) return;
      if (res.settingsPatch) handleUpdateSettings(res.settingsPatch);
      if (res.newReview) handleSaveWeeklyReview(res.newReview);
      if (res.notices.length) setNotice(res.notices.join(" • "));
    };

    const startup = setTimeout(tick, 4000); // let Drive hydration settle first
    const interval = setInterval(tick, 15 * 60 * 1000);
    return () => {
      cancelled = true;
      clearTimeout(startup);
      clearInterval(interval);
    };
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  const currency = appData.settings.currencySymbol || "$";
  const defaultTithe = appData.settings.defaultTithePercentage ?? 10;

  return (
    <div className="min-h-screen bg-[#0A0A0B] flex flex-col font-sans text-slate-200 selection:bg-indigo-500/30">
      {/* Navigation and Sync Header */}
      <Header
        user={user}
        syncStatus={syncStatus}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onLogin={handleLogin}
        onLogout={handleLogout}
        onSyncDrive={handleManualSync}
        isLoggingIn={isLoggingIn}
      />

      {/* Automation / status notice */}
      {notice && (
        <div className="max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 pt-4">
          <div className="flex items-start justify-between gap-3 rounded-xl border border-indigo-500/20 bg-indigo-500/10 px-4 py-2.5 text-xs text-indigo-200">
            <span>{notice}</span>
            <button
              onClick={() => setNotice(null)}
              className="text-indigo-300 hover:text-white font-bold shrink-0"
              aria-label="Dismiss"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Main View Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {activeTab === "finances" && (
          <DailyMoneyTracker
            expenses={appData.expenses}
            earnings={appData.earnings}
            currency={currency}
            onAddExpense={handleAddExpense}
            onAddEarning={handleAddEarning}
            onDeleteExpense={handleDeleteExpense}
            onDeleteEarning={handleDeleteEarning}
          />
        )}

        {activeTab === "tithe" && (
          <TitheAndInvestment
            earnings={appData.earnings}
            expenses={appData.expenses}
            titheRecords={appData.titheRecords}
            investments={appData.investments}
            currency={currency}
            defaultTithePercent={defaultTithe}
            onSaveTitheRecord={handleSaveTitheRecord}
            onAddInvestment={handleAddInvestment}
            onDeleteInvestment={handleDeleteInvestment}
          />
        )}

        {activeTab === "weekend_review" && (
          <WeekendReview
            expenses={appData.expenses}
            earnings={appData.earnings}
            titheRecords={appData.titheRecords}
            weeklyReviews={appData.weeklyReviews}
            currency={currency}
            defaultTithePercent={defaultTithe}
            onSaveReview={handleSaveWeeklyReview}
          />
        )}

        {activeTab === "goals" && (
          <GoalHierarchy
            goals={appData.goals}
            onAddGoal={handleAddGoal}
            onUpdateGoalStatus={handleUpdateGoalStatus}
            onDeleteGoal={handleDeleteGoal}
          />
        )}

        {activeTab === "reminders" && (
          <EmailReminders
            user={user}
            goals={appData.goals}
            defaultNotificationEmail={appData.settings.notificationEmail}
            onLoginRequest={handleLogin}
          />
        )}

        {activeTab === "settings" && (
          <SettingsView
            settings={appData.settings}
            appData={appData}
            onUpdateSettings={handleUpdateSettings}
            onImportData={handleImportData}
            onClearAllData={handleClearAllData}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-white/5 bg-[#0F0F12] py-4 px-6 text-center text-xs text-slate-400">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>
            Self-Managing Life & Wealth Assistant • Synchronized with Google Drive & Gmail API
          </span>
          <span className="text-2xs text-slate-500">
            Powered by Gemini 3.8 Flash Intelligence Engine
          </span>
        </div>
      </footer>
    </div>
  );
}
