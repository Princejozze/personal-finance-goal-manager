import { AppData } from "../types";
import { getAccessToken } from "./auth";

const DRIVE_FILE_NAME = "personal_finance_goals_data.json";
const LOCAL_STORAGE_KEY = "pfg_manager_local_cache";

export interface SyncStatus {
  state: "idle" | "syncing" | "synced" | "error" | "offline";
  lastSyncedAt: string | null;
  errorMessage?: string;
  fileId?: string;
}

export const getInitialDefaultData = (): AppData => {
  const now = new Date();
  const todayStr = now.toISOString().split("T")[0];

  return {
    version: 1,
    lastModified: now.toISOString(),
    expenses: [
      {
        id: "exp-1",
        date: todayStr,
        amount: 24.5,
        purpose: "Weekly grocery staples & fresh fruit",
        category: "Food & Dining",
        necessityRating: "Essential",
        notes: "Nutritious essentials for home cooking",
        createdAt: now.toISOString(),
      },
      {
        id: "exp-2",
        date: todayStr,
        amount: 8.0,
        purpose: "Specialty cafe latte & pastry",
        category: "Food & Dining",
        necessityRating: "Discretionary",
        notes: "Mid-afternoon work treat",
        createdAt: now.toISOString(),
      },
      {
        id: "exp-3",
        date: todayStr,
        amount: 15.0,
        purpose: "Ride-share taxi during rush hour",
        category: "Transportation",
        necessityRating: "Useful",
        notes: "Saved 40 minutes on meeting transit",
        createdAt: now.toISOString(),
      },
    ],
    earnings: [
      {
        id: "earn-1",
        date: todayStr,
        amount: 850.0,
        source: "Digital consulting client",
        jobDescription: "Front-end application development & design review",
        category: "Freelance / Contract",
        notes: "Bi-weekly project milestone payout",
        createdAt: now.toISOString(),
      },
      {
        id: "earn-2",
        date: todayStr,
        amount: 120.0,
        source: "Tech blog article",
        jobDescription: "Technical writing and tutorial publication",
        category: "Freelance / Contract",
        notes: "Guest article stipend",
        createdAt: now.toISOString(),
      },
    ],
    titheRecords: [
      {
        id: "tithe-1",
        weekIdentifier: `Week of ${todayStr}`,
        weekStartDate: todayStr,
        weekEndDate: todayStr,
        totalEarnings: 970.0,
        tithePercentage: 10,
        titheDue: 97.0,
        tithePaid: 97.0,
        isPaid: true,
        paidAt: now.toISOString(),
        recipient: "Local Church Community Fund",
        notes: "Weekly 10% faithful tithe fulfilled",
      },
    ],
    investments: [
      {
        id: "inv-1",
        date: todayStr,
        amount: 200.0,
        assetType: "Index Fund / ETF",
        platformOrVehicle: "Broad Market S&P 500 Index",
        notes: "Regular dollar-cost averaging automated contribution",
        createdAt: now.toISOString(),
      },
    ],
    goals: [
      {
        id: "goal-y1",
        tier: "yearly",
        title: "Build $20,000 Liquid Investment & Emergency Fortress",
        description: "Achieve resilient financial independence with diversified liquid reserves and active income streams.",
        targetDate: "2026-12-31",
        status: "in_progress",
        createdAt: now.toISOString(),
      },
      {
        id: "goal-m1",
        tier: "monthly",
        parentId: "goal-y1",
        title: "Deposit $1,500 into Index Funds & Savings this Month",
        description: "Maintain a consistent 35%+ net savings rate across all freelance and salary payouts.",
        targetDate: "2026-09-30",
        status: "in_progress",
        createdAt: now.toISOString(),
      },
      {
        id: "goal-w1",
        tier: "weekly",
        parentId: "goal-m1",
        title: "Secure 2 high-ticket client milestones and log all daily spends",
        description: "Keep discretionary expenses under $50 and deliver client deliverables on time.",
        targetDate: todayStr,
        status: "in_progress",
        createdAt: now.toISOString(),
      },
      {
        id: "goal-d1",
        tier: "daily",
        parentId: "goal-w1",
        title: "Review daily budget, log today's receipts & complete client code sprint",
        description: "Ensure exact accounting for every dollar spent and earned.",
        targetDate: todayStr,
        status: "pending",
        createdAt: now.toISOString(),
      },
    ],
    weeklyReviews: [],
    settings: {
      currency: "$",
      defaultTithePercent: 10,
      reminderEmail: "giftj964@gmail.com",
      autoSyncDrive: true,
    },
  };
};

// Local storage helpers
export const loadLocalData = (): AppData => {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (e) {
    console.warn("Could not read local cache:", e);
  }
  const defaultData = getInitialDefaultData();
  saveLocalData(defaultData);
  return defaultData;
};

export const saveLocalData = (data: AppData): void => {
  try {
    data.lastModified = new Date().toISOString();
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(data));
  } catch (e) {
    console.warn("Could not write local cache:", e);
  }
};

// Google Drive API Helpers
export const findDriveFileId = async (accessToken: string): Promise<string | null> => {
  try {
    const q = encodeURIComponent(`name = '${DRIVE_FILE_NAME}' and trashed = false`);
    const res = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name,modifiedTime)`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    if (!res.ok) {
      throw new Error(`Google Drive search error (${res.status}): ${await res.text()}`);
    }

    const data = await res.json();
    if (data.files && data.files.length > 0) {
      return data.files[0].id;
    }
    return null;
  } catch (err) {
    console.error("findDriveFileId failed:", err);
    throw err;
  }
};

export const loadDataFromDrive = async (
  accessToken: string,
  fileId: string
): Promise<AppData> => {
  const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!res.ok) {
    throw new Error(`Failed to download file from Google Drive (${res.status})`);
  }

  const data: AppData = await res.json();
  saveLocalData(data);
  return data;
};

export const saveDataToDrive = async (
  accessToken: string,
  data: AppData,
  existingFileId?: string | null
): Promise<string> => {
  data.lastModified = new Date().toISOString();
  saveLocalData(data);
  const jsonContent = JSON.stringify(data, null, 2);

  // If we already know the file ID, patch it
  if (existingFileId) {
    const patchRes = await fetch(
      `https://www.googleapis.com/upload/drive/v3/files/${existingFileId}?uploadType=media`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: jsonContent,
      }
    );

    if (patchRes.ok) {
      return existingFileId;
    }
    // If not found or error, fall through to re-search or create
  }

  // Check if file already exists in Drive
  const existingId = await findDriveFileId(accessToken);
  if (existingId) {
    const patchRes = await fetch(
      `https://www.googleapis.com/upload/drive/v3/files/${existingId}?uploadType=media`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: jsonContent,
      }
    );

    if (!patchRes.ok) {
      throw new Error(`Failed to update file on Google Drive (${patchRes.status})`);
    }
    return existingId;
  }

  // Create new multipart file
  const boundary = "-------314159265358979323846";
  const delimiter = `\r\n--${boundary}\r\n`;
  const closeDelimiter = `\r\n--${boundary}--`;

  const metadata = {
    name: DRIVE_FILE_NAME,
    mimeType: "application/json",
    description: "Personal Finance & Goals Manager Cloud Database",
  };

  const multipartRequestBody =
    delimiter +
    "Content-Type: application/json; charset=UTF-8\r\n\r\n" +
    JSON.stringify(metadata) +
    delimiter +
    "Content-Type: application/json\r\n\r\n" +
    jsonContent +
    closeDelimiter;

  const createRes = await fetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": `multipart/related; boundary=${boundary}`,
      },
      body: multipartRequestBody,
    }
  );

  if (!createRes.ok) {
    throw new Error(`Failed to create file on Google Drive (${createRes.status}): ${await createRes.text()}`);
  }

  const createdFile = await createRes.json();
  return createdFile.id;
};

// Aliases and wrappers for unified usage
export const loadLocalAppData = loadLocalData;
export const saveLocalAppData = saveLocalData;

export const loadFromGoogleDrive = async (accessToken: string): Promise<AppData | null> => {
  try {
    const fileId = await findDriveFileId(accessToken);
    if (!fileId) return null;
    return await loadDataFromDrive(accessToken, fileId);
  } catch (err) {
    console.error("loadFromGoogleDrive error:", err);
    return null;
  }
};

export const saveToGoogleDrive = async (
  accessToken: string,
  data: AppData
): Promise<{ success: boolean; fileId?: string; error?: string }> => {
  try {
    const fileId = await saveDataToDrive(accessToken, data);
    return { success: true, fileId };
  } catch (err: any) {
    console.error("saveToGoogleDrive error:", err);
    return { success: false, error: err.message || "Failed to save to Drive" };
  }
};
