import { Socket } from "socket.io";

type EventRateData = {
  [event: string]: number[];
};

const userLimits = new Map<string, EventRateData>();

/* ================= CONFIG ================= */

const LIMITS = {
  MESSAGE_PER_5_SEC: 10,
  TYPING_PER_5_SEC: 20,
  WINDOW: 5000
};

export const rateLimitSocket = (socket: Socket) => {

  const userId = socket.data.userId;
  if (!userId) return;

  socket.use((packet, next) => {

    const event = packet[0];
    const payload = packet[1];
    const now = Date.now();

    if (!userLimits.has(userId)) {
      userLimits.set(userId, {});
    }

    const userData = userLimits.get(userId)!;

    if (!userData[event]) {
      userData[event] = [];
    }

    /* تنظيف timestamps القديمة */
    userData[event] = userData[event].filter(
      ts => now - ts < LIMITS.WINDOW
    );

    let maxAllowed = Infinity;

    /* ================= MESSAGE LIMIT ================= */

    if (event === "chat:send") {
      maxAllowed = LIMITS.MESSAGE_PER_5_SEC;
    }

    /* ================= TYPING LIMIT ================= */

    if (event === "chat:typing") {

      // لا نمنع typing:false
      if (payload?.typing === false) {
        return next();
      }

      maxAllowed = LIMITS.TYPING_PER_5_SEC;
    }

    /* ================= SAFE EVENTS ================= */

    if (
      event === "chat:join" ||
      event === "chat:seen" ||
      event === "notification:sync"
    ) {
      return next();
    }

    /* ================= CHECK LIMIT ================= */

    if (userData[event].length >= maxAllowed) {

      console.log("🚫 RATE LIMIT BLOCKED");
      console.log("User:", userId);
      console.log("Event:", event);
      console.log("Count:", userData[event].length);

      // لا نرمي Error حتى لا ينقطع الاتصال
      return next();
    }

    userData[event].push(now);

    next();
  });

  socket.on("disconnect", () => {
    userLimits.delete(userId);
  });
};
