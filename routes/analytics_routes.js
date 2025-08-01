import { Router } from "express";
import { auth } from "../src/auth.js";
import dayjs from "dayjs";
import {
  updateDailyAnalytics,
  getWeeklyAnalytics,
  getMonthlyAnalytics,
  getProgressInsights,
  getHabitCorrelationInsights,
  getAnalyticsForDateRange
} from "../services/analytics_service.js";

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
    const [weekly, monthly, insights] = await Promise.all([
      getWeeklyAnalytics(req.auth.id),
      getMonthlyAnalytics(req.auth.id),
      getProgressInsights(req.auth.id)
    ]);

    res.send({
      weekly,
      monthly,
      insights
    });
  } catch (err) {
    res.status(500).send({ error: err.message });
  }
});

export default router; 