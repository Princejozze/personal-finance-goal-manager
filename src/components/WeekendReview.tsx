import React, { useState } from "react";
import {
  Sparkles,
  Calendar,
  CheckCircle2,
  AlertCircle,
  TrendingDown,
  TrendingUp,
  BookmarkCheck,
  RotateCcw,
} from "lucide-react";
import { Expense, Earning, TitheRecord, WeeklyReviewRecord } from "../types";
import { requestWeeklyReview } from "../services/geminiClient";

interface WeekendReviewProps {
  expenses: Expense[];
  earnings: Earning[];
  titheRecords: TitheRecord[];
  weeklyReviews: WeeklyReviewRecord[];
  currency: string;
  defaultTithePercent: number;
  onSaveReview: (review: WeeklyReviewRecord) => void;
}

export const WeekendReview: React.FC<WeekendReviewProps> = ({
  expenses,
  earnings,
  titheRecords,
  weeklyReviews,
  currency,
  defaultTithePercent,
  onSaveReview,
}) => {
  const today = new Date();
  const todayStr = today.toISOString().split("T")[0];

  // Calculate 7-day window
  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(today.getDate() - 7);
  const oneWeekAgoStr = oneWeekAgo.toISOString().split("T")[0];

  const weekExpenses = expenses.filter((e) => new Date(e.date) >= oneWeekAgo);
  const weekEarnings = earnings.filter((e) => new Date(e.date) >= oneWeekAgo);

  const totalSpent = weekExpenses.reduce((sum, e) => sum + e.amount, 0);
  const totalEarned = weekEarnings.reduce((sum, e) => sum + e.amount, 0);

  // Breakdown by necessity
  const essentialSpent = weekExpenses
    .filter((e) => e.necessityRating === "Essential")
    .reduce((sum, e) => sum + e.amount, 0);

  const usefulSpent = weekExpenses
    .filter((e) => e.necessityRating === "Useful")
    .reduce((sum, e) => sum + e.amount, 0);

  const discretionarySpent = weekExpenses
    .filter((e) => e.necessityRating === "Discretionary")
    .reduce((sum, e) => sum + e.amount, 0);

  const wastefulSpent = weekExpenses
    .filter((e) => e.necessityRating === "Wasteful")
    .reduce((sum, e) => sum + e.amount, 0);

  const titheDue = (totalEarned * defaultTithePercent) / 100;
  const currentWeekTithe = titheRecords.find((t) => new Date(t.weekEndDate) >= oneWeekAgo);
  const isTithePaid = currentWeekTithe?.isPaid || false;

  const [isLoading, setIsLoading] = useState(false);
  const [currentReview, setCurrentReview] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleGenerateReview = async () => {
    setIsLoading(true);
    setErrorMsg(null);

    try {
      const reviewText = await requestWeeklyReview({
        expenses: weekExpenses,
        earnings: weekEarnings,
        weekInfo: `${oneWeekAgoStr} to ${todayStr}`,
        titheStatus: {
          totalEarned,
          titheDue,
          tithePaid: currentWeekTithe?.tithePaid || 0,
          isPaid: isTithePaid,
        },
      });

      setCurrentReview(reviewText);

      // Save into historical reviews
      const newReviewRecord: WeeklyReviewRecord = {
        id: `review-${Date.now()}`,
        weekIdentifier: `Week Ending ${todayStr}`,
        weekStartDate: oneWeekAgoStr,
        weekEndDate: todayStr,
        reviewContent: reviewText,
        generatedAt: new Date().toISOString(),
      };
      onSaveReview(newReviewRecord);
    } catch (err: any) {
      setErrorMsg(err.message || "Could not generate weekly review");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-[#141417] rounded-2xl p-6 text-white border border-white/5 shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="p-1.5 bg-indigo-500/10 border border-indigo-500/20 rounded-lg text-indigo-400">
                <Sparkles className="w-5 h-5" />
              </span>
              <h2 className="text-lg sm:text-xl font-bold uppercase tracking-wider">Weekend AI Financial Audit</h2>
            </div>
            <p className="text-xs sm:text-sm text-slate-400 max-w-2xl">
              Gemini AI provides a candid evaluation of this week's expenses (what was useful vs
              what was wasteful), job performance analysis, tithe faithfulness, and future investment advice.
            </p>
          </div>

          <button
            onClick={handleGenerateReview}
            disabled={isLoading}
            className="flex items-center justify-center gap-2 px-5 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs sm:text-sm rounded-xl shadow-lg shadow-emerald-500/20 transition-all disabled:opacity-50 shrink-0"
          >
            {isLoading ? (
              <>
                <RotateCcw className="w-4 h-4 animate-spin" />
                <span>Generating Review...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                <span>Run Weekend Review</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Weekly Data Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Spent & Breakdown */}
        <div className="bg-[#141417] p-5 rounded-2xl border border-white/5 shadow-xl">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">7-Day Total Spend</span>
          <div className="text-2xl font-bold font-mono text-rose-400 mt-1">
            {currency}
            {totalSpent.toFixed(2)}
          </div>
          <div className="mt-3 space-y-1.5 text-xs text-slate-400 font-mono">
            <div className="flex justify-between">
              <span className="text-slate-500">Essential:</span>
              <span className="font-semibold text-emerald-400">{currency}{essentialSpent.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Useful:</span>
              <span className="font-semibold text-indigo-400">{currency}{usefulSpent.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Discretionary:</span>
              <span className="font-semibold text-amber-400">{currency}{discretionarySpent.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Wasteful / Regret:</span>
              <span className="font-semibold text-rose-400">{currency}{wastefulSpent.toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* Total Earned */}
        <div className="bg-[#141417] p-5 rounded-2xl border border-white/5 shadow-xl">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">7-Day Gross Earnings</span>
          <div className="text-2xl font-bold font-mono text-emerald-400 mt-1">
            {currency}
            {totalEarned.toFixed(2)}
          </div>
          <p className="text-xs text-slate-500 mt-2">
            Across {weekEarnings.length} income milestone(s).
          </p>
        </div>

        {/* Tithe Status */}
        <div className="bg-[#141417] p-5 rounded-2xl border border-white/5 shadow-xl">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">Weekly 10% Tithe</span>
          <div className="text-2xl font-bold font-mono text-amber-400 mt-1">
            {currency}
            {titheDue.toFixed(2)}
          </div>
          <div className="mt-2">
            <span
              className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold border ${
                isTithePaid
                  ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                  : "bg-amber-500/10 border-amber-500/20 text-amber-400"
              }`}
            >
              {isTithePaid ? "✓ Faithful Tithe Paid" : "⏳ Pending Payment"}
            </span>
          </div>
        </div>

        {/* Net Cash Flow */}
        <div className="bg-[#141417] p-5 rounded-2xl border border-white/5 shadow-xl">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">Net Weekly Surplus</span>
          <div
            className={`text-2xl font-bold font-mono mt-1 ${
              totalEarned - totalSpent >= 0 ? "text-indigo-400" : "text-rose-400"
            }`}
          >
            {totalEarned - totalSpent >= 0 ? "+" : "-"}
            {currency}
            {Math.abs(totalEarned - totalSpent).toFixed(2)}
          </div>
          <p className="text-xs text-slate-500 mt-2">
            {totalEarned - totalSpent >= 0 ? "Capital to invest and save" : "Deficit to curb"}
          </p>
        </div>
      </div>

      {/* Error alert */}
      {errorMsg && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs rounded-xl flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Current AI Review Display */}
      {currentReview && (
        <div className="bg-[#141417] rounded-2xl border border-indigo-500/30 shadow-xl p-6 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-white/5">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-indigo-400" />
              <h3 className="font-bold text-white text-base">Gemini Weekly Audit & Directive</h3>
            </div>
            <span className="text-xs text-slate-500 font-mono">Generated just now</span>
          </div>

          <div className="prose prose-invert max-w-none text-slate-300 leading-relaxed whitespace-pre-line text-xs sm:text-sm font-sans">
            {currentReview}
          </div>
        </div>
      )}

      {/* Historical Reviews List */}
      <div className="bg-[#141417] rounded-2xl border border-white/5 shadow-xl p-6">
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
          <BookmarkCheck className="w-4 h-4 text-slate-500" />
          Historical Weekly AI Reviews ({weeklyReviews.length})
        </h3>

        {weeklyReviews.length === 0 ? (
          <p className="text-xs text-slate-500 italic">
            No past reviews saved yet. Click "Run Weekend Review" above to produce and preserve your
            first weekly audit in Google Drive.
          </p>
        ) : (
          <div className="space-y-4">
            {weeklyReviews.map((rev) => (
              <details
                key={rev.id}
                className="group border border-white/5 rounded-xl p-4 bg-black/20 open:bg-black/40 transition-colors"
              >
                <summary className="flex items-center justify-between cursor-pointer font-medium text-xs sm:text-sm text-slate-300 list-none">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-indigo-400" />
                    <span>{rev.weekIdentifier}</span>
                  </div>
                  <span className="text-xs text-slate-500 font-mono">
                    {new Date(rev.generatedAt).toLocaleDateString()}
                  </span>
                </summary>
                <div className="mt-4 pt-3 border-t border-white/5 text-xs text-slate-400 whitespace-pre-line leading-relaxed font-sans">
                  {rev.reviewContent}
                </div>
              </details>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
