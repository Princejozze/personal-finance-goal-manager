import React, { useState } from "react";
import {
  Target,
  CheckCircle2,
  Circle,
  AlertCircle,
  PlusCircle,
  ChevronRight,
  Trash2,
  Calendar,
  Sparkles,
  Layers,
  ArrowRight,
} from "lucide-react";
import { GoalItem, GoalTier, MissedReasonCategory } from "../types";
import { MissedGoalModal } from "./MissedGoalModal";

interface GoalHierarchyProps {
  goals: GoalItem[];
  onAddGoal: (goal: Omit<GoalItem, "id" | "createdAt">) => void;
  onUpdateGoalStatus: (
    goalId: string,
    status: GoalItem["status"],
    reasonCategory?: MissedReasonCategory,
    reasonDetails?: string,
    aiPivots?: string
  ) => void;
  onDeleteGoal: (goalId: string) => void;
}

export const GoalHierarchy: React.FC<GoalHierarchyProps> = ({
  goals,
  onAddGoal,
  onUpdateGoalStatus,
  onDeleteGoal,
}) => {
  const [selectedTier, setSelectedTier] = useState<"all" | GoalTier>("all");
  const [showAddModal, setShowAddModal] = useState(false);

  // Add Goal Form State
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newTier, setNewTier] = useState<GoalTier>("daily");
  const [newParentId, setNewParentId] = useState<string>("");
  const [newTargetDate, setNewTargetDate] = useState(new Date().toISOString().split("T")[0]);

  // Missed Goal Reason Modal State
  const [targetMissedGoal, setTargetMissedGoal] = useState<GoalItem | null>(null);

  // Group goals by tier
  const yearlyGoals = goals.filter((g) => g.tier === "yearly");
  const monthlyGoals = goals.filter((g) => g.tier === "monthly");
  const weeklyGoals = goals.filter((g) => g.tier === "weekly");
  const dailyGoals = goals.filter((g) => g.tier === "daily");

  const filteredGoals =
    selectedTier === "all" ? goals : goals.filter((g) => g.tier === selectedTier);

  // Parent options based on newTier
  const getParentOptions = () => {
    if (newTier === "monthly") return yearlyGoals;
    if (newTier === "weekly") return monthlyGoals;
    if (newTier === "daily") return weeklyGoals;
    return [];
  };

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    onAddGoal({
      title: newTitle.trim(),
      description: newDescription.trim() || undefined,
      tier: newTier,
      parentId: newTier === "yearly" ? undefined : newParentId || undefined,
      targetDate: newTargetDate,
      status: "pending",
    });

    setNewTitle("");
    setNewDescription("");
    setNewParentId("");
    setShowAddModal(false);
  };

  const getParentHierarchyText = (goal: GoalItem): string[] => {
    const chain: string[] = [];
    let current = goal;
    while (current.parentId) {
      const parent = goals.find((g) => g.id === current.parentId);
      if (!parent) break;
      chain.unshift(`${parent.tier.toUpperCase()}: ${parent.title}`);
      current = parent;
    }
    return chain;
  };

  // Completion calculation
  const totalTasks = goals.length;
  const completedTasks = goals.filter((g) => g.status === "completed").length;
  const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Top Banner & Hierarchy Breakdown */}
      <div className="bg-[#141417] rounded-2xl border border-white/5 shadow-xl p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-white/5">
          <div>
            <div className="flex items-center gap-2">
              <Layers className="w-5 h-5 text-indigo-400" />
              <h2 className="text-base sm:text-lg font-bold text-white uppercase tracking-wider">
                Cascading Goal & Task System
              </h2>
            </div>
            <p className="text-xs text-slate-400 mt-1 max-w-2xl">
              Connect your Daily Tasks to Weekly Targets, Weekly Targets to Monthly Milestones, and
              Monthly Milestones to Yearly Vision. When daily tasks fall behind, the AI analyzes root
              causes to keep the grand vision on track.
            </p>
          </div>

          <button
            onClick={() => {
              setNewParentId("");
              setShowAddModal(true);
            }}
            className="flex items-center gap-1.5 px-4 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold rounded-xl shadow-lg shadow-emerald-500/20 transition-all shrink-0"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Create New Goal / Task</span>
          </button>
        </div>

        {/* 4-Tier Interactive Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6">
          <div
            onClick={() => setSelectedTier("yearly")}
            className={`p-4 rounded-xl border cursor-pointer transition-all ${
              selectedTier === "yearly"
                ? "bg-purple-500/10 border-purple-500/40 ring-1 ring-purple-500/40"
                : "bg-black/20 border-white/5 hover:bg-white/5"
            }`}
          >
            <div className="flex items-center justify-between text-2xs font-bold text-purple-400 uppercase tracking-wider">
              <span>1. Yearly Goals</span>
              <span className="font-mono">{yearlyGoals.filter((g) => g.status === "completed").length}/{yearlyGoals.length}</span>
            </div>
            <div className="text-xl font-bold font-mono text-white mt-1">{yearlyGoals.length}</div>
            <p className="text-2xs text-slate-500 mt-0.5">Long-term vision</p>
          </div>

          <div
            onClick={() => setSelectedTier("monthly")}
            className={`p-4 rounded-xl border cursor-pointer transition-all ${
              selectedTier === "monthly"
                ? "bg-indigo-500/10 border-indigo-500/40 ring-1 ring-indigo-500/40"
                : "bg-black/20 border-white/5 hover:bg-white/5"
            }`}
          >
            <div className="flex items-center justify-between text-2xs font-bold text-indigo-400 uppercase tracking-wider">
              <span>2. Monthly Milestones</span>
              <span className="font-mono">{monthlyGoals.filter((g) => g.status === "completed").length}/{monthlyGoals.length}</span>
            </div>
            <div className="text-xl font-bold font-mono text-white mt-1">{monthlyGoals.length}</div>
            <p className="text-2xs text-slate-500 mt-0.5">Key monthly gates</p>
          </div>

          <div
            onClick={() => setSelectedTier("weekly")}
            className={`p-4 rounded-xl border cursor-pointer transition-all ${
              selectedTier === "weekly"
                ? "bg-blue-500/10 border-blue-500/40 ring-1 ring-blue-500/40"
                : "bg-black/20 border-white/5 hover:bg-white/5"
            }`}
          >
            <div className="flex items-center justify-between text-2xs font-bold text-blue-400 uppercase tracking-wider">
              <span>3. Weekly Targets</span>
              <span className="font-mono">{weeklyGoals.filter((g) => g.status === "completed").length}/{weeklyGoals.length}</span>
            </div>
            <div className="text-xl font-bold font-mono text-white mt-1">{weeklyGoals.length}</div>
            <p className="text-2xs text-slate-500 mt-0.5">Sprint commitments</p>
          </div>

          <div
            onClick={() => setSelectedTier("daily")}
            className={`p-4 rounded-xl border cursor-pointer transition-all ${
              selectedTier === "daily"
                ? "bg-emerald-500/10 border-emerald-500/40 ring-1 ring-emerald-500/40"
                : "bg-black/20 border-white/5 hover:bg-white/5"
            }`}
          >
            <div className="flex items-center justify-between text-2xs font-bold text-emerald-400 uppercase tracking-wider">
              <span>4. Daily Tasks</span>
              <span className="font-mono">{dailyGoals.filter((g) => g.status === "completed").length}/{dailyGoals.length}</span>
            </div>
            <div className="text-xl font-bold font-mono text-white mt-1">{dailyGoals.length}</div>
            <p className="text-2xs text-slate-500 mt-0.5">Immediate action items</p>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mt-5 pt-4 border-t border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="text-xs text-slate-400">
            Overall Completion Rate: <span className="font-bold text-white font-mono">{completionRate}%</span> ({completedTasks} of {totalTasks} finished)
          </div>
          <div className="w-full sm:w-56 bg-black/40 border border-white/5 rounded-full h-2.5 overflow-hidden">
            <div
              className="bg-emerald-500 h-full rounded-full transition-all duration-300 shadow-sm shadow-emerald-500/50"
              style={{ width: `${completionRate}%` }}
            />
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center justify-between">
        <div className="inline-flex rounded-xl bg-[#141417] p-1 border border-white/5 text-xs font-medium">
          {(["all", "yearly", "monthly", "weekly", "daily"] as const).map((tier) => (
            <button
              key={tier}
              type="button"
              onClick={() => setSelectedTier(tier)}
              className={`px-3.5 py-1.5 rounded-lg capitalize transition-all ${
                selectedTier === tier
                  ? "bg-white text-black font-bold shadow-md"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              {tier === "all" ? "All Goals" : `${tier} Goals`}
            </button>
          ))}
        </div>
      </div>

      {/* Goals List */}
      <div className="space-y-3">
        {filteredGoals.length === 0 ? (
          <div className="p-10 text-center bg-[#141417] rounded-2xl border border-white/5 text-slate-500 text-sm">
            No goals found under this tier. Click "Create New Goal / Task" to start.
          </div>
        ) : (
          filteredGoals.map((g) => {
            const parentHierarchy = getParentHierarchyText(g);
            const isDone = g.status === "completed";
            const isMissed = g.status === "unachieved";

            return (
              <div
                key={g.id}
                className={`bg-[#141417] rounded-2xl border p-4 sm:p-5 shadow-xl transition-all ${
                  isDone
                    ? "border-emerald-500/20 bg-emerald-950/10"
                    : isMissed
                    ? "border-rose-500/20 bg-rose-950/10"
                    : "border-white/5 hover:border-white/10"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    {/* Status Checkbox */}
                    <button
                      type="button"
                      onClick={() =>
                        onUpdateGoalStatus(g.id, isDone ? "pending" : "completed")
                      }
                      className="mt-0.5 shrink-0 text-slate-500 hover:text-emerald-400 transition-colors"
                      title={isDone ? "Mark Pending" : "Mark Completed"}
                    >
                      {isDone ? (
                        <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                      ) : (
                        <Circle className="w-5 h-5" />
                      )}
                    </button>

                    <div className="min-w-0">
                      {/* Parent Hierarchy Breadcrumbs */}
                      {parentHierarchy.length > 0 && (
                        <div className="flex flex-wrap items-center gap-1 text-2xs text-slate-500 font-medium mb-1">
                          {parentHierarchy.map((crumb, idx) => (
                            <React.Fragment key={idx}>
                              <span className="truncate max-w-[200px]">{crumb}</span>
                              <ChevronRight className="w-3 h-3 text-slate-600" />
                            </React.Fragment>
                          ))}
                        </div>
                      )}

                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`font-semibold text-sm ${
                            isDone
                              ? "line-through text-slate-500"
                              : isMissed
                              ? "text-rose-300"
                              : "text-white"
                          }`}
                        >
                          {g.title}
                        </span>

                        <span
                          className={`text-2xs uppercase tracking-wider font-bold px-2.5 py-0.5 rounded-full border ${
                            g.tier === "yearly"
                              ? "bg-purple-500/10 border-purple-500/20 text-purple-300"
                              : g.tier === "monthly"
                              ? "bg-indigo-500/10 border-indigo-500/20 text-indigo-300"
                              : g.tier === "weekly"
                              ? "bg-blue-500/10 border-blue-500/20 text-blue-300"
                              : "bg-emerald-500/10 border-emerald-500/20 text-emerald-300"
                          }`}
                        >
                          {g.tier}
                        </span>

                        {isMissed && (
                          <span className="text-2xs font-bold px-2.5 py-0.5 rounded-full border bg-rose-500/10 border-rose-500/20 text-rose-300">
                            Unachieved / Missed
                          </span>
                        )}
                      </div>

                      {g.description && (
                        <p className="text-xs text-slate-400 mt-1">{g.description}</p>
                      )}

                      {/* Missed Reflection & AI Insight if available */}
                      {isMissed && g.missedReasonCategory && (
                        <div className="mt-3 p-3.5 bg-rose-500/10 border border-rose-500/20 rounded-xl text-xs space-y-1.5">
                          <div className="font-semibold text-rose-300 flex items-center gap-1.5">
                            <AlertCircle className="w-3.5 h-3.5" />
                            Obstacle Logged: {g.missedReasonCategory.replace("_", " ")}
                          </div>
                          {g.missedReasonDetails && (
                            <p className="text-slate-300 italic">{g.missedReasonDetails}</p>
                          )}
                          {g.aiSuggestedPivots && (
                            <div className="mt-2 pt-2 border-t border-rose-500/20 text-indigo-300 whitespace-pre-line">
                              <span className="font-bold flex items-center gap-1 text-indigo-400">
                                <Sparkles className="w-3 h-3 text-indigo-400" />
                                AI Strategic Pivot:
                              </span>
                              {g.aiSuggestedPivots}
                            </div>
                          )}
                        </div>
                      )}

                      <div className="flex items-center gap-3 text-2xs text-slate-500 mt-2 font-mono">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" /> Due: {g.targetDate}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Actions Right Side */}
                  <div className="flex items-center gap-2 shrink-0">
                    {!isDone && (
                      <button
                        type="button"
                        onClick={() => setTargetMissedGoal(g)}
                        className={`px-3 py-1.5 text-xs rounded-xl border font-medium transition-all ${
                          isMissed
                            ? "border-rose-500/40 bg-rose-500/10 text-rose-300 hover:bg-rose-500/20"
                            : "border-white/10 text-slate-400 hover:border-rose-500/30 hover:text-rose-300"
                        }`}
                      >
                        {isMissed ? "Update Reason" : "Mark Unachieved"}
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => onDeleteGoal(g.id)}
                      className="p-1.5 text-slate-500 hover:text-rose-400 rounded-lg transition-colors"
                      title="Delete Goal"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* CREATE GOAL MODAL */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4">
          <div className="bg-[#141417] rounded-2xl shadow-2xl max-w-lg w-full p-6 border border-white/10">
            <h3 className="text-base font-bold text-white mb-1">Create New Goal or Task</h3>
            <p className="text-xs text-slate-400 mb-4">
              Select tier and parent goal to maintain cascading alignment.
            </p>

            <form onSubmit={handleAddSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1.5">Goal Tier *</label>
                <div className="grid grid-cols-4 gap-2">
                  {(["yearly", "monthly", "weekly", "daily"] as GoalTier[]).map((tier) => (
                    <button
                      key={tier}
                      type="button"
                      onClick={() => {
                        setNewTier(tier);
                        setNewParentId("");
                      }}
                      className={`py-2 text-xs font-bold rounded-xl border capitalize transition-all ${
                        newTier === tier
                          ? "bg-emerald-500 text-slate-950 border-emerald-500 shadow-md shadow-emerald-500/20"
                          : "bg-black/20 text-slate-400 border-white/5 hover:bg-white/5 hover:text-white"
                      }`}
                    >
                      {tier}
                    </button>
                  ))}
                </div>
              </div>

              {/* Parent Goal Selector (if tier is not yearly) */}
              {newTier !== "yearly" && (
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1.5">
                    Connect to Parent {newTier === "monthly" ? "Yearly Goal" : newTier === "weekly" ? "Monthly Milestone" : "Weekly Target"} (Optional)
                  </label>
                  <select
                    value={newParentId}
                    onChange={(e) => setNewParentId(e.target.value)}
                    className="w-full px-3.5 py-2.5 border border-white/10 rounded-xl bg-[#0A0A0B] text-white text-xs focus:outline-hidden focus:border-emerald-500"
                  >
                    <option value="" className="bg-[#141417] text-slate-400">-- No Parent (Independent) --</option>
                    {getParentOptions().map((parent) => (
                      <option key={parent.id} value={parent.id} className="bg-[#141417] text-white">
                        {parent.title} ({parent.targetDate})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1.5">Goal / Task Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g., Deliver feature X sprint, Read 10 pages, Save $500"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-white/10 rounded-xl bg-[#0A0A0B] text-white placeholder-slate-600 text-xs focus:outline-hidden focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1.5">Description / Metric (Optional)</label>
                <textarea
                  rows={2}
                  placeholder="Details, acceptance criteria, or context"
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-white/10 rounded-xl bg-[#0A0A0B] text-white placeholder-slate-600 text-xs focus:outline-hidden focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1.5">Target Date *</label>
                <input
                  type="date"
                  required
                  value={newTargetDate}
                  onChange={(e) => setNewTargetDate(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-white/10 rounded-xl bg-[#0A0A0B] text-white text-xs focus:outline-hidden focus:border-emerald-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-white/5">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-400 hover:bg-white/5 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold text-slate-950 bg-emerald-500 hover:bg-emerald-400 rounded-xl shadow-lg shadow-emerald-500/20 transition-all"
                >
                  Add Goal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Missed Goal Reason & AI Diagnostic Modal */}
      {targetMissedGoal && (
        <MissedGoalModal
          goal={targetMissedGoal}
          allGoals={goals}
          isOpen={Boolean(targetMissedGoal)}
          onClose={() => setTargetMissedGoal(null)}
          onSaveReason={(id, reasonCat, details, aiPivots) => {
            onUpdateGoalStatus(id, "unachieved", reasonCat, details, aiPivots);
            setTargetMissedGoal(null);
          }}
        />
      )}
    </div>
  );
};
