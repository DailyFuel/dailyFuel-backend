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