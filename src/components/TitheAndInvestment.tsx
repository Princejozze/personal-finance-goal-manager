import React, { useState } from "react";
import {
  Coins,
  TrendingUp,
  CheckCircle2,
  Clock,
  Sparkles,
  PlusCircle,
  ShieldCheck,
  Percent,
  Trash2,
  Calendar,
  AlertCircle,
  HelpCircle,
  ArrowRight,
  Wallet,
  PieChart,
  Check,
  ChevronRight,
  Sliders,
} from "lucide-react";
import { TitheRecord, InvestmentRecord, Earning, Expense } from "../types";
import { requestInvestmentProposal } from "../services/geminiClient";

interface TitheAndInvestmentProps {
  earnings: Earning[];
  expenses: Expense[];
  titheRecords: TitheRecord[];
  investments: InvestmentRecord[];
  currency: string;
  defaultTithePercent: number;
  theme?: "dark" | "light";
  onSaveTitheRecord: (tithe: TitheRecord) => void;
  onAddInvestment: (inv: Omit<InvestmentRecord, "id" | "createdAt">) => void;
  onDeleteInvestment: (id: string) => void;
}

type TimeframeType = "week" | "month" | "year" | "custom" | "all";

export const TitheAndInvestment: React.FC<TitheAndInvestmentProps> = ({
  earnings,
  expenses,
  titheRecords,
  investments,
  currency,
  defaultTithePercent,
  theme = "dark",
  onSaveTitheRecord,
  onAddInvestment,
  onDeleteInvestment,
}) => {
  const isLight = theme === "light";
  const today = new Date();
  const todayStr = today.toISOString().split("T")[0];

  // Timeframe state
  const [selectedTimeframe, setSelectedTimeframe] = useState<TimeframeType>("week");

  // Custom date range state
  const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1)
    .toISOString()
    .split("T")[0];
  const [customStartDate, setCustomStartDate] = useState(firstOfMonth);
  const [customEndDate, setCustomEndDate] = useState(todayStr);

  // Target Investment Percentage (default 20% standard wealth-building ratio)
  const [targetInvestmentPercent, setTargetInvestmentPercent] = useState<number>(20);
  const [showAdjustRatio, setShowAdjustRatio] = useState<boolean>(false);

  // State for recording tithe payment
  const [showTitheModal, setShowTitheModal] = useState(false);
  const [tithePayAmount, setTithePayAmount] = useState("");
  const [titheRecipient, setTitheRecipient] = useState("Local Church");
  const [titheNotes, setTitheNotes] = useState("");

  // State for AI Investment Proposal
  const [isGeneratingProposal, setIsGeneratingProposal] = useState(false);
  const [aiProposal, setAiProposal] = useState<string | null>(null);
  const [proposalError, setProposalError] = useState<string | null>(null);

  // State for logging new investment
  const [invAmount, setInvAmount] = useState("");
  const [invDate, setInvDate] = useState(todayStr);
  const [invType, setInvType] = useState<InvestmentRecord["assetType"]>("Index Fund / ETF");
  const [invPlatform, setInvPlatform] = useState("");
  const [invNotes, setInvNotes] = useState("");

  // --- 1. Compute Predefined Aggregate Incomes (Per Week, Per Month, Per Year) ---
  // A. This Week (last 7 days)
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(today.getDate() - 7);
  const weeklyEarnings = earnings
    .filter((e) => new Date(e.date) >= sevenDaysAgo)
    .reduce((sum, e) => sum + e.amount, 0);

  // B. This Month (from 1st of current month to today)
  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const monthlyEarnings = earnings
    .filter((e) => new Date(e.date) >= startOfMonth)
    .reduce((sum, e) => sum + e.amount, 0);

  // C. This Year (from Jan 1 of current year to today)
  const startOfYear = new Date(today.getFullYear(), 0, 1);
  const yearlyEarnings = earnings
    .filter((e) => new Date(e.date) >= startOfYear)
    .reduce((sum, e) => sum + e.amount, 0);

  // D. All-Time Earnings
  const allTimeEarnings = earnings.reduce((sum, e) => sum + e.amount, 0);

  // --- 2. Filter Transactions by Selected Timeframe ---
  let filterStart: Date | null = null;
  let filterEnd: Date | null = null;
  let timeframeLabel = "This Week (Last 7 Days)";

  if (selectedTimeframe === "week") {
    filterStart = sevenDaysAgo;
    filterEnd = new Date();
    timeframeLabel = "This Week (Last 7 Days)";
  } else if (selectedTimeframe === "month") {
    filterStart = startOfMonth;
    filterEnd = new Date();
    timeframeLabel = `This Month (${today.toLocaleString("default", { month: "long" })})`;
  } else if (selectedTimeframe === "year") {
    filterStart = startOfYear;
    filterEnd = new Date();
    timeframeLabel = `This Year (${today.getFullYear()})`;
  } else if (selectedTimeframe === "custom") {
    filterStart = customStartDate ? new Date(customStartDate) : null;
    filterEnd = customEndDate ? new Date(`${customEndDate}T23:59:59`) : null;
    timeframeLabel = `Custom Range (${customStartDate || "Start"} to ${customEndDate || "End"})`;
  } else {
    timeframeLabel = "All-Time Records";
  }

  const matchesTimeframe = (dateStr: string) => {
    if (selectedTimeframe === "all") return true;
    const d = new Date(dateStr);
    if (filterStart && d < filterStart) return false;
    if (filterEnd && d > filterEnd) return false;
    return true;
  };

  // Selected Period Calculations
  const periodEarnings = earnings
    .filter((e) => matchesTimeframe(e.date))
    .reduce((sum, e) => sum + e.amount, 0);

  const periodExpenses = expenses
    .filter((e) => matchesTimeframe(e.date))
    .reduce((sum, e) => sum + e.amount, 0);

  // Actual Tithe Paid in this period
  const periodTitheRecords = titheRecords.filter((t) => matchesTimeframe(t.weekEndDate));
  const periodTithePaid = periodTitheRecords.reduce((sum, t) => sum + (t.tithePaid || 0), 0);

  // Actual Investments Made in this period
  const periodInvestments = investments.filter((i) => matchesTimeframe(i.date));
  const periodInvested = periodInvestments.reduce((sum, i) => sum + i.amount, 0);

  // --- 3. Exact Mathematical Allocation Engine ---
  // 1. Tithe Target (10% standard firstfruits)
  const titheTarget = (periodEarnings * defaultTithePercent) / 100;
  const isTitheFullyPaid = periodTithePaid >= titheTarget && titheTarget > 0;
  const titheShortfall = Math.max(0, titheTarget - periodTithePaid);

  // 2. Investment Target (e.g., 20%)
  const investmentTarget = (periodEarnings * targetInvestmentPercent) / 100;
  const isInvestmentTargetMet = periodInvested >= investmentTarget && investmentTarget > 0;
  const investmentGap = Math.max(0, investmentTarget - periodInvested);

  // 3. Valid Money Remained for Normal Use ("Safe-to-Spend / Personal Life")
  // Formula: Total Earned - Tithe - Investment Target = Normal Usage Pool
  const validNormalUsagePool = Math.max(0, periodEarnings - titheTarget - investmentTarget);

  // Remaining Safe-to-Spend from normal usage pool after logged expenses
  const remainingNormalUsageCash = validNormalUsagePool - periodExpenses;

  // Percentage shares for visual bar
  const titheSharePercent = periodEarnings > 0 ? (titheTarget / periodEarnings) * 100 : 10;
  const invSharePercent = periodEarnings > 0 ? (investmentTarget / periodEarnings) * 100 : 20;
  const normalUsageSharePercent = Math.max(0, 100 - titheSharePercent - invSharePercent);

  // Form Handlers
  const handlePayTithe = (e: React.FormEvent) => {
    e.preventDefault();
    const paidNum = parseFloat(tithePayAmount);
    if (isNaN(paidNum) || paidNum <= 0) return;

    const record: TitheRecord = {
      id: `tithe-${Date.now()}`,
      weekIdentifier: `${timeframeLabel}`,
      weekStartDate: filterStart ? filterStart.toISOString().split("T")[0] : todayStr,
      weekEndDate: todayStr,
      totalEarnings: periodEarnings,
      tithePercentage: defaultTithePercent,
      titheDue: titheTarget,
      tithePaid: paidNum,
      isPaid: true,
      paidAt: new Date().toISOString(),
      recipient: titheRecipient.trim() || "Local Church",
      notes: titheNotes.trim() || undefined,
    };

    onSaveTitheRecord(record);
    setShowTitheModal(false);
  };

  const handleGenerateAIProposal = async () => {
    setIsGeneratingProposal(true);
    setProposalError(null);
    try {
      const result = await requestInvestmentProposal({
        weeklyEarnings: periodEarnings,
        weeklyExpenses: periodExpenses,
        currentSavings: investments.reduce((sum, inv) => sum + inv.amount, 0),
        riskAppetite: "Disciplined Long-Term Wealth Building",
      });
      setAiProposal(result);
    } catch (err: any) {
      setProposalError(err.message || "Failed to generate proposal");
    } finally {
      setIsGeneratingProposal(false);
    }
  };

  const handleAddInvestment = (e: React.FormEvent) => {
    e.preventDefault();
    const amountNum = parseFloat(invAmount);
    if (isNaN(amountNum) || amountNum <= 0 || !invPlatform.trim()) return;

    onAddInvestment({
      amount: amountNum,
      date: invDate,
      assetType: invType,
      platformOrVehicle: invPlatform.trim(),
      notes: invNotes.trim() || undefined,
    });

    setInvAmount("");
    setInvPlatform("");
    setInvNotes("");
  };

  const totalInvestedAllTime = investments.reduce((sum, inv) => sum + inv.amount, 0);

  const cardBg = isLight
    ? "bg-white border-slate-200 text-slate-900 shadow-sm"
    : "bg-[#141417] border-white/5 text-white shadow-xl";
  const subBoxBg = isLight
    ? "bg-slate-50 border-slate-200 text-slate-800"
    : "bg-black/30 border-white/5 text-slate-200";

  return (
    <div className="space-y-8">
      {/* SECTION 1: INCOME DIVISION ACROSS TIMEFRAMES */}
      <div className={`rounded-2xl border p-6 ${cardBg}`}>
        <div className={`flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b ${
          isLight ? "border-slate-200" : "border-white/5"
        }`}>
          <div>
            <div className="flex items-center gap-2">
              <span className="p-1.5 bg-indigo-500/10 border border-indigo-500/20 rounded-lg text-indigo-500">
                <PieChart className="w-5 h-5" />
              </span>
              <h2 className={`text-base font-bold uppercase tracking-wider ${isLight ? "text-slate-900" : "text-white"}`}>
                Income Division & Multi-Timeframe Tracker
              </h2>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              View your exact income division per week, per month, per year, or between any specific custom date range.
            </p>
          </div>

          {/* Timeframe Tabs */}
          <div className={`inline-flex flex-wrap p-1 rounded-xl border text-xs font-semibold ${
            isLight ? "bg-slate-100 border-slate-200" : "bg-black/40 border-white/5"
          }`}>
            {(
              [
                { id: "week", label: "This Week" },
                { id: "month", label: "This Month" },
                { id: "year", label: "This Year" },
                { id: "custom", label: "Specific Range" },
                { id: "all", label: "All-Time" },
              ] as { id: TimeframeType; label: string }[]
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setSelectedTimeframe(tab.id)}
                className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                  selectedTimeframe === tab.id
                    ? "bg-indigo-600 text-white shadow-sm font-bold"
                    : isLight
                    ? "text-slate-600 hover:text-slate-900 hover:bg-slate-200/60"
                    : "text-slate-400 hover:text-slate-200 hover:bg-white/5"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Custom Date Range Picker if "custom" selected */}
        {selectedTimeframe === "custom" && (
          <div className={`p-4 rounded-xl border mt-4 flex flex-wrap items-center gap-4 ${subBoxBg}`}>
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-indigo-500" />
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Choose Specific Range:
              </span>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-2xs font-semibold text-slate-400">From:</label>
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className={`px-3 py-1.5 border rounded-lg text-xs font-mono focus:outline-hidden focus:border-indigo-500 ${
                  isLight
                    ? "bg-white text-slate-900 border-slate-300"
                    : "bg-[#0A0A0B] text-white border-white/10"
                }`}
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-2xs font-semibold text-slate-400">To:</label>
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className={`px-3 py-1.5 border rounded-lg text-xs font-mono focus:outline-hidden focus:border-indigo-500 ${
                  isLight
                    ? "bg-white text-slate-900 border-slate-300"
                    : "bg-[#0A0A0B] text-white border-white/10"
                }`}
              />
            </div>
          </div>
        )}

        {/* Multi-Timeframe Income Division Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
          {/* Week */}
          <div
            onClick={() => setSelectedTimeframe("week")}
            className={`p-4 rounded-xl border transition-all cursor-pointer ${
              selectedTimeframe === "week"
                ? "border-indigo-500 ring-2 ring-indigo-500/20 " + (isLight ? "bg-indigo-50/50" : "bg-indigo-950/20")
                : subBoxBg + " hover:border-indigo-500/40"
            }`}
          >
            <span className="text-2xs font-bold text-slate-500 uppercase tracking-widest block">
              Per Week (Last 7d)
            </span>
            <div className="text-xl font-bold font-mono text-emerald-500 mt-1">
              {currency}
              {weeklyEarnings.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <span className="text-2xs text-slate-400 mt-1 block">
              7-Day Earning Velocity
            </span>
          </div>

          {/* Month */}
          <div
            onClick={() => setSelectedTimeframe("month")}
            className={`p-4 rounded-xl border transition-all cursor-pointer ${
              selectedTimeframe === "month"
                ? "border-indigo-500 ring-2 ring-indigo-500/20 " + (isLight ? "bg-indigo-50/50" : "bg-indigo-950/20")
                : subBoxBg + " hover:border-indigo-500/40"
            }`}
          >
            <span className="text-2xs font-bold text-slate-500 uppercase tracking-widest block">
              Per Month ({today.toLocaleString("default", { month: "short" })})
            </span>
            <div className="text-xl font-bold font-mono text-emerald-500 mt-1">
              {currency}
              {monthlyEarnings.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <span className="text-2xs text-slate-400 mt-1 block">
              Month-to-Date Gross
            </span>
          </div>

          {/* Year */}
          <div
            onClick={() => setSelectedTimeframe("year")}
            className={`p-4 rounded-xl border transition-all cursor-pointer ${
              selectedTimeframe === "year"
                ? "border-indigo-500 ring-2 ring-indigo-500/20 " + (isLight ? "bg-indigo-50/50" : "bg-indigo-950/20")
                : subBoxBg + " hover:border-indigo-500/40"
            }`}
          >
            <span className="text-2xs font-bold text-slate-500 uppercase tracking-widest block">
              Per Year ({today.getFullYear()})
            </span>
            <div className="text-xl font-bold font-mono text-emerald-500 mt-1">
              {currency}
              {yearlyEarnings.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <span className="text-2xs text-slate-400 mt-1 block">
              Year-to-Date Gross
            </span>
          </div>

          {/* Selected Focus Scope */}
          <div className={`p-4 rounded-xl border ${isLight ? "bg-indigo-600 text-white" : "bg-indigo-950/60 border-indigo-500/40 text-white"}`}>
            <span className="text-2xs font-bold uppercase tracking-widest block text-indigo-200">
              Active Focus Period
            </span>
            <div className="text-xl font-bold font-mono mt-1">
              {currency}
              {periodEarnings.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <span className="text-2xs opacity-85 mt-1 block truncate">
              {timeframeLabel}
            </span>
          </div>
        </div>
      </div>

      {/* SECTION 2: WEALTH ALLOCATION & NORMAL USAGE CALCULATOR (The User's Core Request) */}
      <div className={`rounded-2xl border overflow-hidden ${cardBg}`}>
        <div className={`border-b p-6 ${isLight ? "border-slate-200 bg-slate-50/50" : "border-white/5 bg-white/[0.02]"}`}>
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="p-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-emerald-500">
                  <Wallet className="w-5 h-5" />
                </span>
                <h3 className={`text-base font-bold uppercase tracking-wider ${isLight ? "text-slate-900" : "text-white"}`}>
                  Wealth Allocation & Valid Normal Usage Calculator
                </h3>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Separates your income into Tithe, Investments, and your <strong>Valid Safe-to-Spend Normal Usage</strong>, and checks if you actually paid the tithe and invested the target amount.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setShowAdjustRatio(!showAdjustRatio)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl border transition-all cursor-pointer ${
                isLight
                  ? "bg-white border-slate-300 text-slate-700 hover:bg-slate-100"
                  : "bg-white/5 border-white/10 text-slate-300 hover:bg-white/10"
              }`}
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>{showAdjustRatio ? "Hide Ratio Settings" : "Adjust Allocation Rates"}</span>
            </button>
          </div>

          {/* Optional Allocation Ratio Sliders */}
          {showAdjustRatio && (
            <div className={`mt-4 p-4 rounded-xl border grid grid-cols-1 sm:grid-cols-2 gap-4 ${subBoxBg}`}>
              <div>
                <div className="flex items-center justify-between text-xs font-bold mb-1">
                  <span>Tithe Firstfruits Target:</span>
                  <span className="text-amber-500 font-mono">{defaultTithePercent}% (Biblical Standard)</span>
                </div>
                <p className="text-2xs text-slate-500">
                  Calculated automatically on all gross earnings before discretionary spending.
                </p>
              </div>

              <div>
                <div className="flex items-center justify-between text-xs font-bold mb-1">
                  <span>Target Investment Rate:</span>
                  <span className="text-indigo-500 font-mono">{targetInvestmentPercent}%</span>
                </div>
                <input
                  type="range"
                  min="5"
                  max="60"
                  step="5"
                  value={targetInvestmentPercent}
                  onChange={(e) => setTargetInvestmentPercent(parseInt(e.target.value, 10))}
                  className="w-full accent-indigo-600 cursor-pointer"
                />
                <div className="flex justify-between text-2xs text-slate-400 font-mono">
                  <span>5% (Starter)</span>
                  <span>20% (Wealth Rule)</span>
                  <span>50% (Aggressive FIRE)</span>
                </div>
              </div>
            </div>
          )}

          {/* Allocation Formula Visual Breakdown Bar */}
          <div className="mt-6">
            <div className="flex items-center justify-between text-2xs font-bold uppercase tracking-wider mb-1.5 text-slate-500">
              <span>Income Allocation Distribution</span>
              <span>100% of Gross Earned ({currency}{periodEarnings.toFixed(2)})</span>
            </div>
            <div className="h-4 w-full bg-slate-200 dark:bg-white/10 rounded-full overflow-hidden flex">
              <div
                style={{ width: `${titheSharePercent}%` }}
                className="bg-amber-500 h-full transition-all duration-300"
                title={`Tithe: ${defaultTithePercent}%`}
              />
              <div
                style={{ width: `${invSharePercent}%` }}
                className="bg-indigo-500 h-full transition-all duration-300"
                title={`Investment Target: ${targetInvestmentPercent}%`}
              />
              <div
                style={{ width: `${normalUsageSharePercent}%` }}
                className="bg-emerald-500 h-full transition-all duration-300"
                title={`Valid Normal Usage: ${normalUsageSharePercent.toFixed(0)}%`}
              />
            </div>
            <div className="flex flex-wrap items-center gap-4 text-2xs font-semibold mt-2 text-slate-500">
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                <span>Tithe: {defaultTithePercent}% ({currency}{titheTarget.toFixed(2)})</span>
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full bg-indigo-500" />
                <span>Investment Target: {targetInvestmentPercent}% ({currency}{investmentTarget.toFixed(2)})</span>
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                <span>Valid Normal Usage: {normalUsageSharePercent.toFixed(0)}% ({currency}{validNormalUsagePool.toFixed(2)})</span>
              </span>
            </div>
          </div>
        </div>

        {/* 4 Pillars Grid: Income -> Tithe Check -> Investment Check -> Valid Normal Usage Remained */}
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* 1. TOTAL EARNED */}
            <div className={`p-4 rounded-xl border ${subBoxBg}`}>
              <span className="text-2xs font-bold uppercase tracking-widest text-slate-500 block">
                1. Total Earned
              </span>
              <div className="text-2xl font-bold font-mono text-emerald-500 mt-1">
                {currency}
                {periodEarnings.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <p className="text-2xs text-slate-500 mt-1.5">
                Gross inflows during {timeframeLabel.toLowerCase()}
              </p>
            </div>

            {/* 2. TITHE ALLOCATION & VERIFICATION CHECK */}
            <div className={`p-4 rounded-xl border ${
              isTitheFullyPaid
                ? isLight
                  ? "bg-emerald-50/60 border-emerald-300"
                  : "bg-emerald-950/20 border-emerald-500/30"
                : titheTarget > 0
                ? isLight
                  ? "bg-amber-50/60 border-amber-300"
                  : "bg-amber-950/20 border-amber-500/30"
                : subBoxBg
            }`}>
              <div className="flex items-center justify-between">
                <span className="text-2xs font-bold uppercase tracking-widest text-slate-500">
                  2. 10% Tithe Stewardship
                </span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                  isTitheFullyPaid
                    ? "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
                    : "bg-amber-500/20 text-amber-600 dark:text-amber-400 border-amber-500/30"
                }`}>
                  {isTitheFullyPaid ? "PAID ✅" : "PENDING ⚠️"}
                </span>
              </div>

              <div className="text-xl font-bold font-mono text-amber-500 mt-1">
                {currency}{titheTarget.toFixed(2)}
              </div>

              {/* Tithe Verification details */}
              <div className="mt-2 text-2xs space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-500">Actual Paid:</span>
                  <span className="font-mono font-bold">{currency}{periodTithePaid.toFixed(2)}</span>
                </div>
                {titheShortfall > 0 ? (
                  <div className="flex justify-between text-rose-500 font-semibold">
                    <span>Shortfall remaining:</span>
                    <span className="font-mono">-{currency}{titheShortfall.toFixed(2)}</span>
                  </div>
                ) : (
                  <div className="text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                    <Check className="w-3 h-3" />
                    <span>Tithe fully honored for this period</span>
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={() => {
                  setTithePayAmount(titheShortfall > 0 ? titheShortfall.toFixed(2) : titheTarget.toFixed(2));
                  setShowTitheModal(true);
                }}
                className={`w-full mt-3 py-1.5 px-3 rounded-lg text-2xs font-bold transition-all cursor-pointer shadow-xs ${
                  isTitheFullyPaid
                    ? isLight ? "bg-slate-200 text-slate-700 hover:bg-slate-300" : "bg-white/10 text-slate-200 hover:bg-white/20"
                    : "bg-amber-600 hover:bg-amber-500 text-white shadow-amber-600/20"
                }`}
              >
                {isTitheFullyPaid ? "Add Extra Contribution" : "Fulfill Tithe Now"}
              </button>
            </div>

            {/* 3. INVESTMENT TARGET & VERIFICATION CHECK */}
            <div className={`p-4 rounded-xl border ${
              isInvestmentTargetMet
                ? isLight
                  ? "bg-indigo-50/60 border-indigo-300"
                  : "bg-indigo-950/20 border-indigo-500/30"
                : investmentTarget > 0
                ? isLight
                  ? "bg-slate-50 border-indigo-200"
                  : "bg-indigo-950/10 border-indigo-500/20"
                : subBoxBg
            }`}>
              <div className="flex items-center justify-between">
                <span className="text-2xs font-bold uppercase tracking-widest text-slate-500">
                  3. Investment ({targetInvestmentPercent}%)
                </span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                  isInvestmentTargetMet
                    ? "bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 border-indigo-500/30"
                    : "bg-slate-500/20 text-slate-500 border-slate-500/30"
                }`}>
                  {isInvestmentTargetMet ? "INVESTED ✅" : "IN PROGRESS ⏳"}
                </span>
              </div>

              <div className="text-xl font-bold font-mono text-indigo-500 mt-1">
                {currency}{investmentTarget.toFixed(2)}
              </div>

              {/* Investment Verification details */}
              <div className="mt-2 text-2xs space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-500">Actual Invested:</span>
                  <span className="font-mono font-bold text-indigo-500">{currency}{periodInvested.toFixed(2)}</span>
                </div>
                {investmentGap > 0 ? (
                  <div className="flex justify-between text-amber-600 dark:text-amber-400 font-semibold">
                    <span>Remaining to invest:</span>
                    <span className="font-mono">-{currency}{investmentGap.toFixed(2)}</span>
                  </div>
                ) : (
                  <div className="text-indigo-600 dark:text-indigo-400 font-semibold flex items-center gap-1">
                    <Check className="w-3 h-3" />
                    <span>Target fulfilled ({((periodInvested / investmentTarget) * 100).toFixed(0)}%)</span>
                  </div>
                )}
              </div>

              <a
                href="#record-investment-form"
                className={`block text-center w-full mt-3 py-1.5 px-3 rounded-lg text-2xs font-bold transition-all cursor-pointer shadow-xs ${
                  isInvestmentTargetMet
                    ? isLight ? "bg-slate-200 text-slate-700 hover:bg-slate-300" : "bg-white/10 text-slate-200 hover:bg-white/20"
                    : "bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-600/20"
                }`}
              >
                Record Investment
              </a>
            </div>

            {/* 4. VALID MONEY REMAINED FOR NORMAL USAGE */}
            <div className={`p-4 rounded-xl border ${
              remainingNormalUsageCash >= 0
                ? isLight
                  ? "bg-emerald-50 border-emerald-300 text-emerald-950"
                  : "bg-emerald-950/40 border-emerald-500/40 text-white"
                : isLight
                ? "bg-rose-50 border-rose-300 text-rose-950"
                : "bg-rose-950/40 border-rose-500/40 text-white"
            }`}>
              <div className="flex items-center justify-between">
                <span className="text-2xs font-bold uppercase tracking-widest text-emerald-600 dark:text-emerald-400">
                  4. Valid Normal Usage
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                  SAFE TO SPEND
                </span>
              </div>

              <div className="text-2xl font-bold font-mono text-emerald-600 dark:text-emerald-400 mt-1">
                {currency}{validNormalUsagePool.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>

              <p className="text-2xs opacity-80 mt-1">
                Earned ({currency}{periodEarnings.toFixed(0)}) - Tithe ({currency}{titheTarget.toFixed(0)}) - Inv ({currency}{investmentTarget.toFixed(0)})
              </p>

              {/* Day-to-Day Expenses vs Normal Usage Pool */}
              <div className="mt-3 pt-2 border-t border-emerald-500/20 text-2xs space-y-1">
                <div className="flex justify-between">
                  <span className="opacity-80">Logged Normal Living Expenses:</span>
                  <span className="font-mono font-bold text-rose-500">-{currency}{periodExpenses.toFixed(2)}</span>
                </div>
                <div className="flex justify-between font-bold pt-0.5 border-t border-emerald-500/20">
                  <span>Net Remaining Cash:</span>
                  <span className={`font-mono ${remainingNormalUsageCash >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-500"}`}>
                    {remainingNormalUsageCash >= 0 ? "+" : ""}{currency}{remainingNormalUsageCash.toFixed(2)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Plain Language Summary Box */}
          <div className={`mt-4 p-4 rounded-xl border flex items-start gap-3 text-xs leading-relaxed ${
            isLight ? "bg-slate-50 border-slate-200 text-slate-700" : "bg-black/20 border-white/5 text-slate-300"
          }`}>
            <HelpCircle className="w-4 h-4 text-indigo-500 shrink-0 mt-0.5" />
            <div>
              <strong>Executive Financial Formula:</strong> In this period you earned{" "}
              <strong className="text-emerald-500">{currency}{periodEarnings.toFixed(2)}</strong>. You set aside{" "}
              <strong className="text-amber-500">{currency}{titheTarget.toFixed(2)}</strong> (10%) for faithful tithe, and{" "}
              <strong className="text-indigo-500">{currency}{investmentTarget.toFixed(2)}</strong> ({targetInvestmentPercent}%) for long-term compound wealth. That leaves exactly{" "}
              <strong className="text-emerald-500">{currency}{validNormalUsagePool.toFixed(2)}</strong> as valid money remaining for personal groceries, dining, housing, bills, and everyday normal usage.
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 3: TITHE PAYMENT HISTORY & STATUS */}
      <div className={`rounded-2xl border overflow-hidden ${cardBg}`}>
        <div className={`border-b px-6 py-4 flex items-center justify-between ${
          isLight ? "border-slate-200 bg-slate-50/50" : "border-white/5 bg-white/[0.02]"
        }`}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-500 flex items-center justify-center font-bold">
              <Coins className="w-5 h-5" />
            </div>
            <div>
              <h3 className={`text-sm font-bold uppercase tracking-wider ${isLight ? "text-slate-900" : "text-white"}`}>
                Tithe Stewardship Records
              </h3>
              <p className="text-xs text-slate-500">
                Log and audit your faithful firstfruits tithes across each financial cycle
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              setTithePayAmount(titheShortfall > 0 ? titheShortfall.toFixed(2) : titheTarget.toFixed(2));
              setShowTitheModal(true);
            }}
            className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-amber-600 hover:bg-amber-500 transition-all shadow-md shadow-amber-600/20 cursor-pointer"
          >
            Record Tithe Payment
          </button>
        </div>

        <div className="p-6">
          {titheRecords.length === 0 ? (
            <p className="text-xs text-slate-500 italic">No previous tithe records logged yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className={`w-full text-left text-xs border rounded-xl overflow-hidden ${
                isLight ? "border-slate-200" : "border-white/5"
              }`}>
                <thead className={`uppercase text-[10px] tracking-wider border-b ${
                  isLight ? "bg-slate-100 text-slate-600 border-slate-200" : "bg-white/[0.03] text-slate-400 border-white/5"
                }`}>
                  <tr>
                    <th className="py-2.5 px-3">Period / Reference</th>
                    <th className="py-2.5 px-3">Gross Earned</th>
                    <th className="py-2.5 px-3">Tithe Due (10%)</th>
                    <th className="py-2.5 px-3">Amount Paid</th>
                    <th className="py-2.5 px-3">Recipient</th>
                    <th className="py-2.5 px-3">Status</th>
                  </tr>
                </thead>
                <tbody className={`divide-y ${isLight ? "divide-slate-200" : "divide-white/5"}`}>
                  {titheRecords.map((t) => (
                    <tr key={t.id} className={isLight ? "hover:bg-slate-50" : "hover:bg-white/[0.02]"}>
                      <td className={`py-2.5 px-3 font-medium ${isLight ? "text-slate-800" : "text-slate-300"}`}>{t.weekIdentifier}</td>
                      <td className="py-2.5 px-3 font-mono text-slate-500">
                        {currency}{t.totalEarnings.toFixed(2)}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-amber-500">
                        {currency}{t.titheDue.toFixed(2)}
                      </td>
                      <td className="py-2.5 px-3 font-mono font-semibold text-emerald-500">
                        {currency}{t.tithePaid.toFixed(2)}
                      </td>
                      <td className="py-2.5 px-3 text-slate-500">{t.recipient || "Local Church"}</td>
                      <td className="py-2.5 px-3">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 border border-emerald-500/20 text-emerald-500">
                          <Check className="w-3 h-3" /> PAID
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* SECTION 4: AI INVESTMENT ADVISOR & PORTFOLIO RECORDING */}
      <div id="record-investment-form" className={`rounded-2xl border overflow-hidden ${cardBg}`}>
        <div className={`border-b px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
          isLight ? "border-slate-200 bg-slate-50/50" : "border-white/5 bg-white/[0.02]"
        }`}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-500 flex items-center justify-center font-bold">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <h3 className={`text-sm font-bold uppercase tracking-wider ${isLight ? "text-slate-900" : "text-white"}`}>
                AI Investment Advisor & Portfolio Ledger
              </h3>
              <p className="text-xs text-slate-500">
                Log real assets and ask Gemini AI for optimal capital allocation strategies
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleGenerateAIProposal}
            disabled={isGeneratingProposal}
            className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl shadow-lg shadow-indigo-600/20 transition-all disabled:opacity-50 cursor-pointer"
          >
            <Sparkles className="w-4 h-4" />
            <span>{isGeneratingProposal ? "Analyzing Rate..." : "Propose Investment with AI"}</span>
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Rate Summary */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className={`p-4 rounded-xl border ${subBoxBg}`}>
              <span className="text-2xs text-slate-500 font-bold uppercase tracking-widest">Selected Inflow</span>
              <div className="text-lg font-bold font-mono text-emerald-500 mt-1">
                {currency}{periodEarnings.toFixed(2)}
              </div>
            </div>

            <div className={`p-4 rounded-xl border ${subBoxBg}`}>
              <span className="text-2xs text-slate-500 font-bold uppercase tracking-widest">Normal Expenses Spent</span>
              <div className="text-lg font-bold font-mono text-rose-500 mt-1">
                {currency}{periodExpenses.toFixed(2)}
              </div>
            </div>

            <div className={`p-4 rounded-xl border ${subBoxBg}`}>
              <span className="text-2xs text-slate-500 font-bold uppercase tracking-widest">Total Invested So Far</span>
              <div className="text-lg font-bold font-mono text-indigo-500 mt-1">
                {currency}{totalInvestedAllTime.toFixed(2)}
              </div>
            </div>
          </div>

          {/* AI Proposal Display */}
          {proposalError && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-500 text-xs rounded-xl">
              {proposalError}
            </div>
          )}

          {aiProposal && (
            <div className={`p-5 rounded-xl border space-y-3 ${
              isLight
                ? "bg-indigo-50/80 border-indigo-200 text-slate-800"
                : "bg-indigo-950/20 border-indigo-500/20 text-slate-200"
            }`}>
              <div className="flex items-center gap-2 text-indigo-500 font-semibold text-sm">
                <Sparkles className="w-4 h-4" />
                <span>Gemini AI Investment Proposal</span>
              </div>
              <div className="text-xs whitespace-pre-line leading-relaxed font-sans">
                {aiProposal}
              </div>
            </div>
          )}

          {/* Form to log actual investment */}
          <div className={`p-5 rounded-xl border ${subBoxBg}`}>
            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">
              Record an Investment Made
            </h4>
            <form onSubmit={handleAddInvestment} className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block text-2xs font-semibold text-slate-500 mb-1">
                    Amount ({currency}) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    min="0.01"
                    placeholder="250.00"
                    value={invAmount}
                    onChange={(e) => setInvAmount(e.target.value)}
                    className={`w-full px-3 py-2 border rounded-xl text-xs font-mono focus:outline-hidden focus:border-indigo-500 ${
                      isLight
                        ? "bg-white text-slate-900 border-slate-300"
                        : "bg-white/5 text-white border-white/10"
                    }`}
                  />
                </div>

                <div>
                  <label className="block text-2xs font-semibold text-slate-500 mb-1">Date *</label>
                  <input
                    type="date"
                    required
                    value={invDate}
                    onChange={(e) => setInvDate(e.target.value)}
                    className={`w-full px-3 py-2 border rounded-xl text-xs font-mono focus:outline-hidden focus:border-indigo-500 ${
                      isLight
                        ? "bg-white text-slate-900 border-slate-300"
                        : "bg-white/5 text-white border-white/10"
                    }`}
                  />
                </div>

                <div>
                  <label className="block text-2xs font-semibold text-slate-500 mb-1">
                    Asset Class *
                  </label>
                  <select
                    value={invType}
                    onChange={(e) => setInvType(e.target.value as any)}
                    className={`w-full px-3 py-2 border rounded-xl text-xs focus:outline-hidden focus:border-indigo-500 ${
                      isLight
                        ? "bg-white text-slate-900 border-slate-300"
                        : "bg-[#1b1b20] text-white border-white/10"
                    }`}
                  >
                    <option value="Index Fund / ETF">Index Fund / ETF</option>
                    <option value="Stocks">Stocks</option>
                    <option value="High-Yield Savings">High-Yield Savings</option>
                    <option value="Real Estate">Real Estate</option>
                    <option value="Bonds / Fixed">Bonds / Fixed</option>
                    <option value="Crypto">Crypto</option>
                    <option value="Skills & Business">Skills & Business</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <div>
                  <label className="block text-2xs font-semibold text-slate-500 mb-1">
                    Platform / Vehicle *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Vanguard S&P 500, Fidelity, High Yield"
                    value={invPlatform}
                    onChange={(e) => setInvPlatform(e.target.value)}
                    className={`w-full px-3 py-2 border rounded-xl text-xs focus:outline-hidden focus:border-indigo-500 ${
                      isLight
                        ? "bg-white text-slate-900 border-slate-300 placeholder-slate-400"
                        : "bg-white/5 text-white border-white/10 placeholder-slate-500"
                    }`}
                  />
                </div>
              </div>

              <div className="flex items-center justify-between pt-2 gap-4">
                <input
                  type="text"
                  placeholder="Notes (optional, e.g. scheduled monthly DCA or bonus reinvestment)"
                  value={invNotes}
                  onChange={(e) => setInvNotes(e.target.value)}
                  className={`flex-1 px-3 py-2 border rounded-xl text-xs focus:outline-hidden focus:border-indigo-500 ${
                    isLight
                      ? "bg-white text-slate-900 border-slate-300 placeholder-slate-400"
                      : "bg-white/5 text-white border-white/10 placeholder-slate-500"
                  }`}
                />

                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-xl shadow-lg shadow-emerald-600/20 flex items-center gap-1.5 shrink-0 cursor-pointer"
                >
                  <PlusCircle className="w-3.5 h-3.5" />
                  Save Investment
                </button>
              </div>
            </form>
          </div>

          {/* Investment Portfolio Ledger */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest">
                Investment Portfolio History
              </h4>
              <span className="text-xs font-bold font-mono text-indigo-500">
                Total Portfolio: {currency}{totalInvestedAllTime.toFixed(2)}
              </span>
            </div>

            {investments.length === 0 ? (
              <p className="text-xs text-slate-500 italic">No investments logged yet.</p>
            ) : (
              <div className={`divide-y border rounded-xl overflow-hidden ${
                isLight ? "divide-slate-200 border-slate-200" : "divide-white/5 border-white/5"
              }`}>
                {investments.map((inv) => (
                  <div
                    key={inv.id}
                    className={`p-3.5 flex items-center justify-between gap-4 text-xs transition-colors ${
                      isLight ? "bg-white hover:bg-slate-50" : "bg-[#141417] hover:bg-white/[0.02]"
                    }`}
                  >
                    <div>
                      <span className={`font-semibold ${isLight ? "text-slate-900" : "text-white"}`}>
                        {inv.platformOrVehicle}
                      </span>
                      <span className={`ml-2 px-2 py-0.5 rounded text-2xs font-medium border ${
                        isLight ? "bg-slate-100 border-slate-200 text-slate-600" : "bg-white/5 border-white/5 text-slate-400"
                      }`}>
                        {inv.assetType}
                      </span>
                      {inv.notes && <span className="ml-2 text-slate-500 italic">({inv.notes})</span>}
                      <span className="block text-2xs font-mono text-slate-400 mt-0.5">{inv.date}</span>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="font-bold font-mono text-emerald-500 text-sm">
                        +{currency}{inv.amount.toFixed(2)}
                      </span>
                      <button
                        onClick={() => onDeleteInvestment(inv.id)}
                        className="text-slate-400 hover:text-rose-500 transition-colors p-1 cursor-pointer"
                        title="Delete investment record"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* TITHE PAYMENT MODAL */}
      {showTitheModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4">
          <div className={`rounded-2xl shadow-2xl max-w-md w-full p-6 border ${cardBg}`}>
            <h3 className={`text-base font-bold mb-1 ${isLight ? "text-slate-900" : "text-white"}`}>
              Record Tithe Payment
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Confirm your faithful 10% firstfruits stewardship contribution for this period.
            </p>

            <form onSubmit={handlePayTithe} className="space-y-4">
              <div>
                <label className="block text-2xs font-semibold text-slate-500 uppercase mb-1">
                  Amount to Pay ({currency}) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={tithePayAmount}
                  onChange={(e) => setTithePayAmount(e.target.value)}
                  className={`w-full px-3.5 py-2.5 border rounded-xl text-sm font-mono focus:outline-hidden focus:border-amber-500 ${
                    isLight
                      ? "bg-white text-slate-900 border-slate-300"
                      : "bg-white/5 text-white border-white/10"
                  }`}
                />
              </div>

              <div>
                <label className="block text-2xs font-semibold text-slate-500 uppercase mb-1">
                  Church / Ministry / Beneficiary *
                </label>
                <input
                  type="text"
                  required
                  value={titheRecipient}
                  onChange={(e) => setTitheRecipient(e.target.value)}
                  className={`w-full px-3.5 py-2.5 border rounded-xl text-xs focus:outline-hidden focus:border-amber-500 ${
                    isLight
                      ? "bg-white text-slate-900 border-slate-300"
                      : "bg-white/5 text-white border-white/10"
                  }`}
                />
              </div>

              <div>
                <label className="block text-2xs font-semibold text-slate-500 uppercase mb-1">
                  Notes (Optional)
                </label>
                <input
                  type="text"
                  placeholder="Receipt number, bank transfer, cash, etc."
                  value={titheNotes}
                  onChange={(e) => setTitheNotes(e.target.value)}
                  className={`w-full px-3.5 py-2.5 border rounded-xl text-xs focus:outline-hidden focus:border-amber-500 ${
                    isLight
                      ? "bg-white text-slate-900 border-slate-300 placeholder-slate-400"
                      : "bg-white/5 text-white border-white/10 placeholder-slate-500"
                  }`}
                />
              </div>

              <div className={`flex justify-end gap-2 pt-3 border-t ${isLight ? "border-slate-200" : "border-white/5"}`}>
                <button
                  type="button"
                  onClick={() => setShowTitheModal(false)}
                  className={`px-4 py-2 text-xs font-semibold rounded-xl border transition-all cursor-pointer ${
                    isLight
                      ? "border-slate-300 text-slate-600 hover:bg-slate-100"
                      : "border-white/10 text-slate-400 hover:text-white"
                  }`}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold text-white bg-amber-600 hover:bg-amber-500 rounded-xl shadow-lg shadow-amber-600/20 cursor-pointer"
                >
                  Confirm Tithe Paid
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
