import { Router } from "express";
import auth, { adminOnly } from "../src/auth.js";
import { trackEvent, getRetentionSummary, getRecentEvents, getEventSummary, getUserStats } from "../services/event_service.js";

const router = Router();

// Ingest an event from the frontend
router.post("/", auth, async (req, res) => {
  try {
    const { name, properties, context } = req.body || {};
    if (!name) {
      return res.status(400).send({ error: "Event name is required" });
    }
    const event = await trackEvent(req.auth.id, name, properties, context);
    res.status(201).send({ success: true, eventId: event?._id });
  } catch (error) {
    console.error("POST /events error:", error);
    res.status(500).send({ error: "Failed to track event" });
  }
});

// Retention summary (D7/D30)
router.get("/retention", auth, async (_req, res) => {
  try {
    const summary = await getRetentionSummary();
    res.send(summary);
  } catch (error) {
    console.error("GET /events/retention error:", error);
    res.status(500).send({ error: "Failed to compute retention" });
  }
});

// Recent events for current user
router.get('/recent', auth, async (req, res) => {
  try {
    const { limit } = req.query;
    const events = await getRecentEvents({ userId: req.auth.id, limit: Number(limit) || 100 });
    res.send({ events });
  } catch (error) {
    console.error('GET /events/recent error:', error);
    res.status(500).send({ error: 'Failed to fetch recent events' });
  }
});

// Event summary for current user
router.get('/summary', auth, async (req, res) => {
  try {
    const { from, to } = req.query;
    const summary = await getEventSummary({ userId: req.auth.id, from, to });
    res.send({ summary });
  } catch (error) {
    console.error('GET /events/summary error:', error);
    res.status(500).send({ error: 'Failed to fetch event summary' });
  }
});

// Admin: recent events (all users)
router.get('/admin/recent', auth, adminOnly, async (req, res) => {
  try {
    const { limit } = req.query;
    const events = await getRecentEvents({ limit: Number(limit) || 100, includeUser: true });
    res.send({ events });
  } catch (error) {
    console.error('GET /events/admin/recent error:', error);
    res.status(500).send({ error: 'Failed to fetch admin recent events' });
  }
});

// Admin: event summary (all users)
router.get('/admin/summary', auth, adminOnly, async (req, res) => {
  try {
    const { from, to } = req.query;
    const [summary, userStats] = await Promise.all([
      getEventSummary({ from, to }),
      getUserStats(),
    ]);
    res.send({ summary, userStats });
  } catch (error) {
    console.error('GET /events/admin/summary error:', error);
    res.status(500).send({ error: 'Failed to fetch admin event summary' });
  }
});

export default router;
