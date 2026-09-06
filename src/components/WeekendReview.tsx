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
  Mail,
  Send,
  Check,
} from "lucide-react";
import { Expense, Earning, TitheRecord, WeeklyReviewRecord } from "../types";
import { requestWeeklyReview } from "../services/geminiClient";
import { sendEmailViaGmail } from "../services/gmailService";
import { getValidGoogleAccessToken, reauthorizeGoogleAccess } from "../services/auth";

interface WeekendReviewProps {
  expenses: Expense[];
  earnings: Earning[];
  titheRecords: TitheRecord[];
  weeklyReviews: WeeklyReviewRecord[];
  currency: string;
  defaultTithePercent: number;
  userEmail?: string;
  theme?: "dark" | "light";
  onSaveReview: (review: WeeklyReviewRecord) => void;
}

export const WeekendReview: React.FC<WeekendReviewProps> = ({
  expenses,
  earnings,
  titheRecords,
  weeklyReviews,
  currency,
  defaultTithePercent,
  userEmail,
  theme = "dark",
  onSaveReview,
}) => {
  const isLight = theme === "light";
  const cardBg = isLight
    ? "bg-white border-slate-200 text-slate-900 shadow-sm"
    : "bg-[#141417] border-white/5 text-white shadow-xl";
  const subBoxBg = isLight
    ? "bg-slate-50 border-slate-200 text-slate-800"
    : "bg-black/20 border-white/5 text-slate-300";

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
  const [isEmailing, setIsEmailing] = useState(false);
  const [emailStatusMsg, setEmailStatusMsg] = useState<string | null>(null);

  const pushReviewToEmail = async (text: string) => {
    const target = (userEmail || "giftj964@gmail.com").trim();
    if (!target) return;
    setIsEmailing(true);
    try {
      let token = await getValidGoogleAccessToken();
      if (!token) token = await reauthorizeGoogleAccess();
      if (!token) {
        setEmailStatusMsg("Could not send email: Google session expired, please sign in.");
        return;
      }
      const sendRes = await sendEmailViaGmail(token, {
        to: target,
        subject: `📊 Direct AI Weekly Review (${todayStr})`,
        bodyText: text,
        bodyHtml: `<div style="font-family: Arial, sans-serif; line-height: 1.6; color: #1e293b; max-width: 600px; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
          <h2 style="color: #4f46e5; margin-top: 0; font-size: 18px;">Direct AI Financial Review</h2>
          <pre style="font-family: inherit; white-space: pre-wrap; font-size: 13.5px; background: #f8fafc; padding: 12px; border-radius: 6px; color: #334155;">${text}</pre>
          <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 16px 0;" />
          <p style="font-size: 11px; color: #64748b;">Direct & Short AI Brief from your Personal Finance & Goal Manager</p>
        </div>`,
      });
      if (sendRes.success) {
        setEmailStatusMsg(`Direct review successfully emailed to ${target}!`);
      } else {
        setEmailStatusMsg(`Email dispatch failed: ${sendRes.error}`);
      }
    } catch (err: any) {
      setEmailStatusMsg(`Email error: ${err.message || err}`);
    } finally {
      setIsEmailing(false);
    }
  };

  const handleGenerateReview = async () => {
    setIsLoading(true);
    setErrorMsg(null);
    setEmailStatusMsg(null);

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

      // Automatically push direct review to email
      if (userEmail) {
        pushReviewToEmail(reviewText);
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Could not generate weekly review");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className={`rounded-2xl p-6 border ${cardBg}`}>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="p-1.5 bg-indigo-500/10 border border-indigo-500/20 rounded-lg text-indigo-500">
                <Sparkles className="w-5 h-5" />
              </span>
              <h2 className={`text-lg sm:text-xl font-bold uppercase tracking-wider ${isLight ? "text-slate-900" : "text-white"}`}>
                Weekend AI Financial Audit
              </h2>
            </div>
            <p className="text-xs sm:text-sm text-slate-500 max-w-2xl">
              Gemini AI provides a candid evaluation of this week's expenses (what was useful vs
              what was wasteful), job performance analysis, tithe faithfulness, and future investment advice.
            </p>
          </div>

          <button
            onClick={handleGenerateReview}
            disabled={isLoading}
            className="flex items-center justify-center gap-2 px-5 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs sm:text-sm rounded-xl shadow-lg shadow-emerald-500/20 transition-all disabled:opacity-50 shrink-0 cursor-pointer"
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
        <div className={`p-5 rounded-2xl border ${cardBg}`}>
          <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">7-Day Total Spend</span>
          <div className="text-2xl font-bold font-mono text-rose-500 mt-1">
            {currency}
            {totalSpent.toFixed(2)}
          </div>
          <div className="mt-3 space-y-1.5 text-xs text-slate-500 font-mono">
            <div className="flex justify-between">
              <span className="text-slate-500">Essential:</span>
              <span className="font-semibold text-emerald-500">{currency}{essentialSpent.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Useful:</span>
              <span className="font-semibold text-indigo-500">{currency}{usefulSpent.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Discretionary:</span>
              <span className="font-semibold text-amber-500">{currency}{discretionarySpent.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Wasteful / Regret:</span>
              <span className="font-semibold text-rose-500">{currency}{wastefulSpent.toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* Total Earned */}
        <div className={`p-5 rounded-2xl border ${cardBg}`}>
          <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">7-Day Gross Earnings</span>
          <div className="text-2xl font-bold font-mono text-emerald-500 mt-1">
            {currency}
            {totalEarned.toFixed(2)}
          </div>
          <p className="text-xs text-slate-500 mt-2">
            Across {weekEarnings.length} income milestone(s).
          </p>
        </div>

        {/* Tithe Status */}
        <div className={`p-5 rounded-2xl border ${cardBg}`}>
          <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">Weekly 10% Tithe</span>
          <div className="text-2xl font-bold font-mono text-amber-500 mt-1">
            {currency}
            {titheDue.toFixed(2)}
          </div>
          <div className="mt-2">
            <span
              className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold border ${
                isTithePaid
                  ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-500"
                  : "bg-amber-500/10 border-amber-500/20 text-amber-500"
              }`}
            >
              {isTithePaid ? "✓ Faithful Tithe Paid" : "⏳ Pending Payment"}
            </span>
          </div>
        </div>

        {/* Net Cash Flow */}
        <div className={`p-5 rounded-2xl border ${cardBg}`}>
          <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">Net Weekly Surplus</span>
          <div
            className={`text-2xl font-bold font-mono mt-1 ${
              totalEarned - totalSpent >= 0 ? "text-indigo-500" : "text-rose-500"
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
        <div className="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-500 text-xs rounded-xl flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Current AI Review Display */}
      {currentReview && (
        <div className={`rounded-2xl border p-6 space-y-4 ${cardBg} ${
          isLight ? "border-indigo-200" : "border-indigo-500/30"
        }`}>
          <div className={`flex items-center justify-between pb-3 border-b ${
            isLight ? "border-slate-200" : "border-white/5"
          }`}>
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-indigo-500" />
              <h3 className={`font-bold text-base ${isLight ? "text-slate-900" : "text-white"}`}>
                Direct AI Weekly Audit
              </h3>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => pushReviewToEmail(currentReview)}
                disabled={isEmailing}
                className="flex items-center gap-1.5 px-3 py-1 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium rounded-lg transition-all disabled:opacity-50 cursor-pointer"
              >
                <Mail className="w-3.5 h-3.5" />
                <span>{isEmailing ? "Sending Email..." : "Push to Email"}</span>
              </button>
              <span className="text-xs text-slate-500 font-mono hidden sm:inline">Just now</span>
            </div>
          </div>

          {emailStatusMsg && (
            <div className="p-3 bg-indigo-500/10 border border-indigo-500/20 text-indigo-500 text-xs rounded-lg flex items-center gap-2">
              <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
              <span>{emailStatusMsg}</span>
            </div>
          )}

          <div className={`whitespace-pre-line leading-relaxed text-xs sm:text-sm font-sans ${
            isLight ? "text-slate-700" : "text-slate-300"
          }`}>
            {currentReview}
          </div>
        </div>
      )}

      {/* Historical Reviews List */}
      <div className={`rounded-2xl border p-6 ${cardBg}`}>
        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2">
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
                className={`group border rounded-xl p-4 transition-colors ${subBoxBg}`}
              >
                <summary className={`flex items-center justify-between cursor-pointer font-medium text-xs sm:text-sm list-none ${
                  isLight ? "text-slate-800" : "text-slate-300"
                }`}>
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-indigo-500" />
                    <span>{rev.weekIdentifier}</span>
                  </div>
                  <span className="text-xs text-slate-500 font-mono">
                    {new Date(rev.generatedAt).toLocaleDateString()}
                  </span>
                </summary>
                <div className={`mt-4 pt-3 border-t text-xs whitespace-pre-line leading-relaxed font-sans ${
                  isLight ? "border-slate-200 text-slate-600" : "border-white/5 text-slate-400"
                }`}>
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
