import mongoose from "mongoose";
import Tweet from "../models/Tweet";
import Like from "../models/Like";
import User from "../models/User";
import notificationService from "./notification.service";

type ScheduleOptions = {
    minDelayMs?: number;
    maxDelayMs?: number;
    maxLikes?: number;
};

const TEST_ENGAGEMENT_CONFIG = {
    enabled: false,
    allowInProduction: false,
    minDelayMs: 30_000,
    maxDelayMs: 60_000,
    maxLikes: 15,
    label: "Test",
};

class TweetTestEngagementService {
    private timers = new Map<string, NodeJS.Timeout[]>();

    private isEnabled() {
        return TEST_ENGAGEMENT_CONFIG.enabled;
    }

    private isProductionBlocked() {
        return process.env.NODE_ENV === "production" && !TEST_ENGAGEMENT_CONFIG.allowInProduction;
    }

    private randomInt(min: number, max: number) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    private shuffle<T>(arr: T[]) {
        const copy = [...arr];
        for (let i = copy.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [copy[i], copy[j]] = [copy[j], copy[i]];
        }
        return copy;
    }

    async scheduleLikesForTweet(
        tweetId: string,
        authorId: string,
        options: ScheduleOptions = {}
    ) {
        if (!this.isEnabled()) return;
        if (this.isProductionBlocked()) return;

        if (!mongoose.Types.ObjectId.isValid(tweetId)) return;
        if (!mongoose.Types.ObjectId.isValid(authorId)) return;

        const minDelayMs = options.minDelayMs ?? TEST_ENGAGEMENT_CONFIG.minDelayMs;
        const maxDelayMs = options.maxDelayMs ?? TEST_ENGAGEMENT_CONFIG.maxDelayMs;
        const maxLikes = Math.min(
            options.maxLikes ?? TEST_ENGAGEMENT_CONFIG.maxLikes,
            15
        );

        const tweet = await Tweet.findById(tweetId).select("_id author deleted isHidden");
        if (!tweet || tweet.deleted || tweet.isHidden) return;

        const desiredLikes = this.randomInt(3, maxLikes);

        // استخدم فقط حسابات اختبار حقيقية وواضحة
        const testUsers = await User.find({
            _id: { $ne: new mongoose.Types.ObjectId(authorId) },
            isBot: true,
            isOfficial: false,
        })
            .select("_id username")
            .limit(100)
            .lean();

        if (!testUsers.length) return;

        const selectedUsers = this.shuffle(testUsers).slice(0, desiredLikes);

        this.cancel(tweetId);

        const tweetTimers: NodeJS.Timeout[] = [];
for (let index = 0; index < selectedUsers.length; index++) {
  const testUser = selectedUsers[index];

  // أول لايك بعد 5 ثواني
  const baseDelay = 5000;

  // باقي اللايكات كل 2 - 5 ثواني بعده
  const extraDelay = index === 0
    ? 0
    : this.randomInt(2000, 5000) * index;

  const delay = baseDelay + extraDelay;

  const timer = setTimeout(async () => {
    try {
      const latestTweet = await Tweet.findById(tweetId).select(
        "_id author deleted isHidden"
      );
      if (!latestTweet || latestTweet.deleted || latestTweet.isHidden) return;

      const alreadyLiked = await Like.findOne({
        user: testUser._id,
        tweet: latestTweet._id,
      }).select("_id");

      if (alreadyLiked) return;

      await Like.create({
        user: testUser._id,
        tweet: latestTweet._id,
      });

      await Tweet.updateOne(
        { _id: latestTweet._id },
        { $inc: { likesCount: 1 } }
      );

      if (String(latestTweet.author) !== String(testUser._id)) {
        await notificationService.create({
          recipient: latestTweet.author,
          sender: testUser._id,
          type: "tweet_like",
          relatedTweet: latestTweet._id,
          body: `${testUser.username} liked your tweet`,
        });
      }
    } catch (error) {
      console.log("❌ test engagement like error:", error);
    }
  }, delay);

  tweetTimers.push(timer);
}

        this.timers.set(tweetId, tweetTimers);
    }

    cancel(tweetId: string) {
        const timers = this.timers.get(tweetId);
        if (!timers?.length) return;

        for (const timer of timers) {
            clearTimeout(timer);
        }

        this.timers.delete(tweetId);
    }

    cancelAll() {
        for (const [, timers] of this.timers.entries()) {
            for (const timer of timers) {
                clearTimeout(timer);
            }
        }
        this.timers.clear();
    }
}

export default new TweetTestEngagementService();