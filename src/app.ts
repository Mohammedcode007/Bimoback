
// export default app;


import express from "express";
import cors from "cors";
import path from "path";

/* routes */
import authRoutes from "./routes/auth.routes";
import userRoutes from "./routes/user.routes";
import friendRoutes from "./routes/friend.routes";
import notificationRoutes from "./routes/notification.routes";
import tweetRoutes from "./routes/tweet.routes";
import followRoutes from "./routes/follow.routes";
import chatRoutes from "./routes/chat.routes";
import messageRoutes from "./routes/message.routes";
import roomRoutes from "./routes/room.routes";
import roomControlRoutes from "./routes/room.control.routes";
import storeRoutes from "./routes/store.routes";
import storyRoutes from "./routes/story.routes";
import appConfigRoutes from "./routes/appConfig.routes";
import contactUsRoutes from "./routes/contactUs.routes";
import paymobRoutes from "./routes/paymob.routes";

import { errorHandler } from "./middlewares/error.middleware";
import { enforceMinVersion } from "./middlewares/enforceMinVersion.middleware";
import reportRoutes from "./routes/report.routes";
import blockRoutes from "./routes/block.routes";

const app = express();

/* =========================
   Global Middlewares
========================= */
app.use(
  cors({
    origin: ["https://te-bot.site", "https://api.te-bot.site"],
    credentials: true,
  })
);

app.use(express.json({ limit: "1mb" }));

/* =========================
   Static Pages
========================= */
const publicPath = path.join(__dirname, "../public");

app.use(express.static(publicPath));
app.use(
  "/uploads",
  express.static(path.join(process.cwd(), "public/uploads"))
);
app.get("/", (_, res) => {
  res.sendFile(path.join(publicPath, "index.html"));
});

app.get("/privacy", (_, res) => {
  res.sendFile(path.join(publicPath, "privacy.html"));
});

app.get("/terms", (_, res) => {
  res.sendFile(path.join(publicPath, "terms.html"));
});

/* =========================
   Health Check
========================= */
app.get("/health", (_, res) => {
  res.status(200).json({
    success: true,
    message: "Chat Backend Running 🚀",
  });
});

/* =========================
   App Config
========================= */
app.use("/api", appConfigRoutes);

/* =========================
   Force Update Middleware
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
app.use("/api/tweets", tweetRoutes);
app.use("/api/store", storeRoutes);
app.use("/api/stories", storyRoutes);
app.use("/api/chats", chatRoutes);
app.use("/api/messages", messageRoutes);
app.use("/api/rooms", roomRoutes);
app.use("/api/contact-us", contactUsRoutes);
app.use("/api/blocks", blockRoutes);
app.use("/api/payments/paymob", paymobRoutes);
app.use("/api/reports", reportRoutes);
/* =========================
   404 Handler
========================= */
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found",
  });
});


/* =========================
   Error Handler
========================= */
app.use(errorHandler);

export default app;