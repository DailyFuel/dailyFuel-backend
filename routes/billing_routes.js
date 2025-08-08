import { Router } from 'express';
import Stripe from 'stripe';
import auth from '../src/auth.js';
import User from '../models/user.js';
import Subscription from '../models/subscription.js';
import Receipt from '../models/receipt.js';

const router = Router();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2024-06-20' });

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

router.post('/checkout', auth, async (req, res) => {
  try {
    const { interval = 'month', success_url, cancel_url } = req.body || {};
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
      success_url: success_url || 'http://localhost:4321/dashboard?purchase=success',
      cancel_url: cancel_url || 'http://localhost:4321/pricing?purchase=cancelled',
      subscription_data: {
        metadata: { userId: String(user._id), plan: plan.plan, interval: plan.interval }
      },
      metadata: { userId: String(user._id), plan: plan.plan, interval: plan.interval }
    });

    res.json({ url: session.url });
  } catch (error) {
    console.error('Checkout error:', error);
    res.status(500).json({ error: 'Failed to create checkout session' });
  }
});

router.post('/portal', auth, async (req, res) => {
  try {
    const user = await User.findById(req.auth.id);
    if (!user?.stripeCustomerId) return res.status(400).json({ error: 'No billing profile found' });
    const session = await stripe.billingPortal.sessions.create({
      customer: user.stripeCustomerId,
      return_url: req.body?.return_url || 'http://localhost:4321/settings',
    });
    res.json({ url: session.url });
  } catch (error) {
    console.error('Portal error:', error);
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
    console.error('Cancel subscription error:', error);
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
    console.error('Restore error:', error);
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
    console.error('Receipts error:', error);
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
    console.error('Upcoming invoice error:', error);
    res.status(500).json({ error: 'Failed to fetch upcoming payment' });
  }
});

export default router;

