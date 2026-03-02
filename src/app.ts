// app.ts

import express from "express";
import cors from "cors";
import dotenv from "dotenv";

/* =========================
   Routes Imports
========================= */

import authRoutes from "./routes/auth.routes";
import userRoutes from "./routes/user.routes";
import friendRoutes from "./routes/friend.routes";
import notificationRoutes from "./routes/notification.routes";
import tweetRoutes from "./routes/tweet.routes";
import followRoutes from "./routes/follow.routes";
import chatRoutes from "./routes/chat.routes";
import messageRoutes from "./routes/message.routes";
import roomRoutes from "./routes/room.routes"; // ✅ Rooms
import roomControlRoutes from "./routes/room.control.routes"; // ✅ Rooms
import storeRoutes from "./routes/store.routes";
import { errorHandler } from "./middlewares/error.middleware";
import storyRoutes from "./routes/story.routes"; // ✅ NEW
/* ✅ NEW: App Config + Force Update */
/* ✅ NEW: App Config + Force Update */
import appConfigRoutes from "./routes/appConfig.routes";
import { enforceMinVersion } from "./middlewares/enforceMinVersion.middleware";
import contactUsRoutes from "./routes/contactUs.routes";
// dotenv.config();

const app = express();

/* =========================
   Global Middlewares
========================= */

app.use(
  cors({
    origin: [
      "https://te-bot.site",
      "https://api.te-bot.site"
    ],
    credentials: true,
  })
);
app.use(express.json());

/* =========================
   Health Check
========================= */

app.get("/", (_, res) => {
   res.status(200).json({
      success: true,
      message: "Chat Backend Running 🚀"
   });
});

app.get("/health", (_, res) => res.json({ ok: true }));

/* =========================
   App Config (must be BEFORE enforceMinVersion)
========================= */
app.use("/api", appConfigRoutes);

/* =========================
   Force Update Middleware (applies to all APIs after this)
========================= */
app.use(enforceMinVersion);
/* =========================
   API Routes
========================= */

app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/friends", friendRoutes);
app.use("/api/follow", followRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/room/control", roomControlRoutes);
/* 🔥 Tweets */
app.use("/api/tweets", tweetRoutes);
app.use("/api/store", storeRoutes);
app.use("/api/stories", storyRoutes); // ✅ تم إضافة نظام الحالات

/* 🔥 Chat & Messages */
app.use("/api/chats", chatRoutes);
app.use("/api/messages", messageRoutes);
app.use("/api/rooms", roomRoutes);
/* 🔥 Rooms System */
app.use("/api/rooms", roomRoutes); // ✅ تمت الإضافة
app.use("/api/contact-us", contactUsRoutes);

/* =========================
   404 Handler
========================= */

app.use((req, res) => {
   res.status(404).json({
      success: false,
      message: "Route not found"
   });
});

/* =========================
   Error Handler (آخر شيء)
========================= */

app.use(errorHandler);

export default app;