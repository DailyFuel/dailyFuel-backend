import { Router } from "express";
import Subscription from "../models/subscription.js";
import auth from "../src/auth.js";
import { trackEvent } from "../services/event_service.js";
import { getUserSubscriptionStatus } from "../middleware/subscriptionCheck.js";

const router = Router();

router.get("/", auth, getUserSubscriptionStatus, async (req, res) => {
  try {
    let sub;
    try {
      sub = await Subscription.findOne({ user: req.auth.id });
    } catch (error) {
      console.error('Error finding subscription:', error);
      sub = null;
    }
    
    // Ensure we have a valid response even if middleware failed
    const status = req.subscriptionStatus || {
      plan: 'free',
      status: 'active',
      limits: {
        habits: {
          limit: 3,
          current: 0,
          remaining: 3
        },
        socialSharing: {
          limit: 3,
          current: 0,
          remaining: 3
        }
      }
    };
    
    // Attach trial fields to status if present
    if (sub?.trial_active) {
      status.trial = {
        active: sub.trial_active,
        startedAt: sub.trial_started,
        endsAt: sub.trial_end,
      };
    }

    res.send({
      subscription: sub,
      status: status
    });
  } catch (error) {
    console.error('Error in subscription GET route:', error);
    // Send a default response even on error
    res.send({
      subscription: null,
      status: {
        plan: 'free',
        status: 'active',
        limits: {
          habits: {
            limit: 3,
            current: 0,
            remaining: 3
          },
          socialSharing: {
            limit: 3,
            current: 0,
            remaining: 3
          }
        }
      }
    });
  }
});

router.post("/start", auth, async (req, res) => {
  const { plan, end_date } = req.body;

  const sub = await Subscription.findOneAndUpdate(
    { user: req.auth.id },
    {
      plan,
      start_date: new Date(),
      end_date: new Date(end_date),
      status: "active",
      renewal: true,
    },
    { upsert: true, new: true }
  );

  res.send(sub);
  try {
    trackEvent(req.auth.id, plan === 'pro' ? 'subscription_started' : 'trial_started', {
      plan,
      end_date,
    });
  } catch {}
});

// Start trial (default 7 days)
router.post('/start-trial', auth, async (req, res) => {
  try {
    const days = Math.max(1, Math.min(30, Number(req.body?.days || 7)));
    const start = new Date();
    const end = new Date(start.getTime() + days * 24 * 60 * 60 * 1000);
    const sub = await Subscription.findOneAndUpdate(
      { user: req.auth.id },
      {
        plan: 'free',
        status: 'active',
        trial_active: true,
        trial_started: start,
        trial_end: end,
      },
      { upsert: true, new: true }
    );
    try { trackEvent(req.auth.id, 'trial_started', { days, trial_end: end }); } catch {}
    res.json({ ok: true, trial: { endsAt: end } });
  } catch (e) {
    console.error('start-trial failed', e);
    res.status(500).json({ error: 'Failed to start trial' });
  }
});

// Extend trial by N days (default 7)
router.post('/extend-trial', auth, async (req, res) => {
  try {
    const days = Math.max(1, Math.min(21, Number(req.body?.days || 7)));
    const sub = await Subscription.findOne({ user: req.auth.id });
    if (!sub?.trial_active || !sub?.trial_end) {
      return res.status(400).json({ error: 'No active trial to extend' });
    }
    const newEnd = new Date(sub.trial_end.getTime() + days * 24 * 60 * 60 * 1000);
    sub.trial_end = newEnd;
    await sub.save();
    try { trackEvent(req.auth.id, 'trial_extended', { days, trial_end: newEnd }); } catch {}
    res.json({ ok: true, extended: true, trial: { endsAt: newEnd } });
  } catch (e) {
    console.error('extend-trial failed', e);
    res.status(500).json({ error: 'Failed to extend trial' });
  }
});

router.post("/cancel", auth, async (req, res) => {
  const sub = await Subscription.findOneAndUpdate(
    { user: req.auth.id },
    { status: "cancelled", renewal: false },
    { new: true }
  );

  res.send(sub);
  try {
    trackEvent(req.auth.id, 'subscription_cancelled', { plan: sub?.plan, end_date: sub?.end_date });
  } catch {}
});

export default router;