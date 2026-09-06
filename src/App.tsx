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
  getCachedGoogleAccessToken,
} from "./services/auth";
import {
  loadFromGoogleDrive,
  saveToGoogleDrive,
  loadLocalAppData,
  saveLocalAppData,
  SyncStatus,
} from "./services/driveStorage";
import { Header } from "./components/Header";
import { DailyMoneyTracker } from "./components/DailyMoneyTracker";
import { TitheAndInvestment } from "./components/TitheAndInvestment";
import { WeekendReview } from "./components/WeekendReview";
import { GoalHierarchy } from "./components/GoalHierarchy";
import { EmailReminders } from "./components/EmailReminders";
import { SettingsView } from "./components/SettingsView";

const INITIAL_SAMPLE_DATA: AppData = {
  version: 1,
  lastModified: new Date().toISOString(),
  lastUpdated: new Date().toISOString(),
  expenses: [
    {
      id: "exp-1",
      amount: 45.0,
      date: new Date().toISOString().split("T")[0],
      purpose: "Weekly groceries & fresh produce",
      category: "Food & Dining",
      necessityRating: "Essential",
      createdAt: new Date().toISOString(),
    },
    {
      id: "exp-2",
      amount: 14.5,
      date: new Date().toISOString().split("T")[0],
      purpose: "Afternoon premium latte and pastry",
      category: "Food & Dining",
      necessityRating: "Discretionary",
      notes: "Impulse coffee break",
      createdAt: new Date().toISOString(),
    },
  ],
  earnings: [
    {
      id: "earn-1",
      amount: 850.0,
      date: new Date().toISOString().split("T")[0],
      source: "Acme Software Corp",
      jobDescription: "Shipped React dashboard components and cloud integration tests",
      category: "Freelance / Contract",
      createdAt: new Date().toISOString(),
    },
  ],
  titheRecords: [],
  investments: [],
  goals: [
    {
      id: "goal-yr-1",
      title: "Build $20,000 Liquid Investment & Family Emergency Fortress",
      tier: "yearly",
      targetDate: "2026-12-31",
      status: "pending",
      description: "Disciplined saving and low-cost ETF investing with faithful tithe stewardship",
      createdAt: new Date().toISOString(),
    },
    {
      id: "goal-mo-1",
      parentId: "goal-yr-1",
      title: "Save & Invest $1,600 this month",
      tier: "monthly",
      targetDate: "2026-09-30",
      status: "pending",
      description: "Allocate weekly surplus into index funds",
      createdAt: new Date().toISOString(),
    },
    {
      id: "goal-wk-1",
      parentId: "goal-mo-1",
      title: "Deliver client software milestone & audit all weekly expenses",
      tier: "weekly",
      targetDate: "2026-09-12",
      status: "pending",
      description: "Hit earning target of $1,000+ while keeping wasteful expenses under $30",
      createdAt: new Date().toISOString(),
    },
    {
      id: "goal-day-1",
      parentId: "goal-wk-1",
      title: "Complete API endpoint test suite and log all today's spending",
      tier: "daily",
      targetDate: new Date().toISOString().split("T")[0],
      status: "pending",
      createdAt: new Date().toISOString(),
    },
  ],
  weeklyReviews: [],
  settings: {
    currency: "$",
    currencySymbol: "$",
    defaultTithePercent: 10,
    defaultTithePercentage: 10,
    reminderEmail: "",
    notificationEmail: "",
    autoSyncDrive: true,
  },
};

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>({ state: "idle" });
  const [activeTab, setActiveTab] = useState<
    "finances" | "tithe" | "weekend_review" | "goals" | "reminders" | "settings"
  >("finances");

  const [appData, setAppData] = useState<AppData>(() => {
    const cached = loadLocalAppData();
    if (
      cached &&
      (cached.expenses.length > 0 ||
        cached.earnings.length > 0 ||
        cached.goals.length > 0)
    ) {
      return cached;
    }
    return INITIAL_SAMPLE_DATA;
  });

  const isInitialMount = useRef(true);
  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Sync to Google Drive helper
  const performDriveSync = useCallback(async (token: string, dataToSave: AppData) => {
    setSyncStatus({ state: "syncing" });
    const result = await saveToGoogleDrive(token, dataToSave);
    if (result.success) {
      setSyncStatus({
        state: "synced",
        lastSyncedAt: new Date().toLocaleTimeString(),
      });
    } else {
      setSyncStatus({
        state: "error",
        errorMessage: result.error,
      });
    }
  }, []);

  // Listen to Firebase Auth state
  useEffect(() => {
    const unsubscribe = subscribeToAuthChanges(async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        const token = getCachedGoogleAccessToken();
        if (token) {
          // Attempt to pull latest Google Drive data
          setSyncStatus({ state: "syncing" });
          const driveData = await loadFromGoogleDrive(token);
          if (driveData) {
            setAppData(driveData);
            saveLocalAppData(driveData);
            setSyncStatus({
              state: "synced",
              lastSyncedAt: new Date().toLocaleTimeString(),
            });
          } else {
            // First time connecting drive: upload local data
            await performDriveSync(token, appData);
          }
        }
      }
    });

    return () => unsubscribe();
  }, [performDriveSync]);

  // Autosave locally whenever appData changes, and debounce to Drive
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }

    // Save locally immediately
    saveLocalAppData(appData);

    // Debounced Drive sync
    const token = getCachedGoogleAccessToken();
    if (user && token) {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
      autoSaveTimerRef.current = setTimeout(() => {
        performDriveSync(token, appData);
      }, 1500);
    }

    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, [appData, user, performDriveSync]);

  // Auth Handlers
  const handleLogin = async () => {
    setIsLoggingIn(true);
    try {
      const { user: authedUser, accessToken } = await signInWithGoogle();
      setUser(authedUser);
      if (accessToken) {
        setSyncStatus({ state: "syncing" });
        const driveData = await loadFromGoogleDrive(accessToken);
        if (driveData) {
          setAppData(driveData);
          saveLocalAppData(driveData);
          setSyncStatus({
            state: "synced",
            lastSyncedAt: new Date().toLocaleTimeString(),
          });
        } else {
          await performDriveSync(accessToken, appData);
        }
      }
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
    const token = getCachedGoogleAccessToken();
    if (!token) {
      handleLogin();
      return;
    }
    await performDriveSync(token, appData);
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
    const token = getCachedGoogleAccessToken();
    if (token) {
      performDriveSync(token, importedData);
    }
  };

  const handleClearAllData = () => {
    const freshData: AppData = {
      version: 1,
      lastModified: new Date().toISOString(),
      lastUpdated: new Date().toISOString(),
      expenses: [],
      earnings: [],
      titheRecords: [],
      investments: [],
      goals: [],
      weeklyReviews: [],
      settings: {
        currency: "$",
        currencySymbol: "$",
        defaultTithePercent: 10,
        defaultTithePercentage: 10,
        reminderEmail: "",
        notificationEmail: "",
        autoSyncDrive: true,
      },
    };
    setAppData(freshData);
    saveLocalAppData(freshData);
    const token = getCachedGoogleAccessToken();
    if (token) {
      performDriveSync(token, freshData);
    }
  };

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
            Powered by Gemini 2.5 Intelligence Engine
          </span>
        </div>
      </footer>
    </div>
  );
}
