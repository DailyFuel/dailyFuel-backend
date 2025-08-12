import { Router } from 'express';
import webpush from 'web-push';
import auth from '../src/auth.js';
import PushSubscription from '../models/push_subscription.js';

const router = Router();

// VAPID keys should be configured via env vars
const {
  VAPID_PUBLIC_KEY = '',
  VAPID_PRIVATE_KEY = '',
  VAPID_SUBJECT = 'mailto:admin@dailyfuel.app',
} = process.env;

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
}

router.get('/vapid-public-key', (req, res) => {
  res.send({ publicKey: VAPID_PUBLIC_KEY });
});

// Save or update a push subscription
router.post('/subscribe', auth, async (req, res) => {
  try {
    const subscription = req.body; // { endpoint, keys: {p256dh, auth} }
    if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
      return res.status(400).send({ error: 'Invalid subscription payload' });
    }

    const saved = await PushSubscription.findOneAndUpdate(
      { owner: req.auth.id, endpoint: subscription.endpoint },
      { ...subscription, owner: req.auth.id, userAgent: req.headers['user-agent'] || '' },
      { upsert: true, new: true }
    );
    res.status(201).send({ ok: true, id: saved._id });
  } catch (err) {
    res.status(500).send({ error: err.message });
  }
});

// Test push notification
router.post('/test', auth, async (req, res) => {
  try {
    const sub = await PushSubscription.findOne({ owner: req.auth.id }).sort({ createdAt: -1 });
    if (!sub) return res.status(404).send({ error: 'No push subscription found' });
    await webpush.sendNotification(sub.toObject(), JSON.stringify({
      title: 'DailyFuel Test',
      body: 'Push notifications are working!',
      url: '/',
    }));
    res.send({ ok: true });
  } catch (err) {
    console.error('Push test error:', err);
    res.status(500).send({ error: err.message });
  }
});

export default router;

