import { Router } from "express";
import { auth } from "../src/auth.js";
import { 
  getUserAchievements, 
  getAchievementStats 
} from "../services/achievement_service.js";

const router = Router();

// Get all achievements for the authenticated user
router.get("/", auth, async (req, res) => {
  try {
    const achievements = await getUserAchievements(req.auth.id);
    res.send(achievements);
  } catch (err) {
    res.status(500).send({ error: err.message });
  }
});

// Get achievement statistics for the user
router.get("/stats", auth, async (req, res) => {
  try {
    const stats = await getAchievementStats(req.auth.id);
    res.send(stats);
  } catch (err) {
    res.status(500).send({ error: err.message });
  }
});

// Get recent achievements (last 5)
router.get("/recent", auth, async (req, res) => {
  try {
    const achievements = await getUserAchievements(req.auth.id);
    const recentAchievements = achievements.slice(0, 5);
    res.send(recentAchievements);
  } catch (err) {
    res.status(500).send({ error: err.message });
  }
});

// Get achievements by type
router.get("/type/:type", auth, async (req, res) => {
  try {
    const { type } = req.params;
    const achievements = await getUserAchievements(req.auth.id);
    const filteredAchievements = achievements.filter(achievement => 
      achievement.type === type
    );
    res.send(filteredAchievements);
  } catch (err) {
    res.status(500).send({ error: err.message });
  }
});

export default router; 