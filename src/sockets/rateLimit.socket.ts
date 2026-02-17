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
    const now = Date.now();

    if (!userLimits.has(userId)) {
      userLimits.set(userId, {});
    }

    const userData = userLimits.get(userId)!;

    if (!userData[event]) {
      userData[event] = [];
    }

    /* تنظيف timestamps القديمة لهذا الحدث فقط */
    userData[event] = userData[event].filter(
      ts => now - ts < LIMITS.WINDOW
    );

    let maxAllowed = Infinity;

    if (event === "chat:send") {
      maxAllowed = LIMITS.MESSAGE_PER_5_SEC;
    }

    if (event === "chat:typing") {
      maxAllowed = LIMITS.TYPING_PER_5_SEC;
    }

    if (
      event === "chat:join" ||
      event === "notification:sync" ||
      event === "chat:seen"
    ) {
      return next();
    }

    if (userData[event].length >= maxAllowed) {

      console.log("🚫 RATE LIMIT BLOCKED");
      console.log("User:", userId);
      console.log("Event:", event);
      console.log("Count:", userData[event].length);

      return next(new Error("Rate limit exceeded"));
    }

    userData[event].push(now);

    next();
  });

  socket.on("disconnect", () => {
    userLimits.delete(userId);
  });
};
