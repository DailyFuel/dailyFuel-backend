import { Router } from "express";
import firebaseAuth from "../src/firebase-auth.js";
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
router.post("/update", firebaseAuth, async (req, res) => {
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
router.get("/weekly", firebaseAuth, async (req, res) => {
  try {
    const analytics = await getWeeklyAnalytics(req.auth.id);
    res.send(analytics);
  } catch (err) {
    res.status(500).send({ error: err.message });
  }
});

// Get monthly analytics
router.get("/monthly", firebaseAuth, async (req, res) => {
  try {
    const analytics = await getMonthlyAnalytics(req.auth.id);
    res.send(analytics);
  } catch (err) {
    res.status(500).send({ error: err.message });
  }
});

// Get analytics for custom date range
router.get("/range", firebaseAuth, async (req, res) => {
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
router.get("/insights", firebaseAuth, async (req, res) => {
  try {
    const insights = await getProgressInsights(req.auth.id);
    res.send(insights);
  } catch (err) {
    res.status(500).send({ error: err.message });
  }
});

// Get habit correlation insights
router.get("/correlations", firebaseAuth, async (req, res) => {
  try {
    const correlations = await getHabitCorrelationInsights(req.auth.id);
    res.send(correlations);
  } catch (err) {
    res.status(500).send({ error: err.message });
  }
});

// Get today's analytics
router.get("/today", firebaseAuth, async (req, res) => {
  try {
    const today = dayjs().format("YYYY-MM-DD");
    const analytics = await updateDailyAnalytics(req.auth.id, today);
    res.send(analytics);
  } catch (err) {
    res.status(500).send({ error: err.message });
  }
});

// Get analytics summary
router.get("/summary", firebaseAuth, async (req, res) => {
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

export default router;