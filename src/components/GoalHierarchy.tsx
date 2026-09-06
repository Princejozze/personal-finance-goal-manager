import React, { useState, useEffect, useRef } from "react";
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
  Clock,
  Bell,
  Check,
  RotateCcw,
  Zap,
  Lightbulb,
  ShieldCheck,
  Loader2,
} from "lucide-react";
import { GoalItem, GoalTier, MissedReasonCategory } from "../types";
import { MissedGoalModal } from "./MissedGoalModal";
import { requestTaskAnalysis } from "../services/geminiClient";
import {
  parseNaturalTimeFromText,
  formatTimeDisplay,
  getTaskTimeStatus,
  autoEvaluateTasksDeadline,
} from "../services/timeTaskHelper";

interface GoalHierarchyProps {
  goals: GoalItem[];
  theme?: "dark" | "light";
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

const REASON_QUICK_OPTIONS: { id: MissedReasonCategory; label: string; icon: string }[] = [
  { id: "time_constraint", label: "Ran out of time", icon: "⏱️" },
  { id: "distractions", label: "Distracted / Procrastinated", icon: "📱" },
  { id: "low_energy", label: "Low energy / Fatigue", icon: "🔋" },
  { id: "external_blocker", label: "Work / Emergency", icon: "🚧" },
  { id: "unrealistic_scope", label: "Oversized scope", icon: "🎯" },
  { id: "other", label: "Other reason", icon: "❓" },
];

export const GoalHierarchy: React.FC<GoalHierarchyProps> = ({
  goals,
  theme = "dark",
  onAddGoal,
  onUpdateGoalStatus,
  onDeleteGoal,
}) => {
  const isLight = theme === "light";
  const [selectedTier, setSelectedTier] = useState<"all" | GoalTier>("all");
  const [showAddModal, setShowAddModal] = useState(false);

  // Add Goal Form State
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newTier, setNewTier] = useState<GoalTier>("daily");
  const [newParentId, setNewParentId] = useState<string>("");
  const [newTargetDate, setNewTargetDate] = useState(new Date().toISOString().split("T")[0]);
  const [newTargetTime, setNewTargetTime] = useState<string>("");
  const [detectedTimeHint, setDetectedTimeHint] = useState<{
    targetTime: string;
    label: string;
  } | null>(null);

  // AI Task Analyzer State & Strategy ("How to keep it")
  const [isAnalyzingTask, setIsAnalyzingTask] = useState(false);
  const [aiCommitmentStrategy, setAiCommitmentStrategy] = useState<string>("");
  const [aiPrepBuffer, setAiPrepBuffer] = useState<string>("");
  const [showManualTimeInput, setShowManualTimeInput] = useState<boolean>(false);
  const analyzeDebounceRef = useRef<any>(null);

  // Missed Goal Reason Modal State
  const [targetMissedGoal, setTargetMissedGoal] = useState<GoalItem | null>(null);

  // Periodic check for overdue time-based tasks every 20 seconds
  useEffect(() => {
    const { newlyUnachievedGoals } = autoEvaluateTasksDeadline(goals);
    if (newlyUnachievedGoals.length > 0) {
      newlyUnachievedGoals.forEach((g) => {
        onUpdateGoalStatus(g.id, "unachieved");
      });
    }
  }, [goals, onUpdateGoalStatus]);

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

  // AI Analysis & Strategy invocation
  const runTaskAnalysis = async (titleVal: string, descVal?: string, tierVal?: GoalTier) => {
    const trimmed = titleVal.trim();
    if (!trimmed) return;
    setIsAnalyzingTask(true);
    try {
      const result = await requestTaskAnalysis({
        title: trimmed,
        description: descVal,
        tier: tierVal || newTier,
      });

      if (result.targetTime) {
        setNewTargetTime(result.targetTime);
        setDetectedTimeHint({
          targetTime: result.targetTime,
          label: result.timeLabel || formatTimeDisplay(result.targetTime),
        });
      }
      if (result.commitmentStrategy) {
        setAiCommitmentStrategy(result.commitmentStrategy);
      }
      if (result.prepBuffer) {
        setAiPrepBuffer(result.prepBuffer);
      }
    } catch (err) {
      console.warn("AI task analysis error:", err);
      // Fallback already happens on server or local regex
      const parsed = parseNaturalTimeFromText(trimmed);
      if (parsed) {
        setNewTargetTime(parsed.targetTime);
        setDetectedTimeHint({
          targetTime: parsed.targetTime,
          label: formatTimeDisplay(parsed.targetTime),
        });
      }
    } finally {
      setIsAnalyzingTask(false);
    }
  };

  // Live detection of time from title input + debounced AI deep analysis
  const handleTitleChange = (val: string) => {
    setNewTitle(val);
    if (newTier === "daily") {
      // Instant regex detection for immediate responsive UI feedback
      const parsed = parseNaturalTimeFromText(val);
      if (parsed) {
        setDetectedTimeHint({
          targetTime: parsed.targetTime,
          label: formatTimeDisplay(parsed.targetTime),
        });
        if (!newTargetTime) {
          setNewTargetTime(parsed.targetTime);
        }
      }

      // Debounced AI Strategy request (600ms)
      if (analyzeDebounceRef.current) {
        clearTimeout(analyzeDebounceRef.current);
      }
      if (val.trim().length >= 4) {
        analyzeDebounceRef.current = setTimeout(() => {
          runTaskAnalysis(val, newDescription, newTier);
        }, 750);
      }
    }
  };

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    let targetTime = newTargetTime;
    if (!targetTime && newTier === "daily") {
      const parsed = parseNaturalTimeFromText(newTitle);
      if (parsed) {
        targetTime = parsed.targetTime;
      }
    }

    onAddGoal({
      title: newTitle.trim(),
      description: newDescription.trim() || undefined,
      tier: newTier,
      parentId: newTier === "yearly" ? undefined : newParentId || undefined,
      targetDate: newTargetDate,
      targetTime: targetTime || undefined,
      commitmentStrategy: aiCommitmentStrategy.trim() || undefined,
      prepBuffer: aiPrepBuffer.trim() || undefined,
      status: "pending",
    });

    setNewTitle("");
    setNewDescription("");
    setNewParentId("");
    setNewTargetTime("");
    setDetectedTimeHint(null);
    setAiCommitmentStrategy("");
    setAiPrepBuffer("");
    setShowManualTimeInput(false);
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
  const unachievedTasks = goals.filter((g) => g.status === "unachieved").length;
  const pendingTasks = goals.filter((g) => g.status === "pending" || g.status === "in_progress").length;
  const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  const cardBg = isLight ? "bg-white border-slate-200 text-slate-900 shadow-sm" : "bg-[#141417] border-white/5 text-white shadow-xl";

  return (
    <div className="space-y-6">
      {/* Top Banner & Hierarchy Breakdown */}
      <div className={`rounded-2xl border p-6 ${cardBg}`}>
        <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b ${
          isLight ? "border-slate-200" : "border-white/5"
        }`}>
          <div>
            <div className="flex items-center gap-2">
              <Layers className="w-5 h-5 text-indigo-500" />
              <h2 className={`text-base sm:text-lg font-bold uppercase tracking-wider ${isLight ? "text-slate-900" : "text-white"}`}>
                Time-Based & Cascading Goal System
              </h2>
            </div>
            <p className={`text-xs mt-1 max-w-2xl ${isLight ? "text-slate-600" : "text-slate-400"}`}>
              Schedule hourly and time-based tasks (e.g. <em>"Cook before noon"</em>, <em>"Church at 4pm"</em>).
              Tasks nearing deadline alert you, and when deadlines pass, tasks are automatically marked unachieved
              waiting for you to log the obstacle.
            </p>
          </div>

          <button
            onClick={() => {
              setNewParentId("");
              setShowAddModal(true);
            }}
            className="flex items-center gap-1.5 px-4 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold rounded-xl shadow-lg shadow-emerald-500/20 transition-all shrink-0 cursor-pointer"
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
                ? "bg-purple-500/15 border-purple-500/50 ring-1 ring-purple-500/50"
                : isLight
                ? "bg-slate-50 border-slate-200 hover:bg-slate-100"
                : "bg-black/20 border-white/5 hover:bg-white/5"
            }`}
          >
            <div className="flex items-center justify-between text-2xs font-bold text-purple-500 uppercase tracking-wider">
              <span>1. Yearly Goals</span>
              <span className="font-mono">{yearlyGoals.filter((g) => g.status === "completed").length}/{yearlyGoals.length}</span>
            </div>
            <div className={`text-xl font-bold font-mono mt-1 ${isLight ? "text-slate-900" : "text-white"}`}>{yearlyGoals.length}</div>
            <p className="text-2xs text-slate-500 mt-0.5">Long-term vision</p>
          </div>

          <div
            onClick={() => setSelectedTier("monthly")}
            className={`p-4 rounded-xl border cursor-pointer transition-all ${
              selectedTier === "monthly"
                ? "bg-indigo-500/15 border-indigo-500/50 ring-1 ring-indigo-500/50"
                : isLight
                ? "bg-slate-50 border-slate-200 hover:bg-slate-100"
                : "bg-black/20 border-white/5 hover:bg-white/5"
            }`}
          >
            <div className="flex items-center justify-between text-2xs font-bold text-indigo-500 uppercase tracking-wider">
              <span>2. Monthly Milestones</span>
              <span className="font-mono">{monthlyGoals.filter((g) => g.status === "completed").length}/{monthlyGoals.length}</span>
            </div>
            <div className={`text-xl font-bold font-mono mt-1 ${isLight ? "text-slate-900" : "text-white"}`}>{monthlyGoals.length}</div>
            <p className="text-2xs text-slate-500 mt-0.5">Key monthly gates</p>
          </div>

          <div
            onClick={() => setSelectedTier("weekly")}
            className={`p-4 rounded-xl border cursor-pointer transition-all ${
              selectedTier === "weekly"
                ? "bg-blue-500/15 border-blue-500/50 ring-1 ring-blue-500/50"
                : isLight
                ? "bg-slate-50 border-slate-200 hover:bg-slate-100"
                : "bg-black/20 border-white/5 hover:bg-white/5"
            }`}
          >
            <div className="flex items-center justify-between text-2xs font-bold text-blue-500 uppercase tracking-wider">
              <span>3. Weekly Targets</span>
              <span className="font-mono">{weeklyGoals.filter((g) => g.status === "completed").length}/{weeklyGoals.length}</span>
            </div>
            <div className={`text-xl font-bold font-mono mt-1 ${isLight ? "text-slate-900" : "text-white"}`}>{weeklyGoals.length}</div>
            <p className="text-2xs text-slate-500 mt-0.5">Weekly sprints</p>
          </div>

          <div
            onClick={() => setSelectedTier("daily")}
            className={`p-4 rounded-xl border cursor-pointer transition-all ${
              selectedTier === "daily"
                ? "bg-emerald-500/15 border-emerald-500/50 ring-1 ring-emerald-500/50"
                : isLight
                ? "bg-slate-50 border-slate-200 hover:bg-slate-100"
                : "bg-black/20 border-white/5 hover:bg-white/5"
            }`}
          >
            <div className="flex items-center justify-between text-2xs font-bold text-emerald-500 uppercase tracking-wider">
              <span>4. Daily Tasks</span>
              <span className="font-mono">{dailyGoals.filter((g) => g.status === "completed").length}/{dailyGoals.length}</span>
            </div>
            <div className={`text-xl font-bold font-mono mt-1 ${isLight ? "text-slate-900" : "text-white"}`}>{dailyGoals.length}</div>
            <p className="text-2xs text-slate-500 mt-0.5">Hourly execution</p>
          </div>
        </div>

        {/* Global Progress Bar */}
        <div className="mt-6">
          <div className="flex items-center justify-between text-xs font-semibold mb-1.5">
            <span className={isLight ? "text-slate-600" : "text-slate-400"}>Overall Task Velocity</span>
            <span className="text-emerald-500 font-mono">
              {completionRate}% ({completedTasks}/{totalTasks} Done, {unachievedTasks} Missed)
            </span>
          </div>
          <div className={`w-full h-2 rounded-full overflow-hidden flex ${isLight ? "bg-slate-200" : "bg-white/5"}`}>
            <div
              className="h-full bg-emerald-500 transition-all duration-500"
              style={{ width: `${completionRate}%` }}
            />
            <div
              className="h-full bg-rose-500 transition-all duration-500"
              style={{
                width: `${totalTasks > 0 ? Math.round((unachievedTasks / totalTasks) * 100) : 0}%`,
              }}
            />
          </div>
        </div>
      </div>

      {/* Tier Filter Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
        <button
          onClick={() => setSelectedTier("all")}
          className={`px-3 py-1.5 rounded-xl font-semibold transition-all cursor-pointer ${
            selectedTier === "all"
              ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/20"
              : isLight
              ? "bg-slate-100 text-slate-600 hover:bg-slate-200"
              : "bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white"
          }`}
        >
          All Tiers ({goals.length})
        </button>
        {(["daily", "weekly", "monthly", "yearly"] as GoalTier[]).map((tier) => (
          <button
            key={tier}
            onClick={() => setSelectedTier(tier)}
            className={`px-3 py-1.5 rounded-xl font-semibold capitalize transition-all cursor-pointer ${
              selectedTier === tier
                ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/20"
                : isLight
                ? "bg-slate-100 text-slate-600 hover:bg-slate-200"
                : "bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white"
            }`}
          >
            {tier} ({goals.filter((g) => g.tier === tier).length})
          </button>
        ))}
      </div>

      {/* Goals List */}
      <div className="space-y-3">
        {filteredGoals.length === 0 ? (
          <div className={`text-center py-12 rounded-2xl border ${cardBg}`}>
            <Target className="w-10 h-10 text-slate-400 mx-auto mb-3 opacity-40" />
            <h3 className={`text-sm font-bold ${isLight ? "text-slate-900" : "text-white"}`}>No goals or tasks in this tier</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              Add a goal to build your cascading hierarchy, or set daily time-based tasks like "Cook before noon".
            </p>
          </div>
        ) : (
          filteredGoals.map((g) => {
            const isDone = g.status === "completed";
            const isMissed = g.status === "unachieved";
            const parentHierarchy = getParentHierarchyText(g);
            const timeStatus = getTaskTimeStatus(g);

            return (
              <div
                key={g.id}
                className={`rounded-2xl border p-4 sm:p-5 transition-all ${
                  isDone
                    ? isLight
                      ? "border-emerald-200 bg-emerald-50/50"
                      : "border-emerald-500/20 bg-emerald-950/10"
                    : isMissed
                    ? isLight
                      ? "border-rose-300 bg-rose-50/70 shadow-xs"
                      : "border-rose-500/30 bg-rose-950/20 shadow-lg"
                    : timeStatus.isNearDeadline
                    ? isLight
                      ? "border-amber-300 bg-amber-50/60 ring-1 ring-amber-300/60"
                      : "border-amber-500/40 bg-amber-950/20 ring-1 ring-amber-500/30"
                    : cardBg
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
                      className="mt-0.5 shrink-0 text-slate-400 hover:text-emerald-500 transition-colors cursor-pointer"
                      title={isDone ? "Mark Pending" : "Mark Completed"}
                    >
                      {isDone ? (
                        <CheckCircle2 className="w-5 h-5 text-emerald-500" />
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
                              <ChevronRight className="w-3 h-3 text-slate-400" />
                            </React.Fragment>
                          ))}
                        </div>
                      )}

                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`font-semibold text-sm ${
                            isDone
                              ? "line-through text-slate-400"
                              : isMissed
                              ? "text-rose-600 dark:text-rose-300 font-bold"
                              : isLight
                              ? "text-slate-900"
                              : "text-white"
                          }`}
                        >
                          {g.title}
                        </span>

                        <span
                          className={`text-2xs uppercase tracking-wider font-bold px-2 py-0.5 rounded-full border ${
                            g.tier === "yearly"
                              ? "bg-purple-500/10 border-purple-500/20 text-purple-600 dark:text-purple-300"
                              : g.tier === "monthly"
                              ? "bg-indigo-500/10 border-indigo-500/20 text-indigo-600 dark:text-indigo-300"
                              : g.tier === "weekly"
                              ? "bg-blue-500/10 border-blue-500/20 text-blue-600 dark:text-blue-300"
                              : "bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-300"
                          }`}
                        >
                          {g.tier}
                        </span>

                        {/* Target Time & Deadline Badge */}
                        {g.targetTime && (
                          <span
                            className={`inline-flex items-center gap-1 text-2xs font-semibold px-2 py-0.5 rounded-full border ${timeStatus.badgeColorClass}`}
                          >
                            <Clock className="w-3 h-3" />
                            {timeStatus.label}
                          </span>
                        )}

                        {isMissed && !g.targetTime && (
                          <span className="text-2xs font-bold px-2.5 py-0.5 rounded-full border bg-rose-500/10 border-rose-500/20 text-rose-600 dark:text-rose-300">
                            Unachieved / Missed
                          </span>
                        )}
                      </div>

                      {g.description && (
                        <p className={`text-xs mt-1 ${isLight ? "text-slate-600" : "text-slate-400"}`}>{g.description}</p>
                      )}

                      {/* AI Strategy: How to Keep It */}
                      {g.commitmentStrategy && !isDone && (
                        <div className={`mt-2 p-2.5 rounded-xl text-xs flex items-start gap-2 border ${
                          isLight
                            ? "bg-emerald-50/80 border-emerald-200 text-emerald-950"
                            : "bg-emerald-950/30 border-emerald-500/25 text-emerald-200"
                        }`}>
                          <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                          <div className="space-y-0.5">
                            <div>
                              <strong className="font-semibold text-emerald-600 dark:text-emerald-400">How to Keep It: </strong>
                              <span>{g.commitmentStrategy}</span>
                            </div>
                            {g.prepBuffer && (
                              <div className="text-2xs text-emerald-700 dark:text-emerald-300 font-mono flex items-center gap-1">
                                <Zap className="w-3 h-3 text-amber-500" />
                                <span>Prep recommendation: {g.prepBuffer}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Approaching Reminder Callout */}
                      {timeStatus.isNearDeadline && !isDone && (
                        <div className={`mt-2.5 px-3 py-2 rounded-xl text-xs flex items-center gap-2 border ${
                          isLight
                            ? "bg-amber-100/70 border-amber-300 text-amber-900"
                            : "bg-amber-500/10 border-amber-500/30 text-amber-300"
                        }`}>
                          <Bell className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                          <span>
                            <strong>Approaching Deadline:</strong> Due at {formatTimeDisplay(g.targetTime)}. Please finish or prepare.
                          </span>
                        </div>
                      )}

                      {/* AUTO-MARKED UNACHIEVED PROMPT / MISSING REASON BOX */}
                      {isMissed && (g.autoMarkedUnachieved || g.needsReason || !g.missedReasonCategory) && (
                        <div className={`mt-3 p-3.5 rounded-xl text-xs space-y-2 border ${
                          isLight
                            ? "bg-rose-100/60 border-rose-300 text-slate-800"
                            : "bg-rose-950/40 border-rose-500/40 text-rose-200"
                        }`}>
                          <div className="font-bold flex items-center justify-between text-rose-600 dark:text-rose-300">
                            <span className="flex items-center gap-1.5">
                              <AlertCircle className="w-4 h-4 text-rose-500" />
                              Deadline Passed — Auto-Marked Unachieved!
                            </span>
                            <button
                              onClick={() => onUpdateGoalStatus(g.id, "completed")}
                              className="text-2xs font-semibold underline text-emerald-600 dark:text-emerald-400 cursor-pointer"
                            >
                              Actually finished it?
                            </button>
                          </div>
                          <p className="text-2xs text-slate-600 dark:text-slate-300">
                            Select why this task wasn't achieved to calibrate AI recovery and insights:
                          </p>

                          {/* Quick 1-click Reason Chips */}
                          <div className="flex flex-wrap gap-1.5 pt-1">
                            {REASON_QUICK_OPTIONS.map((opt) => (
                              <button
                                key={opt.id}
                                type="button"
                                onClick={() => {
                                  onUpdateGoalStatus(g.id, "unachieved", opt.id, opt.label);
                                }}
                                className={`flex items-center gap-1 px-2.5 py-1 text-2xs font-semibold rounded-lg border transition-all cursor-pointer ${
                                  isLight
                                    ? "bg-white hover:bg-slate-100 text-slate-800 border-slate-300 shadow-xs"
                                    : "bg-black/40 hover:bg-white/10 text-slate-200 border-white/10"
                                }`}
                              >
                                <span>{opt.icon}</span>
                                <span>{opt.label}</span>
                              </button>
                            ))}
                            <button
                              type="button"
                              onClick={() => setTargetMissedGoal(g)}
                              className="flex items-center gap-1 px-2.5 py-1 text-2xs font-semibold rounded-lg border border-indigo-500/40 bg-indigo-500/20 text-indigo-300 hover:bg-indigo-500/30 cursor-pointer"
                            >
                              <Sparkles className="w-3 h-3 text-indigo-400" />
                              <span>Deep AI Diagnostic</span>
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Logged Obstacle & AI Strategic Pivot */}
                      {isMissed && g.missedReasonCategory && (
                        <div className={`mt-3 p-3.5 rounded-xl text-xs space-y-1.5 border ${
                          isLight
                            ? "bg-slate-100 border-slate-200"
                            : "bg-rose-500/10 border-rose-500/20"
                        }`}>
                          <div className="font-semibold text-rose-600 dark:text-rose-300 flex items-center justify-between">
                            <span className="flex items-center gap-1.5">
                              <AlertCircle className="w-3.5 h-3.5 text-rose-500" />
                              Obstacle Logged: {g.missedReasonCategory.replace("_", " ")}
                            </span>
                            <button
                              onClick={() => setTargetMissedGoal(g)}
                              className="text-2xs text-indigo-500 underline cursor-pointer"
                            >
                              Edit / Pivot
                            </button>
                          </div>
                          {g.missedReasonDetails && (
                            <p className="text-slate-600 dark:text-slate-300 italic">{g.missedReasonDetails}</p>
                          )}
                          {g.aiSuggestedPivots && (
                            <div className="mt-2 pt-2 border-t border-rose-500/20 text-indigo-600 dark:text-indigo-300 whitespace-pre-line">
                              <span className="font-bold flex items-center gap-1 text-indigo-500 dark:text-indigo-400">
                                <Sparkles className="w-3 h-3" />
                                AI Strategic Pivot:
                              </span>
                              {g.aiSuggestedPivots}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Date & Time display */}
                      <div className="flex items-center gap-3 text-2xs text-slate-500 mt-2 font-mono">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" /> Due: {g.targetDate}
                        </span>
                        {g.targetTime && (
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" /> Time: {formatTimeDisplay(g.targetTime)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Actions Right Side */}
                  <div className="flex items-center gap-2 shrink-0">
                    {!isDone && (
                      <button
                        type="button"
                        onClick={() => setTargetMissedGoal(g)}
                        className={`px-3 py-1.5 text-xs rounded-xl border font-medium transition-all cursor-pointer ${
                          isMissed
                            ? "border-rose-500/40 bg-rose-500/10 text-rose-600 dark:text-rose-300 hover:bg-rose-500/20"
                            : isLight
                            ? "border-slate-300 text-slate-600 hover:bg-slate-100"
                            : "border-white/10 text-slate-400 hover:border-rose-500/30 hover:text-rose-300"
                        }`}
                      >
                        {isMissed ? "Update Reason" : "Mark Unachieved"}
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => onDeleteGoal(g.id)}
                      className="p-1.5 text-slate-400 hover:text-rose-500 rounded-lg transition-colors cursor-pointer"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4 overflow-y-auto">
          <div className={`rounded-2xl shadow-2xl max-w-lg w-full p-6 border my-8 ${cardBg}`}>
            <h3 className={`text-base font-bold mb-1 ${isLight ? "text-slate-900" : "text-white"}`}>Create New Goal or Task</h3>
            <p className="text-xs text-slate-500 mb-4">
              Connect daily hourly tasks to weekly, monthly, and yearly vision.
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
                      className={`py-2 text-xs font-bold rounded-xl border capitalize transition-all cursor-pointer ${
                        newTier === tier
                          ? "bg-emerald-500 text-slate-950 border-emerald-500 shadow-md shadow-emerald-500/20"
                          : isLight
                          ? "bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200"
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
                    className={`w-full px-3.5 py-2.5 border rounded-xl text-xs focus:outline-hidden focus:border-emerald-500 ${
                      isLight
                        ? "bg-white text-slate-900 border-slate-300"
                        : "bg-[#0A0A0B] text-white border-white/10"
                    }`}
                  >
                    <option value="">-- No Parent (Independent) --</option>
                    {getParentOptions().map((parent) => (
                      <option key={parent.id} value={parent.id}>
                        {parent.title} ({parent.targetDate})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1.5">
                  Goal / Task Title *
                </label>
                <input
                  type="text"
                  required
                  placeholder='e.g. "Cook before noon", "Go to church at 4pm", "Finish report by 1pm"'
                  value={newTitle}
                  onChange={(e) => handleTitleChange(e.target.value)}
                  className={`w-full px-3.5 py-2.5 border rounded-xl text-xs focus:outline-hidden focus:border-emerald-500 ${
                    isLight
                      ? "bg-white text-slate-900 border-slate-300 placeholder-slate-400"
                      : "bg-[#0A0A0B] text-white border-white/10 placeholder-slate-600"
                  }`}
                />
                {detectedTimeHint && (
                  <div className="mt-1.5 flex items-center gap-1.5 text-2xs text-amber-500 font-semibold">
                    <Zap className="w-3 h-3" />
                    <span>Auto-detected deadline: <strong>{detectedTimeHint.label}</strong> (Applied!)</span>
                  </div>
                )}
              </div>

              {/* AI Task Analyzer & Commitment Coach ("How to Keep It") */}
              {newTier === "daily" && (
                <div className={`p-4 rounded-xl border transition-all space-y-3 ${
                  isLight ? "bg-slate-50 border-slate-200" : "bg-[#0F0F12] border-white/10"
                }`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-indigo-500">
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>AI Schedule & Commitment Intelligence</span>
                    </div>

                    <button
                      type="button"
                      onClick={() => runTaskAnalysis(newTitle, newDescription, newTier)}
                      disabled={isAnalyzingTask || !newTitle.trim()}
                      className="inline-flex items-center gap-1 px-2.5 py-1 text-2xs font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white transition-all cursor-pointer shadow-xs"
                    >
                      {isAnalyzingTask ? (
                        <>
                          <Loader2 className="w-3 h-3 animate-spin" />
                          <span>Analyzing...</span>
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-3 h-3" />
                          <span>Analyze Task & Strategy</span>
                        </>
                      )}
                    </button>
                  </div>

                  {/* Target Time Status Bar */}
                  <div className={`p-3 rounded-xl border flex items-center justify-between ${
                    newTargetTime
                      ? isLight
                        ? "bg-indigo-50 border-indigo-200 text-indigo-950"
                        : "bg-indigo-950/40 border-indigo-500/30 text-indigo-200"
                      : isLight
                      ? "bg-white border-slate-200 text-slate-700"
                      : "bg-black/20 border-white/5 text-slate-300"
                  }`}>
                    <div className="flex items-center gap-2.5">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs ${
                        newTargetTime
                          ? "bg-indigo-600 text-white shadow-xs"
                          : isLight ? "bg-slate-200 text-slate-600" : "bg-white/10 text-slate-400"
                      }`}>
                        <Clock className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-2xs uppercase tracking-wider font-bold text-slate-500">
                          Target Execution Deadline
                        </div>
                        <div className="text-xs font-bold font-mono">
                          {newTargetTime ? formatTimeDisplay(newTargetTime) : "Flexible / No specific hour detected"}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setShowManualTimeInput(!showManualTimeInput)}
                        className="text-2xs font-semibold text-indigo-500 hover:underline cursor-pointer"
                      >
                        {showManualTimeInput ? "Hide Time Adjuster" : "Fine-Tune Hour"}
                      </button>
                      {newTargetTime && (
                        <button
                          type="button"
                          onClick={() => {
                            setNewTargetTime("");
                            setDetectedTimeHint(null);
                          }}
                          className="text-2xs text-slate-400 hover:text-rose-500 underline cursor-pointer"
                        >
                          Clear
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Manual Time Input if requested */}
                  {showManualTimeInput && (
                    <div className="pt-1">
                      <label className="block text-2xs font-semibold text-slate-500 uppercase mb-1">
                        Exact Target Time (HH:MM)
                      </label>
                      <input
                        type="time"
                        value={newTargetTime}
                        onChange={(e) => {
                          setNewTargetTime(e.target.value);
                          if (e.target.value) {
                            setDetectedTimeHint({
                              targetTime: e.target.value,
                              label: formatTimeDisplay(e.target.value),
                            });
                          }
                        }}
                        className={`w-full px-3 py-2 border rounded-xl text-xs font-mono focus:outline-hidden focus:border-indigo-500 ${
                          isLight
                            ? "bg-white text-slate-900 border-slate-300"
                            : "bg-[#0A0A0B] text-white border-white/10"
                        }`}
                      />
                    </div>
                  )}

                  {/* AI Commitment Strategy ("How to Keep It") */}
                  {aiCommitmentStrategy ? (
                    <div className={`p-3 rounded-xl border space-y-1.5 ${
                      isLight
                        ? "bg-emerald-50 border-emerald-200 text-emerald-950"
                        : "bg-emerald-950/30 border-emerald-500/25 text-emerald-200"
                    }`}>
                      <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                        <ShieldCheck className="w-4 h-4" />
                        <span>AI Commitment Strategy — How to Keep It:</span>
                      </div>
                      <p className="text-xs leading-relaxed">
                        {aiCommitmentStrategy}
                      </p>
                      {aiPrepBuffer && (
                        <div className="text-2xs font-semibold text-emerald-700 dark:text-emerald-300 flex items-center gap-1 pt-1.5 border-t border-emerald-500/20">
                          <Zap className="w-3.5 h-3.5 text-amber-500" />
                          <span>Recommended Prep Window: {aiPrepBuffer}</span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-2xs text-slate-500 flex items-center gap-2 px-1">
                      <Lightbulb className="w-4 h-4 text-amber-500 shrink-0" />
                      <span>
                        Type your plan above (e.g., <em>"Cook before noon"</em> or <em>"Go to church at 4pm"</em>). The AI will automatically schedule deadlines and recommend how to keep your commitment!
                      </span>
                    </div>
                  )}
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1.5">
                  Description / Metric (Optional)
                </label>
                <textarea
                  rows={2}
                  placeholder="Details, acceptance criteria, or context"
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  className={`w-full px-3.5 py-2.5 border rounded-xl text-xs focus:outline-hidden focus:border-emerald-500 ${
                    isLight
                      ? "bg-white text-slate-900 border-slate-300 placeholder-slate-400"
                      : "bg-[#0A0A0B] text-white border-white/10 placeholder-slate-600"
                  }`}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1.5">
                  Target Date *
                </label>
                <input
                  type="date"
                  required
                  value={newTargetDate}
                  onChange={(e) => setNewTargetDate(e.target.value)}
                  className={`w-full px-3.5 py-2.5 border rounded-xl text-xs focus:outline-hidden focus:border-emerald-500 ${
                    isLight
                      ? "bg-white text-slate-900 border-slate-300"
                      : "bg-[#0A0A0B] text-white border-white/10"
                  }`}
                />
              </div>

              <div className={`flex justify-end gap-2 pt-4 border-t ${isLight ? "border-slate-200" : "border-white/5"}`}>
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className={`px-4 py-2 text-xs font-bold rounded-xl border transition-all cursor-pointer ${
                    isLight
                      ? "border-slate-300 text-slate-600 hover:bg-slate-100"
                      : "border-white/10 text-slate-400 hover:text-white"
                  }`}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold rounded-xl shadow-lg shadow-emerald-500/20 transition-all cursor-pointer"
                >
                  Create Goal / Task
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Missed Goal Reason & AI Diagnostic Modal */}
      <MissedGoalModal
        goal={targetMissedGoal}
        allGoals={goals}
        isOpen={Boolean(targetMissedGoal)}
        theme={theme}
        onClose={() => setTargetMissedGoal(null)}
        onSaveReason={(goalId, reasonCategory, details, aiPivots) => {
          onUpdateGoalStatus(goalId, "unachieved", reasonCategory, details, aiPivots);
          setTargetMissedGoal(null);
        }}
      />
    </div>
  );
};
