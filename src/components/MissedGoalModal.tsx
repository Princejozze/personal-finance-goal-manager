import React, { useState } from "react";
import { AlertCircle, Sparkles, CheckCircle2, RotateCcw } from "lucide-react";
import { GoalItem, MissedReasonCategory } from "../types";
import { requestGoalInsights } from "../services/geminiClient";

interface MissedGoalModalProps {
  goal: GoalItem | null;
  allGoals: GoalItem[];
  isOpen: boolean;
  theme?: "dark" | "light";
  onClose: () => void;
  onSaveReason: (goalId: string, reasonCategory: MissedReasonCategory, details: string, aiPivots?: string) => void;
}

const REASON_OPTIONS: { id: MissedReasonCategory; label: string; desc: string }[] = [
  { id: "time_constraint", label: "Time Constraint", desc: "Ran out of hours or day was overtaken by urgent fires" },
  { id: "low_energy", label: "Low Energy / Burnout", desc: "Mental or physical exhaustion impeded focus" },
  { id: "unrealistic_scope", label: "Oversized Scope", desc: "The task was too large for a single daily or weekly block" },
  { id: "distractions", label: "Distractions / Procrastination", desc: "Lost focus to minor tasks or digital interruptions" },
  { id: "external_blocker", label: "External Blocker", desc: "Blocked waiting on someone else, client, or tooling" },
  { id: "lack_of_clarity", label: "Lack of Clarity", desc: "Was not 100% sure what specific first step to take" },
  { id: "other", label: "Other / Unforeseen", desc: "Emergency, sickness, or unexpected schedule shift" },
];

export const MissedGoalModal: React.FC<MissedGoalModalProps> = ({
  goal,
  allGoals,
  isOpen,
  theme = "dark",
  onClose,
  onSaveReason,
}) => {
  if (!isOpen || !goal) return null;

  const isLight = theme === "light";
  const [selectedCategory, setSelectedCategory] = useState<MissedReasonCategory>(
    goal.missedReasonCategory || "time_constraint"
  );
  const [details, setDetails] = useState(goal.missedReasonDetails || "");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiAdvice, setAiAdvice] = useState<string | null>(goal.aiSuggestedPivots || null);

  const handleAskAI = async () => {
    setIsAnalyzing(true);
    try {
      const insights = await requestGoalInsights({
        missedGoals: [
          {
            ...goal,
            missedReasonCategory: selectedCategory,
            missedReasonDetails: details,
          },
        ],
        allGoals,
        recentFeedback: `Missed Goal: "${goal.title}" (${goal.tier} tier). Reason: ${selectedCategory} - Details: ${details}`,
      });
      setAiAdvice(insights);
    } catch (err: any) {
      setAiAdvice(`Notice: ${err.message || "Could not generate AI diagnostic"}`);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleSave = () => {
    onSaveReason(goal.id, selectedCategory, details, aiAdvice || undefined);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4 overflow-y-auto">
      <div className={`rounded-2xl shadow-2xl max-w-lg w-full p-6 border my-8 ${
        isLight ? "bg-white border-slate-200 text-slate-900" : "bg-[#141417] border-white/10 text-white"
      }`}>
        <div className="flex items-center gap-2 text-rose-500 mb-2">
          <AlertCircle className="w-5 h-5" />
          <h3 className={`font-bold text-base ${isLight ? "text-slate-900" : "text-white"}`}>
            Why was this goal not achieved?
          </h3>
        </div>

        <p className={`text-xs mb-4 ${isLight ? "text-slate-500" : "text-slate-400"}`}>
          Tracking obstacles honestly helps Gemini AI diagnose friction and restructure upcoming
          daily micro-tasks to ensure your weekly and monthly goals still succeed.
        </p>

        {/* Goal Summary */}
        <div className={`p-3.5 rounded-xl border mb-4 ${
          isLight ? "bg-slate-50 border-slate-200" : "bg-black/40 border-white/5"
        }`}>
          <span className="text-2xs uppercase font-bold text-slate-500 block tracking-wider">
            {goal.tier} Goal
          </span>
          <div className={`text-sm font-semibold mt-0.5 ${isLight ? "text-slate-900" : "text-white"}`}>
            {goal.title}
          </div>
          {goal.description && (
            <p className={`text-xs mt-1 ${isLight ? "text-slate-600" : "text-slate-400"}`}>
              {goal.description}
            </p>
          )}
        </div>

        {/* Reason Category Selection */}
        <div className="space-y-2 mb-4">
          <label className={`block text-xs font-bold uppercase tracking-widest ${isLight ? "text-slate-700" : "text-slate-400"}`}>
            Primary Obstacle
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {REASON_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setSelectedCategory(opt.id)}
                className={`p-2.5 text-left rounded-xl border text-xs transition-all cursor-pointer ${
                  selectedCategory === opt.id
                    ? isLight
                      ? "bg-rose-50 border-rose-400 text-rose-800 font-semibold ring-1 ring-rose-400"
                      : "bg-rose-500/10 border-rose-500/40 text-rose-300 font-semibold ring-1 ring-rose-500/40"
                    : isLight
                    ? "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                    : "bg-black/20 border-white/5 text-slate-400 hover:bg-white/5 hover:text-white"
                }`}
              >
                <div className="font-semibold">{opt.label}</div>
                <div className="text-2xs opacity-75 mt-0.5">{opt.desc}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Additional Details */}
        <div className="mb-4">
          <label className={`block text-xs font-bold uppercase tracking-widest mb-1.5 ${isLight ? "text-slate-700" : "text-slate-400"}`}>
            Personal Reflection / What happened?
          </label>
          <textarea
            rows={2}
            value={details}
            onChange={(e) => setDetails(e.target.value)}
            placeholder="e.g., Client meeting ran 2 hours overtime, felt mentally drained after 4pm"
            className={`w-full px-3.5 py-2.5 text-xs border rounded-xl focus:outline-hidden focus:border-rose-500 ${
              isLight
                ? "bg-white text-slate-900 border-slate-300 placeholder-slate-400"
                : "bg-[#0A0A0B] text-white border-white/10 placeholder-slate-600"
            }`}
          />
        </div>

        {/* AI Insight Section */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className={`text-xs font-bold uppercase tracking-widest ${isLight ? "text-slate-700" : "text-slate-400"}`}>
              Gemini Strategic Recovery
            </span>
            <button
              type="button"
              onClick={handleAskAI}
              disabled={isAnalyzing}
              className="flex items-center gap-1.5 text-xs text-indigo-500 hover:text-indigo-600 font-medium disabled:opacity-50 cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5" />
              {isAnalyzing ? "Diagnosing..." : "Ask Gemini for Recovery Plan"}
            </button>
          </div>

          {aiAdvice && (
            <div className={`p-3.5 rounded-xl text-xs whitespace-pre-line leading-relaxed max-h-48 overflow-y-auto border ${
              isLight
                ? "bg-indigo-50 border-indigo-200 text-indigo-950"
                : "bg-indigo-500/10 border-indigo-500/20 text-slate-300"
            }`}>
              {aiAdvice}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className={`flex items-center justify-end gap-2 pt-4 border-t ${isLight ? "border-slate-200" : "border-white/5"}`}>
          <button
            type="button"
            onClick={onClose}
            className={`px-4 py-2 text-xs font-medium rounded-xl transition-colors cursor-pointer ${
              isLight ? "text-slate-600 hover:bg-slate-100" : "text-slate-400 hover:bg-white/5"
            }`}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            className={`px-5 py-2 text-xs font-bold rounded-xl shadow-md transition-all cursor-pointer ${
              isLight
                ? "bg-slate-900 hover:bg-slate-800 text-white"
                : "text-black bg-white hover:bg-slate-200"
            }`}
          >
            Save Reason & Status
          </button>
        </div>
      </div>
    </div>
  );
};
