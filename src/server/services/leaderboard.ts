import OrderModel from "../models/Order";
import UserModel, { type UserDocument } from "../models/User";

export const LEADERBOARD_OPT_OUT_COOLDOWN_MS = 14 * 24 * 60 * 60 * 1000;

export type LeaderboardPeriod = "daily" | "weekly" | "monthly";

export const LEADERBOARD_PERIODS: LeaderboardPeriod[] = ["daily", "weekly", "monthly"];

function startOfDayTurkey(date: Date) {
  const shifted = new Date(date.getTime() + 3 * 60 * 60 * 1000);
  shifted.setUTCHours(0, 0, 0, 0);
  return new Date(shifted.getTime() - 3 * 60 * 60 * 1000);
}

export function getLeaderboardPeriodBounds(period: LeaderboardPeriod): { from: Date; to: Date } {
  const now = new Date();

  if (period === "daily") {
    return { from: startOfDayTurkey(now), to: now };
  }

  if (period === "weekly") {
    return { from: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000), to: now };
  }

  return { from: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000), to: now };
}

export function getLeaderboardCooldownRemainingMs(user: Pick<UserDocument, "leaderboardOptedOutAt">) {
  if (!user.leaderboardOptedOutAt) {
    return 0;
  }

  const remaining = user.leaderboardOptedOutAt.getTime() + LEADERBOARD_OPT_OUT_COOLDOWN_MS - Date.now();
  return Math.max(0, remaining);
}

export async function getLeaderboard(period: LeaderboardPeriod, currentUserId?: string) {
  const { from, to } = getLeaderboardPeriodBounds(period);

  const optedInUsers = await UserModel.find({
    role: "customer",
    leaderboardOptedIn: true,
  })
    .select({ _id: 1 })
    .lean();

  const optedInIds = optedInUsers.map((user) => user._id.toString());

  const rows = await OrderModel.aggregate([
    {
      $match: {
        userId: { $in: optedInIds },
        status: "completed",
        loyaltyPointsAwarded: { $gt: 0 },
        timestamp: { $gte: from, $lte: to },
      },
    },
    { $group: { _id: "$userId", kp: { $sum: "$loyaltyPointsAwarded" } } },
    { $sort: { kp: -1, _id: 1 } },
  ]);

  const ranked = rows.map((row, index) => ({
    userId: row._id as string,
    kp: row.kp as number,
    rank: index + 1,
  }));

  const topEntries = ranked.slice(0, 50);

  const userMap = new Map<string, { name: string; avatar: string }>();

  if (topEntries.length > 0) {
    const users = await UserModel.find({ _id: { $in: topEntries.map((entry) => entry.userId) } })
      .select({ name: 1, surname: 1, avatar: 1 })
      .lean();

    users.forEach((user) => {
      userMap.set(user._id.toString(), {
        name: `${user.name} ${user.surname}`.trim(),
        avatar: user.avatar || "",
      });
    });
  }

  const entries = topEntries.map((entry) => ({
    rank: entry.rank,
    userId: entry.userId,
    name: userMap.get(entry.userId)?.name || "Kullanıcı",
    avatar: userMap.get(entry.userId)?.avatar || "",
    kp: entry.kp,
  }));

  let currentUser: { rank: number; kp: number } | null = null;

  if (currentUserId) {
    const found = ranked.find((entry) => entry.userId === currentUserId);

    if (found) {
      currentUser = { rank: found.rank, kp: found.kp };
    }
  }

  return {
    period,
    from: from.toISOString(),
    to: to.toISOString(),
    entries,
    currentUser,
  };
}