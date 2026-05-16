// src/routes/room.control.routes.ts
import { Router } from "express";
import RoomControlController from "../controllers/room.control.controller";
import { protect } from "../middlewares/auth.middleware"; // ✅ إضافة middleware

const r = Router();

// ✅ كل المسارات تحتاج توكن
r.use(protect);

r.get("/:id/control", RoomControlController.getControl);

r.patch("/:id/control/info", RoomControlController.updateInfo);
r.patch("/:id/control/type", RoomControlController.changeType);
r.patch("/:id/control/premium", RoomControlController.changePremiumLevel);

r.patch("/:id/control/lock", RoomControlController.setLock);
r.patch("/:id/control/antispam", RoomControlController.setAntiSpam);
r.patch("/:id/control/slowmode", RoomControlController.setSlowMode);
r.patch("/:id/control/welcome", RoomControlController.updateWelcome);
r.patch("/:id/control/voice-seats", RoomControlController.setMaxVoiceSeats);


r.post("/:id/control/poll/start", RoomControlController.startPoll);
r.post("/:id/control/poll/vote", RoomControlController.votePoll);
r.post("/:id/control/poll/end", RoomControlController.endPoll);

r.patch("/:id/control/max-users/increase", RoomControlController.increaseMaxUsers);

r.delete("/:id/control", RoomControlController.deleteRoom);

export default r;