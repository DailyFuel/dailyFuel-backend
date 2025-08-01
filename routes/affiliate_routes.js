import { Router } from "express";
import Affiliate from "../models/affiliate.js";
import { auth } from "../src/auth.js";
import { nanoid } from "nanoid";

const router = Router();

router.get("/", auth, async (req, res) => {
  const affiliate = await Affiliate.findOne({ user: req.auth.id });
  res.send(affiliate);
});

router.post("/register", auth, async (req, res) => {
  const existing = await Affiliate.findOne({ user: req.auth.id });
  if (existing) return res.status(400).send({ error: "Already an affiliate." });

  const code = `AFF-${nanoid(6)}`;
  const affiliate = await Affiliate.create({
    user: req.auth.id,
    code
  });

  res.send(affiliate);
});

export default router;
