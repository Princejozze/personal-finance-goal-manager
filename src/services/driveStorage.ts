import { AppData, AppSettings } from "../types";
import { getValidGoogleAccessToken } from "./auth";

const DRIVE_FILE_NAME = "personal_finance_goals_data.json";
const LOCAL_STORAGE_KEY = "pfg_manager_local_cache";

export interface SyncStatus {
  state: "idle" | "syncing" | "synced" | "error" | "offline";
  lastSyncedAt?: string | null;
  errorMessage?: string;
  fileId?: string;
}

export const DEFAULT_SETTINGS: AppSettings = {
  currency: "$",
  currencySymbol: "$",
  defaultTithePercent: 10,
  defaultTithePercentage: 10,
  reminderEmail: "",
  notificationEmail: "",
  autoSyncDrive: true,
  autoReminderEnabled: false,
  reminderHour: 20,
  autoWeekendReviewEnabled: false,
};

export const getInitialDefaultData = (): AppData => {
  const now = new Date().toISOString();
  return {
    version: 1,
    lastModified: now,
    lastUpdated: now,
    expenses: [],
    earnings: [],
    titheRecords: [],
    investments: [],
    goals: [],
    weeklyReviews: [],
    settings: { ...DEFAULT_SETTINGS },
  };
};

/** Fill in any missing fields on data loaded from an older file version. */
export const normalizeAppData = (raw: Partial<AppData> | null | undefined): AppData => {
  const base = getInitialDefaultData();
  if (!raw || typeof raw !== "object") return base;
  return {
    ...base,
    ...raw,
    expenses: Array.isArray(raw.expenses) ? raw.expenses : [],
    earnings: Array.isArray(raw.earnings) ? raw.earnings : [],
    titheRecords: Array.isArray(raw.titheRecords) ? raw.titheRecords : [],
    investments: Array.isArray(raw.investments) ? raw.investments : [],
    goals: Array.isArray(raw.goals) ? raw.goals : [],
    weeklyReviews: Array.isArray(raw.weeklyReviews) ? raw.weeklyReviews : [],
    settings: { ...DEFAULT_SETTINGS, ...(raw.settings || {}) },
  };
};

// ---------------------------------------------------------------------------
// Local storage cache
// ---------------------------------------------------------------------------
export const loadLocalData = (): AppData => {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (raw) return normalizeAppData(JSON.parse(raw));
  } catch (e) {
    console.warn("Could not read local cache:", e);
  }
  return getInitialDefaultData();
};

export const saveLocalData = (data: AppData): void => {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(data));
  } catch (e) {
    console.warn("Could not write local cache:", e);
  }
};

export const loadLocalAppData = loadLocalData;
export const saveLocalAppData = saveLocalData;

// ---------------------------------------------------------------------------
// Google Drive REST helpers (with one silent-refresh retry on 401)
// ---------------------------------------------------------------------------
const driveFetch = async (
  url: string,
  init: RequestInit,
  token: string
): Promise<Response> => {
  const withAuth = (t: string): RequestInit => ({
    ...init,
    headers: { ...(init.headers || {}), Authorization: `Bearer ${t}` },
  });

  let res = await fetch(url, withAuth(token));
  if (res.status === 401) {
    const fresh = await getValidGoogleAccessToken();
    if (fresh && fresh !== token) {
      res = await fetch(url, withAuth(fresh));
    }
  }
  return res;
};

export const findDriveFileId = async (accessToken: string): Promise<string | null> => {
  const q = encodeURIComponent(`name = '${DRIVE_FILE_NAME}' and trashed = false`);
  const res = await driveFetch(
    `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name,modifiedTime)&spaces=drive`,
    { method: "GET" },
    accessToken
  );
  if (!res.ok) {
    throw new Error(`Google Drive search error (${res.status}): ${await res.text()}`);
  }
  const data = await res.json();
  return data.files?.[0]?.id ?? null;
};

export const loadDataFromDrive = async (
  accessToken: string,
  fileId: string
): Promise<AppData> => {
  const res = await driveFetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
    { method: "GET" },
    accessToken
  );
  if (!res.ok) {
    throw new Error(`Failed to download file from Google Drive (${res.status})`);
  }
  const data = normalizeAppData(await res.json());
  saveLocalData(data);
  return data;
};

export const saveDataToDrive = async (
  accessToken: string,
  data: AppData,
  existingFileId?: string | null
): Promise<string> => {
  const payload: AppData = { ...data, lastModified: new Date().toISOString() };
  saveLocalData(payload);
  const jsonContent = JSON.stringify(payload, null, 2);

  const patch = async (id: string) =>
    driveFetch(
      `https://www.googleapis.com/upload/drive/v3/files/${id}?uploadType=media`,
      { method: "PATCH", headers: { "Content-Type": "application/json" }, body: jsonContent },
      accessToken
    );

  const targetId = existingFileId || (await findDriveFileId(accessToken));
  if (targetId) {
    const res = await patch(targetId);
    if (res.ok) return targetId;
    if (res.status !== 404) {
      throw new Error(`Failed to update file on Google Drive (${res.status})`);
    }
    // 404 → file was removed; fall through to create a new one.
  }

  const boundary = "-------314159265358979323846";
  const delimiter = `\r\n--${boundary}\r\n`;
  const closeDelimiter = `\r\n--${boundary}--`;
  const metadata = {
    name: DRIVE_FILE_NAME,
    mimeType: "application/json",
    description: "Personal Finance & Goals Manager Cloud Database",
  };
  const body =
    delimiter +
    "Content-Type: application/json; charset=UTF-8\r\n\r\n" +
    JSON.stringify(metadata) +
    delimiter +
    "Content-Type: application/json\r\n\r\n" +
    jsonContent +
    closeDelimiter;

  const res = await driveFetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart",
    {
      method: "POST",
      headers: { "Content-Type": `multipart/related; boundary=${boundary}` },
      body,
    },
    accessToken
  );
  if (!res.ok) {
    throw new Error(`Failed to create file on Google Drive (${res.status}): ${await res.text()}`);
  }
  return (await res.json()).id;
};

// ---------------------------------------------------------------------------
// High-level wrappers used by the app
// ---------------------------------------------------------------------------
export const loadFromGoogleDrive = async (
  accessToken: string
): Promise<AppData | null> => {
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
