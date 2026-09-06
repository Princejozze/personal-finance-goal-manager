import React, { useState } from "react";
import {
  PlusCircle,
  TrendingDown,
  TrendingUp,
  DollarSign,
  Briefcase,
  Tag,
  Trash2,
  Calendar,
  Filter,
  CheckCircle,
  AlertCircle,
  ChevronDown,
  BarChart3,
  ArrowRight,
} from "lucide-react";
import { Expense, Earning, ExpenseCategory, EarningCategory, NecessityRating } from "../types";

interface DailyMoneyTrackerProps {
  expenses: Expense[];
  earnings: Earning[];
  currency: string;
  theme?: "dark" | "light";
  onViewAnalytics?: () => void;
  onAddExpense: (expense: Omit<Expense, "id" | "createdAt">) => void;
  onAddEarning: (earning: Omit<Earning, "id" | "createdAt">) => void;
  onDeleteExpense: (id: string) => void;
  onDeleteEarning: (id: string) => void;
}

const EXPENSE_CATEGORIES: ExpenseCategory[] = [
  "Food & Dining",
  "Housing & Rent",
  "Transportation",
  "Utilities & Bills",
  "Health & Medical",
  "Education & Books",
  "Shopping & Personal",
  "Entertainment",
  "Family & Kids",
  "Business & Work",
  "Other",
];

const EARNING_CATEGORIES: EarningCategory[] = [
  "Salary / Wage",
  "Freelance / Contract",
  "Business Revenue",
  "Investment / Dividend",
  "Consulting",
  "Bonus / Gift",
  "Other",
];

export const DailyMoneyTracker: React.FC<DailyMoneyTrackerProps> = ({
  expenses,
  earnings,
  currency,
  theme = "dark",
  onViewAnalytics,
  onAddExpense,
  onAddEarning,
  onDeleteExpense,
  onDeleteEarning,
}) => {
  const isLight = theme === "light";
  const cardBg = isLight
    ? "bg-white border-slate-200 text-slate-900 shadow-sm"
    : "bg-[#141417] border-white/5 text-white shadow-xl";
  const todayStr = new Date().toISOString().split("T")[0];

  const [activeForm, setActiveForm] = useState<"expense" | "earning">("expense");

  // Expense Form State
  const [expenseAmount, setExpenseAmount] = useState("");
  const [expenseDate, setExpenseDate] = useState(todayStr);
  const [expensePurpose, setExpensePurpose] = useState("");
  const [expenseCategory, setExpenseCategory] = useState<ExpenseCategory>("Food & Dining");
  const [expenseNecessity, setExpenseNecessity] = useState<NecessityRating>("Essential");
  const [expenseNotes, setExpenseNotes] = useState("");

  // Earning Form State
  const [earningAmount, setEarningAmount] = useState("");
  const [earningDate, setEarningDate] = useState(todayStr);
  const [earningSource, setEarningSource] = useState("");
  const [earningJob, setEarningJob] = useState("");
  const [earningCategory, setEarningCategory] = useState<EarningCategory>("Salary / Wage");
  const [earningNotes, setEarningNotes] = useState("");

  // Ledger Filter
  const [filterType, setFilterType] = useState<"all" | "expenses" | "earnings">("all");
  const [filterDate, setFilterDate] = useState<string>("");

  const handleExpenseSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const amountNum = parseFloat(expenseAmount);
    if (isNaN(amountNum) || amountNum <= 0 || !expensePurpose.trim()) {
      return;
    }

    onAddExpense({
      amount: amountNum,
      date: expenseDate,
      purpose: expensePurpose.trim(),
      category: expenseCategory,
      necessityRating: expenseNecessity,
      notes: expenseNotes.trim() || undefined,
    });

    setExpenseAmount("");
    setExpensePurpose("");
    setExpenseNotes("");
  };

  const handleEarningSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const amountNum = parseFloat(earningAmount);
    if (isNaN(amountNum) || amountNum <= 0 || !earningSource.trim() || !earningJob.trim()) {
      return;
    }

    onAddEarning({
      amount: amountNum,
      date: earningDate,
      source: earningSource.trim(),
      jobDescription: earningJob.trim(),
      category: earningCategory,
      notes: earningNotes.trim() || undefined,
    });

    setEarningAmount("");
    setEarningSource("");
    setEarningJob("");
    setEarningNotes("");
  };

  // Calculations for Today
  const todayExpenses = expenses
    .filter((e) => e.date === todayStr)
    .reduce((sum, e) => sum + e.amount, 0);

  const todayEarnings = earnings
    .filter((e) => e.date === todayStr)
    .reduce((sum, e) => sum + e.amount, 0);

  const todayNet = todayEarnings - todayExpenses;

  // Combined and sorted transactions
  const combinedTransactions = [
    ...expenses.map((e) => ({ ...e, txnType: "expense" as const })),
    ...earnings.map((e) => ({ ...e, txnType: "earning" as const })),
  ]
    .filter((t) => {
      if (filterType === "expenses") return t.txnType === "expense";
      if (filterType === "earnings") return t.txnType === "earning";
      return true;
    })
    .filter((t) => (!filterDate ? true : t.date === filterDate))
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return (
    <div className="space-y-6">
      {/* Quick Visuals & Analytics Banner */}
      {onViewAnalytics && (
        <div
          className={`p-4 rounded-2xl border flex flex-col sm:flex-row items-center justify-between gap-3 transition-colors ${
            isLight
              ? "bg-indigo-50 border-indigo-200 text-slate-800"
              : "bg-indigo-950/20 border-indigo-500/20 text-indigo-200"
          }`}
        >
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-md">
              <BarChart3 className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider">Visual Graphs & Progress Analytics</h4>
              <p className="text-2xs opacity-80">
                Visualize daily cash flows, category spending breakdowns, task velocity, and health graphs.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onViewAnalytics}
            className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl transition-all shadow-md shadow-indigo-600/20 shrink-0 cursor-pointer"
          >
            <span>View Graphs Tab</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Top Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Today's Spent */}
        <div className={`rounded-2xl p-5 border ${cardBg}`}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">
              Today's Spent
            </span>
            <div className="w-8 h-8 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center">
              <TrendingDown className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold font-mono text-rose-400">
            -{currency}
            {todayExpenses.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <p className="text-xs text-slate-500 mt-1">
            {expenses.filter((e) => e.date === todayStr).length} expense item(s) logged today
          </p>
        </div>

        {/* Today's Earned */}
        <div className={`rounded-2xl p-5 border ${cardBg}`}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">
              Today's Earned
            </span>
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold font-mono text-emerald-400">
            +{currency}
            {todayEarnings.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <p className="text-xs text-slate-500 mt-1">
            {earnings.filter((e) => e.date === todayStr).length} income entry(s) logged today
          </p>
        </div>

        {/* Today's Net Balance */}
        <div className={`rounded-2xl p-5 border ${cardBg}`}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">
              Today's Net Flow
            </span>
            <div
              className={`w-8 h-8 rounded-lg flex items-center justify-center border ${
                todayNet >= 0
                  ? "bg-indigo-500/10 border-indigo-500/20 text-indigo-400"
                  : "bg-rose-500/10 border-rose-500/20 text-rose-400"
              }`}
            >
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div
            className={`mt-2 text-2xl font-bold font-mono ${
              todayNet >= 0 ? "text-indigo-400" : "text-rose-400"
            }`}
          >
            {todayNet >= 0 ? "+" : "-"}
            {currency}
            {Math.abs(todayNet).toLocaleString("en-US", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </div>
          <p className="text-xs text-slate-500 mt-1">
            {todayNet >= 0 ? "Surplus available for tithe & investment" : "Net deficit for today"}
          </p>
        </div>
      </div>

      {/* Main Logging Card */}
      <div className={`rounded-2xl border shadow-xl overflow-hidden ${cardBg}`}>
        <div className={`border-b px-6 py-4 flex items-center justify-between ${
          isLight ? "border-slate-200 bg-slate-50/50" : "border-white/5 bg-white/[0.02]"
        }`}>
          <div className="flex items-center gap-2">
            <PlusCircle className="w-4 h-4 text-indigo-500" />
            <h2 className={`text-xs font-bold uppercase tracking-widest ${isLight ? "text-slate-700" : "text-slate-400"}`}>
              Log Daily Money Activity
            </h2>
          </div>
          {/* Segmented Form Switcher */}
          <div className={`inline-flex rounded-lg p-1 text-xs font-medium border ${
            isLight ? "bg-slate-100 border-slate-200" : "bg-black/40 border-white/5"
          }`}>
            <button
              type="button"
              onClick={() => setActiveForm("expense")}
              className={`px-3 py-1 rounded-md transition-all cursor-pointer ${
                activeForm === "expense"
                  ? isLight
                    ? "bg-rose-500 text-white font-semibold shadow-xs"
                    : "bg-rose-500/20 text-rose-300 font-semibold border border-rose-500/30"
                  : isLight
                  ? "text-slate-600 hover:text-slate-900"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Record Expense
            </button>
            <button
              type="button"
              onClick={() => setActiveForm("earning")}
              className={`px-3 py-1 rounded-md transition-all cursor-pointer ${
                activeForm === "earning"
                  ? isLight
                    ? "bg-emerald-600 text-white font-semibold shadow-xs"
                    : "bg-emerald-500/20 text-emerald-300 font-semibold border border-emerald-500/30"
                  : isLight
                  ? "text-slate-600 hover:text-slate-900"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Record Earning
            </button>
          </div>
        </div>

        <div className="p-6">
          {activeForm === "expense" ? (
            <form onSubmit={handleExpenseSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* Amount */}
                <div>
                  <label className={`block text-xs font-medium mb-1 ${isLight ? "text-slate-700" : "text-slate-400"}`}>
                    Amount Spent ({currency}) *
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400 font-medium">
                      {currency}
                    </span>
                    <input
                      type="number"
                      step="0.01"
                      required
                      min="0.01"
                      placeholder="0.00"
                      value={expenseAmount}
                      onChange={(e) => setExpenseAmount(e.target.value)}
                      className={`w-full pl-8 pr-3 py-2 border rounded-xl text-sm transition-all font-mono focus:outline-hidden focus:ring-1 focus:ring-rose-500 focus:border-rose-500 ${
                        isLight
                          ? "bg-white text-slate-900 border-slate-300 placeholder-slate-400"
                          : "bg-white/5 text-slate-200 border-white/10 placeholder-slate-500 focus:bg-white/10"
                      }`}
                    />
                  </div>
                </div>

                {/* Date */}
                <div>
                  <label className={`block text-xs font-medium mb-1 ${isLight ? "text-slate-700" : "text-slate-400"}`}>
                    Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={expenseDate}
                    onChange={(e) => setExpenseDate(e.target.value)}
                    className={`w-full px-3 py-2 border rounded-xl text-sm transition-all focus:outline-hidden focus:ring-1 focus:ring-rose-500 ${
                      isLight
                        ? "bg-white text-slate-900 border-slate-300"
                        : "bg-white/5 text-slate-200 border-white/10 focus:bg-white/10"
                    }`}
                  />
                </div>

                {/* Category */}
                <div>
                  <label className={`block text-xs font-medium mb-1 ${isLight ? "text-slate-700" : "text-slate-400"}`}>
                    Category *
                  </label>
                  <select
                    value={expenseCategory}
                    onChange={(e) => setExpenseCategory(e.target.value as ExpenseCategory)}
                    className={`w-full px-3 py-2 border rounded-xl text-sm transition-all focus:outline-hidden focus:ring-1 focus:ring-rose-500 ${
                      isLight
                        ? "bg-white text-slate-900 border-slate-300"
                        : "bg-[#1b1b20] text-slate-200 border-white/10 focus:bg-[#22222a]"
                    }`}
                  >
                    {EXPENSE_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat} className={isLight ? "bg-white text-slate-900" : "bg-[#1b1b20] text-slate-200"}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Purpose */}
                <div>
                  <label className={`block text-xs font-medium mb-1 ${isLight ? "text-slate-700" : "text-slate-400"}`}>
                    Purpose (What did you use this money for?) *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g., Weekly supermarket groceries, Taxi ride to client, Gas refill"
                    value={expensePurpose}
                    onChange={(e) => setExpensePurpose(e.target.value)}
                    className={`w-full px-3 py-2 border rounded-xl text-sm transition-all focus:outline-hidden focus:ring-1 focus:ring-rose-500 ${
                      isLight
                        ? "bg-white text-slate-900 border-slate-300 placeholder-slate-400"
                        : "bg-white/5 text-slate-200 border-white/10 placeholder-slate-500 focus:bg-white/10"
                    }`}
                  />
                </div>

                {/* Necessity Rating */}
                <div>
                  <label className={`block text-xs font-medium mb-1 ${isLight ? "text-slate-700" : "text-slate-400"}`}>
                    Necessity Assessment (For AI Weekly Utility Audit)
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {(["Essential", "Useful", "Discretionary", "Wasteful"] as NecessityRating[]).map(
                      (rating) => (
                        <button
                          key={rating}
                          type="button"
                          onClick={() => setExpenseNecessity(rating)}
                          className={`py-1.5 px-2 text-xs font-medium rounded-lg border transition-all text-center cursor-pointer ${
                            expenseNecessity === rating
                              ? rating === "Essential"
                                ? isLight
                                  ? "bg-emerald-100 border-emerald-400 text-emerald-800 font-bold"
                                  : "bg-emerald-500/10 border-emerald-500/40 text-emerald-300 font-semibold"
                                : rating === "Useful"
                                ? isLight
                                  ? "bg-indigo-100 border-indigo-400 text-indigo-800 font-bold"
                                  : "bg-indigo-500/10 border-indigo-500/40 text-indigo-300 font-semibold"
                                : rating === "Discretionary"
                                ? isLight
                                  ? "bg-amber-100 border-amber-400 text-amber-800 font-bold"
                                  : "bg-amber-500/10 border-amber-500/40 text-amber-300 font-semibold"
                                : isLight
                                ? "bg-rose-100 border-rose-400 text-rose-800 font-bold"
                                : "bg-rose-500/10 border-rose-500/40 text-rose-300 font-semibold"
                              : isLight
                              ? "bg-slate-100 border-slate-200 text-slate-600 hover:bg-slate-200"
                              : "bg-white/5 border-white/5 text-slate-400 hover:bg-white/10"
                          }`}
                        >
                          {rating}
                        </button>
                      )
                    )}
                  </div>
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className={`block text-xs font-medium mb-1 ${isLight ? "text-slate-700" : "text-slate-400"}`}>
                  Additional Notes (Optional)
                </label>
                <input
                  type="text"
                  placeholder="Receipt reference, vendor name, or context"
                  value={expenseNotes}
                  onChange={(e) => setExpenseNotes(e.target.value)}
                  className={`w-full px-3 py-2 border rounded-xl text-sm transition-all focus:outline-hidden focus:ring-1 focus:ring-rose-500 ${
                    isLight
                      ? "bg-white text-slate-900 border-slate-300 placeholder-slate-400"
                      : "bg-white/5 text-slate-200 border-white/10 placeholder-slate-500 focus:bg-white/10"
                  }`}
                />
              </div>

              <div className="flex justify-end pt-1">
                <button
                  type="submit"
                  className="px-5 py-2 bg-rose-600 hover:bg-rose-500 text-white text-xs sm:text-sm font-semibold rounded-xl shadow-lg shadow-rose-600/20 transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <PlusCircle className="w-4 h-4" />
                  Save Expense
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleEarningSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* Amount */}
                <div>
                  <label className={`block text-xs font-medium mb-1 ${isLight ? "text-slate-700" : "text-slate-400"}`}>
                    Amount Earned ({currency}) *
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400 font-medium">
                      {currency}
                    </span>
                    <input
                      type="number"
                      step="0.01"
                      required
                      min="0.01"
                      placeholder="0.00"
                      value={earningAmount}
                      onChange={(e) => setEarningAmount(e.target.value)}
                      className={`w-full pl-8 pr-3 py-2 border rounded-xl text-sm transition-all font-mono focus:outline-hidden focus:ring-1 focus:ring-emerald-500 ${
                        isLight
                          ? "bg-white text-slate-900 border-slate-300 placeholder-slate-400"
                          : "bg-white/5 text-slate-200 border-white/10 placeholder-slate-500 focus:bg-white/10"
                      }`}
                    />
                  </div>
                </div>

                {/* Date */}
                <div>
                  <label className={`block text-xs font-medium mb-1 ${isLight ? "text-slate-700" : "text-slate-400"}`}>
                    Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={earningDate}
                    onChange={(e) => setEarningDate(e.target.value)}
                    className={`w-full px-3 py-2 border rounded-xl text-sm transition-all focus:outline-hidden focus:ring-1 focus:ring-emerald-500 ${
                      isLight
                        ? "bg-white text-slate-900 border-slate-300"
                        : "bg-white/5 text-slate-200 border-white/10 focus:bg-white/10"
                    }`}
                  />
                </div>

                {/* Category */}
                <div>
                  <label className={`block text-xs font-medium mb-1 ${isLight ? "text-slate-700" : "text-slate-400"}`}>
                    Category *
                  </label>
                  <select
                    value={earningCategory}
                    onChange={(e) => setEarningCategory(e.target.value as EarningCategory)}
                    className={`w-full px-3 py-2 border rounded-xl text-sm transition-all focus:outline-hidden focus:ring-1 focus:ring-emerald-500 ${
                      isLight
                        ? "bg-white text-slate-900 border-slate-300"
                        : "bg-[#1b1b20] text-slate-200 border-white/10 focus:bg-[#22222a]"
                    }`}
                  >
                    {EARNING_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat} className={isLight ? "bg-white text-slate-900" : "bg-[#1b1b20] text-slate-200"}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Source / Client */}
                <div>
                  <label className={`block text-xs font-medium mb-1 ${isLight ? "text-slate-700" : "text-slate-400"}`}>
                    Income Source / Client (How did you earn it?) *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g., Tech Startup Client, Full-time Employer, Online Consulting"
                    value={earningSource}
                    onChange={(e) => setEarningSource(e.target.value)}
                    className={`w-full px-3 py-2 border rounded-xl text-sm transition-all focus:outline-hidden focus:ring-1 focus:ring-emerald-500 ${
                      isLight
                        ? "bg-white text-slate-900 border-slate-300 placeholder-slate-400"
                        : "bg-white/5 text-slate-200 border-white/10 placeholder-slate-500 focus:bg-white/10"
                    }`}
                  />
                </div>

                {/* Job Description */}
                <div>
                  <label className={`block text-xs font-medium mb-1 ${isLight ? "text-slate-700" : "text-slate-400"}`}>
                    Specific Job Done (What job did I do to earn it?) *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g., Developed API endpoints, 40 hours sprint delivery, Sold handcrafted items"
                    value={earningJob}
                    onChange={(e) => setEarningJob(e.target.value)}
                    className={`w-full px-3 py-2 border rounded-xl text-sm transition-all focus:outline-hidden focus:ring-1 focus:ring-emerald-500 ${
                      isLight
                        ? "bg-white text-slate-900 border-slate-300 placeholder-slate-400"
                        : "bg-white/5 text-slate-200 border-white/10 placeholder-slate-500 focus:bg-white/10"
                    }`}
                  />
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className={`block text-xs font-medium mb-1 ${isLight ? "text-slate-700" : "text-slate-400"}`}>
                  Additional Notes (Optional)
                </label>
                <input
                  type="text"
                  placeholder="Invoice number, payment method (wire, Stripe, cash), etc."
                  value={earningNotes}
                  onChange={(e) => setEarningNotes(e.target.value)}
                  className={`w-full px-3 py-2 border rounded-xl text-sm transition-all focus:outline-hidden focus:ring-1 focus:ring-emerald-500 ${
                    isLight
                      ? "bg-white text-slate-900 border-slate-300 placeholder-slate-400"
                      : "bg-white/5 text-slate-200 border-white/10 placeholder-slate-500 focus:bg-white/10"
                  }`}
                />
              </div>

              <div className="flex justify-end pt-1">
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs sm:text-sm font-semibold rounded-xl shadow-lg shadow-emerald-600/20 transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <PlusCircle className="w-4 h-4" />
                  Save Earning
                </button>
              </div>
            </form>
          )}
        </div>
      </div>

      {/* Transaction Stream & Filter Header */}
      <div className={`rounded-2xl border shadow-xl overflow-hidden ${cardBg}`}>
        <div className={`p-4 sm:p-5 border-b flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
          isLight ? "border-slate-200 bg-slate-50/50" : "border-white/5 bg-white/[0.02]"
        }`}>
          <div className="flex items-center gap-2">
            <h3 className={`font-bold text-xs uppercase tracking-widest ${isLight ? "text-slate-800" : "text-slate-300"}`}>
              Transaction Ledger
            </h3>
            <span className={`text-xs px-2 py-0.5 border rounded-full font-mono ${
              isLight ? "bg-slate-100 border-slate-200 text-slate-600" : "bg-white/5 border-white/5 text-slate-400"
            }`}>
              {combinedTransactions.length} records
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Filter Type */}
            <div className={`inline-flex rounded-lg border p-1 text-xs font-medium ${
              isLight ? "bg-slate-100 border-slate-200" : "bg-black/40 border-white/5"
            }`}>
              <button
                type="button"
                onClick={() => setFilterType("all")}
                className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                  filterType === "all"
                    ? isLight
                      ? "bg-white text-slate-900 shadow-xs font-bold"
                      : "bg-white/10 text-white shadow-xs font-semibold"
                    : isLight
                    ? "text-slate-600 hover:text-slate-900"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                All
              </button>
              <button
                type="button"
                onClick={() => setFilterType("expenses")}
                className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                  filterType === "expenses"
                    ? isLight
                      ? "bg-rose-500 text-white font-bold shadow-xs"
                      : "bg-rose-500/20 text-rose-300 font-semibold border border-rose-500/30"
                    : isLight
                    ? "text-slate-600 hover:text-slate-900"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                Expenses
              </button>
              <button
                type="button"
                onClick={() => setFilterType("earnings")}
                className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                  filterType === "earnings"
                    ? isLight
                      ? "bg-emerald-600 text-white font-bold shadow-xs"
                      : "bg-emerald-500/20 text-emerald-300 font-semibold border border-emerald-500/30"
                    : isLight
                    ? "text-slate-600 hover:text-slate-900"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                Earnings
              </button>
            </div>

            {/* Date filter */}
            <input
              type="date"
              value={filterDate}
              onChange={(e) => setFilterDate(e.target.value)}
              className={`px-2.5 py-1 text-xs border rounded-lg ${
                isLight ? "bg-white text-slate-900 border-slate-300" : "bg-white/5 border-white/10 text-slate-200"
              }`}
              title="Filter by exact date"
            />
            {filterDate && (
              <button
                onClick={() => setFilterDate("")}
                className="text-xs text-indigo-500 hover:text-indigo-400 underline cursor-pointer"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {/* Transaction Table / List */}
        {combinedTransactions.length === 0 ? (
          <div className="py-12 text-center text-slate-500 text-sm">
            No transactions match your filter criteria.
          </div>
        ) : (
          <div className={`divide-y ${isLight ? "divide-slate-200" : "divide-white/5"}`}>
            {combinedTransactions.map((item) => (
              <div
                key={item.id}
                className={`p-4 sm:px-6 transition-colors flex items-start justify-between gap-4 ${
                  isLight ? "hover:bg-slate-50" : "hover:bg-white/[0.03]"
                }`}
              >
                <div className="flex items-start gap-3 min-w-0">
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5 border ${
                      item.txnType === "earning"
                        ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-500"
                        : "bg-rose-500/10 border-rose-500/20 text-rose-500"
                    }`}
                  >
                    {item.txnType === "earning" ? (
                      <TrendingUp className="w-4 h-4" />
                    ) : (
                      <TrendingDown className="w-4 h-4" />
                    )}
                  </div>

                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`font-semibold text-sm ${isLight ? "text-slate-900" : "text-white"}`}>
                        {item.txnType === "earning"
                          ? (item as Earning).source
                          : (item as Expense).purpose}
                      </span>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium border ${
                        isLight ? "bg-slate-100 border-slate-200 text-slate-600" : "bg-white/5 border-white/5 text-slate-400"
                      }`}>
                        {item.category}
                      </span>
                      {item.txnType === "expense" && (
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded-full font-medium border ${
                            (item as Expense).necessityRating === "Essential"
                              ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-500"
                              : (item as Expense).necessityRating === "Useful"
                              ? "bg-indigo-500/10 border-indigo-500/20 text-indigo-500"
                              : (item as Expense).necessityRating === "Discretionary"
                              ? "bg-amber-500/10 border-amber-500/20 text-amber-500"
                              : "bg-rose-500/10 border-rose-500/20 text-rose-500 font-bold"
                          }`}
                        >
                          {(item as Expense).necessityRating}
                        </span>
                      )}
                    </div>

                    {/* Job or Purpose Detail */}
                    {item.txnType === "earning" && (
                      <div className="text-xs text-slate-400 mt-1 flex items-center gap-1.5">
                        <Briefcase className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                        <span>Job: {(item as Earning).jobDescription}</span>
                      </div>
                    )}

                    {item.notes && (
                      <p className="text-xs text-slate-500 mt-0.5 italic">{item.notes}</p>
                    )}

                    <span className="text-[11px] text-slate-500 mt-1 block font-mono">{item.date}</span>
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <span
                    className={`font-bold font-mono text-sm sm:text-base ${
                      item.txnType === "earning" ? "text-emerald-400" : "text-rose-400"
                    }`}
                  >
                    {item.txnType === "earning" ? "+" : "-"}
                    {currency}
                    {item.amount.toLocaleString("en-US", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </span>

                  <button
                    type="button"
                    onClick={() =>
                      item.txnType === "earning"
                        ? onDeleteEarning(item.id)
                        : onDeleteExpense(item.id)
                    }
                    className="p-1 text-slate-500 hover:text-rose-400 rounded transition-colors"
                    title="Delete record"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
