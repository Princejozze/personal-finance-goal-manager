# Implementation Plan: Personal Finance & Goal Manager with Google Drive & Gemini AI

## 1. Project Objectives
Build a self-managing personal finance and hierarchical goal management web app that:
1. **Stores data on Google Drive**: Real-time cloud synchronization via Google Drive API (`drive.file` scope) so that data can be accessed live across any device in any web browser.
2. **Daily Money Tracking (Spend & Earn)**:
   - Daily expenses: Amount, date, category/purpose, necessity assessment.
   - Daily & weekly earnings: Income amount, date, job/client/source description.
3. **Tithe & Investment Automation**:
   - Automatic weekly tithe calculation (10% of gross or net earnings), with tracking for paid vs. pending tithe.
   - Proposed investment amounts and strategies powered by Gemini AI based on earning rates, spending rates, and cash flow.
4. **Weekend AI Financial Reviews**:
   - Comprehensive weekly reviews by Gemini AI (`gemini-3.8-flash` via server-side `@google/genai`).
   - Evaluating usefulness of spendings (what was high-value, what was waste/avoidable).
   - Advice on improving savings rates and optimizing future budgets.
5. **Hierarchical Goals & Tasks**:
   - Multi-tier goals: Yearly Goals $\rightarrow$ Monthly Milestones $\rightarrow$ Weekly Targets $\rightarrow$ Daily Tasks.
   - Inter-tier linkage: Connecting daily tasks to weekly targets, and weekly targets to monthly/yearly achievements.
   - AI Missed-Goal Root Cause Analysis: Inquiring why tasks were not completed, analyzing obstacles, and dynamically adapting upcoming goals based on historical performance.
6. **Automated Reminders via Gmail**:
   - Integration with Gmail API (`gmail.send` scope) to dispatch reminder emails for uncompleted daily tasks and weekly review briefings.

---

## 2. Architectural Blueprint

### Full-Stack Architecture
- **Backend (`server.ts` with Express)**:
  - Hosts secure Gemini AI endpoints (`/api/gemini/financial-review`, `/api/gemini/investment-proposal`, `/api/gemini/goal-insights`).
  - Uses `@google/genai` with `gemini-3.8-flash` model and server-side secret management.
  - Serves static assets and provides API proxying.
- **Frontend (React 19 + TypeScript + Tailwind CSS + Lucide Icons + Motion)**:
  - **Auth Layer**: Firebase Auth client-side Google sign-in to securely obtain access tokens for Google Drive and Gmail APIs with in-memory token management.
  - **Drive Storage Engine (`src/services/driveStorage.ts`)**:
    - Queries user's Google Drive for `personal_finance_goals_data.json` in the app data scope.
    - Creates the file on first run if not found, with automatic conflict resolution and local cache fallback.
    - Provides smooth auto-sync on change and manual refresh capabilities.
  - **Gmail Notification Service (`src/services/gmailService.ts`)**:
    - Drafts and sends formatted email reminders for unachieved daily tasks and weekly financial briefings.
    - Includes explicit confirmation dialogs before sending emails.
  - **State Management & UI Structure**:
    - **Header & Navigation**: Cloud Drive sync status, Google Auth status, quick actions.
    - **Finances Tab**:
      - Daily Expense Entry with purpose and category.
      - Daily Earning Entry with job/source description.
      - Tithe Tracker (Weekly earnings, 10% calculated tithe, paid toggle, tithe history).
      - Investment Advisor (AI-recommended allocation, emergency fund, growth assets).
    - **Weekend AI Review Tab**:
      - One-click weekly AI audit of spending utility, wasteful patterns, and income optimization.
    - **Hierarchical Goals Tab**:
      - Yearly, Monthly, Weekly, and Daily breakdown.
      - Task completion tracker with completion rates.
      - AI Goal Assistant: Root-cause diagnosis for missed tasks and recommended next steps.
    - **Email Reminders & Settings**:
      - Notification preferences, unachieved task email trigger, recipient email customization.

---

## 3. Step-by-Step Implementation Strategy

1. **Step 1: OAuth Configuration**:
   - Request Google Drive (`https://www.googleapis.com/auth/drive.file`) and Gmail (`https://www.googleapis.com/auth/gmail.send`) scopes.
   - Prompt user for confirmation.
2. **Step 2: Backend Setup (`server.ts`)**:
   - Configure Express with Vite middleware and bundle configuration.
   - Implement Gemini endpoints for weekly spending review, investment analysis, and goal diagnostic reasoning.
3. **Step 3: Drive & Gmail Integration Services**:
   - `src/services/auth.ts`: Firebase Auth with Google provider & token listener.
   - `src/services/driveStorage.ts`: File search, create, read, and write for persistent JSON database on Google Drive.
   - `src/services/gmailService.ts`: RFC 2822 email encoding and Gmail API sending with user confirmation.
4. **Step 4: Data Models & Types**:
   - Define TypeScript interfaces for Expense, Earning, TitheRecord, InvestmentProposal, Goal, Task, and WeeklyReview.
5. **Step 5: UI Components**:
   - Navigation header with sync indicator and user profile.
   - Daily Money tracker (Expense & Earning forms + tables + summaries).
   - Tithe & Investment dashboard with live calculators.
   - Weekend Review dashboard with structured Gemini feedback.
   - Hierarchical Goals manager with cascading linkages and AI root cause analyzer.
   - Email dispatch modal with confirmation.
6. **Step 6: Build, Verification & Testing**:
   - Run compilation and ensure complete zero-error build.
