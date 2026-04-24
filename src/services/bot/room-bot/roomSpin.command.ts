// src/services/bot/room-bot/roomSpin.command.ts

import mongoose, { Schema } from "mongoose";
import User from "../../../models/User";

export type RoomSpinCommandResult = {
  handled: boolean;
  success?: boolean;
  amount?: number;
  text?: string;
  meta?: Record<string, any>;
};

type SpinConfig = {
  minWin: number;
  maxWin: number;
  cooldownMs: number;
};

const SPIN_CONFIG: SpinConfig = {
  minWin: Number(process.env.SPIN_MIN_WIN || 10),
  maxWin: Number(process.env.SPIN_MAX_WIN || 100),

  // ✅ 15 minutes
  cooldownMs: Number(process.env.SPIN_COOLDOWN_MS || 15 * 60 * 1000),
};

// ✅ Your real Coinz field
const USER_COINZ_FIELD = "CoinzBalance";

const SpinCooldownSchema = new Schema(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true,
    },
    lastSpinAt: {
      type: Date,
      required: true,
    },
    nextSpinAt: {
      type: Date,
      required: true,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

const SpinCooldown =
  mongoose.models.SpinCooldown ||
  mongoose.model("SpinCooldown", SpinCooldownSchema);

function normalizeText(value?: string) {
  return String(value || "").trim();
}

function randomInt(min: number, max: number) {
  const safeMin = Math.ceil(min);
  const safeMax = Math.floor(max);

  return Math.floor(Math.random() * (safeMax - safeMin + 1)) + safeMin;
}

function getSafeSpinConfig() {
  let minWin = Number(SPIN_CONFIG.minWin);
  let maxWin = Number(SPIN_CONFIG.maxWin);
  let cooldownMs = Number(SPIN_CONFIG.cooldownMs);

  if (!Number.isFinite(minWin) || minWin < 1) minWin = 1;
  if (!Number.isFinite(maxWin) || maxWin < minWin) maxWin = minWin;

  if (!Number.isFinite(cooldownMs) || cooldownMs < 1000) {
    cooldownMs = 15 * 60 * 1000;
  }

  return {
    minWin: Math.floor(minWin),
    maxWin: Math.floor(maxWin),
    cooldownMs: Math.floor(cooldownMs),
  };
}

function formatRemainingTime(ms: number) {
  const totalSeconds = Math.ceil(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  if (minutes <= 0) {
    return `${seconds}s`;
  }

  if (seconds <= 0) {
    return `${minutes}m`;
  }

  return `${minutes}m ${seconds}s`;
}

export function parseSpinCommand(raw?: string) {
  const text = normalizeText(raw).toLowerCase();
  return text === ".s";
}

export async function executeRoomSpinCommand(input: {
  raw?: string;
  userId: string;
  username?: string;
}): Promise<RoomSpinCommandResult> {
  const { raw, userId, username = "User" } = input;

  if (!parseSpinCommand(raw)) {
    return { handled: false };
  }

  if (!mongoose.Types.ObjectId.isValid(userId)) {
    return {
      handled: true,
      success: false,
      text: "Spin failed. Invalid user.",
      meta: {
        action: "spin_invalid_user",
        userId,
      },
    };
  }

  const { minWin, maxWin, cooldownMs } = getSafeSpinConfig();

  const now = new Date();
  const nowMs = now.getTime();

  try {
    /**
     * ✅ Check cooldown first
     */
    const cooldown = await SpinCooldown.findOne({
      user: userId,
    }).lean();

    if (cooldown?.nextSpinAt) {
      const nextSpinMs = new Date(cooldown.nextSpinAt).getTime();

      if (Number.isFinite(nextSpinMs) && nextSpinMs > nowMs) {
        const remainingMs = nextSpinMs - nowMs;
        const remainingText = formatRemainingTime(remainingMs);

        return {
          handled: true,
          success: false,
          text: `⏳ ${username}, you can spin again in ${remainingText}.`,
          meta: {
            action: "spin_cooldown",
            userId,
            username,
            remainingMs,
            remainingText,
            nextSpinAt: cooldown.nextSpinAt,
            cooldownMs,
          },
        };
      }
    }

    const winAmount = randomInt(minWin, maxWin);
    const nextSpinAt = new Date(nowMs + cooldownMs);

    /**
     * ✅ Add Coinz
     */
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      {
        $inc: {
          [USER_COINZ_FIELD]: winAmount,
        },
      },
      {
        new: true,
        runValidators: false,
        select: `username ${USER_COINZ_FIELD}`,
      }
    ).lean();

    if (!updatedUser) {
      return {
        handled: true,
        success: false,
        text: "Spin failed. User was not found.",
        meta: {
          action: "spin_user_not_found",
          userId,
        },
      };
    }

    /**
     * ✅ Save cooldown only after successful reward
     */
    await SpinCooldown.updateOne(
      {
        user: userId,
      },
      {
        $set: {
          user: userId,
          lastSpinAt: now,
          nextSpinAt,
        },
      },
      {
        upsert: true,
      }
    );

    const totalCoinz = Number((updatedUser as any)?.[USER_COINZ_FIELD] || 0);

    console.log("🎰 Spin updated user:", {
      userId,
      username,
      field: USER_COINZ_FIELD,
      winAmount,
      totalCoinz,
      nextSpinAt,
    });

    return {
      handled: true,
      success: true,
      amount: winAmount,
      text: `🎰 ${username} spun the wheel and won ${winAmount} Coinz 🪙\n💰 Current balance: ${totalCoinz}\n⏳ Next spin available in 15 minutes.`,
      meta: {
        action: "spin_win",
        userId,
        username,
        amount: winAmount,
        totalCoinz,
        minWin,
        maxWin,
        cooldownMs,
        lastSpinAt: now,
        nextSpinAt,
        coinzField: USER_COINZ_FIELD,
      },
    };
  } catch (error: any) {
    return {
      handled: true,
      success: false,
      text: "Spin failed. Please try again later.",
      meta: {
        action: "spin_failed",
        userId,
        username,
        coinzField: USER_COINZ_FIELD,
        error: error?.message || "unknown_error",
      },
    };
  }
}