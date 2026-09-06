import React from "react";
import {
  Wallet,
  Coins,
  Sparkles,
  Target,
  Mail,
  RefreshCw,
  Cloud,
  CheckCircle2,
  AlertCircle,
  LogOut,
  Sliders,
  BarChart3,
  Sun,
  Moon,
} from "lucide-react";
import { User } from "firebase/auth";
import { SyncStatus } from "../services/driveStorage";

interface HeaderProps {
  user: User | null;
  syncStatus: SyncStatus;
  activeTab: "finances" | "tithe" | "weekend_review" | "goals" | "reminders" | "analytics" | "settings";
  theme: "dark" | "light";
  onToggleTheme: () => void;
  onTabChange: (tab: "finances" | "tithe" | "weekend_review" | "goals" | "reminders" | "analytics" | "settings") => void;
  onLogin: () => void;
  onLogout: () => void;
  onSyncDrive: () => void;
  isLoggingIn: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  user,
  syncStatus,
  activeTab,
  theme,
  onToggleTheme,
  onTabChange,
  onLogin,
  onLogout,
  onSyncDrive,
  isLoggingIn,
}) => {
  const isLight = theme === "light";

  return (
    <header className={`${isLight ? "bg-white border-b border-slate-200 text-slate-900" : "bg-[#0F0F12] border-b border-white/5 text-white"} sticky top-0 z-30 shadow-sm transition-colors`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand & Identity */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-600 to-purple-700 flex items-center justify-center text-white shadow-lg shadow-indigo-500/20 font-bold text-lg">
              <Wallet className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className={`text-base sm:text-lg font-bold tracking-tight leading-tight ${isLight ? "text-slate-900" : "text-white"}`}>
                  ETHOS <span className="text-indigo-500">FINANCE</span>
                </h1>
                <span className="hidden md:inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.5)]"></span>
                  Drive Cloud
                </span>
              </div>
              <p className={`text-xs hidden sm:block ${isLight ? "text-slate-500" : "text-slate-400"}`}>
                Self-managing finances, tithes, investments & goal hierarchy
              </p>
            </div>
          </div>

          {/* Right Action Icons: Theme Toggle & Drive Sync */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Light / Dark Mode Toggle Button */}
            <button
              onClick={onToggleTheme}
              className={`p-2 rounded-xl border transition-all flex items-center gap-1.5 text-xs font-semibold ${
                isLight
                  ? "bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-700 shadow-xs"
                  : "bg-white/5 hover:bg-white/10 border-white/10 text-amber-300"
              }`}
              title={isLight ? "Switch to Dark Mode" : "Switch to Light Mode"}
            >
              {isLight ? (
                <>
                  <Moon className="w-4 h-4 text-indigo-600" />
                  <span className="hidden md:inline text-xs font-medium">Dark</span>
                </>
              ) : (
                <>
                  <Sun className="w-4 h-4 text-amber-400" />
                  <span className="hidden md:inline text-xs font-medium">Light</span>
                </>
              )}
            </button>

            {/* Sync Status Badge & Button */}
            <div className={`flex items-center border rounded-lg px-2.5 py-1 text-xs ${
              isLight ? "bg-slate-100 border-slate-200" : "bg-white/5 border-white/5"
            }`}>
              <Cloud className="w-3.5 h-3.5 text-slate-400 mr-1.5" />
              {syncStatus.state === "syncing" ? (
                <span className="flex items-center text-amber-400 font-medium">
                  <RefreshCw className="w-3 h-3 animate-spin mr-1 text-amber-400" />
                  Syncing...
                </span>
              ) : syncStatus.state === "synced" ? (
                <span className="flex items-center text-emerald-400 font-medium" title={syncStatus.lastSyncedAt || ""}>
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.5)] mr-1.5"></span>
                  <span className="hidden sm:inline">Drive </span>Synced
                </span>
              ) : syncStatus.state === "error" ? (
                <span className="flex items-center text-rose-400 font-medium" title={syncStatus.errorMessage}>
                  <AlertCircle className="w-3 h-3 text-rose-400 mr-1" />
                  Sync Error
                </span>
              ) : (
                <span className="text-slate-400">Local Cache</span>
              )}

              {user && (
                <button
                  onClick={onSyncDrive}
                  disabled={syncStatus.state === "syncing"}
                  className="ml-2 pl-2 border-l border-white/10 text-slate-400 hover:text-emerald-400 transition-colors"
                  title="Force Sync with Google Drive"
                >
                  <RefreshCw className={`w-3 h-3 ${syncStatus.state === "syncing" ? "animate-spin" : ""}`} />
                </button>
              )}
            </div>

            {/* Google Sign-in / User Profile */}
            {user ? (
              <div className="flex items-center gap-2 pl-2 border-l border-white/10">
                {user.photoURL ? (
                  <img
                    src={user.photoURL}
                    alt={user.displayName || "User"}
                    className="w-8 h-8 rounded-full border border-white/10"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-slate-800 text-slate-200 border border-white/10 font-medium text-xs flex items-center justify-center">
                    {user.email?.[0]?.toUpperCase() || "U"}
                  </div>
                )}
                <div className="hidden lg:block text-left text-xs">
                  <div className="font-medium text-slate-200 truncate max-w-[120px]">
                    {user.displayName || user.email}
                  </div>
                  <div className="text-slate-500 truncate max-w-[120px]">{user.email}</div>
                </div>
                <button
                  onClick={onLogout}
                  className="p-1.5 text-slate-400 hover:text-slate-200 rounded-md hover:bg-white/5 transition-colors"
                  title="Sign Out"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                onClick={onLogin}
                disabled={isLoggingIn}
                className="flex items-center gap-2 px-3 py-1.5 bg-white/5 border border-white/10 hover:bg-white/10 text-slate-200 text-xs font-medium rounded-lg shadow-sm transition-all"
              >
                <svg className="w-4 h-4" viewBox="0 0 48 48">
                  <path
                    fill="#EA4335"
                    d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
                  />
                  <path
                    fill="#4285F4"
                    d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
                  />
                  <path
                    fill="#34A853"
                    d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
                  />
                </svg>
                <span>{isLoggingIn ? "Connecting..." : "Sign in with Google"}</span>
              </button>
            )}
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav className={`flex space-x-1 sm:space-x-2 overflow-x-auto py-2 border-t ${
          isLight ? "border-slate-200" : "border-white/5"
        } scrollbar-none text-xs sm:text-sm`}>
          <button
            onClick={() => onTabChange("finances")}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg font-medium whitespace-nowrap transition-all ${
              activeTab === "finances"
                ? "bg-indigo-600 text-white shadow-lg shadow-indigo-500/20 font-semibold"
                : isLight
                ? "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                : "text-slate-400 hover:text-slate-200 hover:bg-white/5"
            }`}
          >
            <Wallet className="w-4 h-4" />
            <span>Daily Finances</span>
          </button>

          <button
            onClick={() => onTabChange("tithe")}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg font-medium whitespace-nowrap transition-all ${
              activeTab === "tithe"
                ? "bg-indigo-600 text-white shadow-lg shadow-indigo-500/20 font-semibold"
                : isLight
                ? "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                : "text-slate-400 hover:text-slate-200 hover:bg-white/5"
            }`}
          >
            <Coins className="w-4 h-4" />
            <span>Tithe & Investments</span>
          </button>

          <button
            onClick={() => onTabChange("goals")}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg font-medium whitespace-nowrap transition-all ${
              activeTab === "goals"
                ? "bg-indigo-600 text-white shadow-lg shadow-indigo-500/20 font-semibold"
                : isLight
                ? "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                : "text-slate-400 hover:text-slate-200 hover:bg-white/5"
            }`}
          >
            <Target className="w-4 h-4" />
            <span>Goals & Tasks</span>
          </button>

          <button
            onClick={() => onTabChange("analytics")}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg font-semibold whitespace-nowrap transition-all ${
              activeTab === "analytics"
                ? "bg-indigo-600 text-white shadow-lg shadow-indigo-500/20"
                : isLight
                ? "text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200"
                : "text-indigo-300 bg-indigo-950/40 hover:bg-indigo-900/50 border border-indigo-500/30"
            }`}
          >
            <BarChart3 className="w-4 h-4 text-emerald-400" />
            <span>Progress & Graphs</span>
          </button>

          <button
            onClick={() => onTabChange("weekend_review")}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg font-medium whitespace-nowrap transition-all ${
              activeTab === "weekend_review"
                ? "bg-indigo-600 text-white shadow-lg shadow-indigo-500/20 font-semibold"
                : isLight
                ? "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                : "text-slate-400 hover:text-slate-200 hover:bg-white/5"
            }`}
          >
            <Sparkles className="w-4 h-4" />
            <span>Weekend AI Review</span>
          </button>

          <button
            onClick={() => onTabChange("reminders")}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg font-medium whitespace-nowrap transition-all ${
              activeTab === "reminders"
                ? "bg-indigo-600 text-white shadow-lg shadow-indigo-500/20 font-semibold"
                : isLight
                ? "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                : "text-slate-400 hover:text-slate-200 hover:bg-white/5"
            }`}
          >
            <Mail className="w-4 h-4" />
            <span>Email Reminders</span>
          </button>

          <button
            onClick={() => onTabChange("settings")}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg font-medium whitespace-nowrap transition-all ${
              activeTab === "settings"
                ? "bg-indigo-600 text-white shadow-lg shadow-indigo-500/20 font-semibold"
                : isLight
                ? "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                : "text-slate-400 hover:text-slate-200 hover:bg-white/5"
            }`}
          >
            <Sliders className="w-4 h-4" />
            <span>Settings</span>
          </button>
        </nav>
      </div>
    </header>
  );
};
