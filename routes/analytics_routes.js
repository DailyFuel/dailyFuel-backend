import { Router } from "express";
import auth from "../src/auth.js";
import dayjs from "dayjs";
import Subscription from "../models/subscription.js";
import {
  updateDailyAnalytics,
  getWeeklyAnalytics,
  getMonthlyAnalytics,
  getProgressInsights,
  getHabitCorrelationInsights,
  getAnalyticsForDateRange
} from "../services/analytics_service.js";
import { computeInsightFeatures, getCachedInsight, ensureDailyInsight, summarizeInsightsLLM, generateHabitCoachPlan } from "../services/insights_service.js";
import { getLLM } from "../services/llm_provider.js";
import DeepInsight from "../models/deep_insight.js";
import CoachPlan from "../models/coach_plan.js";

const router = Router();

// Update today's analytics
router.post("/update", auth, async (req, res) => {
  try {
    const today = dayjs().format("YYYY-MM-DD");
    const analytics = await updateDailyAnalytics(req.auth.id, today);
    
    if (analytics) {
      res.send(analytics);
    } else {
      res.status(500).send({ error: "Failed to update analytics" });
    }
  } catch (err) {
    res.status(500).send({ error: err.message });
  }
});

// Get weekly analytics
router.get("/weekly", auth, async (req, res) => {
  try {
    const analytics = await getWeeklyAnalytics(req.auth.id);
    res.send(analytics);
  } catch (err) {
    res.status(500).send({ error: err.message });
  }
});

// Get monthly analytics
router.get("/monthly", auth, async (req, res) => {
  try {
    const analytics = await getMonthlyAnalytics(req.auth.id);
    res.send(analytics);
  } catch (err) {
    res.status(500).send({ error: err.message });
  }
});

// Get analytics for custom date range
router.get("/range", auth, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    if (!startDate || !endDate) {
      return res.status(400).send({ error: "startDate and endDate are required" });
    }

    // Enforce history window for free users
    const sub = await Subscription.findOne({ user: req.auth.id });
    const isPro = sub?.plan === 'pro';
    if (!isPro) {
      const maxStart = dayjs(endDate).subtract(30, 'day');
      const requestedStart = dayjs(startDate);
      if (requestedStart.isBefore(maxStart, 'day')) {
        return res.status(403).send({
          error: 'Free tier limit: history limited to last 30 days. Upgrade to Pro for full history.',
          upgradeRequired: true,
          limitDays: 30
        });
      }
    }

    const analytics = await getAnalyticsForDateRange(req.auth.id, startDate, endDate);
    res.send(analytics);
  } catch (err) {
    res.status(500).send({ error: err.message });
  }
});

// Get progress insights
router.get("/insights", auth, async (req, res) => {
  try {
    const insights = await getProgressInsights(req.auth.id);
    res.send(insights);
  } catch (err) {
    res.status(500).send({ error: err.message });
  }
});

// Get habit correlation insights
router.get("/correlations", auth, async (req, res) => {
  try {
    const correlations = await getHabitCorrelationInsights(req.auth.id);
    res.send(correlations);
  } catch (err) {
    res.status(500).send({ error: err.message });
  }
});

// Get today's analytics
router.get("/today", auth, async (req, res) => {
  try {
    const today = dayjs().format("YYYY-MM-DD");
    const analytics = await updateDailyAnalytics(req.auth.id, today);
    res.send(analytics);
  } catch (err) {
    res.status(500).send({ error: err.message });
  }
});

// Get analytics summary
router.get("/summary", auth, async (req, res) => {
  try {
    // Get analytics with individual error handling
    let weekly, monthly, insights;
    
    try {
      weekly = await getWeeklyAnalytics(req.auth.id);
    } catch (err) {
      console.error("Error getting weekly analytics:", err);
      weekly = { dailyData: [], summary: {} };
    }
    
    try {
      monthly = await getMonthlyAnalytics(req.auth.id);
    } catch (err) {
      console.error("Error getting monthly analytics:", err);
      monthly = { dailyData: [], summary: {} };
    }
    
    try {
      insights = await getProgressInsights(req.auth.id);
    } catch (err) {
      console.error("Error getting progress insights:", err);
      insights = {
        message: "Unable to generate insights at this time",
        trends: [],
        recommendations: ["Try logging some habits to see insights"]
      };
    }
    
    res.send({
      weekly,
      monthly,
      insights
    });
  } catch (err) {
    console.error("Error in analytics summary:", err);
    res.status(500).send({ error: err.message });
  }
});

// Deterministic features for Deep Insights (no LLM required)
router.get('/deep-insights/features', auth, async (req, res) => {
  try {
    const features = await computeInsightFeatures(req.auth.id);
    // Add explicit coverage fields to help clients debug
    const safe = { ...features };
    if (typeof safe.coverage14 !== 'number') {
      safe.coverage14 = 0;
    }
    if (typeof safe.dataDays14 !== 'number') {
      safe.dataDays14 = 0;
    }
    res.send({ ok: true, features: safe });
  } catch (err) {
    console.error('Error computing deep insight features:', err);
    res.status(500).send({ error: 'failed_to_compute_features' });
  }
});

// Return cached daily deep insight (summary + features), generate if missing
router.get('/deep-insights/daily', auth, async (req, res) => {
  try {
    const reset = String(req.query.reset || '').toLowerCase() === 'true';
    const force = String(req.query.force || '').toLowerCase() === 'true';
    // Enforce subscription gating here to avoid accidental generation for free users
    const sub = await Subscription.findOne({ user: req.auth.id });
    const isPro = sub?.plan === 'pro' || sub?.trial_active === true;
    if (!isPro) {
      // Do not return any insight for free users; optionally clear stale docs on reset
      if (reset) {
        try { await DeepInsight.deleteMany({ user: req.auth.id }); } catch {}
      }
      return res.send({ ok: true, insight: null });
    }

    if (reset) {
      try { await DeepInsight.deleteMany({ user: req.auth.id }); } catch (e) { console.warn('deep insight reset failed', e?.message); }
    }
    let insight = await getCachedInsight(req.auth.id);
    const llm = getLLM();
    // If missing or forced, (re)generate a summary using the latest features
    if (!insight || force || !insight.summary) {
      try {
        const features = await computeInsightFeatures(req.auth.id);
        const summary = await summarizeInsightsLLM(features, llm);
        if (insight) {
          // Update existing cached document
          await DeepInsight.updateOne(
            { _id: insight._id },
            {
              $set: {
                features,
                summary: summary?.summary || null,
                windowStart: features.window?.start,
                windowEnd: features.window?.end,
                generatedAt: new Date(),
                'llm.recommendations': summary?.recommendations || [],
                'llm.rationale': summary?.rationale || [],
                'llm.tips': summary?.tips || [],
              },
            }
          );
          insight = await DeepInsight.findById(insight._id);
        } else {
          // Delegate creation path to ensureDailyInsight for consistency with gating
          insight = await ensureDailyInsight(req.auth.id, llm);
        }
      } catch (e) {
        // Fallback
        if (!insight) {
          insight = await ensureDailyInsight(req.auth.id, llm);
        }
      }
    }
    if (!insight) return res.send({ ok: true, insight: null });

    // Helper: sanitize summary/strings to remove code fences and embedded JSON blobs
    const sanitizeInsightText = (value) => {
      if (value == null) return '';
      let t = String(value).trim();
      // Normalize smart quotes
      t = t.replace(/[“”]/g, '"').replace(/[‘’]/g, "'");
      // Remove fenced code blocks
      t = t.replace(/```[\s\S]*?```/g, '').trim();
      // Try to remove a parsable inline JSON object
      const removeJsonObject = (input) => {
        let out = input;
        const start = out.indexOf('{');
        const end = out.lastIndexOf('}');
        if (start !== -1 && end !== -1 && end > start) {
          const candidate = out.slice(start, end + 1);
          try {
            const parsed = JSON.parse(candidate);
            if (parsed && typeof parsed === 'object') {
              out = (out.slice(0, start) + out.slice(end + 1)).trim();
            }
          } catch {}
        }
        return out;
      };
      t = removeJsonObject(t);
      // Try to remove a parsable inline JSON array
      const startA = t.indexOf('[');
      const endA = t.lastIndexOf(']');
      if (startA !== -1 && endA !== -1 && endA > startA) {
        const candidate = t.slice(startA, endA + 1);
        try {
          const parsed = JSON.parse(candidate);
          if (Array.isArray(parsed)) {
            t = (t.slice(0, startA) + t.slice(endA + 1)).trim();
          }
        } catch {}
      }
      // Aggressive fallback: drop trailing content after any brace/bracket if still present
      const firstBrace = t.indexOf('{');
      if (firstBrace !== -1) t = t.slice(0, firstBrace).trim();
      const firstBracket = t.indexOf('[');
      if (firstBracket !== -1) t = t.slice(0, firstBracket).trim();
      return t;
    };

    // Ensure client gets a flat string for summary (some providers may return object) and sanitize it
    const safe = insight.toObject ? insight.toObject() : insight;
    if (safe && typeof safe.summary !== 'string') {
      safe.summary = typeof safe.summary === 'object' && safe.summary !== null ? (safe.summary.summary || '') : String(safe.summary || '');
    }
    safe.summary = sanitizeInsightText(safe.summary || '');

    // Ensure arrays exist for UI and sanitize their entries
    if (!safe.llm) safe.llm = {};
    if (!Array.isArray(safe.llm.recommendations)) safe.llm.recommendations = [];
    if (!Array.isArray(safe.llm.rationale)) safe.llm.rationale = [];
    if (!Array.isArray(safe.llm.tips)) safe.llm.tips = [];
    const sanitizeList = (arr) => (Array.isArray(arr) ? arr.map((s) => sanitizeInsightText(s)).filter((s) => typeof s === 'string' && s.length > 0) : []);
    safe.llm.recommendations = sanitizeList(safe.llm.recommendations);
    safe.llm.rationale = sanitizeList(safe.llm.rationale);
    safe.llm.tips = sanitizeList(safe.llm.tips);

    res.send({ ok: true, insight: safe });
  } catch (err) {
    console.error('Error getting daily deep insight:', err);
    res.status(500).send({ error: 'failed_to_get_daily_insight' });
  }
});

// Optional: cron endpoint to trigger daily insights generation manually
router.post('/deep-insights/cron', async (req, res) => {
  try {
    const secret = req.headers['x-cron-secret'];
    if (process.env.CRON_SECRET && secret !== process.env.CRON_SECRET) {
      return res.status(401).send({ error: 'unauthorized' });
    }
    const llm = getLLM();
    // Import here to avoid circular deps
    const Subscription = (await import('../models/subscription.js')).default;
    const proUsers = await Subscription.find({ $or: [ { plan: 'pro' }, { trial_active: true } ] }).select('user');
    let generated = 0;
    for (const s of proUsers) {
      const out = await ensureDailyInsight(s.user, llm);
      if (out) generated++;
    }
    res.send({ ok: true, generated, total: proUsers.length });
  } catch (err) {
    console.error('cron deep-insights error', err);
    res.status(500).send({ error: 'failed_to_run_cron' });
  }
});

// Ad-hoc coaching plan based on provided habits
router.post('/deep-insights/coach-plan', auth, async (req, res) => {
  try {
    const { habits } = req.body || {};
    const llm = getLLM();
    const out = await generateHabitCoachPlan(req.auth.id, habits, llm);
    res.send({ ok: true, plan: out.plan, usedHabits: out.usedHabits });
  } catch (err) {
    console.error('Error generating coach plan:', err);
    res.status(500).send({ error: 'failed_to_generate_coach_plan' });
  }
});

export default router;