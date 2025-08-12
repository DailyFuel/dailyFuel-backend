import Event from "../models/event.js";
import User from "../models/user.js";
import dayjs from "dayjs";
import Subscription from "../models/subscription.js";

export async function trackEvent(userId, name, properties = {}, context = {}) {
  try {
    const event = await Event.create({
      user: userId || undefined,
      name,
      properties,
      context,
      timestamp: new Date(),
    });
    return event;
  } catch (error) {
    console.error("trackEvent error:", name, error?.message || error);
    return null;
  }
}

// Compute D7/D30 retention for users created exactly N days ago
export async function getRetentionSummary() {
  const today = dayjs().startOf("day");

  async function computeDayNRetention(n) {
    const cohortStart = today.subtract(n, "day");
    const cohortEnd = cohortStart.endOf("day");

    const cohortUsers = await User.find({
      createdAt: { $gte: cohortStart.toDate(), $lte: cohortEnd.toDate() },
    }).select("_id createdAt");

    const userIds = cohortUsers.map((u) => u._id);
    if (userIds.length === 0) {
      return { cohortSize: 0, retained: 0, rate: 0 };
    }

    const activeWindowStart = cohortStart.add(n, "day");
    const activeWindowEnd = activeWindowStart.endOf("day");

    const retainedUsers = await Event.distinct("user", {
      user: { $in: userIds },
      name: { $in: ["app_open", "daily_active", "dashboard_view", "check_in"] },
      timestamp: {
        $gte: activeWindowStart.toDate(),
        $lte: activeWindowEnd.toDate(),
      },
    });

    const retained = retainedUsers.length;
    const cohortSize = userIds.length;
    const rate = cohortSize > 0 ? retained / cohortSize : 0;
    return { cohortSize, retained, rate };
  }

  const d7 = await computeDayNRetention(7);
  const d30 = await computeDayNRetention(30);

  return { d7, d30 };
}

export async function getRecentEvents({ userId, limit = 100, includeUser = false } = {}) {
  const query = {};
  if (userId) {
    query.user = userId;
  }
  const cursor = Event.find(query)
    .sort({ timestamp: -1 })
    .limit(Math.max(1, Math.min(limit, 500)));
  if (includeUser) {
    cursor.populate('user', 'email name');
  }
  return cursor.exec();
}

export async function getEventSummary({ userId, from, to } = {}) {
  const match = {};
  if (userId) {
    match.user = typeof userId === 'string' ? new (await import('mongoose')).default.Types.ObjectId(userId) : userId;
  }
  if (from || to) {
    match.timestamp = {};
    if (from) match.timestamp.$gte = dayjs(from).startOf('day').toDate();
    if (to) match.timestamp.$lte = dayjs(to).endOf('day').toDate();
  }

  const pipeline = [
    Object.keys(match).length ? { $match: match } : null,
    { $group: { _id: '$name', count: { $sum: 1 }, last: { $max: '$timestamp' } } },
    { $project: { _id: 0, name: '$_id', count: 1, last: 1 } },
    { $sort: { count: -1 } },
  ].filter(Boolean);

  const results = await Event.aggregate(pipeline).exec();
  return results;
}

export async function getUserStats() {
  const totalUsers = await User.countDocuments({});
  const paidSubs = await Subscription.countDocuments({ plan: 'pro', status: 'active' });
  const paidUsers = paidSubs; // 1:1 by unique user in schema
  const freeUsers = Math.max(0, totalUsers - paidUsers);
  return { totalUsers, paidUsers, freeUsers };
}
