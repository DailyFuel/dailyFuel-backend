import { getMonthlyAnalytics, getHabitCorrelationInsights, getAnalyticsForDateRange } from './analytics_service.js';
import DeepInsight from '../models/deep_insight.js';
import CoachPlan from '../models/coach_plan.js';
import AiLock from '../models/ai_lock.js';
import Subscription from '../models/subscription.js';
import dayjs from 'dayjs';
import Habit from '../models/habit.js';
import HabitLog from '../models/habit_log.js';

// 1) Deterministic feature extraction (no LLM)
export async function computeInsightFeatures(userId) {
  // Use all available history for trials; fallback to last 30 days
  const firstLog = await HabitLog.findOne({ owner: userId }).sort({ date: 1 });
  const start = firstLog?.date || dayjs().subtract(30, 'day').format('YYYY-MM-DD');
  const end = dayjs().format('YYYY-MM-DD');
  const dailyData = await getAnalyticsForDateRange(userId, start, end);
  const summary = {};
  const correlations = await getHabitCorrelationInsights(userId);

  // Build date-index for accurate windowed metrics (missing days count as 0)
  const dataByDate = dailyData.reduce((acc, d) => {
    if (d?.date) acc[d.date] = d;
    return acc;
  }, {});
  const endDay = dayjs(end);
  const makeWindow = (days) => Array.from({ length: days }, (_, i) => endDay.subtract(days - 1 - i, 'day').format('YYYY-MM-DD'));
  const last14Dates = makeWindow(14);
  const prev14Dates = makeWindow(28).slice(0, 14);
  const last14 = last14Dates.map(date => ({
    date,
    ...(dataByDate[date] || {}),
    isWeekend: [0,6].includes(dayjs(date).day()),
    completionRate: dataByDate[date]?.completionRate || 0,
  }));
  const prev14 = prev14Dates.map(date => ({
    date,
    ...(dataByDate[date] || {}),
    isWeekend: [0,6].includes(dayjs(date).day()),
    completionRate: dataByDate[date]?.completionRate || 0,
  }));
  const completionRates = last14.map(d => d.completionRate || 0);
  const avg14 = completionRates.length ? completionRates.reduce((a,b)=>a+b,0)/completionRates.length : 0;
  const perfectDays14 = last14.filter(d => (d.completionRate||0) === 100).length;
  const activeDays14 = last14.filter(d => (d.completionRate||0) > 0).length;
  const avgPrev14 = prev14.length ? prev14.reduce((a,b)=>a+(b.completionRate||0),0)/prev14.length : 0;
  const trendDelta14 = Math.round(avg14 - avgPrev14);

  // Weekend vs weekday delta
  const weekend = last14.filter(d => d.isWeekend);
  const weekday = last14.filter(d => !d.isWeekend);
  const weekendAvg = weekend.length ? weekend.reduce((a,b)=>a+(b.completionRate||0),0)/weekend.length : 0;
  const weekdayAvg = weekday.length ? weekday.reduce((a,b)=>a+(b.completionRate||0),0)/weekday.length : 0;

  const habitContext = await Habit.findOne({ owner: userId, goal: { $exists: true, $ne: '' } }, { name: 1, goal: 1, why: 1 }).lean();

  // Longest streak observed in window (approximation from analytics field)
  const longestStreakWindow = Math.max(0, ...dailyData.map(d => d.longestStreak || 0));

  // Day-of-week performance over last 30 days
  const last30Dates = Array.from({ length: 30 }, (_, i) => endDay.subtract(29 - i, 'day').format('YYYY-MM-DD'));
  const last30 = last30Dates.map(date => ({
    date,
    ...(dataByDate[date] || {}),
    dayOfWeek: (dataByDate[date]?.dayOfWeek) || dayjs(date).format('dddd').toLowerCase(),
    completionRate: dataByDate[date]?.completionRate || 0,
  }));
  const byDow = last30.reduce((acc, d) => {
    const k = d.dayOfWeek || 'unknown';
    if (!acc[k]) acc[k] = { total: 0, count: 0 };
    acc[k].total += (d.completionRate || 0);
    acc[k].count += 1;
    return acc;
  }, {});
  let bestDayOfWeek = null;
  let bestDayAvg = -1;
  Object.entries(byDow).forEach(([k, v]) => {
    const avg = v.total / (v.count || 1);
    if (avg > bestDayAvg) { bestDayAvg = avg; bestDayOfWeek = k; }
  });

  return {
    window: { start, end },
    avgCompletion14: Math.round(avg14),
    perfectDays14,
    activeDays14,
    weekendDelta: Math.round(weekdayAvg - weekendAvg),
    trendDelta14,
    longestStreakWindow,
    bestDayOfWeek,
    dataDays14: last14.filter(d => (d?.date && (dataByDate[d.date]))).length,
    coverage14: Math.round((last14.filter(d => (d?.date && (dataByDate[d.date]))).length / 14) * 100),
    summary,
    correlations: (correlations.correlations || []).slice(0,2),
    habitContext,
  };
}

// 2) Optional LLM summarization wrapper (pluggable, can be disabled)
export async function summarizeInsightsLLM(features, llm) {
  if (!llm) return null;
  const system = 'You are an expert habit coach. Apply behavior science (implementation intentions, habit stacking, cue salience, goal‑gradient, loss aversion). Be specific, supportive, concise, and evidence‑based. 8th‑grade level.';
  const promptVersion = 'v1.3';
  const user = `Given these FEATURES about the user's history (or last 30 days), produce a concise paragraph summary (3–5 sentences, ~60–120 words), a brief evidence section (with concrete numbers from FEATURES), 3 ultra‑specific actions for the next 7 days, and 3 quick tips to sustain habits. If a habit goal/why exists, tailor cues and safeguards to it. Consider weekends, trends, streaks, and correlations.

FEATURES:\n${JSON.stringify(features)}

Rules:
- Base advice on what already works; remove friction before adding effort.
- If avgCompletion14 < 50: focus on one keystone habit and smallest next step.
- If weekendDelta < 0: include a weekend‑specific plan.
- If correlations exist: propose a stack using the strongest pair.
- Always include a concrete cue (when/where) and a safeguard (reminder or 2‑minute backup).
- Tone: encouraging, non‑judgmental, zero hype.
 - DO NOT claim performance across the full 14 days unless dataDays14 === 14. If dataDays14 < 14, clearly qualify statements (e.g., "on the days you logged") and use coverage14%.

Output JSON ONLY with this exact shape:
{
  "summary": "A single paragraph (3–5 sentences, ~60–120 words) explaining what is working and the most leveraged next step.",
  "rationale": [
    "Cite 1–3 numeric facts from FEATURES, e.g., 'Avg 14‑day completion 72%'; keep to one sentence each"
  ],
  "recommendations": [
    "After <cue>, I will <specific action> at <time/place> (because <why>).",
    "Stack: After <habit A>, I will <habit B> at <time/place>.",
    "Safeguard: Set <reminder type> at <time>; if missed, do <2‑minute backup>."
  ],
  "tips": [
    "3 very short sustaining tips tailored to FEATURES (e.g., calendar block, pair with existing routine, visible cue)."
  ]
}`;
  const result = await llm({ system, user, context: 'deep_insight' });
  const summaryText = typeof result === 'string'
    ? result
    : (result?.summary ?? '');
  const recommendations = Array.isArray(result?.recommendations) ? result.recommendations : [];
  const rationale = Array.isArray(result?.rationale) ? result.rationale : [];
  const tips = Array.isArray(result?.tips) ? result.tips : [];
  return { summary: summaryText, recommendations, rationale, tips, promptVersion, raw: result };
}

// Cache lookup helper: fetch most recent insight within 24h
export async function getCachedInsight(userId) {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  return DeepInsight.findOne({ user: userId, generatedAt: { $gte: since } }).sort({ generatedAt: -1 });
}

// Main entry: generate daily insight if not cached (for Pro or active trial)
export async function ensureDailyInsight(userId, llm) {
  // Check subscription plan/trial
  const sub = await Subscription.findOne({ user: userId });
  const isPro = sub?.plan === 'pro' || sub?.trial_active === true;
  if (!isPro) return null; // Only generate for Pro/trial

  // Check cache
  const cached = await getCachedInsight(userId);
  if (cached) return cached;

  // Use a short-lived lock to avoid duplicate generations at startup or race conditions
  const lockKey = `daily_insight:${userId}`;
  const now = new Date();
  const lockExp = new Date(now.getTime() + 2 * 60 * 1000); // 2 minutes
  try {
    await AiLock.create({ key: lockKey, expiresAt: lockExp });
  } catch {
    // Lock exists, wait for cached document to appear
    const waitStart = Date.now();
    while (Date.now() - waitStart < 5_000) { // wait up to 5s
      const again = await getCachedInsight(userId);
      if (again) return again;
      await new Promise(r => setTimeout(r, 250));
    }
    // Give up without calling LLM
    return null;
  }

  // Compute features and summarize via LLM
  const features = await computeInsightFeatures(userId);
  let summary = null;
  try { summary = await summarizeInsightsLLM(features, llm); } catch {}

  const doc = await DeepInsight.create({
    user: userId,
    generatedAt: new Date(),
    windowStart: features.window?.start,
    windowEnd: features.window?.end,
    features,
    summary: summary?.summary || null,
    promptVersion: summary?.promptVersion || null,
    llm: {
      recommendations: summary?.recommendations || [],
      rationale: summary?.rationale || [],
      tips: summary?.tips || [],
    },
  });
  return doc;
}

// 3) Ad-hoc habit coaching plan (given habits and optional "why")
export async function generateHabitCoachPlan(userId, habits, llm) {
  if (!llm) return null;
  let habitList = Array.isArray(habits) ? habits : [];
  if (habitList.length === 0) {
    // Fallback: pull user's active habits
    const dbHabits = await Habit.find({ owner: userId }, { name: 1, why: 1 }).lean();
    habitList = dbHabits.map(h => ({ name: h.name, why: h.why || '' }));
  }

  const system = 'You are a habit coach. Be specific, pragmatic, and evidence-informed. Avoid vague praise; tie encouragement to concrete actions.';
  const user = `You are a habit coach. Given a list of habits and optional "why" reasons, do the following:
1) Review all habits together and individually.
2) Use "why" reasons to personalise advice.
3) Spot likely challenges or blockers.
4) Give practical, specific tips for building and maintaining each habit (e.g., habit stacking, environment design, cue–routine–reward).
5) Avoid vague praise; encouragement must be tied to specific actions.

User data (JSON Array of { name, why }):\n${JSON.stringify(habitList)}

Respond with JSON ONLY using this shape:
{
  "summary": "1 short paragraph synthesising the overall plan",
  "globalInsights": ["2–4 observations across habits"],
  "likelyBlockers": ["3–5 likely obstacles with short mitigations"],
  "habitPlans": [
    {
      "habit": "<habit name>",
      "why": "<why if provided>",
      "starterStep": "a very small first step to start this week",
      "stack": "After <existing routine>, I will <new action> at <time/place>",
      "environment": ["2–3 environment tweaks to make the habit easier"],
      "cueRoutineReward": { "cue": "...", "routine": "...", "reward": "..." },
      "safeguards": ["2–3 if‑then backups when time/energy is low"],
      "metrics": ["1–2 simple ways to track progress"]
    }
  ],
  "weeklySchedule": ["Mon: …", "Tue: …", "Wed: …", "Thu: …", "Fri: …", "Sat: …", "Sun: …"],
  "reminders": ["2–4 concrete reminders with timing and channel suggestions"]
}`;

  // Check cache by habits hash within 24h to avoid repeated calls
  const habitsHash = Buffer.from(JSON.stringify(habitList)).toString('base64');
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const cached = await CoachPlan.findOne({ user: userId, habitsHash, generatedAt: { $gte: since } }).sort({ generatedAt: -1 });
  if (cached) return { plan: cached.plan, usedHabits: habitList };

  const result = await llm({ system, user });
  // Persist for reuse
  try {
    await CoachPlan.create({ user: userId, habits: habitList, habitsHash, plan: result || null });
  } catch {}
  return { plan: result || null, usedHabits: habitList };
}

