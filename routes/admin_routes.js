import { Router } from 'express';
import { adminOnly, auth } from '../src/auth.js';
import DeepInsight from '../models/deep_insight.js';
import CoachPlan from '../models/coach_plan.js';

const router = Router();

// List recent cached AI responses for admin view
router.get('/ai-cache', auth, adminOnly, async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
    const insights = await DeepInsight.find({}).sort({ generatedAt: -1 }).limit(limit).select('user generatedAt windowStart windowEnd summary');
    const plans = await CoachPlan.find({}).sort({ generatedAt: -1 }).limit(limit).select('user generatedAt habits plan');
    res.send({ ok: true, insights, plans });
  } catch (err) {
    console.error('admin ai-cache error', err);
    res.status(500).send({ error: 'failed_to_load_ai_cache' });
  }
});

export default router;

