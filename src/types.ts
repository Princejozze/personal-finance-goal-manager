export type ExpenseCategory =
  | "Food & Dining"
  | "Housing & Rent"
  | "Transportation"
  | "Utilities & Bills"
  | "Health & Medical"
  | "Education & Books"
  | "Shopping & Personal"
  | "Entertainment"
  | "Family & Kids"
  | "Business & Work"
  | "Other";

export type NecessityRating = "Essential" | "Useful" | "Discretionary" | "Wasteful";

export interface Expense {
  id: string;
  date: string; // YYYY-MM-DD
  amount: number;
  purpose: string;
  category: ExpenseCategory;
  necessityRating: NecessityRating;
  notes?: string;
  createdAt: string;
}

export type EarningCategory =
  | "Salary / Wage"
  | "Freelance / Contract"
  | "Business Revenue"
  | "Investment / Dividend"
  | "Consulting"
  | "Bonus / Gift"
  | "Other";

export interface Earning {
  id: string;
  date: string; // YYYY-MM-DD
  amount: number;
  source: string;
  jobDescription: string;
  category: EarningCategory;
  notes?: string;
  createdAt: string;
}

export interface TitheRecord {
  id: string;
  weekIdentifier: string; // e.g. "2026-W36"
  weekStartDate: string;
  weekEndDate: string;
  totalEarnings: number;
  tithePercentage: number; // default 10%
  titheDue: number;
  tithePaid: number;
  isPaid: boolean;
  paidAt?: string;
  recipient?: string;
  notes?: string;
}

export interface InvestmentRecord {
  id: string;
  date: string;
  amount: number;
  assetType:
    | "Index Fund / ETF"
    | "Stocks"
    | "High-Yield Savings"
    | "Real Estate"
    | "Bonds / Fixed"
    | "Crypto"
    | "Skills & Business"
    | "Other";
  platformOrVehicle: string;
  notes?: string;
  createdAt: string;
}

export type GoalTier = "yearly" | "monthly" | "weekly" | "daily";

export type MissedReasonCategory =
  | "time_constraint"
  | "low_energy"
  | "unrealistic_scope"
  | "distractions"
  | "external_blocker"
  | "lack_of_clarity"
  | "other";

export interface GoalItem {
  id: string;
  tier: GoalTier;
  parentId?: string; // daily -> weekly -> monthly -> yearly
  title: string;
  description?: string;
  targetDate: string; // YYYY-MM-DD
  status: "pending" | "in_progress" | "completed" | "unachieved";
  completedAt?: string;
  missedReasonCategory?: MissedReasonCategory;
  missedReasonDetails?: string;
  aiSuggestedPivots?: string;
  createdAt: string;
}

export interface WeeklyReviewRecord {
  id: string;
  weekIdentifier: string;
  weekStartDate: string;
  weekEndDate: string;
  reviewContent: string;
  generatedAt: string;
}

export interface AppSettings {
  currency: string;
  currencySymbol?: string;
  defaultTithePercent: number;
  defaultTithePercentage?: number;
  reminderEmail: string;
  notificationEmail?: string;
  autoSyncDrive: boolean;

  /** When true, the app auto-sends the AI daily reminder email once per day
   *  (after `reminderHour`) whenever it is opened and daily tasks are still pending. */
  autoReminderEnabled?: boolean;
  /** Hour of day (0-23, local time) after which the daily reminder may be sent. */
  reminderHour?: number;
  /** ISO date (YYYY-MM-DD) the daily reminder was last auto-sent — guards against duplicates. */
  lastAutoReminderDate?: string;

  /** When true, the app auto-generates the Gemini weekend review on Sat/Sun. */
  autoWeekendReviewEnabled?: boolean;
  /** ISO week identifier (e.g. "2026-W36") the weekend review was last auto-generated for. */
  lastAutoWeekendReviewWeek?: string;
}

export type UserSettings = AppSettings;

export interface AppData {
  version: number;
  lastModified: string;
  lastUpdated?: string;
  expenses: Expense[];
  earnings: Earning[];
  titheRecords: TitheRecord[];
  investments: InvestmentRecord[];
  goals: GoalItem[];
  weeklyReviews: WeeklyReviewRecord[];
  settings: AppSettings;
}

export interface UserProfile {
  uid: string;
  displayName: string | null;
  email: string | null;
  photoURL: string | null;
}
