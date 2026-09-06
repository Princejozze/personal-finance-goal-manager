import React, { useState, useMemo } from "react";
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  CheckCircle2,
  Clock,
  AlertCircle,
  Sparkles,
  Send,
  Mail,
  Zap,
  DollarSign,
  Target,
  PieChart as PieIcon,
  RefreshCw,
} from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import { User } from "firebase/auth";
import { AppData, Expense, Earning, GoalItem, TitheRecord, InvestmentRecord } from "../types";
import { triggerExecutiveBriefAndEmail, triggerZeroTaskCheckInEmail } from "../services/reminderScheduler";
import { getValidGoogleAccessToken, reauthorizeGoogleAccess } from "../services/auth";

interface ProgressAnalyticsProps {
  appData: AppData;
  user: User | null;
  currency: string;
  theme?: "dark" | "light";
  onLoginRequest: () => void;
}

const CATEGORY_COLORS: Record<string, string> = {
  Essential: "#10b981",
  "High ROI": "#6366f1",
  "Impulsive/Wasted": "#f43f5e",
  Living: "#3b82f6",
  Education: "#8b5cf6",
  Health: "#ec4899",
  Other: "#64748b",
};

const STATUS_COLORS: Record<string, string> = {
  Completed: "#10b981",
  "In Progress": "#6366f1",
  Pending: "#f59e0b",
  Unachieved: "#f43f5e",
};

export const ProgressAnalytics: React.FC<ProgressAnalyticsProps> = ({
  appData,
  user,
  currency,
  theme = "dark",
  onLoginRequest,
}) => {
  const isLight = theme === "light";
  const [isGeneratingBrief, setIsGeneratingBrief] = useState(false);
  const [isSendingZeroReminder, setIsSendingZeroReminder] = useState(false);
  const [zeroReminderResult, setZeroReminderResult] = useState<{ message: string; success: boolean } | null>(null);
  const [briefResult, setBriefResult] = useState<{
    text: string;
    emailSent: boolean;
    error?: string;
  } | null>(null);

  // Financial calculations
  const totalEarnings = useMemo(
    () => appData.earnings.reduce((sum, e) => sum + e.amount, 0),
    [appData.earnings]
  );
  const totalExpenses = useMemo(
    () => appData.expenses.reduce((sum, e) => sum + e.amount, 0),
    [appData.expenses]
  );
  const netCashFlow = totalEarnings - totalExpenses;
  const savingsRate = totalEarnings > 0 ? Math.max(0, Math.round((netCashFlow / totalEarnings) * 100)) : 0;

  const defaultTithePct = appData.settings.defaultTithePercentage ?? appData.settings.defaultTithePercent ?? 10;
  const titheDue = (totalEarnings * defaultTithePct) / 100;
  const tithePaid = useMemo(
    () => appData.titheRecords.reduce((sum, t) => sum + (t.tithePaid || 0), 0),
    [appData.titheRecords]
  );
  const titheFaithfulness = titheDue > 0 ? Math.min(100, Math.round((tithePaid / titheDue) * 100)) : 100;

  const totalInvested = useMemo(
    () => appData.investments.reduce((sum, i) => sum + i.amount, 0),
    [appData.investments]
  );

  // Goal & Task Calculations
  const goals = appData.goals;
  const totalGoalsCount = goals.length;
  const completedGoalsCount = goals.filter((g) => g.status === "completed").length;
  const inProgressGoalsCount = goals.filter((g) => g.status === "in_progress").length;
  const pendingGoalsCount = goals.filter((g) => g.status === "pending").length;
  const unachievedGoalsCount = goals.filter((g) => g.status === "unachieved").length;
  const overallTaskCompletionRate =
    totalGoalsCount > 0 ? Math.round((completedGoalsCount / totalGoalsCount) * 100) : 0;

  // Chart Data 1: Cash Flow Timeline (Past 7 dates or aggregated entries)
  const cashFlowTimeline = useMemo(() => {
    const map = new Map<string, { date: string; earnings: number; expenses: number }>();

    // Seed last 7 days or use entries
    const dates: string[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const str = d.toISOString().split("T")[0];
      dates.push(str);
      map.set(str, { date: str.slice(5), earnings: 0, expenses: 0 });
    }

    appData.earnings.forEach((e) => {
      const d = e.date ? e.date.split("T")[0] : "";
      if (map.has(d)) {
        const item = map.get(d)!;
        item.earnings += e.amount;
      } else if (d) {
        map.set(d, { date: d.slice(5), earnings: e.amount, expenses: 0 });
      }
    });

    appData.expenses.forEach((e) => {
      const d = e.date ? e.date.split("T")[0] : "";
      if (map.has(d)) {
        const item = map.get(d)!;
        item.expenses += e.amount;
      } else if (d) {
        map.set(d, { date: d.slice(5), earnings: 0, expenses: e.amount });
      }
    });

    return Array.from(map.values()).slice(-10);
  }, [appData.earnings, appData.expenses]);

  // Chart Data 2: Expense Breakdown by Category
  const expenseCategoryData = useMemo(() => {
    const counts: Record<string, number> = {};
    appData.expenses.forEach((e) => {
      const cat = e.category || "Other";
      counts[cat] = (counts[cat] || 0) + e.amount;
    });
    return Object.entries(counts).map(([name, value]) => ({
      name,
      value,
      color: CATEGORY_COLORS[name] || "#64748b",
    }));
  }, [appData.expenses]);

  // Chart Data 3: Task Completion by 4-Tier Hierarchy
  const tierProgressData = useMemo(() => {
    const tiers: Array<{ tier: "daily" | "weekly" | "monthly" | "yearly"; label: string }> = [
      { tier: "daily", label: "Daily Tasks" },
      { tier: "weekly", label: "Weekly Targets" },
      { tier: "monthly", label: "Monthly Goals" },
      { tier: "yearly", label: "Yearly Vision" },
    ];

    return tiers.map(({ tier, label }) => {
      const tierGoals = goals.filter((g) => g.tier === tier);
      const total = tierGoals.length;
      const completed = tierGoals.filter((g) => g.status === "completed").length;
      const pending = total - completed;
      const rate = total > 0 ? Math.round((completed / total) * 100) : 0;
      return {
        tier: label,
        Completed: completed,
        Pending: pending,
        rate,
      };
    });
  }, [goals]);

  // Chart Data 4: Task Status Distribution
  const taskStatusData = useMemo(() => {
    return [
      { name: "Completed", value: completedGoalsCount, color: STATUS_COLORS["Completed"] },
      { name: "In Progress", value: inProgressGoalsCount, color: STATUS_COLORS["In Progress"] },
      { name: "Pending", value: pendingGoalsCount, color: STATUS_COLORS["Pending"] },
      { name: "Unachieved", value: unachievedGoalsCount, color: STATUS_COLORS["Unachieved"] },
    ].filter((d) => d.value > 0);
  }, [completedGoalsCount, inProgressGoalsCount, pendingGoalsCount, unachievedGoalsCount]);

  // Handle Automatic Direct Brief & Instant Email Push
  const handleGenerateAndEmailBrief = async () => {
    setIsGeneratingBrief(true);
    setBriefResult(null);

    const targetEmail = appData.settings.notificationEmail || user?.email || "giftj964@gmail.com";
    const userName = user?.displayName || user?.email?.split("@")[0] || "Friend";

    let token = await getValidGoogleAccessToken();
    if (!token && user) {
      token = await reauthorizeGoogleAccess();
    }

    const res = await triggerExecutiveBriefAndEmail(
      appData,
      userName,
      targetEmail,
      token || ""
    );

    setIsGeneratingBrief(false);
    setBriefResult({
      text: res.brief,
      emailSent: res.emailSent,
      error: res.error,
    });
  };

  // Test zero-tasks accountability email: "Are you totally free today?"
  const handleSendZeroReminder = async () => {
    setIsSendingZeroReminder(true);
    setZeroReminderResult(null);

    const targetEmail = appData.settings.notificationEmail || user?.email || "giftj964@gmail.com";
    const userName = user?.displayName || user?.email?.split("@")[0] || "Friend";

    let token = await getValidGoogleAccessToken();
    if (!token && user) {
      token = await reauthorizeGoogleAccess();
    }

    if (!token) {
      setIsSendingZeroReminder(false);
      setZeroReminderResult({
        success: false,
        message: "Google OAuth token not available. Please sign in to send reminder emails.",
      });
      return;
    }

    const res = await triggerZeroTaskCheckInEmail(userName, targetEmail, token);
    setIsSendingZeroReminder(false);
    if (res.success) {
      setZeroReminderResult({
        success: true,
        message: `Email sent to ${targetEmail}: "${res.subject}"`,
      });
    } else {
      setZeroReminderResult({
        success: false,
        message: res.error || "Failed to send check-in email.",
      });
    }
  };

  const cardBg = isLight ? "bg-white border-slate-200 text-slate-900 shadow-sm" : "bg-[#111116] border-white/5 text-white shadow-lg";
  const gridStroke = isLight ? "#e2e8f0" : "#1e293b";
  const axisStroke = isLight ? "#64748b" : "#94a3b8";
  const tooltipStyle = {
    backgroundColor: isLight ? "#ffffff" : "#0f172a",
    borderColor: isLight ? "#cbd5e1" : "#334155",
    borderRadius: "8px",
    fontSize: "12px",
    color: isLight ? "#0f172a" : "#f8fafc",
    boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
  };

  return (
    <div className="space-y-8 pb-12">
      {/* Header Banner */}
      <div className={`flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-2xl border shadow-xl ${
        isLight
          ? "bg-gradient-to-r from-indigo-50 via-white to-indigo-50 border-indigo-200 text-slate-900"
          : "bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900 border-indigo-500/20 text-white"
      }`}>
        <div>
          <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 font-semibold text-xs uppercase tracking-wider">
            <TrendingUp className="w-4 h-4" />
            <span>Real-Time Progress & Visualization</span>
          </div>
          <h2 className={`text-xl sm:text-2xl font-bold mt-1 ${isLight ? "text-slate-900" : "text-white"}`}>
            Finances & Goal Velocity Analytics
          </h2>
          <p className={`text-xs sm:text-sm mt-0.5 ${isLight ? "text-slate-600" : "text-slate-400"}`}>
            Interactive telemetry tracking cashflow, tithe faithfulness, and 4-tier task completion.
          </p>
        </div>

        {/* Action buttons: Brief push + Zero Task check-in test */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={handleSendZeroReminder}
            disabled={isSendingZeroReminder}
            className={`flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-xl border transition-all cursor-pointer ${
              isLight
                ? "bg-amber-50 hover:bg-amber-100 text-amber-900 border-amber-300 shadow-xs"
                : "bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border-amber-500/30"
            }`}
            title="Test zero-task check-in email: 'Are you totally free today?'"
          >
            {isSendingZeroReminder ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Mail className="w-3.5 h-3.5" />
            )}
            <span>Test "Are You Free?" Email</span>
          </button>

          <button
            onClick={handleGenerateAndEmailBrief}
            disabled={isGeneratingBrief}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white text-xs sm:text-sm font-semibold rounded-xl shadow-lg shadow-indigo-500/25 transition-all disabled:opacity-50 cursor-pointer"
          >
            {isGeneratingBrief ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin text-white" />
                <span>Generating & Sending...</span>
              </>
            ) : (
              <>
                <Zap className="w-4 h-4 text-amber-300" />
                <span>⚡ Auto-Brief & Push to Email</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Zero Task Result Notification Banner */}
      {zeroReminderResult && (
        <div className={`p-4 rounded-xl text-xs flex items-center justify-between border ${
          zeroReminderResult.success
            ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
            : "bg-rose-500/10 border-rose-500/30 text-rose-400"
        }`}>
          <div className="flex items-center gap-2">
            {zeroReminderResult.success ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
            <span>{zeroReminderResult.message}</span>
          </div>
          <button onClick={() => setZeroReminderResult(null)} className="underline ml-4 cursor-pointer">
            Dismiss
          </button>
        </div>
      )}

      {/* AI Direct Brief Output (If generated or delivered) */}
      {briefResult && (
        <div className={`rounded-2xl border p-5 shadow-lg animate-in fade-in slide-in-from-top-4 duration-300 ${
          isLight ? "bg-indigo-50/70 border-indigo-200" : "bg-indigo-950/20 border-indigo-500/30"
        }`}>
          <div className={`flex items-center justify-between gap-3 border-b pb-3 mb-3 ${
            isLight ? "border-indigo-200" : "border-white/5"
          }`}>
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-indigo-500/20 text-indigo-400">
                <Sparkles className="w-4 h-4" />
              </span>
              <h3 className={`text-sm font-bold ${isLight ? "text-slate-900" : "text-white"}`}>Direct & Short Executive AI Brief</h3>
            </div>
            {briefResult.emailSent ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                <Mail className="w-3.5 h-3.5" />
                Pushed to {appData.settings.notificationEmail || user?.email || "Email"}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-500 border border-amber-500/20">
                <AlertCircle className="w-3.5 h-3.5" />
                Displayed below (Sign in to auto-push to Gmail)
              </span>
            )}
          </div>
          <pre className={`font-sans text-xs sm:text-sm whitespace-pre-wrap leading-relaxed ${
            isLight ? "text-slate-800" : "text-slate-200"
          }`}>
            {briefResult.text}
          </pre>
        </div>
      )}

      {/* Primary KPI Metrics Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1: Net Cashflow */}
        <div className={`border rounded-xl p-4 ${cardBg}`}>
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Net Cash Flow</span>
            <DollarSign className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span
              className={`text-xl sm:text-2xl font-bold ${
                netCashFlow >= 0 ? "text-emerald-500" : "text-rose-500"
              }`}
            >
              {netCashFlow >= 0 ? "+" : ""}
              {currency}
              {Math.abs(netCashFlow).toLocaleString()}
            </span>
          </div>
          <div className="mt-2 text-2xs text-slate-500 flex items-center justify-between">
            <span>Savings Rate: {savingsRate}%</span>
            <span>Earn: {currency}{totalEarnings.toLocaleString()}</span>
          </div>
        </div>

        {/* Metric 2: 10% Tithe Progress */}
        <div className={`border rounded-xl p-4 ${cardBg}`}>
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>10% Tithe Status</span>
            <CheckCircle2 className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className={`text-xl sm:text-2xl font-bold ${isLight ? "text-slate-900" : "text-white"}`}>
              {titheFaithfulness}%
            </span>
            <span className="text-xs text-slate-400">fulfilled</span>
          </div>
          <div className="mt-2 text-2xs text-slate-500 flex items-center justify-between">
            <span>Paid: {currency}{tithePaid.toLocaleString()}</span>
            <span>Due: {currency}{Math.round(titheDue).toLocaleString()}</span>
          </div>
        </div>

        {/* Metric 3: Total Investments */}
        <div className={`border rounded-xl p-4 ${cardBg}`}>
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Invested Assets</span>
            <TrendingUp className="w-4 h-4 text-purple-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-xl sm:text-2xl font-bold text-purple-500">
              {currency}{totalInvested.toLocaleString()}
            </span>
          </div>
          <div className="mt-2 text-2xs text-slate-500 flex items-center justify-between">
            <span>{appData.investments.length} log(s)</span>
            <span>Compound growth</span>
          </div>
        </div>

        {/* Metric 4: Goal & Task Completion Rate */}
        <div className={`border rounded-xl p-4 ${cardBg}`}>
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Task Completion</span>
            <Target className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-xl sm:text-2xl font-bold text-emerald-500">
              {overallTaskCompletionRate}%
            </span>
            <span className="text-xs text-slate-400">
              ({completedGoalsCount}/{totalGoalsCount})
            </span>
          </div>
          <div className="mt-2 text-2xs text-slate-500 flex items-center justify-between">
            <span>Pending: {pendingGoalsCount}</span>
            <span>Unachieved: {unachievedGoalsCount}</span>
          </div>
        </div>
      </div>

      {/* Row 1 Graphs: Cash Flow Timeline + Expense Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Graph 1: Cash Flow Timeline (AreaChart) */}
        <div className={`lg:col-span-2 border rounded-2xl p-5 shadow-lg flex flex-col justify-between ${cardBg}`}>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className={`text-sm sm:text-base font-bold flex items-center gap-2 ${isLight ? "text-slate-900" : "text-white"}`}>
                <BarChart3 className="w-4 h-4 text-indigo-400" />
                Cash Flow Trajectory (Earnings vs. Expenses)
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Daily financial momentum and burn rate
              </p>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <span className="flex items-center gap-1 text-emerald-500 font-medium">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span> Earnings
              </span>
              <span className="flex items-center gap-1 text-rose-500 font-medium">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span> Expenses
              </span>
            </div>
          </div>

          <div className="w-full min-h-[260px] h-[260px]">
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={cashFlowTimeline} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="earningsGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="expensesGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#f43f5e" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} vertical={false} />
                <XAxis dataKey="date" stroke={axisStroke} fontSize={11} tickLine={false} />
                <YAxis stroke={axisStroke} fontSize={11} tickLine={false} />
                <Tooltip
                  contentStyle={tooltipStyle}
                  formatter={(value: any) => [`${currency}${Number(value).toLocaleString()}`, ""]}
                />
                <Area
                  type="monotone"
                  dataKey="earnings"
                  name="Earnings"
                  stroke="#10b981"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#earningsGrad)"
                />
                <Area
                  type="monotone"
                  dataKey="expenses"
                  name="Expenses"
                  stroke="#f43f5e"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#expensesGrad)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Graph 2: Expense Category Breakdown (Donut Chart) */}
        <div className={`border rounded-2xl p-5 shadow-lg flex flex-col justify-between ${cardBg}`}>
          <div>
            <h3 className={`text-sm sm:text-base font-bold flex items-center gap-2 ${isLight ? "text-slate-900" : "text-white"}`}>
              <PieIcon className="w-4 h-4 text-purple-400" />
              Expense Distribution
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Spending utility breakdown
            </p>
          </div>

          <div className="w-full min-h-[220px] h-[220px] flex items-center justify-center my-2">
            {expenseCategoryData.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={expenseCategoryData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {expenseCategoryData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={tooltipStyle}
                    formatter={(val: any) => [`${currency}${Number(val).toLocaleString()}`, "Amount"]}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-center text-xs text-slate-500 py-12">
                No expense entries logged yet
              </div>
            )}
          </div>

          <div className="space-y-1 text-xs">
            {expenseCategoryData.slice(0, 4).map((c) => (
              <div key={c.name} className={`flex items-center justify-between ${isLight ? "text-slate-700" : "text-slate-300"}`}>
                <span className="flex items-center gap-1.5 truncate">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: c.color }} />
                  {c.name}
                </span>
                <span className={`font-semibold ${isLight ? "text-slate-900" : "text-white"}`}>
                  {currency}{c.value.toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Row 2 Graphs: Task Completion Velocity by Tier + Task Status Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Graph 3: 4-Tier Goal Hierarchy Velocity (BarChart) */}
        <div className={`lg:col-span-2 border rounded-2xl p-5 shadow-lg flex flex-col justify-between ${cardBg}`}>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className={`text-sm sm:text-base font-bold flex items-center gap-2 ${isLight ? "text-slate-900" : "text-white"}`}>
                <Target className="w-4 h-4 text-emerald-400" />
                Goal & Task Hierarchy Execution Velocity
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Completed vs. Pending tasks across all 4 structure tiers
              </p>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <span className="flex items-center gap-1 text-emerald-500 font-medium">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span> Completed
              </span>
              <span className="flex items-center gap-1 text-amber-500 font-medium">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span> Pending
              </span>
            </div>
          </div>

          <div className="w-full min-h-[260px] h-[260px]">
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={tierProgressData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} vertical={false} />
                <XAxis dataKey="tier" stroke={axisStroke} fontSize={11} tickLine={false} />
                <YAxis stroke={axisStroke} fontSize={11} tickLine={false} allowDecimals={false} />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="Completed" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={35} />
                <Bar dataKey="Pending" fill="#f59e0b" radius={[4, 4, 0, 0]} maxBarSize={35} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Graph 4: Task Status Distribution (Donut Chart) */}
        <div className={`border rounded-2xl p-5 shadow-lg flex flex-col justify-between ${cardBg}`}>
          <div>
            <h3 className={`text-sm sm:text-base font-bold flex items-center gap-2 ${isLight ? "text-slate-900" : "text-white"}`}>
              <Clock className="w-4 h-4 text-amber-400" />
              Task Status Health
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Completion ratio and bottlenecks
            </p>
          </div>

          <div className="w-full min-h-[220px] h-[220px] flex items-center justify-center my-2">
            {taskStatusData.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={taskStatusData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {taskStatusData.map((entry, index) => (
                      <Cell key={`cell-status-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={tooltipStyle}
                    formatter={(val: any) => [`${val} tasks`, "Count"]}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-center text-xs text-slate-500 py-12">
                No tasks created yet
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs">
            {taskStatusData.map((s) => (
              <div key={s.name} className={`flex items-center gap-1.5 ${isLight ? "text-slate-700" : "text-slate-300"}`}>
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: s.color }} />
                <span className="truncate">{s.name}:</span>
                <span className={`font-semibold ml-auto ${isLight ? "text-slate-900" : "text-white"}`}>{s.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
