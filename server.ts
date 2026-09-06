import express, { Request, Response } from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
// Cloud Run / most hosts inject PORT (usually 8080); fall back to 3000 locally.
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json({ limit: "5mb" }));

// Lazy initialization of Gemini client
let genAIClient: GoogleGenAI | null = null;
function getGenAI(): GoogleGenAI {
  if (!genAIClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY environment variable is missing.");
    }
    genAIClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return genAIClient;
}

// Health check endpoint
app.get("/api/health", (req: Request, res: Response) => {
  res.json({
    status: "ok",
    hasGeminiKey: Boolean(process.env.GEMINI_API_KEY),
    timestamp: new Date().toISOString(),
  });
});

// Gemini Endpoint: Weekend Financial Spending & Earnings Review
app.post("/api/gemini/weekly-review", async (req: Request, res: Response) => {
  try {
    const { expenses, earnings, weekInfo, titheStatus } = req.body;
    const ai = getGenAI();

    const prompt = `You are an elite personal financial advisor and life strategist.
Analyze the following financial data for the week (${weekInfo || "Recent Week"}):

EXPENSES LOGGED:
${JSON.stringify(expenses, null, 2)}

EARNINGS LOGGED:
${JSON.stringify(earnings, null, 2)}

TITHE & GIVING STATUS:
${JSON.stringify(titheStatus, null, 2)}

Please provide a structured, encouraging, and highly analytical review with the following sections:
1. SPENDING UTILITY AUDIT:
   - What expenses were genuinely useful, high-ROI, or necessary?
   - What expenses were NOT useful, impulsive, or wasted money? Give specific examples from the data.
2. EARNINGS & PRODUCTIVITY INSIGHT:
   - Analysis of how money was earned, consistency of jobs/income sources, and opportunities to scale earning capacity.
3. TITHE & FAITHFULNESS REVIEW:
   - Acknowledge weekly earnings and verify whether the biblical 10% tithe was calculated and paid, emphasizing stewardship and discipline.
4. PROPOSED INVESTMENT & SAVINGS RECOMMENDATION:
   - Based on net savings rate (earnings minus expenses minus tithe), propose a specific dollar amount to invest this week.
   - Suggest appropriate asset vehicles (emergency cushion, index funds/growth, skill reinvestment).
5. KEY ACTION ITEMS FOR NEXT WEEK:
   - 3 concrete, realistic behavioral adjustments to optimize cash flow.

Format your answer with clear markdown headers and bullet points.`;

    const response = await ai.models.generateContent({
      model: "gemini-3.8-flash",
      contents: prompt,
    });

    res.json({ review: response.text });
  } catch (error: any) {
    console.error("Gemini weekly review error:", error);
    res.status(500).json({ error: error.message || "Failed to generate weekly review" });
  }
});

// Gemini Endpoint: Investment Proposal
app.post("/api/gemini/investment-proposal", async (req: Request, res: Response) => {
  try {
    const { weeklyEarnings, weeklyExpenses, currentSavings, riskAppetite } = req.body;
    const ai = getGenAI();

    const prompt = `You are an expert investment advisor.
Evaluate the user's financial rate:
- Average Weekly Earnings: $${weeklyEarnings}
- Average Weekly Expenses: $${weeklyExpenses}
- Net Weekly Cash Flow: $${weeklyEarnings - weeklyExpenses}
- Existing Emergency/Savings: $${currentSavings || 0}
- Risk Profile: ${riskAppetite || "Balanced/Moderate"}

Propose an intelligent, mathematically grounded investment plan:
1. Proposed weekly or monthly investment amount (explain the math based on their income/expense burn rate).
2. Recommended allocation breakdown in percentages and dollar figures (e.g., Safe Reserve / Index Funds / High Growth).
3. Risk management rules (e.g., keeping 3-6 months buffer first).
4. Long-term projected compounding impact.`;

    const response = await ai.models.generateContent({
      model: "gemini-3.8-flash",
      contents: prompt,
    });

    res.json({ proposal: response.text });
  } catch (error: any) {
    console.error("Gemini investment proposal error:", error);
    res.status(500).json({ error: error.message || "Failed to generate investment proposal" });
  }
});

// Gemini Endpoint: Hierarchical Goal & Unachieved Task Root Cause Analysis
app.post("/api/gemini/goal-insights", async (req: Request, res: Response) => {
  try {
    const { missedGoals, allGoals, recentFeedback } = req.body;
    const ai = getGenAI();

    const prompt = `You are a high-performance productivity coach and goal achievement analyst.
The user maintains a 4-tier goal hierarchy (Yearly Goals -> Monthly Milestones -> Weekly Targets -> Daily Tasks).

UNACHIEVED / MISSED GOALS OR TASKS:
${JSON.stringify(missedGoals, null, 2)}

CURRENT GOAL HIERARCHY:
${JSON.stringify(allGoals, null, 2)}

USER'S REFLECTIONS / REASONS PROVIDED:
${recentFeedback || "No explicit reason logged."}

Your job is to:
1. SEEK ROOT CAUSES: Identify why these daily tasks or milestones were not achieved (e.g., scoping too large, cognitive overload, lack of clear triggers, misalignment with weekly goals).
2. INTER-TIER BRIDGING: Show how completing specific daily micro-actions directly unlocks their weekly targets, and in turn their monthly and yearly milestones.
3. CORRECTIVE SUGGESTIONS: Re-calibrate the unachieved items into smaller, high-momentum tasks for tomorrow and the upcoming week.
4. ACTIONABLE MOTIVATION: A short, grounded encouraging message.`;

    const response = await ai.models.generateContent({
      model: "gemini-3.8-flash",
      contents: prompt,
    });

    res.json({ insights: response.text });
  } catch (error: any) {
    console.error("Gemini goal insights error:", error);
    res.status(500).json({ error: error.message || "Failed to generate goal insights" });
  }
});

// Gemini Endpoint: Draft Reminder Email for Unachieved Tasks
app.post("/api/gemini/draft-reminder-email", async (req: Request, res: Response) => {
  try {
    const { userName, pendingTasks, unachievedGoals } = req.body;
    const ai = getGenAI();

    const prompt = `Draft a personalized, encouraging yet urgent email notification to remind the user about their remaining unachieved daily tasks and weekly goals.
User name: ${userName || "Valued User"}
Date: ${new Date().toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })}

Pending Tasks for Today:
${JSON.stringify(pendingTasks, null, 2)}

Broader Goals Connected:
${JSON.stringify(unachievedGoals, null, 2)}

Return a JSON object with:
- "subject": A concise subject line that grabs attention with an emoji (e.g., "🎯 Daily Focus: 3 tasks pending before bedtime")
- "bodyText": Clean plain text format suitable for email reading
- "bodyHtml": Beautifully styled HTML email snippet with pleasant typography, high contrast, checklist bullet points, and an inspiring call-to-action button or sign-off.`;

    const response = await ai.models.generateContent({
      model: "gemini-3.8-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
      },
    });

    const parsed = JSON.parse(response.text || "{}");
    res.json(parsed);
  } catch (error: any) {
    console.error("Gemini draft email error:", error);
    res.status(500).json({ error: error.message || "Failed to draft reminder email" });
  }
});

// Vite middleware & Static serving
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req: Request, res: Response) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
