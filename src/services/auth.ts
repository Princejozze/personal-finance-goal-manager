import { initializeApp, getApps, getApp } from "firebase/app";
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  signOut,
  setPersistence,
  browserLocalPersistence,
  User,
} from "firebase/auth";
import firebaseConfig from "../../firebase-applet-config.json";

/**
 * Auth model
 * ----------
 * - Firebase Auth owns the *identity* (name, email, avatar) and persists the
 *   signed-in user across reloads and devices (browserLocalPersistence).
 * - Google Identity Services (GIS) owns the short-lived *OAuth access token*
 *   used for the Drive + Gmail REST APIs. The first token comes from the
 *   Firebase sign-in popup; afterwards GIS refreshes it **silently** (no popup)
 *   because the user already granted the scopes to the same OAuth client.
 *
 * This is what makes the app usable "live" across devices: opening it on a phone
 * hours later re-acquires a Drive/Gmail token without a fresh consent screen.
 */

const GOOGLE_SCOPES = [
  "https://www.googleapis.com/auth/drive.file",
  "https://www.googleapis.com/auth/gmail.send",
];

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);
// Keep the user signed in across reloads / tabs / devices.
setPersistence(auth, browserLocalPersistence).catch((e) =>
  console.warn("Could not set auth persistence:", e)
);

const provider = new GoogleAuthProvider();
GOOGLE_SCOPES.forEach((s) => provider.addScope(s));
provider.setCustomParameters({ prompt: "consent" });

// ---------------------------------------------------------------------------
// Token state
// ---------------------------------------------------------------------------
interface TokenState {
  accessToken: string;
  /** epoch ms after which the token must be considered expired */
  expiresAt: number;
}
let tokenState: TokenState | null = null;
let isSigningIn = false;

const setToken = (accessToken: string, expiresInSec: number) => {
  tokenState = {
    accessToken,
    // refresh a minute early to avoid edge-of-expiry 401s
    expiresAt: Date.now() + Math.max(0, expiresInSec - 60) * 1000,
  };
};

const tokenIsFresh = () => !!tokenState && Date.now() < tokenState.expiresAt;

// ---------------------------------------------------------------------------
// Google Identity Services token client (silent refresh)
// ---------------------------------------------------------------------------
type GisTokenClient = {
  requestAccessToken: (opts?: { prompt?: string }) => void;
};

declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient: (config: {
            client_id: string;
            scope: string;
            prompt?: string;
            callback: (resp: {
              access_token?: string;
              expires_in?: number;
              error?: string;
              error_description?: string;
            }) => void;
            error_callback?: (err: { type?: string; message?: string }) => void;
          }) => GisTokenClient;
        };
      };
    };
  }
}

let gisClient: GisTokenClient | null = null;
let pendingRefresh: {
  resolve: (t: string) => void;
  reject: (e: Error) => void;
} | null = null;

const gisReady = (): Promise<void> =>
  new Promise((resolve, reject) => {
    if (window.google?.accounts?.oauth2) return resolve();
    let tries = 0;
    const iv = setInterval(() => {
      if (window.google?.accounts?.oauth2) {
        clearInterval(iv);
        resolve();
      } else if (++tries > 100) {
        clearInterval(iv);
        reject(new Error("Google Identity Services script failed to load."));
      }
    }, 100);
  });

const getGisClient = async (): Promise<GisTokenClient> => {
  if (gisClient) return gisClient;
  await gisReady();
  const clientId = (firebaseConfig as { oAuthClientId?: string }).oAuthClientId;
  if (!clientId) {
    throw new Error(
      "Missing oAuthClientId in firebase-applet-config.json — cannot refresh Google access tokens."
    );
  }
  gisClient = window.google!.accounts.oauth2.initTokenClient({
    client_id: clientId,
    scope: GOOGLE_SCOPES.join(" "),
    callback: (resp) => {
      if (!pendingRefresh) return;
      const p = pendingRefresh;
      pendingRefresh = null;
      if (resp.error || !resp.access_token) {
        p.reject(
          new Error(
            resp.error_description || resp.error || "Token request was not completed."
          )
        );
        return;
      }
      setToken(resp.access_token, resp.expires_in ?? 3600);
      p.resolve(resp.access_token);
    },
    error_callback: (err) => {
      if (!pendingRefresh) return;
      const p = pendingRefresh;
      pendingRefresh = null;
      p.reject(new Error(err.message || err.type || "Silent token refresh failed."));
    },
  });
  return gisClient;
};

/** Request a new access token. `interactive` shows a popup only if needed. */
const requestGoogleToken = (interactive: boolean): Promise<string> =>
  new Promise((resolve, reject) => {
    getGisClient()
      .then((client) => {
        pendingRefresh = { resolve, reject };
        try {
          client.requestAccessToken({ prompt: interactive ? "consent" : "" });
        } catch (e: any) {
          pendingRefresh = null;
          reject(e instanceof Error ? e : new Error(String(e)));
        }
      })
      .catch(reject);
  });

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------
export const subscribeToAuthChanges = (callback: (user: User | null) => void) =>
  onAuthStateChanged(auth, callback);

export const signInWithGoogle = async (): Promise<{
  user: User;
  accessToken: string | null;
}> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (credential?.accessToken) {
      // Firebase OAuth access tokens are valid ~1h; assume 3600s.
      setToken(credential.accessToken, 3600);
    } else {
      // Fall back to GIS if the popup didn't surface a token.
      try {
        await requestGoogleToken(true);
      } catch (e) {
        console.warn("Could not obtain Google API token after sign-in:", e);
      }
    }
    return { user: result.user, accessToken: tokenState?.accessToken ?? null };
  } finally {
    isSigningIn = false;
  }
};

export const signOutFromGoogle = async (): Promise<void> => {
  await signOut(auth);
  tokenState = null;
};

/** Synchronous best-effort token — may be stale/expired. Prefer getValidGoogleAccessToken(). */
export const getCachedGoogleAccessToken = (): string | null =>
  tokenState?.accessToken ?? null;

/**
 * Returns a token that is valid right now, refreshing silently if needed.
 * Returns null if the user is not signed in or a silent refresh is impossible
 * (e.g. third-party cookies blocked) — callers should then prompt a re-sign-in.
 */
export const getValidGoogleAccessToken = async (): Promise<string | null> => {
  if (tokenIsFresh()) return tokenState!.accessToken;
  if (!auth.currentUser || isSigningIn) return null;
  try {
    return await requestGoogleToken(false);
  } catch (e) {
    console.warn("Silent Google token refresh failed:", e);
    return null;
  }
};

/** Force an interactive token request (used to recover from a failed silent refresh). */
export const reauthorizeGoogleAccess = async (): Promise<string | null> => {
  try {
    return await requestGoogleToken(true);
  } catch (e) {
    console.warn("Interactive Google authorization failed:", e);
    return null;
  }
};

// Backwards-compatible aliases used elsewhere in the codebase.
export const googleSignIn = signInWithGoogle;
export const logout = signOutFromGoogle;
export const getAccessToken = getValidGoogleAccessToken;
