// app.ts

import express from "express";
import cors from "cors";
import dotenv from "dotenv";

import authRoutes from "./routes/auth.routes";
import userRoutes from "./routes/user.routes";
import friendRoutes from "./routes/friend.routes";

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

app.get("/", (_, res) => {
  res.send("Chat Backend Running 🚀");
});

/* =========================
   Error Handler (آخر شيء)
========================= */

app.use(errorHandler);

export default app;
