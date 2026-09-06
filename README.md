# Personal Finance & Goal Manager

A self‑managing personal finance + hierarchical goal web app.

- **Data lives on your Google Drive** (`personal_finance_goals_data.json`, `drive.file` scope) so it syncs live across every device through the browser.
- **Daily money tracking** – log each expense (amount, date, purpose, category, necessity) and each earning (amount, source, the job you did).
- **Weekend AI review** – Gemini audits the week: which spending was useful vs. wasteful, how you earned, tithe faithfulness, and a proposed investment amount based on your earn/spend rate.
- **Tithe tracker** – automatic 10% weekly calculation, paid / pending status, history.
- **Cascading goals** – Yearly → Monthly → Weekly → Daily, with AI root‑cause analysis for missed goals and suggestions that use daily wins to unlock weekly/monthly targets.
- **Automated Gmail reminders** – opt‑in: the app emails you a Gemini‑written reminder when daily tasks are still unfinished, and can auto‑generate the weekend review.

---

## 1. Prerequisites & one‑time setup

### a. Rename the project folder (Windows)
The folder name must **not contain `&`** or `npm run …` scripts fail on Windows
(`cmd` treats `&` as a command separator). Rename e.g.:

```
personal-finance-&-goal-manager   →   personal-finance-goal-manager
```

### b. Install
```bash
npm install
```

### c. Gemini API key
Create `.env` (copied from `.env.example`) in the project root:
```
GEMINI_API_KEY="your-key-from-https://aistudio.google.com/apikey"
```
This key is only ever used server‑side (`server.ts`); it is never sent to the browser.

### d. Firebase / Google OAuth
`firebase-applet-config.json` already points at a Firebase project. For sign‑in,
Drive and Gmail to work on your domain you must, in the Google/Firebase consoles:

1. **Firebase Console → Authentication → Settings → Authorized domains** – add
   `localhost` and your deployed domain (e.g. `your-app-xxxx.run.app`).
2. **Google Cloud Console → APIs & Services → Credentials → the OAuth 2.0 Client
   `oAuthClientId`** – add the same origins under *Authorized JavaScript origins*
   (`http://localhost:3000`, `https://your-app-xxxx.run.app`). This is required for
   the silent token refresh (Google Identity Services).
3. **OAuth consent screen** – ensure scopes `.../auth/drive.file` and
   `.../auth/gmail.send` are listed, and add your Google account as a *test user*
   (or publish the app).
4. **Enable APIs**: Google Drive API and Gmail API for the project.

> Using your **own** Firebase project instead? Replace `firebase-applet-config.json`
> with your web app config plus an `oAuthClientId` field.

---

## 2. Run locally
```bash
npm run dev
```
Open http://localhost:3000, click **Sign in with Google**, grant Drive + Gmail.
Your data is cached in `localStorage` and mirrored to Drive on every change.

---

## 3. Deploy (Google Cloud Run)

```bash
gcloud run deploy ethos-finance \
  --source . \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars GEMINI_API_KEY=your-key
```

`Dockerfile` builds the client + server bundle and runs `node dist/server.cjs`
(the server reads `PORT` that Cloud Run injects). After the first deploy, add the
`*.run.app` URL to the authorized domains / JS origins from step 1d.

Any Node host works too:
```bash
npm run build      # → dist/  (client assets + server.cjs)
npm start          # NODE_ENV=production node dist/server.cjs
```

Add the app to your phone's home screen (Share → *Add to Home Screen*) for an
app‑like launcher — it ships a web manifest and icon.

---

## 4. How the "self‑managing" automation works

The app has **no always‑on backend cron**. Instead, whenever you open it on any
device while signed in, it checks (and re‑checks every 15 min while open):

| Automation | Fires when | Guard |
|---|---|---|
| Daily reminder email | after your configured hour, daily tasks still unfinished | once per calendar day (`settings.lastAutoReminderDate`) |
| Weekend AI review | Saturday/Sunday, some activity that week | once per ISO week (`settings.lastAutoWeekendReviewWeek`) |

Enable both under **Settings → Self‑Managing Automations**. Because it needs the
app open at least once in the window, keep a tab/PWA open in the evening, or add a
real scheduled task later (Cloud Scheduler hitting a protected endpoint with a
stored refresh token).

---

## 5. Project layout
```
server.ts                     Express + Gemini endpoints (server-side key)
src/
  App.tsx                     state, Drive sync, automation loop
  services/
    auth.ts                   Firebase identity + GIS silent token refresh
    driveStorage.ts           Drive read/write (+401 refresh retry), local cache
    geminiClient.ts           fetch wrappers for /api/gemini/*
    gmailService.ts           RFC-2822 message build + Gmail send
    reminderScheduler.ts      runDueAutomations(): daily email + weekend review
  components/                  Header, DailyMoneyTracker, TitheAndInvestment,
                               WeekendReview, GoalHierarchy, EmailReminders,
                               SettingsView, modals
```
