// app.ts

import express from "express";
import cors from "cors";
import dotenv from "dotenv";

import authRoutes from "./routes/auth.routes";
import userRoutes from "./routes/user.routes";
import friendRoutes from "./routes/friend.routes";
import notificationRoutes from "./routes/notification.routes";
import tweetRoutes from "./routes/tweet.routes"; // ✅ تمت الإضافة
import followRoutes from "./routes/follow.routes";
import chatRoutes from "./routes/chat.routes";
import messageRoutes from "./routes/message.routes";

import { errorHandler } from "./middlewares/error.middleware";

dotenv.config();

const app = express();

/* =========================
   Global Middlewares
========================= */

app.use(cors());
app.use(express.json());

/* =========================
   Routes
========================= */

app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/friends", friendRoutes);
app.use("/api/tweets", tweetRoutes); // ✅ روت التويت
/* 🔥 Chat & Messages */
app.use("/api/chats", chatRoutes);
app.use("/api/messages", messageRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/follow", followRoutes);

app.get("/", (_, res) => {
  res.send("Chat Backend Running 🚀");
});

/* =========================
   Error Handler (آخر شيء)
========================= */

app.use(errorHandler);

export default app;
