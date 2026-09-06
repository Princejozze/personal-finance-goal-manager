import React, { useState } from "react";
import {
  Coins,
  TrendingUp,
  CheckCircle2,
  Clock,
  Sparkles,
  PlusCircle,
  Building,
  ShieldCheck,
  Percent,
  Trash2,
  Info,
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
  onSaveTitheRecord: (tithe: TitheRecord) => void;
  onAddInvestment: (inv: Omit<InvestmentRecord, "id" | "createdAt">) => void;
  onDeleteInvestment: (id: string) => void;
}

export const TitheAndInvestment: React.FC<TitheAndInvestmentProps> = ({
  earnings,
  expenses,
  titheRecords,
  investments,
  currency,
  defaultTithePercent,
  onSaveTitheRecord,
  onAddInvestment,
  onDeleteInvestment,
}) => {
  const today = new Date();
  const todayStr = today.toISOString().split("T")[0];

  // Calculate current week (last 7 days or current Monday-to-Sunday)
  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(today.getDate() - 7);

  const currentWeekEarnings = earnings
    .filter((e) => new Date(e.date) >= oneWeekAgo)
    .reduce((sum, e) => sum + e.amount, 0);

  const currentWeekExpenses = expenses
    .filter((e) => new Date(e.date) >= oneWeekAgo)
    .reduce((sum, e) => sum + e.amount, 0);

  const titheDueThisWeek = (currentWeekEarnings * defaultTithePercent) / 100;

  // Find if current week already has a recorded tithe
  const currentWeekTithe = titheRecords.find(
    (t) => new Date(t.weekEndDate) >= oneWeekAgo
  );

  const isTithePaid = currentWeekTithe?.isPaid || false;
  const tithePaidAmount = currentWeekTithe?.tithePaid || 0;

  // State for recording tithe payment
  const [showTitheModal, setShowTitheModal] = useState(false);
  const [tithePayAmount, setTithePayAmount] = useState(titheDueThisWeek.toString());
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

  const handlePayTithe = (e: React.FormEvent) => {
    e.preventDefault();
    const paidNum = parseFloat(tithePayAmount);
    if (isNaN(paidNum) || paidNum <= 0) return;

    const record: TitheRecord = {
      id: currentWeekTithe?.id || `tithe-${Date.now()}`,
      weekIdentifier: `Week Ending ${todayStr}`,
      weekStartDate: oneWeekAgo.toISOString().split("T")[0],
      weekEndDate: todayStr,
      totalEarnings: currentWeekEarnings,
      tithePercentage: defaultTithePercent,
      titheDue: titheDueThisWeek,
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
        weeklyEarnings: currentWeekEarnings,
        weeklyExpenses: currentWeekExpenses,
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

  const totalInvestedSoFar = investments.reduce((sum, inv) => sum + inv.amount, 0);

  return (
    <div className="space-y-8">
      {/* SECTION 1: TITHE & FAITHFUL STEWARDSHIP */}
      <div className="bg-[#141417] rounded-2xl border border-white/5 shadow-xl overflow-hidden">
        <div className="border-b border-white/5 bg-white/[0.02] px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center font-bold">
              <Coins className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white uppercase tracking-wider">Weekly Tithe Tracker</h2>
              <p className="text-xs text-slate-400">
                Biblical 10% firstfruits tithe calculated faithfully from your weekly earnings
              </p>
            </div>
          </div>
          <div className="text-right">
            <span
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${
                isTithePaid
                  ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                  : "bg-amber-500/10 border-amber-500/20 text-amber-400"
              }`}
            >
              {isTithePaid ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5" /> Tithe Paid
                </>
              ) : (
                <>
                  <Clock className="w-3.5 h-3.5" /> Tithe Pending
                </>
              )}
            </span>
          </div>
        </div>

        <div className="p-6">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 p-4 bg-black/30 rounded-xl border border-white/5 mb-6">
            <div>
              <span className="text-xs font-bold text-slate-500 uppercase tracking-widest block">7-Day Gross Earnings</span>
              <span className="text-xl font-bold font-mono text-emerald-400">
                {currency}
                {currentWeekEarnings.toLocaleString("en-US", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </span>
            </div>

            <div>
              <span className="text-xs font-bold text-slate-500 uppercase tracking-widest block">Tithe Rate</span>
              <span className="text-xl font-bold font-mono text-white">{defaultTithePercent}%</span>
            </div>

            <div>
              <span className="text-xs font-bold text-slate-500 uppercase tracking-widest block">Calculated Tithe Due</span>
              <span className="text-xl font-bold font-mono text-amber-400">
                {currency}
                {titheDueThisWeek.toLocaleString("en-US", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </span>
            </div>

            <div className="flex items-center justify-start sm:justify-end">
              <button
                type="button"
                onClick={() => {
                  setTithePayAmount(titheDueThisWeek.toFixed(2));
                  setShowTitheModal(true);
                }}
                className={`px-4 py-2 rounded-xl text-xs font-bold text-white transition-all shadow-lg ${
                  isTithePaid
                    ? "bg-white/10 hover:bg-white/20 text-slate-200 border border-white/10"
                    : "bg-amber-600 hover:bg-amber-500 shadow-amber-600/20 ring-1 ring-amber-400/40"
                }`}
              >
                {isTithePaid ? "Update Tithe Record" : "Pay / Fulfill Tithe"}
              </button>
            </div>
          </div>

          {/* Past Tithe Records */}
          <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">
            Tithe Payment History
          </h4>
          {titheRecords.length === 0 ? (
            <p className="text-xs text-slate-500 italic">No previous tithe records logged yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border border-white/5 rounded-xl overflow-hidden">
                <thead className="bg-white/[0.03] text-slate-400 uppercase text-[10px] tracking-wider border-b border-white/5">
                  <tr>
                    <th className="py-2.5 px-3">Week</th>
                    <th className="py-2.5 px-3">Gross Earned</th>
                    <th className="py-2.5 px-3">Tithe Due (10%)</th>
                    <th className="py-2.5 px-3">Amount Paid</th>
                    <th className="py-2.5 px-3">Recipient</th>
                    <th className="py-2.5 px-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {titheRecords.map((t) => (
                    <tr key={t.id} className="hover:bg-white/[0.02]">
                      <td className="py-2.5 px-3 font-medium text-slate-300">{t.weekIdentifier}</td>
                      <td className="py-2.5 px-3 font-mono text-slate-300">
                        {currency}
                        {t.totalEarnings.toFixed(2)}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-slate-400">
                        {currency}
                        {t.titheDue.toFixed(2)}
                      </td>
                      <td className="py-2.5 px-3 font-mono font-semibold text-emerald-400">
                        {currency}
                        {t.tithePaid.toFixed(2)}
                      </td>
                      <td className="py-2.5 px-3 text-slate-400">{t.recipient || "Church"}</td>
                      <td className="py-2.5 px-3">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                          PAID
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

      {/* SECTION 2: AI INVESTMENT PROPOSALS & RECORDING */}
      <div className="bg-[#141417] rounded-2xl border border-white/5 shadow-xl overflow-hidden">
        <div className="border-b border-white/5 bg-white/[0.02] px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white uppercase tracking-wider">AI Investment Advisor & Tracker</h2>
              <p className="text-xs text-slate-400">
                Personalized investment allocation proposed by Gemini AI based on your earning & spending rate
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleGenerateAIProposal}
            disabled={isGeneratingProposal}
            className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl shadow-lg shadow-indigo-600/20 transition-all disabled:opacity-50"
          >
            <Sparkles className="w-4 h-4" />
            <span>{isGeneratingProposal ? "Analyzing Rate..." : "Propose Investment with AI"}</span>
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Rate Summary */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-black/30 p-4 rounded-xl border border-white/5">
              <span className="text-xs text-slate-500 font-bold uppercase tracking-widest">Current Weekly Earnings</span>
              <div className="text-lg font-bold font-mono text-emerald-400 mt-1">
                {currency}
                {currentWeekEarnings.toFixed(2)}
              </div>
            </div>

            <div className="bg-black/30 p-4 rounded-xl border border-white/5">
              <span className="text-xs text-slate-500 font-bold uppercase tracking-widest">Current Weekly Expenses</span>
              <div className="text-lg font-bold font-mono text-rose-400 mt-1">
                {currency}
                {currentWeekExpenses.toFixed(2)}
              </div>
            </div>

            <div className="bg-black/30 p-4 rounded-xl border border-white/5">
              <span className="text-xs text-slate-500 font-bold uppercase tracking-widest">Net Investable Surplus</span>
              <div
                className={`text-lg font-bold font-mono mt-1 ${
                  currentWeekEarnings - currentWeekExpenses > 0 ? "text-indigo-400" : "text-amber-400"
                }`}
              >
                {currency}
                {(currentWeekEarnings - currentWeekExpenses).toFixed(2)}
              </div>
            </div>
          </div>

          {/* AI Generated Proposal Display */}
          {proposalError && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs rounded-xl">
              {proposalError}
            </div>
          )}

          {aiProposal && (
            <div className="p-5 bg-indigo-950/20 rounded-xl border border-indigo-500/20 space-y-3">
              <div className="flex items-center gap-2 text-indigo-300 font-semibold text-sm">
                <Sparkles className="w-4 h-4 text-indigo-400" />
                <span>Gemini AI Investment Insights</span>
              </div>
              <div className="text-xs text-slate-300 whitespace-pre-line leading-relaxed font-sans">
                {aiProposal}
              </div>
            </div>
          )}

          {/* Form to log actual investment */}
          <div className="p-5 bg-black/20 rounded-xl border border-white/5">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">
              Record an Investment Made
            </h4>
            <form onSubmit={handleAddInvestment} className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">
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
                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-xs text-slate-200 placeholder-slate-500 font-mono focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Date *</label>
                  <input
                    type="date"
                    required
                    value={invDate}
                    onChange={(e) => setInvDate(e.target.value)}
                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-xs text-slate-200 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">
                    Asset Type *
                  </label>
                  <select
                    value={invType}
                    onChange={(e) => setInvType(e.target.value as any)}
                    className="w-full px-3 py-2 bg-[#1b1b20] border border-white/10 rounded-xl text-xs text-slate-200 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
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
                  <label className="block text-xs font-medium text-slate-400 mb-1">
                    Platform / Vehicle *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Vanguard S&P 500, Fidelity, High Yield Acc"
                    value={invPlatform}
                    onChange={(e) => setInvPlatform(e.target.value)}
                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between pt-2 gap-4">
                <input
                  type="text"
                  placeholder="Notes (optional, e.g. monthly scheduled DCA)"
                  value={invNotes}
                  onChange={(e) => setInvNotes(e.target.value)}
                  className="flex-1 px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
                />

                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-xl shadow-lg shadow-emerald-600/20 flex items-center gap-1.5 shrink-0"
                >
                  <PlusCircle className="w-3.5 h-3.5" />
                  Save Investment
                </button>
              </div>
            </form>
          </div>

          {/* Investment Portfolio Ledger */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                Investment Portfolio History
              </h4>
              <span className="text-xs font-bold font-mono text-emerald-400">
                Total Invested: {currency}
                {totalInvestedSoFar.toLocaleString("en-US", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </span>
            </div>

            {investments.length === 0 ? (
              <p className="text-xs text-slate-500 italic">No investments logged yet.</p>
            ) : (
              <div className="divide-y divide-white/5 border border-white/5 rounded-xl overflow-hidden">
                {investments.map((inv) => (
                  <div
                    key={inv.id}
                    className="p-3 bg-[#141417] hover:bg-white/[0.02] flex items-center justify-between gap-4 text-xs"
                  >
                    <div>
                      <span className="font-semibold text-slate-200">{inv.platformOrVehicle}</span>
                      <span className="ml-2 px-2 py-0.5 bg-white/5 border border-white/5 rounded text-slate-400 text-[10px] font-medium">
                        {inv.assetType}
                      </span>
                      {inv.notes && <span className="ml-2 text-slate-500 italic">({inv.notes})</span>}
                      <span className="block text-[10px] font-mono text-slate-500 mt-0.5">{inv.date}</span>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="font-bold font-mono text-emerald-400">
                        {currency}
                        {inv.amount.toFixed(2)}
                      </span>
                      <button
                        onClick={() => onDeleteInvestment(inv.id)}
                        className="text-slate-500 hover:text-rose-400 transition-colors"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4">
          <div className="bg-[#141417] rounded-2xl shadow-2xl max-w-md w-full p-6 border border-white/10">
            <h3 className="text-base font-bold text-white mb-1">Record Weekly Tithe Payment</h3>
            <p className="text-xs text-slate-400 mb-4">
              Confirm your faithful 10% stewardship contribution for this week.
            </p>

            <form onSubmit={handlePayTithe} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">
                  Amount to Pay ({currency})
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={tithePayAmount}
                  onChange={(e) => setTithePayAmount(e.target.value)}
                  className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-sm text-slate-200 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">
                  Church / Ministry / Beneficiary
                </label>
                <input
                  type="text"
                  required
                  value={titheRecipient}
                  onChange={(e) => setTitheRecipient(e.target.value)}
                  className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-sm text-slate-200"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">
                  Notes (Optional)
                </label>
                <input
                  type="text"
                  placeholder="Receipt number, bank transfer, cash"
                  value={titheNotes}
                  onChange={(e) => setTitheNotes(e.target.value)}
                  className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-sm text-slate-200 placeholder-slate-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowTitheModal(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-white rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold text-white bg-amber-600 hover:bg-amber-500 rounded-xl shadow-lg shadow-amber-600/20"
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
