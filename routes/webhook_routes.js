import express from 'express';
import Stripe from 'stripe';
import config from '../src/config.js';
import User from '../models/user.js';
import Subscription from '../models/subscription.js';
import Receipt from '../models/receipt.js';
import StreakRestore from '../models/streak_restore.js';
import Streak from '../models/streak.js';

const router = express.Router();
const stripe = new Stripe(config.STRIPE_SECRET_KEY, { apiVersion: '2024-06-20' });

// Stripe requires the raw body to validate the signature
router.post('/stripe', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const endpointSecret = config.STRIPE_WEBHOOK_SECRET;
  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
  } catch (err) {
    console.error('Webhook signature verification failed.', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        const userId = session.metadata?.userId;
        if (!userId) break;
        const subscriptionId = session.subscription;
        if (subscriptionId) {
          const s = await stripe.subscriptions.retrieve(String(subscriptionId));
          const price = s.items.data[0]?.price;
          const interval = price?.recurring?.interval || null;
          await Subscription.findOneAndUpdate(
            { user: userId },
            {
              plan: 'pro',
              status: 'active',
              stripeCustomerId: session.customer,
              stripeSubscriptionId: s.id,
              stripePriceId: price?.id,
              stripeStatus: s.status,
              interval,
              cancel_at_period_end: Boolean(s.cancel_at_period_end),
              current_period_start: new Date(s.current_period_start * 1000),
              current_period_end: new Date(s.current_period_end * 1000),
              start_date: new Date(s.start_date * 1000),
              end_date: new Date(s.current_period_end * 1000),
              renewal: !s.cancel_at_period_end,
            },
            { upsert: true, new: true }
          );
          await User.findByIdAndUpdate(userId, { stripeCustomerId: session.customer });
        }
        // Handle one-off streak restore checkout with idempotency and validated metadata
        if (!subscriptionId && session?.metadata?.purpose === 'streak_restore') {
          try {
            const habitId = session.metadata?.habitId;
            if (!habitId) break;
            // Fetch line items to identify price if needed
            let priceId = null;
            try {
              const items = await stripe.checkout.sessions.listLineItems(session.id, { limit: 1 });
              priceId = items?.data?.[0]?.price?.id || null;
            } catch {}
            // Idempotency: check if already restored for this user+habit+session
            const already = await StreakRestore.findOne({ user: userId, habit: habitId, priceId, restoredAt: { $exists: true } });
            if (already) break;
            const lastEnded = await Streak.findOne({ owner: userId, habit: habitId, end_date: { $ne: null } }).sort({ end_date: -1 });
            if (lastEnded) {
              await Streak.updateOne({ _id: lastEnded._id }, { $set: { end_date: null } });
            }
            await StreakRestore.create({ user: userId, habit: habitId, priceId, restoredAt: new Date() });
          } catch (e) { console.error('streak restore webhook error', e); }
        }
        break;
      }
      case 'customer.subscription.updated':
      case 'customer.subscription.created': {
        const s = event.data.object;
        const userId = s.metadata?.userId;
        const price = s.items.data[0]?.price;
        const interval = price?.recurring?.interval || null;
        // If we do not have metadata userId, try lookup by customer -> user
        let user = null;
        if (!userId) {
          user = await User.findOne({ stripeCustomerId: s.customer });
        }
        const userKey = userId || user?._id;
        if (userKey) {
          await Subscription.findOneAndUpdate(
            { user: userKey },
            {
              plan: 'pro',
              status: s.status === 'active' || s.status === 'trialing' ? 'active' : 'expired',
              stripeCustomerId: s.customer,
              stripeSubscriptionId: s.id,
              stripePriceId: price?.id,
              stripeStatus: s.status,
              interval,
              cancel_at_period_end: Boolean(s.cancel_at_period_end),
              current_period_start: new Date(s.current_period_start * 1000),
              current_period_end: new Date(s.current_period_end * 1000),
              start_date: new Date(s.start_date * 1000),
              end_date: new Date(s.current_period_end * 1000),
              renewal: !s.cancel_at_period_end,
            },
            { upsert: true, new: true }
          );
        }
        break;
      }
      case 'invoice.payment_succeeded': {
        const invoice = event.data.object;
        const customerId = invoice.customer;
        const user = await User.findOne({ stripeCustomerId: customerId });
        if (user) {
          await Receipt.findOneAndUpdate(
            { stripeInvoiceId: invoice.id },
            {
              user: user._id,
              stripeInvoiceId: invoice.id,
              stripePaymentIntentId: invoice.payment_intent,
              amount: invoice.amount_paid ?? invoice.amount_due ?? 0,
              currency: invoice.currency,
              status: invoice.status,
              hostedInvoiceUrl: invoice.hosted_invoice_url,
              invoicePdf: invoice.invoice_pdf,
              lines: invoice.lines?.data || [],
              createdAt: new Date((invoice.created || 0) * 1000),
            },
            { upsert: true, new: true }
          );
        }
        break;
      }
      case 'customer.subscription.deleted': {
        const s = event.data.object;
        const user = await User.findOne({ stripeCustomerId: s.customer });
        if (user) {
          await Subscription.findOneAndUpdate(
            { user: user._id },
            { status: 'expired', stripeStatus: s.status, end_date: new Date() },
            { new: true }
          );
        }
        break;
      }
      default:
        break;
    }
    res.json({ received: true });
  } catch (error) {
    console.error('Webhook handling error:', error);
    res.status(500).json({ error: 'Webhook handler failed' });
  }
});

export default router;

