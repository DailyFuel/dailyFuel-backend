import { Router } from "express";
import Referral from "../models/referral.js";
import Affiliate from "../models/affiliate.js";
import auth from "../src/auth.js";

const router = Router();

// Record referral
router.post("/", auth, async (req, res) => {
  const { referred_user_id, affiliate_code } = req.body;

  const referredBy = await Affiliate.findOne({ code: affiliate_code });
  if (!referredBy) return res.status(404).send({ error: "Affiliate code not found" });

  const referral = await Referral.create({
    referred_user: referred_user_id,
    referred_by: referredBy.user,
    affiliate_code
  });

  await Affiliate.findByIdAndUpdate(referredBy._id, {
    $inc: { total_referrals: 1 }
  });

  res.status(201).send(referral);
});

// Mark as converted (e.g., on subscription)
router.post("/convert/:userId", auth, async (req, res) => {
  const referral = await Referral.findOneAndUpdate(
    { referred_user: req.params.userId },
    { conversion: true },
    { new: true }
  );

  if (referral) {
    await Affiliate.findOneAndUpdate(
      { user: referral.referred_by },
      { $inc: { earnings: 20 } } // assume $20 commission
    );
  }

  res.send(referral);
});

export default router;