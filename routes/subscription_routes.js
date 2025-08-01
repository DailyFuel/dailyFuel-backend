import { Router } from "express";
import Subscription from "../models/subscription.js";
import { auth } from "../src/auth.js";

const router = Router();

router.get("/", auth, async (req, res) => {
  const sub = await Subscription.findOne({ user: req.auth.id });
  res.send(sub);
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
});

router.post("/cancel", auth, async (req, res) => {
  const sub = await Subscription.findOneAndUpdate(
    { user: req.auth.id },
    { status: "cancelled", renewal: false },
    { new: true }
  );

  res.send(sub);
});

export default router;
