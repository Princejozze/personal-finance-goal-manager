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

// Resilient Gemini invoker with exponential backoff & model fallback for 503/429
async function callGeminiWithRetry(
  params: {
    model?: string;
    contents: string;
    config?: Record<string, any>;
  },
  maxRetries = 2
): Promise<any> {
  const ai = getGenAI();
  const modelsToTry = [
    params.model || "gemini-3.8-flash",
    "gemini-2.5-flash",
    "gemini-flash-latest",
  ];

  let lastError: any = null;

  for (const model of modelsToTry) {
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const response = await ai.models.generateContent({
          ...params,
          model,
        });
        return response;
      } catch (err: any) {
        lastError = err;
        const errMsg = String(err?.message || err);
        const isTransient =
          errMsg.includes("503") ||
          errMsg.includes("high demand") ||
          errMsg.includes("UNAVAILABLE") ||
          errMsg.includes("429") ||
          errMsg.includes("RESOURCE_EXHAUSTED") ||
          errMsg.includes("overloaded");

        if (isTransient && attempt < maxRetries) {
          const delayMs = 1200 * Math.pow(1.5, attempt);
          console.warn(
            `Gemini model ${model} transient error on attempt ${attempt + 1}. Retrying in ${delayMs}ms...`
          );
          await new Promise((r) => setTimeout(r, delayMs));
          continue;
        }

        if (isTransient) {
          console.warn(
            `Gemini model ${model} remained unavailable after ${maxRetries + 1} tries. Trying fallback model...`
          );
          break; // Break inner loop to try next model in modelsToTry
        }

        // Non-transient error (e.g. invalid key or bad syntax) -> rethrow
        throw err;
      }
    }
  }

  throw lastError;
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

    const prompt = `You are an elite personal financial advisor and life strategist.
Analyze the financial data for ${weekInfo || "the week"}:

EXPENSES LOGGED:
${JSON.stringify(expenses, null, 2)}

EARNINGS LOGGED:
${JSON.stringify(earnings, null, 2)}

TITHE & GIVING STATUS:
${JSON.stringify(titheStatus, null, 2)}

CRITICAL INSTRUCTION:
You MUST keep your response DIRECT, PUNCHY, AND SHORT (strictly under 130 words).
Do NOT write verbose essays or conversational fluff.
Provide exactly 4 concise bullet points:
• SPENDING AUDIT: 1 necessary expense praise vs. 1 specific cut to make.
• EARNINGS & CASH FLOW: Net savings rate and concrete takeaway.
• TITHE FAITHFULNESS: Exact 10% tithe status (due vs paid).
• NEXT WEEK RULE: 1 high-impact behavioral rule to optimize wealth.`;

    const response = await callGeminiWithRetry({
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

    const prompt = `You are an expert investment advisor.
Financial Profile:
- Weekly Earnings: $${weeklyEarnings} | Weekly Expenses: $${weeklyExpenses} | Net Flow: $${weeklyEarnings - weeklyExpenses}
- Existing Buffer: $${currentSavings || 0} | Risk: ${riskAppetite || "Balanced"}

CRITICAL INSTRUCTION:
You MUST keep this proposal DIRECT, CONCISE, AND SHORT (strictly under 100 words).
Provide 3 direct bullet points:
• EXACT WEEKLY ALLOCATION: Precise dollar amount to invest right now.
• ASSET SPLIT: Percentage and vehicle recommendation (e.g. 70% Index ETF, 30% Buffer).
• RISK GUARDRAIL: 1 crucial rule for emergency cushion.`;

    const response = await callGeminiWithRetry({
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

    const prompt = `You are a high-performance productivity coach.
Unachieved goals or tasks:
${JSON.stringify(missedGoals, null, 2)}

Goal Hierarchy:
${JSON.stringify(allGoals, null, 2)}

User feedback: ${recentFeedback || "None logged"}

CRITICAL INSTRUCTION:
You MUST keep this diagnosis DIRECT, ACTIONABLE, AND SHORT (strictly under 110 words).
Provide 3 concise bullet points:
• ROOT CAUSE: 1 primary operational bottleneck causing missed execution.
• IMMEDIATE MICRO-PIVOT: 2 concrete smaller actions to execute tomorrow.
• MOMENTUM VERDICT: 1 punchy sentence to refocus willpower.`;

    const response = await callGeminiWithRetry({
      model: "gemini-3.8-flash",
      contents: prompt,
    });

    res.json({ insights: response.text });
  } catch (error: any) {
    console.error("Gemini goal insights error:", error);
    res.status(500).json({ error: error.message || "Failed to generate goal insights" });
  }
});

// Gemini Endpoint: Direct Executive Progress Brief (Unified Finances + Tasks)
app.post("/api/gemini/quick-brief", async (req: Request, res: Response) => {
  try {
    const { userName, financialSummary, goalSummary } = req.body;
    const name = userName || "Friend";

    const prompt = `You are an executive personal wealth & productivity advisor.
User: ${name}

FINANCES OVERVIEW:
${JSON.stringify(financialSummary, null, 2)}

GOALS & TASKS OVERVIEW:
${JSON.stringify(goalSummary, null, 2)}

CRITICAL INSTRUCTION:
Provide a DIRECT, ULTRA-SHORT executive brief (strictly under 90 words total).
NO generic opening greetings. NO fluff.
Format strictly as 3 bullet points:
• CASHFLOW & TITHE: Direct status on earnings, net savings, and 10% tithe faithfulness.
• TASK EXECUTION: Direct status on daily completion velocity vs unachieved bottlenecks.
• TOP FOCUS ACTION: The single highest-leverage micro-step to accomplish right now.`;

    const response = await callGeminiWithRetry({
      model: "gemini-3.8-flash",
      contents: prompt,
    });

    res.json({ brief: response.text });
  } catch (error: any) {
    console.error("Gemini quick brief error:", error);
    // Intelligent fallback brief
    const { financialSummary, goalSummary } = req.body;
    const net = (financialSummary?.totalEarnings || 0) - (financialSummary?.totalExpenses || 0);
    const fallbackBrief = `• CASHFLOW & TITHE: Net cashflow is ${net >= 0 ? `+$${net}` : `-$${Math.abs(net)}`}. Ensure 10% tithe is set aside before discretionary spending.
• TASK EXECUTION: ${goalSummary?.pendingDailyCount || 0} daily task(s) remaining today. Complete the highest-priority item first.
• TOP FOCUS ACTION: Spend 20 focused minutes closing out today's pending daily tasks to maintain weekly momentum.`;

    res.json({ brief: fallbackBrief });
  }
});

// Gemini Endpoint: AI Task Analyzer & Commitment Coach ("How to keep it")
app.post("/api/gemini/analyze-task", async (req: Request, res: Response) => {
  const { title, description, tier } = req.body;
  const taskTitle = String(title || "").trim();

  // Natural Language helper fallback for instant offline/speed guarantee
  const naturalFallback = (t: string) => {
    const lower = t.toLowerCase();
    let time: string | null = null;
    let label = "Flexible";

    if (/noon|12\s*pm/i.test(lower)) {
      time = "12:00";
      label = "12:00 PM (Noon)";
    } else if (/\bchurch\b/i.test(lower) && /4\s*pm|4:00|16:00/i.test(lower)) {
      time = "16:00";
      label = "4:00 PM";
    } else if (/(\b1\s*pm\b|13:00|by\s*1\b)/i.test(lower)) {
      time = "13:00";
      label = "1:00 PM";
    } else if (/(\b4\s*pm\b|16:00)/i.test(lower)) {
      time = "16:00";
      label = "4:00 PM";
    } else if (/(\b9\s*am\b|09:00|morning)/i.test(lower)) {
      time = "09:00";
      label = "9:00 AM (Morning)";
    } else if (/(\b7\s*pm\b|19:00|evening)/i.test(lower)) {
      time = "19:00";
      label = "7:00 PM (Evening)";
    } else {
      const match = lower.match(/(?:at|by|before|around)\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);
      if (match) {
        let h = parseInt(match[1], 10);
        const m = match[2] ? parseInt(match[2], 10) : 0;
        const ampm = match[3] ? match[3].toLowerCase() : null;
        if (ampm === "pm" && h < 12) h += 12;
        if (ampm === "am" && h === 12) h = 0;
        time = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
        const displayH = h % 12 === 0 ? 12 : h % 12;
        label = `${displayH}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
      }
    }

    let strategy = "Set a 15-minute preparation reminder. Break down the first micro-step right now to build immediate momentum.";
    if (/cook/i.test(lower)) {
      strategy = "Lay out all ingredients 30 minutes in advance. Clear kitchen counter space so cooking is seamless.";
    } else if (/church/i.test(lower)) {
      strategy = "Get dressed 30 minutes before departure. Have notebook/Bible ready by the door to prevent running late.";
    } else if (/study|read|book/i.test(lower)) {
      strategy = "Keep your phone in another room. Set a dedicated 30-minute timer without switching browser tabs.";
    } else if (/gym|workout|run/i.test(lower)) {
      strategy = "Put your workout shoes and clothes next to your bed/desk right now. Hydrate with a full glass of water.";
    }

    return {
      targetTime: time,
      timeLabel: time ? label : null,
      commitmentStrategy: strategy,
      prepBuffer: time ? "Start preparing 25-30 minutes prior." : "Schedule a dedicated 30m focus block.",
      suggestedTier: tier || "daily",
    };
  };

  try {
    const prompt = `You are a world-class executive productivity coach and commitment strategist.
Analyze this user task input:
Task Title: "${taskTitle}"
Details: "${description || "None"}"
Goal Tier: "${tier || "daily"}"

CRITICAL INSTRUCTIONS:
1. Extract any intended deadline or target time mentioned in natural language (e.g., "before noon" -> "12:00", "at 4pm" -> "16:00", "by 1 pm" -> "13:00", "8:30 am" -> "08:30", "evening" -> "19:00", "morning" -> "09:00", "lunch" -> "12:30"). If no specific time is mentioned, return null for targetTime. Format targetTime strictly as 24-hour "HH:MM".
2. "HOW TO KEEP IT" (commitmentStrategy): Give 1 to 2 crisp, high-impact tactical steps explaining how the user can prepare and successfully KEEP this commitment without getting distracted or missing it. Be specific to the task (e.g. prep buffers, friction removal, execution triggers). Max 35 words.
3. Provide prepBuffer: A short prep window recommendation (e.g. "Start prep by 11:20 AM" or "Leave 25m early").
4. Provide suggestedTier: "daily" | "weekly" | "monthly" | "yearly".

Return ONLY valid JSON matching this schema:
{
  "targetTime": "HH:MM" | null,
  "timeLabel": string | null,
  "commitmentStrategy": string,
  "prepBuffer": string,
  "suggestedTier": "daily" | "weekly" | "monthly" | "yearly"
}`;

    const response = await callGeminiWithRetry({
      model: "gemini-3.8-flash",
      contents: prompt,
      config: { responseMimeType: "application/json" },
    });

    const parsed = JSON.parse(response.text);
    res.json(parsed);
  } catch (error: any) {
    console.warn("Gemini analyze-task fallback used:", error?.message);
    const fallback = naturalFallback(taskTitle);
    res.json(fallback);
  }
});

// Gemini Endpoint: Draft Reminder Email for Unachieved Tasks
app.post("/api/gemini/draft-reminder-email", async (req: Request, res: Response) => {
  const { userName, pendingTasks, unachievedGoals, isZeroTasksDay } = req.body;
  const name = userName || "Valued User";
  const dateStr = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
  });

  const tasksArr = Array.isArray(pendingTasks) ? pendingTasks : [];
  const isZeroDay = Boolean(isZeroTasksDay) || tasksArr.length === 0;

  const prompt = isZeroDay
    ? `Draft a DIRECT, SHORT, accountability email asking: "Today are you totally free?"
User: ${name}
Date: ${dateStr}

Context: No daily tasks or targets have been logged for today yet.

CRITICAL INSTRUCTION:
Keep this email DIRECT, PUNCHY, AND SHORT (under 70 words total).
Do NOT include filler or fluff.
Return a JSON object with:
- "subject": Short punchy subject (max 7 words, e.g. "🎯 Are you totally free today?")
- "bodyText": Direct 2-3 sentence check-in: Inquire if today is a scheduled rest day, or push them to log 1-3 micro-tasks in the app to maintain weekly momentum.
- "bodyHtml": Compact HTML snippet with high contrast.`
    : `Draft a DIRECT, ACTIONABLE, AND SHORT email notification to remind the user about their remaining unachieved daily tasks.
User name: ${name}
Date: ${dateStr}

Pending Tasks for Today:
${JSON.stringify(pendingTasks, null, 2)}

Broader Goals Connected:
${JSON.stringify(unachievedGoals, null, 2)}

CRITICAL INSTRUCTION:
Keep this email DIRECT, PUNCHY, AND SHORT (under 80 words total).
Do NOT include filler or pleasantries.
Return a JSON object with:
- "subject": Short punchy subject (max 7 words, e.g. "🎯 ${pendingTasks?.length || 0} tasks pending today")
- "bodyText": Direct 2-3 line text with checklist bullets and 1 action close.
- "bodyHtml": Compact HTML snippet with high contrast checklist bullets.`;

  try {
    const response = await callGeminiWithRetry({
      model: "gemini-3.8-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
      },
    });

    let rawText = response.text || "{}";
    // Strip markdown fences if present
    rawText = rawText.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```$/i, "").trim();
    const parsed = JSON.parse(rawText);

    if (parsed.subject && (parsed.bodyText || parsed.bodyHtml)) {
      return res.json({
        subject: parsed.subject,
        bodyText: parsed.bodyText || parsed.subject,
        bodyHtml: parsed.bodyHtml || `<p>${parsed.bodyText}</p>`,
      });
    }
  } catch (error: any) {
    console.warn("Gemini AI drafting failed after retries, generating intelligent fallback draft:", error?.message || error);
  }

  // Graceful fallback draft if Gemini is unavailable due to high demand spikes
  if (isZeroDay) {
    return res.json({
      subject: "🎯 Are you totally free today?",
      bodyText: `Hi ${name},\n\nYou haven't logged any daily tasks or targets for today (${dateStr}).\n\nAre you totally free or taking a restful recovery day? If not, open your daily goals to set 1-3 high-leverage micro-tasks and protect your momentum.`,
      bodyHtml: `<div style="font-family: Arial, sans-serif; line-height: 1.5; color: #1e293b; max-width: 540px; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
        <h3 style="color: #4f46e5; margin-top: 0;">🎯 Are you totally free today?</h3>
        <p style="font-size: 14px; color: #334155;">Hi ${name}, you haven't logged any tasks for today (<strong>${dateStr}</strong>).</p>
        <p style="font-size: 14px; color: #334155;">If this is a planned recovery day, enjoy it! Otherwise, jump into Ethos Finance and log 1–3 micro-actions before the day slips away.</p>
        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 16px 0;" />
        <p style="font-size: 11px; color: #94a3b8;">Daily Accountability • Ethos Finance</p>
      </div>`,
    });
  }

  // Graceful fallback draft if Gemini is unavailable due to high demand spikes
  const pendingCount = tasksArr.length;
  const taskBullets = tasksArr
    .map((t: any, i: number) => `${i + 1}. [ ] ${t.title || t.description || "Task"} (${t.timeFrame || "Today"})`)
    .join("\n");
  const taskHtmlItems = tasksArr
    .map(
      (t: any) =>
        `<li style="margin-bottom: 8px; font-weight: 500;">
          <span style="color: #0f766e;">[ ]</span> ${t.title || t.description || "Task"}
          ${t.timeFrame ? `<span style="font-size: 12px; color: #64748b; margin-left: 6px;">(${t.timeFrame})</span>` : ""}
        </li>`
    )
    .join("");

  const fallbackSubject = `🎯 Daily Focus: ${pendingCount > 0 ? `${pendingCount} task${pendingCount > 1 ? "s" : ""} pending for ${dateStr}` : `Evening Goal Review for ${dateStr}`}`;
  const fallbackBodyText = `Hi ${name},

Here is your daily check-in for ${dateStr}.

${pendingCount > 0 ? `You have ${pendingCount} pending task${pendingCount > 1 ? "s" : ""} to complete today:\n\n${taskBullets}` : "All scheduled daily tasks are currently marked complete!"}

${Array.isArray(unachievedGoals) && unachievedGoals.length > 0 ? `\nUnachieved broader goals needing attention:\n${unachievedGoals.map((g: any) => `• ${g.title}`).join("\n")}` : ""}

Keep your momentum strong. Consistent daily execution leads to massive yearly compounding!

— Your Self-Managing Finance & Goals Assistant`;

  const fallbackBodyHtml = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; color: #1e293b; background-color: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0;">
      <h2 style="color: #0f766e; margin-top: 0; font-size: 20px;">🎯 Daily Focus & Goals Reminder</h2>
      <p style="font-size: 15px; color: #475569;">Hi <strong>${name}</strong>,</p>
      <p style="font-size: 15px; color: #334155; line-height: 1.5;">Here is your scheduled daily focus update for <strong>${dateStr}</strong>:</p>
      
      <div style="background-color: #f8fafc; border-left: 4px solid #0f766e; padding: 16px; border-radius: 6px; margin: 18px 0;">
        <h3 style="margin-top: 0; margin-bottom: 10px; font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px; color: #0f766e;">
          Pending Tasks (${pendingCount})
        </h3>
        ${tasksArr.length > 0 ? `<ul style="padding-left: 20px; margin: 0;">${taskHtmlItems}</ul>` : `<p style="margin: 0; color: #10b981; font-weight: 500;">✓ All daily tasks are finished!</p>`}
      </div>

      <p style="font-size: 14px; color: #64748b; line-height: 1.6;">
        Every finished micro-task compounds toward your monthly milestones and yearly freedom. Take 15 minutes to knock out what remains.
      </p>

      <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0 16px 0;" />
      <p style="font-size: 12px; color: #94a3b8; margin: 0;">
        Sent automatically by your Personal Finance & Goal Manager.
      </p>
    </div>
  `;

  return res.json({
    subject: fallbackSubject,
    bodyText: fallbackBodyText,
    bodyHtml: fallbackBodyHtml,
  });
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
