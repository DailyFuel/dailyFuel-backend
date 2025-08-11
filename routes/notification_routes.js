import { Router } from "express";
import auth from "../src/auth.js";
import Notification from "../models/notification.js";
import {
  getUserNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  getNotificationStats,
  createNotification
} from "../services/notification_service.js";

const router = Router();

// Get user notifications
router.get("/", auth, async (req, res) => {
  try {
    const { limit = 20, offset = 0, unreadOnly = false } = req.query;
    
    const notifications = await getUserNotifications(req.auth.id, {
      limit: parseInt(limit),
      offset: parseInt(offset),
      unreadOnly: unreadOnly === 'true'
    });

    res.send(notifications);
  } catch (err) {
    res.status(500).send({ error: err.message });
  }
});

// Get unread notifications count
router.get("/unread-count", auth, async (req, res) => {
  try {
    const stats = await getNotificationStats(req.auth.id);
    res.send({ unreadCount: stats.unreadNotifications });
  } catch (err) {
    res.status(500).send({ error: err.message });
  }
});

// Get notification statistics
router.get("/stats", auth, async (req, res) => {
  try {
    const stats = await getNotificationStats(req.auth.id);
    res.send(stats);
  } catch (err) {
    res.status(500).send({ error: err.message });
  }
});

// Mark notification as read
router.put("/:notificationId/read", auth, async (req, res) => {
  try {
    const { notificationId } = req.params;
    
    const notification = await markNotificationAsRead(req.auth.id, notificationId);
    
    if (!notification) {
      return res.status(404).send({ error: "Notification not found or unauthorized" });
    }

    res.send(notification);
  } catch (err) {
    res.status(500).send({ error: err.message });
  }
});

// Mark all notifications as read
router.put("/read-all", auth, async (req, res) => {
  try {
    const success = await markAllNotificationsAsRead(req.auth.id);
    
    if (success) {
      res.send({ message: "All notifications marked as read" });
    } else {
      res.status(500).send({ error: "Failed to mark notifications as read" });
    }
  } catch (err) {
    res.status(500).send({ error: err.message });
  }
});

// Delete a notification
router.delete("/:notificationId", auth, async (req, res) => {
  try {
    const { notificationId } = req.params;
    
    const notification = await Notification.findOneAndDelete({
      _id: notificationId,
      user: req.auth.id
    });

    if (!notification) {
      return res.status(404).send({ error: "Notification not found or unauthorized" });
    }

    res.send({ message: "Notification deleted successfully" });
  } catch (err) {
    res.status(500).send({ error: err.message });
  }
});

export default router;