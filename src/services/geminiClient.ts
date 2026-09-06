import { Expense, Earning, TitheRecord, GoalItem } from "../types";

export interface WeeklyReviewPayload {
  expenses: Expense[];
  earnings: Earning[];
  weekInfo: string;
  titheStatus: {
    totalEarned: number;
    titheDue: number;
    tithePaid: number;
    isPaid: boolean;
  };
}

export const requestWeeklyReview = async (payload: WeeklyReviewPayload): Promise<string> => {
  const res = await fetch("/api/gemini/weekly-review", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || "Failed to generate weekly review");
  }

  const data = await res.json();
  return data.review;
};

export interface InvestmentProposalPayload {
  weeklyEarnings: number;
  weeklyExpenses: number;
  currentSavings?: number;
  riskAppetite?: string;
}

export const requestInvestmentProposal = async (
  payload: InvestmentProposalPayload
): Promise<string> => {
  const res = await fetch("/api/gemini/investment-proposal", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || "Failed to generate investment proposal");
  }

  const data = await res.json();
  return data.proposal;
};

export interface GoalInsightsPayload {
  missedGoals: GoalItem[];
  allGoals: GoalItem[];
  recentFeedback?: string;
}

export const requestGoalInsights = async (payload: GoalInsightsPayload): Promise<string> => {
  const res = await fetch("/api/gemini/goal-insights", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || "Failed to generate goal insights");
  }

  const data = await res.json();
  return data.insights;
};

export interface DraftReminderEmailPayload {
  userName: string;
  pendingTasks: GoalItem[];
  unachievedGoals: GoalItem[];
  isZeroTasksDay?: boolean;
}

export interface DraftReminderEmailResponse {
  subject: string;
  bodyText: string;
  bodyHtml: string;
}

export const requestDraftReminderEmail = async (
  payload: DraftReminderEmailPayload
): Promise<DraftReminderEmailResponse> => {
  const res = await fetch("/api/gemini/draft-reminder-email", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || "Failed to draft reminder email");
  }

  return await res.json();
};

export interface QuickBriefPayload {
  userName: string;
  financialSummary: {
    totalEarnings: number;
    totalExpenses: number;
    tithePaid: number;
    titheDue: number;
    totalInvested: number;
  };
  goalSummary: {
    totalGoals: number;
    pendingDailyCount: number;
    completedDailyCount: number;
    unachievedCount: number;
  };
}

export const requestQuickBrief = async (payload: QuickBriefPayload): Promise<string> => {
  const res = await fetch("/api/gemini/quick-brief", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || "Failed to generate quick executive brief");
  }

  const data = await res.json();
  return data.brief;
};

export interface TaskAnalysisPayload {
  title: string;
  description?: string;
  tier?: string;
}

export interface TaskAnalysisResponse {
  targetTime: string | null;
  timeLabel: string | null;
  commitmentStrategy: string;
  prepBuffer: string;
  suggestedTier: "daily" | "weekly" | "monthly" | "yearly";
}

export const requestTaskAnalysis = async (
  payload: TaskAnalysisPayload
): Promise<TaskAnalysisResponse> => {
  const res = await fetch("/api/gemini/analyze-task", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || "Failed to analyze task");
  }

  return await res.json();
};

