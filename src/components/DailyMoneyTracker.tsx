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
} from "lucide-react";
import { Expense, Earning, ExpenseCategory, EarningCategory, NecessityRating } from "../types";

interface DailyMoneyTrackerProps {
  expenses: Expense[];
  earnings: Earning[];
  currency: string;
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
  onAddExpense,
  onAddEarning,
  onDeleteExpense,
  onDeleteEarning,
}) => {
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
      {/* Top Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Today's Spent */}
        <div className="bg-[#141417] rounded-2xl p-5 border border-white/5 shadow-xl">
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
        <div className="bg-[#141417] rounded-2xl p-5 border border-white/5 shadow-xl">
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
        <div className="bg-[#141417] rounded-2xl p-5 border border-white/5 shadow-xl">
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
      <div className="bg-[#141417] rounded-2xl border border-white/5 shadow-xl overflow-hidden">
        <div className="border-b border-white/5 bg-white/[0.02] px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <PlusCircle className="w-4 h-4 text-indigo-400" />
            <h2 className="text-xs font-bold uppercase tracking-widest text-slate-400">Log Daily Money Activity</h2>
          </div>
          {/* Segmented Form Switcher */}
          <div className="inline-flex rounded-lg bg-black/40 p-1 text-xs font-medium border border-white/5">
            <button
              type="button"
              onClick={() => setActiveForm("expense")}
              className={`px-3 py-1 rounded-md transition-all ${
                activeForm === "expense"
                  ? "bg-rose-500/20 text-rose-300 font-semibold border border-rose-500/30"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Record Expense
            </button>
            <button
              type="button"
              onClick={() => setActiveForm("earning")}
              className={`px-3 py-1 rounded-md transition-all ${
                activeForm === "earning"
                  ? "bg-emerald-500/20 text-emerald-300 font-semibold border border-emerald-500/30"
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
                  <label className="block text-xs font-medium text-slate-400 mb-1">
                    Amount Spent ({currency}) *
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-500 font-medium">
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
                      className="w-full pl-8 pr-3 py-2 bg-white/5 border border-white/10 rounded-xl text-sm text-slate-200 placeholder-slate-500 focus:bg-white/10 focus:outline-hidden focus:ring-1 focus:ring-rose-500 focus:border-rose-500 transition-all font-mono"
                    />
                  </div>
                </div>

                {/* Date */}
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Date *</label>
                  <input
                    type="date"
                    required
                    value={expenseDate}
                    onChange={(e) => setExpenseDate(e.target.value)}
                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-sm text-slate-200 focus:bg-white/10 focus:outline-hidden focus:ring-1 focus:ring-rose-500 transition-all"
                  />
                </div>

                {/* Category */}
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Category *</label>
                  <select
                    value={expenseCategory}
                    onChange={(e) => setExpenseCategory(e.target.value as ExpenseCategory)}
                    className="w-full px-3 py-2 bg-[#1b1b20] border border-white/10 rounded-xl text-sm text-slate-200 focus:bg-[#22222a] focus:outline-hidden focus:ring-1 focus:ring-rose-500 transition-all"
                  >
                    {EXPENSE_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat} className="bg-[#1b1b20] text-slate-200">
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Purpose */}
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">
                    Purpose (What did you use this money for?) *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g., Weekly supermarket groceries, Taxi ride to client, Gas refill"
                    value={expensePurpose}
                    onChange={(e) => setExpensePurpose(e.target.value)}
                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-sm text-slate-200 placeholder-slate-500 focus:bg-white/10 focus:outline-hidden focus:ring-1 focus:ring-rose-500 transition-all"
                  />
                </div>

                {/* Necessity Rating */}
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">
                    Necessity Assessment (For AI Weekly Utility Audit)
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {(["Essential", "Useful", "Discretionary", "Wasteful"] as NecessityRating[]).map(
                      (rating) => (
                        <button
                          key={rating}
                          type="button"
                          onClick={() => setExpenseNecessity(rating)}
                          className={`py-1.5 px-2 text-xs font-medium rounded-lg border transition-all text-center ${
                            expenseNecessity === rating
                              ? rating === "Essential"
                                ? "bg-emerald-500/10 border-emerald-500/40 text-emerald-300 font-semibold"
                                : rating === "Useful"
                                ? "bg-indigo-500/10 border-indigo-500/40 text-indigo-300 font-semibold"
                                : rating === "Discretionary"
                                ? "bg-amber-500/10 border-amber-500/40 text-amber-300 font-semibold"
                                : "bg-rose-500/10 border-rose-500/40 text-rose-300 font-semibold"
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
                <label className="block text-xs font-medium text-slate-400 mb-1">
                  Additional Notes (Optional)
                </label>
                <input
                  type="text"
                  placeholder="Receipt reference, vendor name, or context"
                  value={expenseNotes}
                  onChange={(e) => setExpenseNotes(e.target.value)}
                  className="w-full px-3 py-1.5 bg-white/5 border border-white/10 rounded-xl text-sm text-slate-200 placeholder-slate-500 focus:bg-white/10 focus:outline-hidden focus:ring-1 focus:ring-rose-500 transition-all"
                />
              </div>

              <div className="flex justify-end pt-1">
                <button
                  type="submit"
                  className="px-5 py-2 bg-rose-600 hover:bg-rose-500 text-white text-xs sm:text-sm font-semibold rounded-xl shadow-lg shadow-rose-600/20 transition-all flex items-center gap-1.5"
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
                  <label className="block text-xs font-medium text-slate-400 mb-1">
                    Amount Earned ({currency}) *
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-500 font-medium">
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
                      className="w-full pl-8 pr-3 py-2 bg-white/5 border border-white/10 rounded-xl text-sm text-slate-200 placeholder-slate-500 focus:bg-white/10 focus:outline-hidden focus:ring-1 focus:ring-emerald-500 transition-all font-mono"
                    />
                  </div>
                </div>

                {/* Date */}
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Date *</label>
                  <input
                    type="date"
                    required
                    value={earningDate}
                    onChange={(e) => setEarningDate(e.target.value)}
                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-sm text-slate-200 focus:bg-white/10 focus:outline-hidden focus:ring-1 focus:ring-emerald-500 transition-all"
                  />
                </div>

                {/* Category */}
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Category *</label>
                  <select
                    value={earningCategory}
                    onChange={(e) => setEarningCategory(e.target.value as EarningCategory)}
                    className="w-full px-3 py-2 bg-[#1b1b20] border border-white/10 rounded-xl text-sm text-slate-200 focus:bg-[#22222a] focus:outline-hidden focus:ring-1 focus:ring-emerald-500 transition-all"
                  >
                    {EARNING_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat} className="bg-[#1b1b20] text-slate-200">
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Source / Client */}
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">
                    Income Source / Client (How did you earn it?) *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g., Tech Startup Client, Full-time Employer, Online Consulting"
                    value={earningSource}
                    onChange={(e) => setEarningSource(e.target.value)}
                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-sm text-slate-200 placeholder-slate-500 focus:bg-white/10 focus:outline-hidden focus:ring-1 focus:ring-emerald-500 transition-all"
                  />
                </div>

                {/* Job Description */}
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">
                    Specific Job Done (What job did I do to earn it?) *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g., Developed API endpoints, 40 hours sprint delivery, Sold handcrafted items"
                    value={earningJob}
                    onChange={(e) => setEarningJob(e.target.value)}
                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-sm text-slate-200 placeholder-slate-500 focus:bg-white/10 focus:outline-hidden focus:ring-1 focus:ring-emerald-500 transition-all"
                  />
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">
                  Additional Notes (Optional)
                </label>
                <input
                  type="text"
                  placeholder="Invoice number, payment method (wire, Stripe, cash), etc."
                  value={earningNotes}
                  onChange={(e) => setEarningNotes(e.target.value)}
                  className="w-full px-3 py-1.5 bg-white/5 border border-white/10 rounded-xl text-sm text-slate-200 placeholder-slate-500 focus:bg-white/10 focus:outline-hidden focus:ring-1 focus:ring-emerald-500 transition-all"
                />
              </div>

              <div className="flex justify-end pt-1">
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs sm:text-sm font-semibold rounded-xl shadow-lg shadow-emerald-600/20 transition-all flex items-center gap-1.5"
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
      <div className="bg-[#141417] rounded-2xl border border-white/5 shadow-xl overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-white/5 bg-white/[0.02] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-slate-300 text-xs uppercase tracking-widest">Transaction Ledger</h3>
            <span className="text-xs px-2 py-0.5 bg-white/5 border border-white/5 text-slate-400 rounded-full font-mono">
              {combinedTransactions.length} records
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Filter Type */}
            <div className="inline-flex rounded-lg bg-black/40 border border-white/5 p-1 text-xs font-medium">
              <button
                type="button"
                onClick={() => setFilterType("all")}
                className={`px-2.5 py-1 rounded-md transition-all ${
                  filterType === "all" ? "bg-white/10 text-white shadow-xs font-semibold" : "text-slate-400 hover:text-slate-200"
                }`}
              >
                All
              </button>
              <button
                type="button"
                onClick={() => setFilterType("expenses")}
                className={`px-2.5 py-1 rounded-md transition-all ${
                  filterType === "expenses" ? "bg-rose-500/20 text-rose-300 font-semibold border border-rose-500/30" : "text-slate-400 hover:text-slate-200"
                }`}
              >
                Expenses
              </button>
              <button
                type="button"
                onClick={() => setFilterType("earnings")}
                className={`px-2.5 py-1 rounded-md transition-all ${
                  filterType === "earnings" ? "bg-emerald-500/20 text-emerald-300 font-semibold border border-emerald-500/30" : "text-slate-400 hover:text-slate-200"
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
              className="px-2.5 py-1 text-xs bg-white/5 border border-white/10 rounded-lg text-slate-200"
              title="Filter by exact date"
            />
            {filterDate && (
              <button
                onClick={() => setFilterDate("")}
                className="text-xs text-indigo-400 hover:text-indigo-300 underline"
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
          <div className="divide-y divide-white/5">
            {combinedTransactions.map((item) => (
              <div
                key={item.id}
                className="p-4 sm:px-6 hover:bg-white/[0.03] transition-colors flex items-start justify-between gap-4"
              >
                <div className="flex items-start gap-3 min-w-0">
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5 border ${
                      item.txnType === "earning"
                        ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                        : "bg-rose-500/10 border-rose-500/20 text-rose-400"
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
                      <span className="font-semibold text-white text-sm">
                        {item.txnType === "earning"
                          ? (item as Earning).source
                          : (item as Expense).purpose}
                      </span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-white/5 border border-white/5 text-slate-400">
                        {item.category}
                      </span>
                      {item.txnType === "expense" && (
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded-full font-medium border ${
                            (item as Expense).necessityRating === "Essential"
                              ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                              : (item as Expense).necessityRating === "Useful"
                              ? "bg-indigo-500/10 border-indigo-500/20 text-indigo-400"
                              : (item as Expense).necessityRating === "Discretionary"
                              ? "bg-amber-500/10 border-amber-500/20 text-amber-400"
                              : "bg-rose-500/10 border-rose-500/20 text-rose-400 font-bold"
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
