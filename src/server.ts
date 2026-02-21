
import http from "http";
import dotenv from "dotenv";
import app from "./app";
import { connectDB } from "./config/db";
import { initSocket } from "./config/socket";

dotenv.config();

/* =========================
   Handle Uncaught Errors
========================= */

process.on("uncaughtException", (err) => {
  console.error("❌ Uncaught Exception:", err);
  process.exit(1);
});

/* =========================
   Connect Database
========================= */

connectDB();

/* =========================
   Create HTTP Server
========================= */

const server = http.createServer(app);

/* =========================
   Initialize Socket.IO
========================= */

initSocket(server);

/* =========================
   Start Server
========================= */

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});

/* =========================
   Handle Unhandled Promise Rejections
========================= */

process.on("unhandledRejection", (err: any) => {
  console.error("❌ Unhandled Rejection:", err);

  server.close(() => {
    process.exit(1);
  });
});
