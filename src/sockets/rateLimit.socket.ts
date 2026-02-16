// import { Socket } from "socket.io";

// const messageTimestamps = new Map<string, number>();

// export const rateLimitSocket = (socket: Socket) => {

//   socket.use((packet, next) => {
//     const now = Date.now();
//     const last = messageTimestamps.get(socket.id) || 0;

//     if (now - last < 300) {
//       return next(new Error("Too many requests"));
//     }

//     messageTimestamps.set(socket.id, now);
//     next();
//   });

// };

import { Socket } from "socket.io";

type RateData = {
  timestamps: number[];
};

const userLimits = new Map<string, RateData>();

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
      userLimits.set(userId, { timestamps: [] });
    }

    const data = userLimits.get(userId)!;

    /* تنظيف timestamps القديمة */
    data.timestamps = data.timestamps.filter(
      ts => now - ts < LIMITS.WINDOW
    );

    /* 🔥 تحديد الحد حسب نوع الحدث */

    let maxAllowed = Infinity;

    if (event === "chat:send") {
      maxAllowed = LIMITS.MESSAGE_PER_5_SEC;
    }

    if (event === "chat:typing") {
      maxAllowed = LIMITS.TYPING_PER_5_SEC;
    }

    /* لا نقيّد join أو sync */
    if (
      event === "chat:join" ||
      event === "notification:sync"
    ) {
      return next();
    }

    if (data.timestamps.length >= maxAllowed) {
      return next(new Error("Rate limit exceeded"));
    }

    data.timestamps.push(now);

    next();
  });

  /* تنظيف عند disconnect */

  socket.on("disconnect", () => {
    userLimits.delete(userId);
  });

};
