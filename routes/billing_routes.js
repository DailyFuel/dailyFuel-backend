import { Router } from 'express';
import Stripe from 'stripe';
import { z } from 'zod';
import config from '../src/config.js';
import auth from '../src/auth.js';
import User from '../models/user.js';
import Subscription from '../models/subscription.js';
import Habit from '../models/habit.js';
import Streak from '../models/streak.js';
import StreakRestore from '../models/streak_restore.js';
import Receipt from '../models/receipt.js';

const router = Router();
const stripe = new Stripe(config.STRIPE_SECRET_KEY, { apiVersion: '2024-06-20' });

// Pricing config (server truth)
const PLANS = {
  pro_monthly: {
    plan: 'pro',
    interval: 'month',
    price: 500, // 5.00 in AUD cents
    stripePriceId: process.env.STRIPE_PRICE_PRO_MONTHLY,
  },
  pro_yearly: {
    plan: 'pro',
    interval: 'year',
    price: 5000, // 50.00 in AUD cents
    stripePriceId: process.env.STRIPE_PRICE_PRO_YEARLY,
  }
};

router.get('/pricing', (_req, res) => {
  const discount = 1 - (PLANS.pro_yearly.price / (PLANS.pro_monthly.price * 12));
  res.json({
    currency: 'aud',
    plans: {
      monthly: { amount: PLANS.pro_monthly.price, interval: 'month' },
      yearly: { amount: PLANS.pro_yearly.price, interval: 'year', discountVsMonthlyPct: Math.round(discount * 1000) / 10 },
    },
  });
});

const checkoutSchema = z.object({
  interval: z.enum(['month', 'year']).optional(),
  success_url: z.string().url().optional(),
  cancel_url: z.string().url().optional(),
});

router.post('/checkout', auth, async (req, res) => {
  try {
    if (!config.STRIPE_SECRET_KEY) {
      return res.status(400).json({ error: 'Billing is not configured' });
    }
    const parsed = checkoutSchema.safeParse(req.body || {});
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid request', details: parsed.error.flatten() });
    }
    const { interval = 'month', success_url, cancel_url } = parsed.data;
    const planKey = interval === 'year' ? 'pro_yearly' : 'pro_monthly';
      const plan = PLANS[planKey];
    if (!plan || !plan.stripePriceId) {
      return res.status(400).json({ error: 'Billing is not configured' });
    }

    const user = await User.findById(req.auth.id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    // Ensure Stripe customer
    let customerId = user.stripeCustomerId;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        name: user.name,
        metadata: { userId: String(user._id) }
      });
      customerId = customer.id;
      user.stripeCustomerId = customerId;
      await user.save();
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      line_items: [{ price: plan.stripePriceId, quantity: 1 }],
      allow_promotion_codes: true,
      success_url: success_url || config.BILLING_SUCCESS_URL,
      cancel_url: cancel_url || config.BILLING_CANCEL_URL,
      subscription_data: {
        metadata: { userId: String(user._id), plan: plan.plan, interval: plan.interval }
      },
      metadata: { userId: String(user._id), plan: plan.plan, interval: plan.interval }
    });

    res.json({ url: session.url });
  } catch (error) {
    console.error('Checkout error:', error?.message || error);
    res.status(500).json({ error: 'Failed to create checkout session' });
  }
});

router.post('/portal', auth, async (req, res) => {
  try {
    const user = await User.findById(req.auth.id);
    if (!user?.stripeCustomerId) return res.status(400).json({ error: 'No billing profile found' });
    const session = await stripe.billingPortal.sessions.create({
      customer: user.stripeCustomerId,
      return_url: req.body?.return_url || config.BILLING_SUCCESS_URL?.replace('dashboard?purchase=success', 'settings') || 'http://localhost:4321/settings',
    });
    res.json({ url: session.url });
  } catch (error) {
    console.error('Portal error:', error?.message || error);
    res.status(500).json({ error: 'Failed to create customer portal session' });
  }
});

// Cancel subscription at period end
router.post('/cancel', auth, async (req, res) => {
  try {
    const user = await User.findById(req.auth.id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    // Prefer local subscription record for subscription id
    let localSub = await Subscription.findOne({ user: user._id });
    let stripeSubscriptionId = localSub?.stripeSubscriptionId;
    if (!stripeSubscriptionId) {
      if (!user.stripeCustomerId) return res.status(400).json({ error: 'No Stripe customer' });
      const list = await stripe.subscriptions.list({ customer: user.stripeCustomerId, status: 'all', limit: 1 });
      if (!list.data.length) return res.status(400).json({ error: 'No active subscription' });
      stripeSubscriptionId = list.data[0].id;
    }

    const updated = await stripe.subscriptions.update(stripeSubscriptionId, { cancel_at_period_end: true });
    const price = updated.items.data[0]?.price;
    const interval = price?.recurring?.interval || null;

    localSub = await Subscription.findOneAndUpdate(
      { user: user._id },
      {
        plan: 'pro',
        status: 'active',
        stripeCustomerId: updated.customer,
        stripeSubscriptionId: updated.id,
        stripePriceId: price?.id,
        stripeStatus: updated.status,
        interval,
        cancel_at_period_end: true,
        current_period_start: new Date(updated.current_period_start * 1000),
        current_period_end: new Date(updated.current_period_end * 1000),
        end_date: new Date(updated.current_period_end * 1000),
        renewal: false,
      },
      { upsert: true, new: true }
    );

    res.json({ success: true, subscription: localSub });
  } catch (error) {
    console.error('Cancel subscription error:', error?.message || error);
    res.status(500).json({ error: 'Failed to cancel subscription' });
  }
});

// Restore purchases: attempt to align local subscription with Stripe subscription
router.post('/restore', auth, async (req, res) => {
  try {
    const user = await User.findById(req.auth.id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    if (!user.stripeCustomerId) {
      return res.json({ restored: false, reason: 'no_customer' });
    }
    const subscriptions = await stripe.subscriptions.list({ customer: user.stripeCustomerId, status: 'all', limit: 1 });
    if (!subscriptions.data.length) {
      return res.json({ restored: false, reason: 'no_subscriptions' });
    }
    const s = subscriptions.data[0];

    const price = s.items.data[0]?.price;
    const interval = price?.recurring?.interval || null;
    const local = await Subscription.findOneAndUpdate(
      { user: user._id },
      {
        plan: 'pro',
        status: s.status === 'active' || s.status === 'trialing' ? 'active' : 'expired',
        stripeCustomerId: user.stripeCustomerId,
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

    res.json({ restored: true, subscription: local });
  } catch (error) {
    console.error('Restore error:', error?.message || error);
    res.status(500).json({ error: 'Failed to restore purchases' });
  }
});

// Receipts listing from Stripe invoices
router.get('/receipts', auth, async (req, res) => {
  try {
    const user = await User.findById(req.auth.id);
    if (!user?.stripeCustomerId) return res.json({ receipts: [] });
    const invoices = await stripe.invoices.list({ customer: user.stripeCustomerId, limit: 20 });
    const receipts = invoices.data.map((inv) => ({
      stripeInvoiceId: inv.id,
      amount: inv.amount_paid ?? inv.amount_due ?? 0,
      currency: inv.currency,
      status: inv.status,
      hostedInvoiceUrl: inv.hosted_invoice_url,
      invoicePdf: inv.invoice_pdf,
      createdAt: new Date((inv.created || 0) * 1000)
    }));
    res.json({ receipts });
  } catch (error) {
    console.error('Receipts error:', error?.message || error);
    res.status(500).json({ error: 'Failed to fetch receipts' });
  }
});

// Upcoming payment (next invoice)
router.get('/upcoming', auth, async (req, res) => {
  try {
    const user = await User.findById(req.auth.id);
    if (!user?.stripeCustomerId) return res.json({ upcoming: null });

    // Get subscription id
    let localSub = await Subscription.findOne({ user: user._id });
    let stripeSubscriptionId = localSub?.stripeSubscriptionId;
    if (!stripeSubscriptionId) {
      const list = await stripe.subscriptions.list({ customer: user.stripeCustomerId, status: 'all', limit: 1 });
      if (list.data.length) stripeSubscriptionId = list.data[0].id;
    }

    if (!stripeSubscriptionId) return res.json({ upcoming: null });

    let upcoming = null;
    try {
      const inv = await stripe.invoices.retrieveUpcoming({ customer: user.stripeCustomerId, subscription: stripeSubscriptionId });
      upcoming = {
        amount_due: inv.amount_due ?? 0,
        currency: inv.currency || 'aud',
        next_payment_attempt: inv.next_payment_attempt ? new Date(inv.next_payment_attempt * 1000) : null,
        subscription: stripeSubscriptionId,
      };
    } catch (err) {
      // Fallback to local subscription period end
      if (localSub?.current_period_end) {
        upcoming = {
          amount_due: null,
          currency: 'aud',
          next_payment_attempt: localSub.current_period_end,
          subscription: stripeSubscriptionId,
        };
      }
    }

    res.json({ upcoming });
  } catch (error) {
    console.error('Upcoming invoice error:', error?.message || error);
    res.status(500).json({ error: 'Failed to fetch upcoming payment' });
  }
});

export default router;

// One-off checkout for streak restore using a Stripe Price (preferred)
router.post('/streak-restore/checkout', auth, async (req, res) => {
  try {
    const { habitId } = req.body || {};
    const habit = await Habit.findOne({ _id: habitId, owner: req.auth.id });
    if (!habit) return res.status(404).json({ error: 'Habit not found' });

    // Ensure Stripe customer
    const user = await User.findById(req.auth.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    let customerId = user.stripeCustomerId;
    if (!customerId) {
      const customer = await stripe.customers.create({ email: user.email, name: user.name, metadata: { userId: String(user._id) } });
      customerId = customer.id;
      user.stripeCustomerId = customerId; await user.save();
    }

    const priceId = config.STRIPE_PRICE_RESTORE_STREAK;
    if (!priceId) return res.status(400).json({ error: 'Restore price not configured' });

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: req.body?.success_url || 'http://localhost:4321/dashboard?restore=success',
      cancel_url: req.body?.cancel_url || 'http://localhost:4321/dashboard?restore=cancelled',
      metadata: { userId: String(user._id), habitId: String(habit._id), purpose: 'streak_restore' }
    });
    await StreakRestore.create({ user: req.auth.id, habit: habitId, priceId });
    res.json({ url: session.url });
  } catch (error) {
    console.error('streak restore checkout error:', error);
    res.status(500).json({ error: 'failed_to_create_streak_restore_checkout' });
  }
});

// Confirm and apply restore (for PaymentIntent based flow)
router.post('/streak-restore/confirm', auth, async (req, res) => {
  try {
    const { paymentIntentId, habitId } = req.body || {};
    const intent = await stripe.paymentIntents.retrieve(paymentIntentId);
    if (intent.status !== 'succeeded') return res.status(400).json({ error: 'payment_not_succeeded' });
    const habit = await Habit.findOne({ _id: habitId, owner: req.auth.id });
    if (!habit) return res.status(404).json({ error: 'Habit not found' });
    const lastEnded = await Streak.findOne({ owner: req.auth.id, habit: habitId, end_date: { $ne: null } }).sort({ end_date: -1 });
    if (!lastEnded) return res.status(404).json({ error: 'no_streak_to_restore' });
    await Streak.updateOne({ _id: lastEnded._id }, { $set: { end_date: null } });
    await StreakRestore.updateOne({ user: req.auth.id, habit: habitId, paymentIntentId }, { $set: { restoredAt: new Date(), previousEnd: lastEnded.end_date } });
    res.json({ ok: true });
  } catch (error) {
    console.error('streak restore confirm error:', error);
    res.status(500).json({ error: 'failed_to_restore_streak' });
  }
});

