import { GoalItem, MissedReasonCategory } from "../types";

export interface NaturalTimeParseResult {
  targetTime: string; // "HH:MM" in 24-hr format
  timePreset: "morning" | "noon" | "afternoon" | "church" | "evening" | "custom";
  matchedPhrase: string;
  cleanedTitle: string;
}

/**
 * Intelligent natural language parser for time in task titles.
 * Examples:
 * - "I will cook before noon" -> targetTime: "12:00", preset: "noon"
 * - "I will go to church at 4pm" -> targetTime: "16:00", preset: "church"
 * - "I will cook by 1 pm" -> targetTime: "13:00", preset: "afternoon"
 * - "Read chapter at 8:30 am" -> targetTime: "08:30", preset: "morning"
 * - "Evening review by 7pm" -> targetTime: "19:00", preset: "evening"
 */
export function parseNaturalTimeFromText(title: string): NaturalTimeParseResult | null {
  if (!title) return null;
  const lower = title.toLowerCase();

  // 1. Church specific check
  const churchMatch = lower.match(/\bchurch\b.*?(?:at|by|near)?\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i) ||
                      lower.match(/(?:at|by|near)?\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)?.*?\bchurch\b/i);
  if (churchMatch) {
    let hour = parseInt(churchMatch[1], 10);
    const minute = churchMatch[2] ? parseInt(churchMatch[2], 10) : 0;
    const meridiem = churchMatch[3]?.toLowerCase();

    if (meridiem === "pm" && hour < 12) hour += 12;
    else if (meridiem === "am" && hour === 12) hour = 0;
    else if (!meridiem && hour <= 6) hour += 12; // e.g. "church at 4" implies 4 PM

    const formattedTime = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
    return {
      targetTime: formattedTime,
      timePreset: "church",
      matchedPhrase: churchMatch[0],
      cleanedTitle: title,
    };
  }

  // 2. Noon / Before Noon / Near Noon check
  if (/\b(?:before|by|near|at|around)?\s*noon\b/i.test(lower)) {
    return {
      targetTime: "12:00",
      timePreset: "noon",
      matchedPhrase: "noon",
      cleanedTitle: title,
    };
  }

  // 3. Midday / Lunch check
  if (/\b(?:before|by|at)?\s*lunch(?:time)?\b/i.test(lower)) {
    return {
      targetTime: "12:30",
      timePreset: "noon",
      matchedPhrase: "lunch",
      cleanedTitle: title,
    };
  }

  // 4. Standard explicit time matching: "at 4pm", "by 1 pm", "before 11:30 am", "at 16:00"
  const timeRegex = /\b(?:at|by|before|near|around)?\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i;
  const match = lower.match(timeRegex);
  if (match) {
    let hour = parseInt(match[1], 10);
    const minute = match[2] ? parseInt(match[2], 10) : 0;
    const meridiem = match[3]?.toLowerCase();

    if (meridiem === "pm" && hour < 12) hour += 12;
    else if (meridiem === "am" && hour === 12) hour = 0;

    const formattedTime = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
    let preset: "morning" | "noon" | "afternoon" | "evening" | "custom" = "custom";
    if (hour < 12) preset = "morning";
    else if (hour === 12) preset = "noon";
    else if (hour < 17) preset = "afternoon";
    else preset = "evening";

    return {
      targetTime: formattedTime,
      timePreset: preset,
      matchedPhrase: match[0],
      cleanedTitle: title,
    };
  }

  // 5. 24-hour format e.g. "at 14:00" or "by 18:30"
  const time24Regex = /\b(?:at|by|before)?\s*([01]?[0-9]|2[0-3]):([0-5][0-9])\b/i;
  const match24 = lower.match(time24Regex);
  if (match24) {
    const hour = parseInt(match24[1], 10);
    const minute = parseInt(match24[2], 10);
    const formattedTime = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
    return {
      targetTime: formattedTime,
      timePreset: "custom",
      matchedPhrase: match24[0],
      cleanedTitle: title,
    };
  }

  return null;
}

/** Format "14:30" into user-friendly "2:30 PM" */
export function formatTimeDisplay(timeStr?: string): string {
  if (!timeStr) return "";
  const parts = timeStr.split(":");
  if (parts.length < 2) return timeStr;
  let hour = parseInt(parts[0], 10);
  const minute = parts[1];
  const ampm = hour >= 12 ? "PM" : "AM";
  hour = hour % 12;
  if (hour === 0) hour = 12;
  return `${hour}:${minute} ${ampm}`;
}

export interface TaskTimeStatus {
  isOverdue: boolean;
  isNearDeadline: boolean; // within 45 min before target
  minutesRemaining: number | null;
  label: string;
  badgeColorClass: string;
}

/**
 * Calculates current status of a task based on targetDate and targetTime.
 */
export function getTaskTimeStatus(task: GoalItem, now = new Date()): TaskTimeStatus {
  // If task is completed, it's not overdue
  if (task.status === "completed") {
    return {
      isOverdue: false,
      isNearDeadline: false,
      minutesRemaining: null,
      label: "Completed",
      badgeColorClass: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    };
  }

  const off = now.getTimezoneOffset() * 60000;
  const todayStr = new Date(now.getTime() - off).toISOString().split("T")[0];

  // If targetDate is before today, it is strictly overdue
  if (task.targetDate && task.targetDate < todayStr) {
    return {
      isOverdue: true,
      isNearDeadline: false,
      minutesRemaining: -9999,
      label: "Past Date (Overdue)",
      badgeColorClass: "bg-rose-500/10 text-rose-400 border-rose-500/30",
    };
  }

  // If targetDate is today and has a targetTime (e.g. "12:00" noon, "16:00" 4pm)
  if (task.targetDate === todayStr && task.targetTime) {
    const [tHour, tMin] = task.targetTime.split(":").map(Number);
    const targetTotalMinutes = tHour * 60 + (tMin || 0);
    const currentTotalMinutes = now.getHours() * 60 + now.getMinutes();
    const diff = targetTotalMinutes - currentTotalMinutes;

    if (diff < 0) {
      // Past time today!
      const hoursLate = Math.abs(Math.floor(diff / 60));
      const minsLate = Math.abs(diff % 60);
      const lateDesc = hoursLate > 0 ? `${hoursLate}h ${minsLate}m ago` : `${minsLate}m ago`;
      return {
        isOverdue: true,
        isNearDeadline: false,
        minutesRemaining: diff,
        label: `Missed (${formatTimeDisplay(task.targetTime)} - ${lateDesc})`,
        badgeColorClass: "bg-rose-500/10 text-rose-400 border-rose-500/30 font-semibold",
      };
    } else if (diff <= 45) {
      // Within 45 minutes of deadline -> "Near Noon" or "Near Deadline"
      return {
        isOverdue: false,
        isNearDeadline: true,
        minutesRemaining: diff,
        label: diff <= 5 ? `Due Now (${formatTimeDisplay(task.targetTime)})` : `Approaching Deadline (in ${diff}m)`,
        badgeColorClass: "bg-amber-500/15 text-amber-300 border-amber-500/40 animate-pulse font-semibold",
      };
    } else {
      return {
        isOverdue: false,
        isNearDeadline: false,
        minutesRemaining: diff,
        label: `Due at ${formatTimeDisplay(task.targetTime)}`,
        badgeColorClass: "bg-slate-500/10 text-slate-300 border-slate-500/20",
      };
    }
  }

  return {
    isOverdue: false,
    isNearDeadline: false,
    minutesRemaining: null,
    label: task.targetTime ? `Target: ${formatTimeDisplay(task.targetTime)}` : "Pending",
    badgeColorClass: "bg-slate-500/10 text-slate-400 border-white/5",
  };
}

/**
 * Iterates through all goals.
 * Any daily task whose target date/time has passed and is not yet completed
 * gets automatically updated to status="unachieved" with autoMarkedUnachieved=true and needsReason=true.
 */
export function autoEvaluateTasksDeadline(goals: GoalItem[], now = new Date()): {
  updatedGoals: GoalItem[];
  countAutoUnachieved: number;
  newlyUnachievedGoals: GoalItem[];
} {
  let changed = false;
  let countAutoUnachieved = 0;
  const newlyUnachievedGoals: GoalItem[] = [];

  const updatedGoals = goals.map((g) => {
    // Only daily tasks that are not yet finished
    if (g.tier !== "daily" || g.status === "completed" || g.status === "unachieved") {
      return g;
    }

    const timeStatus = getTaskTimeStatus(g, now);
    if (timeStatus.isOverdue) {
      changed = true;
      countAutoUnachieved++;
      const updated: GoalItem = {
        ...g,
        status: "unachieved",
        autoMarkedUnachieved: true,
        needsReason: !g.missedReasonCategory, // only prompt if reason hasn't been added yet
      };
      newlyUnachievedGoals.push(updated);
      return updated;
    }

    return g;
  });

  return {
    updatedGoals: changed ? updatedGoals : goals,
    countAutoUnachieved,
    newlyUnachievedGoals,
  };
}
